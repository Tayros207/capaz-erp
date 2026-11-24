import type { HerramientaRegistrada } from '../herramientas/tipos.js';
import type { EstadoDelTurno, LimitesDeDinero } from './tipos-del-turno.js';

// Las guardas del dinero que el asistente mueve solo. El ERP es un sistema ordenado: el asistente no puede registrar dinero con
// fechas raras, repetir un movimiento, duplicar lo que el sistema ya propuso, ni mover montos grandes sin que una persona lo vea.
// Lo que no pasa una guarda NO se pierde: queda como borrador en la Bandeja para que una persona lo apruebe. Todo lo que sí pasa deja
// su huella en `core.agente_acciones`. Tampoco cuenta lo que no se puede medir: una operación de dinero sin importe verificable es borrador.

export const TOPE_DE_ESCRITURAS_POR_TURNO = 20;
export const TOPE_DE_DINERO_POR_TURNO = 5;
/** S/ 1,000 en céntimos (decisión de Moisés, 2026-11-24): por encima de esto una persona aprueba. */
export const TOPE_POR_OPERACION_POR_OMISION = 100_000;
/** Lo que el asistente mueve en un día por persona: este múltiplo del tope por operación. Frena el fraccionamiento en trozos chicos. */
export const TOPE_DIARIO_EN_TOPES = 5;

/** Sin importe en los argumentos pero sin riesgo de monto: anular o restaurar algo ya registrado, o abrir una cuenta sin saldo. */
export const SIN_IMPORTE_PERMITIDO: ReadonlySet<string> = new Set(['adelanto_anular', 'cuenta_crear', 'deuda_anular', 'movimiento_anular', 'movimiento_restaurar']);

export type Veredicto = { tipo: 'directo' } | { tipo: 'borrador'; motivo: string } | { tipo: 'rechazo'; mensaje: string };

const objeto = (x: unknown): Record<string, unknown> => (x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

const PROFUNDIDAD_MAXIMA = 6;

/**
 * El mayor importe que traen los argumentos: todo campo numérico cuyo nombre termina en «Centimos», en cualquier nivel. Si los
 * argumentos son más hondos de lo que se revisa, devuelve infinito: lo que no se puede medir no pasa.
 */
export function mayorImporteEnCentimos(valor: unknown, profundidad = 0): number {
  if (valor === null || typeof valor !== 'object') return 0;
  if (profundidad > PROFUNDIDAD_MAXIMA) return Number.POSITIVE_INFINITY;
  let mayor = 0;
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === 'number' && clave.endsWith('Centimos')) mayor = Math.max(mayor, Math.abs(v));
    else if (typeof v === 'object') mayor = Math.max(mayor, mayorImporteEnCentimos(v, profundidad + 1));
  }
  return mayor;
}

/** ¿Trae algún campo de céntimos? Sin él no hay forma de comprobar el tope. */
export function tieneImporte(valor: unknown, profundidad = 0): boolean {
  if (valor === null || typeof valor !== 'object' || profundidad > PROFUNDIDAD_MAXIMA) return false;
  return Object.entries(valor as Record<string, unknown>).some(([k, v]) => (typeof v === 'number' && k.endsWith('Centimos')) || (typeof v === 'object' && tieneImporte(v, profundidad + 1)));
}

const CLAVES_DE_NEGOCIO = ['contactoId', 'cuentaId', 'colaboradorId', 'origenTipo', 'origenId', 'id', 'tipo', 'fecha', 'origenId', 'destinoId'] as const;

/**
 * Lo que hace que dos operaciones de dinero sean «la misma»: la herramienta, quién y cuánto, y cuándo. El texto libre (descripción,
 * notas) no cuenta: cambiar una letra de la descripción no la vuelve otra operación.
 */
export function claveDeNegocio(args: unknown): string {
  const a = objeto(args);
  const clave: Record<string, unknown> = {};
  for (const k of [...CLAVES_DE_NEGOCIO].sort()) if (k in a) clave[k] = a[k];
  for (const k of Object.keys(a).filter((x) => x.endsWith('Centimos')).sort()) clave[k] = a[k];
  return JSON.stringify(clave);
}

