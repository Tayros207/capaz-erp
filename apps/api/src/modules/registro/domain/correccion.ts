import { formatearSoles } from '@capaz/shared';
import { aplicarAbono, type DespuesDeAbonar, type SaldoDeDeuda } from './deuda.js';
import { PREFIJO_DE_CIERRE } from './cierre.js';
import { PREFIJO_DE_TRANSFERENCIA } from './transferencia.js';
import { rechazada, type Regla } from './regla.js';

// Corregir y restaurar movimientos (ADR-012: un movimiento nunca se edita). Corregir = anular el original y registrar
// uno nuevo en la misma transacción. Todos los reemplazos de una cadena (M1 → M2 → M3) llevan en `origen_ref` el id
// de la RAÍZ (el primer original): esa «familia» tiene a lo sumo un movimiento activo.

/** Prefijo de `origen_ref` de los movimientos que nacen de una corrección. */
export const PREFIJO_DE_CORRECCION = 'correccion:';

export const referenciaDeCorreccion = (raizId: string): string => `${PREFIJO_DE_CORRECCION}${raizId}`;

/** Un `origen_ref` que solo el sistema puede escribir (transferencias, correcciones y diferencias de caja del cierre). */
export const esOrigenReservado = (origenRef: string | null | undefined): boolean =>
  origenRef !== null && origenRef !== undefined && [PREFIJO_DE_TRANSFERENCIA, PREFIJO_DE_CORRECCION, PREFIJO_DE_CIERRE].some((p) => origenRef.startsWith(p));

export const MENSAJE_DE_ORIGEN_DE_CORRECCION = 'Ese origen está reservado para el sistema (correcciones, transferencias y cierres de caja).';

/** El id de la raíz de la familia a la que pertenece el movimiento (él mismo si nunca fue una corrección). */
export function raizDeFamilia(mov: { id: string; origenRef: string | null }): string {
  if (mov.origenRef?.startsWith(PREFIJO_DE_CORRECCION)) return mov.origenRef.slice(PREFIJO_DE_CORRECCION.length) || mov.id;
  return mov.id;
}

/** `correccionDe` de la salida: la raíz si el movimiento es una corrección; `null` si no. */
export const correccionDeReferencia = (origenRef: string | null): string | null =>
  origenRef?.startsWith(PREFIJO_DE_CORRECCION) ? origenRef.slice(PREFIJO_DE_CORRECCION.length) || null : null;

type Corregible = { estado: string; deudaId: string | null; origenRef: string | null };

/** ¿Se puede corregir? Activo, suelto (no es abono) y sin referencia ajena (transferencias, otros módulos). */
export function puedeCorregirse(mov: Corregible): Regla {
  if (mov.estado !== 'activo') return rechazada('conflicto', 'Solo se corrige un movimiento activo.');
  if (mov.origenRef?.startsWith(PREFIJO_DE_TRANSFERENCIA)) return rechazada('conflicto', 'Una transferencia no se corrige: anúlala y vuelve a transferir.');
  if (mov.deudaId) return rechazada('conflicto', 'Es el abono de una deuda: anúlalo y vuelve a abonar desde la deuda.');
  if (mov.origenRef && !mov.origenRef.startsWith(PREFIJO_DE_CORRECCION)) {
    return rechazada('conflicto', 'Este movimiento nació en otro módulo: corrígelo allí o anúlalo.');
  }
  return { ok: true };
}

export const esCorregible = (mov: Corregible): boolean => puedeCorregirse(mov).ok;

export type DatosCorregibles = {
  montoCentimos: number;
  fecha: string;
  cuentaId: string;
  categoriaId: string | null;
  contactoId: string | null;
  medioDePago: string;
  descripcion: string | null;
};

export type CambiosPedidos = {
  montoCentimos?: number | undefined;
  fecha?: string | undefined;
  cuentaId?: string | undefined;
  categoriaId?: string | null | undefined;
  contactoId?: string | null | undefined;
  medioDePago?: string | undefined;
  descripcion?: string | null | undefined;
};

export type CampoCorregido = 'monto' | 'fecha' | 'cuenta' | 'categoría' | 'cliente o proveedor' | 'medio de pago' | 'descripción';

const vacioANulo = (texto: string | null | undefined): string | null => (texto === undefined || texto === null || texto.trim() === '' ? null : texto.trim());

