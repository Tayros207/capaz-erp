// Intérprete de Finanzas: conecta las reglas de dictado con la captura. Lee la base para resolver nombres y
// devuelve propuestas; nunca ejecuta una herramienta (R19). El texto dictado solo vive en los borradores (R26).
// A2: si el modelo extrajo campos (`e.extraccion`), se fusionan con las reglas (fusion-con-modelo.ts); los ids los resuelve SIEMPRE
// este intérprete con sus reglas, nunca el modelo.
import { formatearSoles, type SugerenciaDeCaptura } from '@capaz/shared';
import type { DictadoInterpretado, EntradaDeInterprete, InterpreteDeCaptura, PropuestaInterpretada } from '../../../core/captura/tipos.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { textoDeAviso } from './avisos-del-modelo.js';
import { esquemaDelModelo, INSTRUCCIONES_DEL_MODELO, leerExtraccionDelModelo, type MedioDictado } from './esquema-del-modelo.js';
import { fusionarConModelo, type Fusion } from './fusion-con-modelo.js';
import { interpretarDictado, type Dictado } from './interpretar-dictado.js';
import { propuestaDePedido } from './propuesta-de-pedido.js';
import { deudasAbiertasDe, resolverCategoria, resolverContacto, resolverCuenta, type ContactoResuelto } from './resolver.js';

type Ctx = ContextoDeHerramienta;
type Origen = 'voz' | 'teclado';
type Parcial = { propuestas: PropuestaInterpretada[]; faltan: string[] };
/** Medio de pago y cuenta: solo los aportan el modelo (y la cuenta, resuelta a id aquí). Las herramientas de dinero los admiten. */
type Pago = { medioDePago: MedioDictado | null; cuentaId: string | null };

const SIN_PROPUESTA: Parcial = { propuestas: [], faltan: [] };
const SIN_PAGO: Pago = { medioDePago: null, cuentaId: null };
const CLASE = { por_cobrar: 'Por cobrar', por_pagar: 'Por pagar' } as const;

const sinNulos = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const soles = (c: number | null): string => formatearSoles(c ?? 0);
const partes = (...p: Array<string | null | undefined>): string => p.filter(Boolean).join(' · ');

/** Lo que falta decir de la persona cuando la deuda se propone sin cliente. */
const faltaElCliente = (d: Dictado): string => (d.contactoNombre ? `cliente nuevo: «${d.contactoNombre}»` : 'a quién');

async function proponerMovimiento(tx: Transaccion, ctx: Ctx, d: Dictado, c: ContactoResuelto | null, sug: SugerenciaDeCaptura | null, origen: Origen, pago: Pago): Promise<Parcial> {
  const tipo = d.tipo ?? 'ingreso';
  const categoriaId = await resolverCategoria(tx, ctx, tipo, d.categoriaDeCapaz, c?.id ?? null);
  // Con varias opciones el nombre es dudoso: la sugerencia lo lleva, la descripcion no. Sin opciones es un cliente nuevo y el nombre se conserva.
  const nombreDudoso = !c && (sug?.opciones.length ?? 0) > 0;
  const descripcion = c || nombreDudoso ? d.descripcion : partes(d.descripcion, d.contactoNombre);
  const args = sinNulos({
    tipo,
    montoCentimos: d.montoCentimos,
    fecha: d.fecha,
    cuentaId: pago.cuentaId,
    categoriaId,
    contactoId: c?.id ?? null,
    medioDePago: pago.medioDePago,
    descripcion: descripcion || null,
    origen,
  });
  const resumen = partes(`${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de ${soles(d.montoCentimos)}`, c?.nombre ?? d.contactoNombre, d.descripcion, pago.medioDePago);
  return { propuestas: [{ herramienta: 'movimiento_registrar', args, resumen, ...(sug ? { sugerencias: [sug] } : {}) }], faltan: [] };
}

async function proponerAbono(tx: Transaccion, ctx: Ctx, d: Dictado, c: ContactoResuelto | null, sug: SugerenciaDeCaptura | null, origen: Origen, hoy: string, pago: Pago): Promise<Parcial> {
  const tipoDeDeuda = d.tipoDeDeuda ?? 'por_cobrar';
  const deudas = c ? await deudasAbiertasDe(tx, ctx, c.id, tipoDeDeuda, hoy) : [];
  const primera = deudas[0];
  if (!c || !primera) {
    const r = await proponerMovimiento(tx, ctx, d, c, sug, origen, pago);
    const quien = c?.nombre ?? d.contactoNombre ?? 'Sin cliente indicado';
    return { ...r, faltan: [`${quien} no tiene deudas abiertas: se propone como ${d.tipo === 'egreso' ? 'egreso' : 'ingreso'} simple`] };
  }
  const sugerencias: SugerenciaDeCaptura[] = [];
  if (deudas.length > 1) {
    sugerencias.push({
      campo: 'id',
      texto: `${deudas.length} deudas abiertas`,
      opciones: deudas.map((x) => ({ id: x.id, nombre: x.codigo, detalle: `Saldo ${soles(x.totalCentimos - x.abonadoCentimos)}` })),
    });
  }
  const saldo = primera.totalCentimos - primera.abonadoCentimos;
  const faltan = (d.montoCentimos ?? 0) > saldo ? [`El abono (${soles(d.montoCentimos)}) supera el saldo de ${primera.codigo} (${soles(saldo)})`] : [];
  const args = sinNulos({ id: primera.id, montoCentimos: d.montoCentimos, fecha: d.fecha, cuentaId: pago.cuentaId, medioDePago: pago.medioDePago, origen });
  const resumen = `Abono de ${soles(d.montoCentimos)} a ${primera.codigo} de ${c.nombre}`;
  return { propuestas: [{ herramienta: 'deuda_abonar', args, resumen, ...(sugerencias.length ? { sugerencias } : {}) }], faltan };
}

