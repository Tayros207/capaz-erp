import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import type { Respuesta } from '@capaz/shared';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { mensajeDeRechazo } from './logica.ts';

// Efectos comunes de las acciones del módulo: avisar del resultado y refrescar las consultas.

export const refrescarRegistro = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_REGISTRO });

/**
 * Cierra una acción: si salió bien avisa `mensajeOk` y refresca; si el servidor la rechazó muestra su mensaje
 * (en un conflicto, el del servidor ya viene redactado); si la persona desistió, no hace nada. Devuelve si se aplicó.
 */
type Resultado = Respuesta<unknown> | { cancelada: true };

export async function resolverAccion(llamada: Resultado | Promise<Resultado>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarRegistro();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}