/**
 * Los datos finales y los campos que de verdad cambian. Un valor igual al actual no cuenta como cambio. Sin ningún
 * cambio real se rechaza (no se gasta un número para dejar todo igual).
 */
export function aplicarCorreccion(actual: DatosCorregibles, pedido: CambiosPedidos): Regla<{ final: DatosCorregibles; cambios: Array<{ campo: CampoCorregido; texto: string }> }> {
  const final: DatosCorregibles = { ...actual };
  const cambios: Array<{ campo: CampoCorregido; texto: string }> = [];
  if (pedido.montoCentimos !== undefined && pedido.montoCentimos !== actual.montoCentimos) {
    final.montoCentimos = pedido.montoCentimos;
    cambios.push({ campo: 'monto', texto: `monto ${formatearSoles(actual.montoCentimos)} → ${formatearSoles(pedido.montoCentimos)}` });
  }
  if (pedido.fecha !== undefined && pedido.fecha !== actual.fecha) {
    final.fecha = pedido.fecha;
    cambios.push({ campo: 'fecha', texto: `fecha ${actual.fecha} → ${pedido.fecha}` });
  }
  if (pedido.cuentaId !== undefined && pedido.cuentaId !== actual.cuentaId) {
    final.cuentaId = pedido.cuentaId;
    cambios.push({ campo: 'cuenta', texto: 'cuenta' });
  }
  if (pedido.categoriaId !== undefined && pedido.categoriaId !== actual.categoriaId) {
    final.categoriaId = pedido.categoriaId;
    cambios.push({ campo: 'categoría', texto: pedido.categoriaId === null ? 'categoría quitada' : 'categoría' });
  }
  if (pedido.contactoId !== undefined && pedido.contactoId !== actual.contactoId) {
    final.contactoId = pedido.contactoId;
    cambios.push({ campo: 'cliente o proveedor', texto: pedido.contactoId === null ? 'cliente o proveedor quitado' : 'cliente o proveedor' });
  }
  if (pedido.medioDePago !== undefined && pedido.medioDePago !== actual.medioDePago) {
    final.medioDePago = pedido.medioDePago;
    cambios.push({ campo: 'medio de pago', texto: `medio de pago ${actual.medioDePago} → ${pedido.medioDePago}` });
  }
  if (pedido.descripcion !== undefined && vacioANulo(pedido.descripcion) !== actual.descripcion) {
    final.descripcion = vacioANulo(pedido.descripcion);
    cambios.push({ campo: 'descripción', texto: 'descripción' });
  }
  if (cambios.length === 0) return rechazada('argumentos_invalidos', 'No cambiaste nada: indica al menos un dato distinto al actual.');
  return { ok: true, final, cambios };
}

const LARGO_DEL_MOTIVO = 300;

/** El motivo con que queda anulado el original: el detalle de lo corregido y, si hay, lo que escribió la persona. */
export function motivoDeCorreccion(cambios: ReadonlyArray<{ texto: string }>, motivoLibre: string | undefined): string {
  const base = `Corregido: ${cambios.map((c) => c.texto).join('; ')}`;
  const libre = motivoLibre?.trim();
  return (libre ? `${base}. ${libre}` : base).slice(0, LARGO_DEL_MOTIVO);
}

/** ¿Se puede restaurar? Debe estar anulado, no ser una transferencia y no tener ya una versión vigente en su familia. */
export function puedeRestaurarse(mov: { estado: string; origenRef: string | null }, vigente: { codigo: string } | null): Regla {
  if (mov.estado !== 'anulado') return rechazada('conflicto', 'Ese movimiento no está anulado.');
  if (mov.origenRef?.startsWith(PREFIJO_DE_TRANSFERENCIA)) return rechazada('conflicto', 'Una transferencia anulada no se restaura: vuelve a transferir.');
  if (vigente) return rechazada('conflicto', `Ya hay una versión vigente (${vigente.codigo}): restaurar este la duplicaría. Anula primero esa versión.`);
  return { ok: true };
}

/** Restaurar un abono: la deuda debe seguir abierta y el monto debe caber otra vez en su saldo. */
export function puedeRestaurarseElAbono(deuda: SaldoDeDeuda, montoCentimos: number): Regla<DespuesDeAbonar> {
  const r = aplicarAbono(deuda, montoCentimos);
  if (r.ok) return r;
  return rechazada('conflicto', `No se puede restaurar este abono: ${r.mensaje.charAt(0).toLowerCase()}${r.mensaje.slice(1)}`);
}
