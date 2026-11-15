import { textoOpcional } from '../../clientes/domain/normalizacion.js';

export const CODIGO_SUCURSAL_PRINCIPAL = 'PRI';
export const NOMBRE_SUCURSAL_PRINCIPAL = 'Principal';

/** El código sirve de serie de los correlativos: 2 a 6 letras o cifras en mayúsculas. Inválido es `null`. */
export function normalizarCodigoDeSucursal(codigo: string): string | null {
  const c = codigo.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9]{2,6}$/.test(c) ? c : null;
}

export type EntradaDeSucursal = { codigo: string; nombre: string; direccion?: string | null; telefono?: string | null };
export type DatosDeSucursal = { codigo: string; nombre: string; direccion: string | null; telefono: string | null };
export type ResultadoSucursal = { ok: true; datos: DatosDeSucursal } | { ok: false; campo: string; motivo: string };

export function prepararSucursal(e: EntradaDeSucursal): ResultadoSucursal {
  const codigo = normalizarCodigoDeSucursal(e.codigo);
  if (!codigo) return { ok: false, campo: 'codigo', motivo: 'El código tiene de 2 a 6 letras o cifras.' };
  const nombre = e.nombre.replace(/\s+/g, ' ').trim();
  if (!nombre) return { ok: false, campo: 'nombre', motivo: 'El nombre es obligatorio.' };
  return { ok: true, datos: { codigo, nombre, direccion: textoOpcional(e.direccion), telefono: textoOpcional(e.telefono) } };
}

/** La sucursal principal no se archiva. */
export const puedeArchivarse = (s: { esPrincipal: boolean }): boolean => !s.esPrincipal;
