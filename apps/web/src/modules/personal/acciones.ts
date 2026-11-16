import type { Respuesta } from '@capaz/shared';
import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_PERSONAL } from './claves.ts';
import { mensajeDeRechazo } from './logica.ts';

/** Qué botones de escritura se muestran (R18): módulo con escritura y el permiso del manifiesto. */
export function usePermisosDePersonal(): { editar: boolean; adelantos: boolean; anular: boolean } {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'personal');
  return { editar: escribe && puede(yo, 'personal:editar'), adelantos: escribe && puede(yo, 'personal:adelantos'), anular: escribe && puede(yo, 'personal:anular') };
}

export const refrescarPersonal = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_PERSONAL });

type Resultado = Respuesta<unknown> | { cancelada: true };

/**
 * Cierra una acción: si salió bien avisa `mensajeOk` y refresca; si el servidor la rechazó muestra su mensaje;
 * si la persona desistió, no hace nada. Devuelve si se aplicó.
 */
export async function resolverAccion(llamada: Resultado | Promise<Resultado>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarPersonal();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}
