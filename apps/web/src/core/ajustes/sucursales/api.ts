import type { EntradaDe, Respuesta, SucursalDto } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../../shared/api/herramientas.ts';

/** Cargador de la ruta: una empresa tiene pocas sucursales, así que llegan todas (también las archivadas) y se filtra en pantalla. */
export function cargarSucursales(): Promise<Respuesta<{ items: SucursalDto[]; siguiente: string | null }>> {
  return llamar('sucursales_listar', { incluirArchivadas: true });
}

export const crearSucursal = (args: EntradaDe<'sucursal_crear'>) => llamar('sucursal_crear', args);
export const editarSucursal = (args: EntradaDe<'sucursal_editar'>) => llamar('sucursal_editar', args);
export const archivarSucursal = (id: string) => llamar('sucursal_archivar', { id });

/** Crítica: el servidor pide confirmar y la persona ve el resumen antes de que cambie nada. */
export const marcarPrincipal = (id: string) =>
  llamarConfirmando('sucursal_marcar_principal', { id }, { titulo: 'Marcar como sucursal principal', textoConfirmar: 'Marcar como principal' });
