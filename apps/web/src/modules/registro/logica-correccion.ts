import type { Centimos, EntradaDe, MovimientoDto } from '@capaz/shared';
import type { MedioDePago } from './logica.ts';

// Lógica pura de «Corregir un movimiento»: el formulario parte de lo guardado y solo viaja lo que cambia.

export type FormularioDeCorreccion = {
  monto: Centimos | null;
  fecha: string;
  cuentaId: string;
  categoriaId: string;
  contacto: { id: string; nombre: string } | null;
  medioDePago: MedioDePago;
  descripcion: string;
  /** Nota opcional: el servidor ya anota qué cambió. */
  motivo: string;
};
export type ErroresDeCorreccion = Partial<Record<'monto' | 'fecha' | 'cuentaId' | 'descripcion' | 'motivo', string>>;

export function formularioDeCorreccion(m: MovimientoDto): FormularioDeCorreccion {
  return {
    monto: m.montoCentimos as Centimos,
    fecha: m.fecha,
    cuentaId: m.cuentaId,
    categoriaId: m.categoriaId ?? '',
    contacto: m.contactoId ? { id: m.contactoId, nombre: m.contactoNombre ?? '' } : null,
    medioDePago: m.medioDePago,
    descripcion: m.descripcion ?? '',
    motivo: '',
  };
}

export function validarCorreccion(f: FormularioDeCorreccion, hoy: string): ErroresDeCorreccion {
  const e: ErroresDeCorreccion = {};
  if (f.monto === null || f.monto <= 0) e.monto = 'Indica un monto mayor que cero.';
  if (!f.fecha) e.fecha = 'Indica la fecha.';
  else if (f.fecha > hoy) e.fecha = 'La fecha no puede ser futura.';
  if (!f.cuentaId) e.cuentaId = 'Elige la cuenta.';
  if (f.descripcion.length > 500) e.descripcion = 'Máximo 500 caracteres.';
  if (f.motivo.length > 300) e.motivo = 'Máximo 300 caracteres.';
  return e;
}

/** Solo lo que cambia (`null` quita la categoría, el contacto o la descripción). `null` si no cambió nada. */
export function argumentosDeCorreccion(m: MovimientoDto, f: FormularioDeCorreccion): EntradaDe<'movimiento_corregir'> | null {
  const args: EntradaDe<'movimiento_corregir'> = { id: m.id };
  let cambia = false;
  if (f.monto !== null && f.monto !== m.montoCentimos) { args.montoCentimos = f.monto; cambia = true; }
  if (f.fecha !== m.fecha) { args.fecha = f.fecha; cambia = true; }
  if (f.cuentaId !== m.cuentaId) { args.cuentaId = f.cuentaId; cambia = true; }
  if ((f.categoriaId || null) !== m.categoriaId) { args.categoriaId = f.categoriaId || null; cambia = true; }
  if ((f.contacto?.id ?? null) !== m.contactoId) { args.contactoId = f.contacto?.id ?? null; cambia = true; }
  if (f.medioDePago !== m.medioDePago) { args.medioDePago = f.medioDePago; cambia = true; }
  if ((f.descripcion.trim() || null) !== m.descripcion) { args.descripcion = f.descripcion.trim() || null; cambia = true; }
  if (!cambia) return null;
  if (f.motivo.trim()) args.motivo = f.motivo.trim();
  return args;
}

/** ¿Se ofrece «Restaurar»? Anulado, no es una pata de transferencia y su cadena de correcciones no tiene versión vigente. */
export const puedeRestaurarseEnPantalla = (m: Pick<MovimientoDto, 'estado' | 'transferenciaId' | 'reemplazadoPor'>): boolean =>
  m.estado === 'anulado' && m.transferenciaId === null && m.reemplazadoPor === null;
