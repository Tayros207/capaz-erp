import type { Respuesta } from '@capaz/shared';
import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_PRODUCCION } from './claves.ts';
import { mensajeDeRechazo } from './logica.ts';

/** Qué botones de escritura se muestran (R18): módulo con escritura y el permiso del manifiesto. */
export function usePermisosDeProduccion(): { editar: boolean; anular: boolean } {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'produccion');
  return { editar: escribe && puede(yo, 'produccion:editar'), anular: escribe && puede(yo, 'produccion:anular') };
}

export const refrescarProduccion = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_PRODUCCION });

/** Cierra una acción: si salió bien avisa `mensajeOk` y refresca; si el servidor la rechazó muestra su mensaje. Devuelve si se aplicó. */
export async function resolverAccion(llamada: Promise<Respuesta<unknown>>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarProduccion();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}