function proponerDeuda(d: Dictado, c: ContactoResuelto | null, sug: SugerenciaDeCaptura | null, origen: Origen, pago: Pago): Parcial {
  const tipo = d.tipoDeDeuda ?? 'por_cobrar';
  const conAdelanto = d.intencion === 'deuda_con_adelanto';
  const base = { tipo, contactoId: c?.id ?? null, totalCentimos: d.montoCentimos };
  // `deuda_crear` no mueve dinero: no lleva cuenta ni medio de pago.
  const args = conAdelanto
    ? sinNulos({ ...base, concepto: d.descripcion ?? 'Trabajo dictado', adelantoCentimos: d.adelantoCentimos, cuentaId: pago.cuentaId, medioDePago: pago.medioDePago, origen })
    : sinNulos({ ...base, concepto: d.descripcion ?? 'Deuda dictada' });
  const a = c?.nombre ?? d.contactoNombre;
  const resumen = `${CLASE[tipo]} ${soles(d.montoCentimos)}${a ? ` a ${a}` : ''}${conAdelanto ? `, con adelanto de ${soles(d.adelantoCentimos)}` : ''}`;
  const propuesta: PropuestaInterpretada = { herramienta: conAdelanto ? 'deuda_crear_con_adelanto' : 'deuda_crear', args, resumen, ...(sug ? { sugerencias: [sug] } : {}) };
  return { propuestas: [propuesta], faltan: c ? [] : [faltaElCliente(d)] };
}

/** Reglas siempre; con extracción del modelo, además la fusión. */
function leerDictado(e: EntradaDeInterprete, hoy: string): Fusion {
  const reglas = interpretarDictado(e.texto, { modo: e.modo, hoy });
  const delModelo = leerExtraccionDelModelo(e.extraccion);
  return delModelo ? fusionarConModelo(reglas, delModelo, { texto: e.texto, hoy, modo: e.modo }) : { dictado: reglas, medioDePago: null, cuentaNombre: null, avisos: [] };
}

async function interpretar(tx: Transaccion, ctx: Ctx, e: EntradaDeInterprete): Promise<DictadoInterpretado> {
  const hoy = (await hoyDeLaEmpresa(tx)).dia;
  const f = leerDictado(e, hoy);
  const d = f.dictado;
  // Los movimientos no tienen origen «texto».
  const origen: Origen = e.origen === 'voz' ? 'voz' : 'teclado';
  const { contacto, sugerencia } = await resolverContacto(tx, ctx, d.contactoNombre);
  const cuenta = await resolverCuenta(tx, ctx, f.cuentaNombre);
  const pago: Pago = f.medioDePago || cuenta.id ? { medioDePago: f.medioDePago, cuentaId: cuenta.id } : SIN_PAGO;

  let r: Parcial = SIN_PROPUESTA;
  if (d.intencion === 'movimiento') r = await proponerMovimiento(tx, ctx, d, contacto, sugerencia, origen, pago);
  else if (d.intencion === 'abono') r = await proponerAbono(tx, ctx, d, contacto, sugerencia, origen, hoy, pago);
  else if (d.intencion === 'deuda' || d.intencion === 'deuda_con_adelanto') r = proponerDeuda(d, contacto, sugerencia, origen, pago);
  else if (d.intencion === 'pedido' && d.pedido) r = propuestaDePedido(d.pedido, { contacto, sugerencia });
  const avisos = r.propuestas.length > 0 ? [...f.avisos.map(textoDeAviso), ...cuenta.faltan] : [];
  return { propuestas: r.propuestas, faltan: [...r.faltan, ...d.faltan, ...avisos], pista: d.pista };
}

export const interpreteDeRegistro: InterpreteDeCaptura = {
  modulo: 'registro',
  tambienPropone: ['ordenes'],
  interpretar,
  esquemaParaModelo: esquemaDelModelo,
  instrucciones: INSTRUCCIONES_DEL_MODELO,
};
