// REGLA NUEVA (A2): la única puerta para fusionar las reglas de dictado con lo que entendió el modelo. Puro: solo dictado/.
// Primero corren las reglas (interpretarDictado). Luego el modelo COMPLETA: nombres y conceptos (los segmenta mejor), y el dinero y
// las fechas que las reglas no encontraron. En dinero y fechas, si discrepan, quedan las reglas y se avisa (elegir.ts). La intención
// que las reglas decidieron no se discute; la del modelo solo se usa cuando las reglas no supieron qué era.
import { categoriaDeCapaz } from './categoria-de-capaz.js';
import { elegirCentimos, elegirDia, nombreDelModelo, vacioANulo, type AvisoDelModelo } from './elegir.js';
import type { ExtraccionDelModelo, MedioDictado } from './esquema-del-modelo.js';
import { fechaDictada } from './fecha.js';
import { fechaPasadaDicha } from './fecha-dicha.js';
import { fusionarPedido } from './fusion-de-pedido.js';
import type { Dictado } from './interpretar-dictado.js';
import { inferirCategoria } from './reglas/categoria.js';
import { inferirTipo } from './reglas/monto.js';

export type EntradaDeFusion = { texto: string; hoy: string; modo?: 'ingreso' | 'egreso' };
export type Fusion = { dictado: Dictado; medioDePago: MedioDictado | null; cuentaNombre: string | null; avisos: AvisoDelModelo[] };

type Tipo = 'ingreso' | 'egreso';
type Decision = Pick<Dictado, 'intencion' | 'tipo' | 'tipoDeDeuda' | 'faltan' | 'pista'>;

const deudaSegun = (tipo: Tipo | null): 'por_cobrar' | 'por_pagar' => (tipo === 'egreso' ? 'por_pagar' : 'por_cobrar');
const decisionDe = (r: Dictado): Decision => ({ intencion: r.intencion, tipo: r.tipo, tipoDeDeuda: r.tipoDeDeuda, faltan: r.faltan, pista: r.pista });
const capitalizar = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** Ingreso o egreso: el chip, después lo que leyeron las reglas, después el modelo. Si reglas y modelo discrepan, se avisa. */
function elegirTipo(r: Dictado, m: ExtraccionDelModelo, e: EntradaDeFusion, avisos: AvisoDelModelo[]): Tipo | null {
  if (e.modo) return e.modo;
  // Un dictado incompleto (sin monto) sale sin tipo aunque el texto lo diga («cobré a Juan»): se vuelve a leer.
  const deReglas = r.tipo ?? (r.intencion === 'incompleto' ? inferirTipo(e.texto) : null);
  if (deReglas !== null && m.tipo !== null && deReglas !== m.tipo) {
    avisos.push({ motivo: 'distinto', campo: 'si entró o salió', reglas: { tipo: 'texto', valor: deReglas }, modelo: { tipo: 'texto', valor: m.tipo } });
  }
  return deReglas ?? m.tipo;
}

/** Las reglas no supieron qué era (faltaba el monto o el tipo): decide la intención del modelo con los campos ya fusionados. */
function decidirIncompleto(r: Dictado, m: ExtraccionDelModelo, monto: number | null, tipo: Tipo | null, adelanto: number | null): Decision {
  if (monto === null || m.intencion === 'otro' || m.intencion === 'pedido') return decisionDe(r);
  const listo = { faltan: [], pista: null };
  if (m.intencion === 'abono') {
    const t = tipo ?? 'ingreso';
    return { intencion: 'abono', tipo: t, tipoDeDeuda: deudaSegun(t), ...listo };
  }
  if (m.intencion === 'deuda') {
    return { intencion: adelanto === null ? 'deuda' : 'deuda_con_adelanto', tipo, tipoDeDeuda: m.tipoDeDeuda ?? deudaSegun(tipo), ...listo };
  }
  if (tipo === null) return { intencion: 'incompleto', tipo: null, tipoDeDeuda: null, faltan: ['si entró o salió'], pista: 'Toca «Ingreso» o «Egreso» y vuelve a enviar.' };
  return { intencion: 'movimiento', tipo, tipoDeDeuda: null, ...listo };
}

