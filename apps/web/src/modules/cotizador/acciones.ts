import type { Respuesta } from '@capaz/shared';
import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { mensajeDeRechazo } from './logica.ts';

export const refrescarCotizador = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_COTIZADOR });

type Resultado = Respuesta<unknown> | { cancelada: true };

/** Cierra una acción: avisa del resultado y refresca. Si el servidor la rechazó muestra su mensaje. Devuelve si se aplicó. */
export async function resolverAccion(llamada: Resultado | Promise<Resultado>, mensajeOk: string): Promise<boolean> {
  const r = await llamada;
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar(mensajeOk, 'exito');
    await refrescarCotizador();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}
