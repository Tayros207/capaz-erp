import { useQuery } from '@tanstack/react-query';
import type { Respuesta } from '@capaz/shared';
import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { datosOError } from '../../shared/api/consultas.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_INSUMOS, listarSucursales, verArticulo } from './api.ts';
import { mensajeDeRechazo, sucursalesVigentes } from './logica.ts';

// Ganchos y efectos compartidos por las pantallas del módulo.

/** Qué botones de escritura se muestran (R18): módulo con escritura y el permiso del manifiesto. */
export function usePermisosDeInventario(): { editar: boolean; ajustar: boolean } {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'insumos');
  return { editar: escribe && puede(yo, 'insumos:editar'), ajustar: escribe && puede(yo, 'insumos:ajustar') };
}

/** Sucursales vigentes, la principal primero (las comparten filtros y hojas). */
export function useSucursales() {
  return useQuery({ queryKey: [...CLAVE_INSUMOS, 'sucursales'], queryFn: async () => sucursalesVigentes(datosOError(await listarSucursales()).items) });
}

/** Un artículo con sus existencias por sucursal; sin id no consulta. */
export function useArticulo(id: string | null | undefined) {
  return useQuery({ queryKey: [...CLAVE_INSUMOS, 'articulo', id], queryFn: async () => datosOError(await verArticulo(id ?? '')), enabled: !!id });
}

export const refrescarInventario = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_INSUMOS });

type Resultado = Respuesta<unknown> | { cancelada: true };

/**
 * Cierra una acción: si salió bien avisa `mensajeOk` y refresca; si el servidor la rechazó muestra su mensaje; si la
 * persona desistió en la confirmación, no hace nada. Devuelve si se aplicó.
 */
export async function resolverAccion(llamada: Resultado | Promise<Resultado>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarInventario();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}