/** Los frenos del turno, para CUALQUIER escritura: ni un bucle ni un modelo desbocado cambia decenas de cosas en un turno. */
export function frenoDelTurno(estado: Pick<EstadoDelTurno, 'escrituras' | 'vistas'>, clave: string, esConfirmacion: boolean): string | null {
  if (estado.escrituras >= TOPE_DE_ESCRITURAS_POR_TURNO) return `Ya hiciste ${TOPE_DE_ESCRITURAS_POR_TURNO} cambios en este turno. Para y dile a la persona qué falta: ella puede pedirte que continúes.`;
  if (!esConfirmacion && estado.vistas.has(clave)) return 'Ya hiciste exactamente esa misma llamada en este turno. No la repitas: revisa su resultado.';
  return null;
}

export type SituacionDeDinero = {
  /** Lo normal exige que la herramienta sea idempotente; una crítica con confirmación propia ya tiene su token de un solo uso. */
  exigeIdempotencia: boolean;
  /** La misma operación (misma clave de negocio) ya se hizo hace pocos minutos. */
  repetida: boolean;
  /** Lo que el asistente ya movió hoy por esta persona, en céntimos. */
  acumuladoDelDia: number;
  /** El sistema ya propuso en la Bandeja una operación parecida (mismo cliente o mismo origen): no se crea a mano. */
  propuestaDelSistema: boolean;
};

/** El dinero pasa de a una guarda; la primera que falla decide. Rechazar (error al modelo) o mandar a borrador (lo aprueba una persona). */
export function guardasDeDinero(h: Pick<HerramientaRegistrada, 'nombre' | 'idempotente'>, args: unknown, limites: LimitesDeDinero, estado: Pick<EstadoDelTurno, 'escriturasDeDinero'>, s: SituacionDeDinero): Veredicto {
  if (!limites.dineroDirecto) return { tipo: 'borrador', motivo: 'La empresa dejó el dinero del asistente como borrador.' };
  if (s.exigeIdempotencia && !h.idempotente) return { tipo: 'borrador', motivo: 'Esta operación de dinero no se puede repetir sin riesgo.' };
  if (estado.escriturasDeDinero >= TOPE_DE_DINERO_POR_TURNO) return { tipo: 'rechazo', mensaje: `Ya moviste dinero ${TOPE_DE_DINERO_POR_TURNO} veces en este turno. Para y consúltale a la persona.` };
  if (s.repetida) return { tipo: 'rechazo', mensaje: 'Esa misma operación de dinero (mismos datos principales) ya se hizo hace pocos minutos. Si la persona de verdad quiere otra igual, que la haga ella.' };
  if (s.propuestaDelSistema) return { tipo: 'rechazo', mensaje: 'El sistema ya dejó una propuesta parecida en la Bandeja. No la crees a mano: dile a la persona que la apruebe allí.' };
  const a = objeto(args);
  if (a.origenTipo !== undefined || a.origenId !== undefined) return { tipo: 'borrador', motivo: 'Lo que nace de un documento (con su origen) lo propone el sistema: una persona lo aprueba.' };
  if (typeof a.fecha === 'string' && a.fecha !== limites.hoy) return { tipo: 'borrador', motivo: 'El asistente solo registra dinero con la fecha de hoy.' };
  if (!tieneImporte(args) && !SIN_IMPORTE_PERMITIDO.has(h.nombre)) return { tipo: 'borrador', motivo: 'No se puede comprobar el importe de esta operación.' };
  const importe = mayorImporteEnCentimos(args);
  if (importe > limites.topePorOperacionCentimos) return { tipo: 'borrador', motivo: 'El importe supera lo que el asistente hace solo.' };
  if (s.acumuladoDelDia + (Number.isFinite(importe) ? importe : 0) > limites.topePorOperacionCentimos * TOPE_DIARIO_EN_TOPES) return { tipo: 'borrador', motivo: 'Con esto, lo que el asistente movió hoy supera su límite diario.' };
  return { tipo: 'directo' };
}