/** La del modelo si dijo una; si no, la de las reglas, salvo que sea la frase entera (eso no es un concepto). */
function descripcionFusionada(r: Dictado, m: ExtraccionDelModelo, texto: string): string | null {
  const delModelo = vacioANulo(m.descripcion);
  if (delModelo) return capitalizar(delModelo);
  return r.descripcion && r.descripcion.trim() !== texto.trim() ? r.descripcion : null;
}

function fusionarMovimiento(r: Dictado, m: ExtraccionDelModelo, e: EntradaDeFusion, avisos: AvisoDelModelo[]): Dictado {
  const montoCentimos = elegirCentimos('el monto', r.montoCentimos, m.montoCentimos, e.texto, avisos);
  const tipo = elegirTipo(r, m, e, avisos);
  const esDeuda = r.intencion === 'deuda' || r.intencion === 'deuda_con_adelanto' || (r.intencion === 'incompleto' && m.intencion === 'deuda');
  const adelanto = esDeuda ? elegirCentimos('el adelanto', r.adelantoCentimos, m.adelantoCentimos, e.texto, avisos) : null;
  const decision: Decision =
    r.intencion === 'incompleto'
      ? decidirIncompleto(r, m, montoCentimos, tipo, adelanto)
      : { ...decisionDe(r), intencion: r.intencion === 'deuda' && adelanto !== null ? 'deuda_con_adelanto' : r.intencion };
  const contactoNombre = nombreDelModelo(m.contactoNombre, e.texto) ?? r.contactoNombre;
  const conFecha = decision.intencion === 'movimiento' || decision.intencion === 'abono';
  const fechaDeReglas = r.fecha ?? (conFecha ? fechaDictada(e.texto, e.hoy) : null);
  const fecha = conFecha ? elegirDia('la fecha', fechaDeReglas, m.fechaDicha, (x) => fechaPasadaDicha(x, e.hoy), avisos) : null;
  const rubro = r.categoriaDeRubro ?? (conFecha && decision.tipo ? inferirCategoria(contactoNombre ? `${e.texto} ${contactoNombre}` : e.texto, decision.tipo) : null);
  return {
    ...r,
    ...decision,
    montoCentimos,
    adelantoCentimos: decision.intencion === 'deuda_con_adelanto' ? adelanto : null,
    contactoNombre,
    descripcion: descripcionFusionada(r, m, e.texto),
    fecha,
    categoriaDeRubro: rubro,
    categoriaDeCapaz: rubro ? categoriaDeCapaz(rubro) : null,
  };
}

/** `r` es lo que leyeron las reglas con el mismo texto, modo y hoy. Nada de lo que devuelve es un id: eso lo resuelve el intérprete. */
export function fusionarConModelo(r: Dictado, m: ExtraccionDelModelo, e: EntradaDeFusion): Fusion {
  const avisos: AvisoDelModelo[] = [];
  // Una proforma no se dicta aquí: el modelo no la convierte en otra cosa.
  if (r.intencion === 'fuera_de_alcance') return { dictado: r, medioDePago: null, cuentaNombre: null, avisos };
  const esPedido = r.intencion === 'pedido' || (r.intencion === 'incompleto' && m.intencion === 'pedido' && m.lineas.length > 0 && e.modo !== 'egreso');
  if (esPedido) return { dictado: fusionarPedido(r, m, e, avisos), medioDePago: null, cuentaNombre: null, avisos };
  return { dictado: fusionarMovimiento(r, m, e, avisos), medioDePago: m.medioDePago, cuentaNombre: vacioANulo(m.cuentaNombre), avisos };
}
