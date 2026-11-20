// Intérprete de Finanzas: conecta las reglas de dictado con la captura. Lee la base para resolver nombres y
// devuelve propuestas; nunca ejecuta una herramienta (R19). El texto dictado solo vive en los borradores (R26).
import { formatearSoles, type SugerenciaDeCaptura } from '@capaz/shared';
import type { DictadoInterpretado, EntradaDeInterprete, InterpreteDeCaptura, PropuestaInterpretada } from '../../../core/captura/tipos.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { interpretarDictado, type Dictado } from './interpretar-dictado.js';
import { propuestaDePedido } from './propuesta-de-pedido.js';
import { deudasAbiertasDe, resolverCategoria, resolverContacto, type ContactoResuelto } from './resolver.js';

type Ctx = ContextoDeHerramienta;
type Origen = 'voz' | 'teclado';
type Parcial = { propuestas: PropuestaInterpretada[]; faltan: string[] };

const SIN_PROPUESTA: Parcial = { propuestas: [], faltan: [] };
const CLASE = { por_cobrar: 'Por cobrar', por_pagar: 'Por pagar' } as const;

const sinNulos = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const soles = (c: number | null): string => formatearSoles(c ?? 0);
const partes = (...p: Array<string | null | undefined>): string => p.filter(Boolean).join(' · ');

/** Lo que falta decir de la persona cuando la deuda se propone sin cliente. */
const faltaElCliente = (d: Dictado): string => (d.contactoNombre ? `cliente nuevo: «${d.contactoNombre}»` : 'a quién');

async function proponerMovimiento(tx: Transaccion, ctx: Ctx, d: Dictado, c: ContactoResuelto | null, sug: SugerenciaDeCaptura | null, origen: Origen): Promise<Parcial> {
  const tipo = d.tipo ?? 'ingreso';
  const categoriaId = await resolverCategoria(tx, ctx, tipo, d.categoriaDeCapaz, c?.id ?? null);
  // Con varias opciones el nombre es dudoso: la sugerencia lo lleva, la descripcion no. Sin opciones es un cliente nuevo y el nombre se conserva.
  const nombreDudoso = !c && (sug?.opciones.length ?? 0) > 0;
  const descripcion = c || nombreDudoso ? d.descripcion : partes(d.descripcion, d.contactoNombre);
  const args = sinNulos({
    tipo,
    montoCentimos: d.montoCentimos,
    fecha: d.fecha,
    categoriaId,
    contactoId: c?.id ?? null,
    descripcion: descripcion || null,
    origen,
  });
  const resumen = partes(`${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de ${soles(d.montoCentimos)}`, c?.nombre ?? d.contactoNombre, d.descripcion);
  return { propuestas: [{ herramienta: 'movimiento_registrar', args, resumen, ...(sug ? { sugerencias: [sug] } : {}) }], faltan: [] };
}

async function proponerAbono(tx: Transaccion, ctx: Ctx, d: Dictado, c: ContactoResuelto | null, sug: SugerenciaDeCaptura | null, origen: Origen, hoy: string): Promise<Parcial> {
  const tipoDeDeuda = d.tipoDeDeuda ?? 'por_cobrar';
  const deudas = c ? await deudasAbiertasDe(tx, ctx, c.id, tipoDeDeuda, hoy) : [];
  const primera = deudas[0];
  if (!c || !primera) {
    const r = await proponerMovimiento(tx, ctx, d, c, sug, origen);
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
  const args = sinNulos({ id: primera.id, montoCentimos: d.montoCentimos, fecha: d.fecha, origen });
  const resumen = `Abono de ${soles(d.montoCentimos)} a ${primera.codigo} de ${c.nombre}`;
  return { propuestas: [{ herramienta: 'deuda_abonar', args, resumen, ...(sugerencias.length ? { sugerencias } : {}) }], faltan };
}

function proponerDeuda(d: Dictado, c: ContactoResuelto | null, sug: SugerenciaDeCaptura | null, origen: Origen): Parcial {
  const tipo = d.tipoDeDeuda ?? 'por_cobrar';
  const conAdelanto = d.intencion === 'deuda_con_adelanto';
  const base = { tipo, contactoId: c?.id ?? null, totalCentimos: d.montoCentimos };
  const args = conAdelanto
    ? sinNulos({ ...base, concepto: d.descripcion ?? 'Trabajo dictado', adelantoCentimos: d.adelantoCentimos, origen })
    : sinNulos({ ...base, concepto: d.descripcion ?? 'Deuda dictada' });
  const a = c?.nombre ?? d.contactoNombre;
  const resumen = `${CLASE[tipo]} ${soles(d.montoCentimos)}${a ? ` a ${a}` : ''}${conAdelanto ? `, con adelanto de ${soles(d.adelantoCentimos)}` : ''}`;
  const propuesta: PropuestaInterpretada = { herramienta: conAdelanto ? 'deuda_crear_con_adelanto' : 'deuda_crear', args, resumen, ...(sug ? { sugerencias: [sug] } : {}) };
  return { propuestas: [propuesta], faltan: c ? [] : [faltaElCliente(d)] };
}

async function interpretar(tx: Transaccion, ctx: Ctx, e: EntradaDeInterprete): Promise<DictadoInterpretado> {
  const hoy = (await hoyDeLaEmpresa(tx)).dia;
  const d = interpretarDictado(e.texto, { modo: e.modo, hoy });
  // Los movimientos no tienen origen «texto».
  const origen: Origen = e.origen === 'voz' ? 'voz' : 'teclado';
  const { contacto, sugerencia } = await resolverContacto(tx, ctx, d.contactoNombre);

  let r: Parcial = SIN_PROPUESTA;
  if (d.intencion === 'movimiento') r = await proponerMovimiento(tx, ctx, d, contacto, sugerencia, origen);
  else if (d.intencion === 'abono') r = await proponerAbono(tx, ctx, d, contacto, sugerencia, origen, hoy);
  else if (d.intencion === 'deuda' || d.intencion === 'deuda_con_adelanto') r = proponerDeuda(d, contacto, sugerencia, origen);
  else if (d.intencion === 'pedido' && d.pedido) r = propuestaDePedido(d.pedido, { contacto, sugerencia });
  return { propuestas: r.propuestas, faltan: [...r.faltan, ...d.faltan], pista: d.pista };
}

export const interpreteDeRegistro: InterpreteDeCaptura = { modulo: 'registro', tambienPropone: ['ordenes'], interpretar };
