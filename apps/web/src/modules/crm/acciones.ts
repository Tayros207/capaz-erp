import { useQueryClient } from '@tanstack/react-query';
import type { Respuesta } from '@capaz/shared';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_CRM } from './api.ts';
import { mensajeDeRechazo } from './logica.ts';

/**
 * Corre una escritura, avisa el resultado y refresca las consultas del módulo. Devuelve los datos o
 * nulo si fue rechazada (el aviso ya se mostró).
 */
export function useEscribir() {
  const consultas = useQueryClient();
  return async function escribir<S>(llamada: Promise<Respuesta<S>>, exito?: string): Promise<S | null> {
    const r = await llamada;
    if (r.ok && 'datos' in r) {
      if (exito) notificar(exito, 'exito');
      await consultas.invalidateQueries({ queryKey: CLAVE_CRM });
      return r.datos;
    }
    if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
    return null;
  };
}
