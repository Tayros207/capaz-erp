import type { EntradaDe, SucursalDto } from '@capaz/shared';

// Lógica pura de la pantalla de Sucursales.

export type FormularioDeSucursal = { codigo: string; nombre: string; direccion: string; telefono: string };
export type ErroresDeSucursal = Partial<Record<keyof FormularioDeSucursal, string>>;

export const FORMULARIO_VACIO: FormularioDeSucursal = { codigo: '', nombre: '', direccion: '', telefono: '' };

export function formularioDesde(s: SucursalDto): FormularioDeSucursal {
  return { codigo: s.codigo, nombre: s.nombre, direccion: s.direccion ?? '', telefono: s.telefono ?? '' };
}

/** `crear` exige el código; al editar el código no se cambia. */
export function validarSucursal(f: FormularioDeSucursal, crear: boolean): ErroresDeSucursal {
  const e: ErroresDeSucursal = {};
  if (crear && !f.codigo.trim()) e.codigo = 'El código es obligatorio.';
  if (crear && f.codigo.trim().length > 10) e.codigo = 'El código admite hasta 10 caracteres.';
  if (!f.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
  return e;
}

const vacioANulo = (t: string): string | null => (t.trim() === '' ? null : t.trim());

export function argumentosDeCreacion(f: FormularioDeSucursal): EntradaDe<'sucursal_crear'> {
  const args: EntradaDe<'sucursal_crear'> = { codigo: f.codigo.trim().toUpperCase(), nombre: f.nombre.trim() };
  if (f.direccion.trim()) args.direccion = f.direccion.trim();
  if (f.telefono.trim()) args.telefono = f.telefono.trim();
  return args;
}

/** Solo lo que cambió (`null` borra dirección o teléfono). Nulo si nada cambió. */
export function argumentosDeEdicion(original: SucursalDto, f: FormularioDeSucursal): EntradaDe<'sucursal_editar'> | null {
  const antes = formularioDesde(original);
  const args: EntradaDe<'sucursal_editar'> = { id: original.id };
  let cambio = false;
  if (f.nombre.trim() !== antes.nombre) {
    args.nombre = f.nombre.trim();
    cambio = true;
  }
  if (f.direccion.trim() !== antes.direccion) {
    args.direccion = vacioANulo(f.direccion);
    cambio = true;
  }
  if (f.telefono.trim() !== antes.telefono) {
    args.telefono = vacioANulo(f.telefono);
    cambio = true;
  }
  return cambio ? args : null;
}

/** La principal va primero y las archivadas al final; el resto por código. */
export function ordenarSucursales(lista: readonly SucursalDto[]): SucursalDto[] {
  const peso = (s: SucursalDto) => (s.archivadoEn ? 2 : s.esPrincipal ? 0 : 1);
  return [...lista].sort((a, b) => peso(a) - peso(b) || a.codigo.localeCompare(b.codigo, 'es'));
}

export function filtrarSucursales(lista: readonly SucursalDto[], verArchivadas: boolean): SucursalDto[] {
  return ordenarSucursales(verArchivadas ? lista : lista.filter((s) => !s.archivadoEn));
}

/** Solo una sucursal activa que no es la principal se puede marcar como principal. */
export const puedeMarcarPrincipal = (s: SucursalDto): boolean => !s.esPrincipal && !s.archivadoEn;
/** No se archiva la principal (el servidor también lo impide). */
export const puedeArchivar = (s: SucursalDto): boolean => !s.esPrincipal && !s.archivadoEn;

export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'conflicto') return mensaje || 'Ya existe una sucursal con ese código.';
  if (codigo === 'sin_permiso') return 'No tienes permiso para gestionar sucursales.';
  if (codigo === 'sin_conexion') return 'No hay conexión con el servidor. Inténtalo de nuevo.';
  return mensaje;
}
