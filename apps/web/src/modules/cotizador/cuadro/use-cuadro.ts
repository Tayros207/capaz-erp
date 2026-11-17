import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Respuesta, SalidaDelCuadroDto } from '@capaz/shared';
import { datosOError } from '../../../shared/api/consultas.ts';
import { notificar } from '../../../shared/ui/notificar.ts';
import { CLAVE_COTIZADOR } from '../claves.ts';
import { mensajeDeRechazo } from '../logica.ts';
import { verCuadro } from './api-cuadro.ts';
import type { Vista } from './logica-cuadro.ts';

export const claveDelCuadro = (id: string) => [...CLAVE_COTIZADOR, 'cuadro', id] as const;

export type Aplicar = (llamada: Promise<Respuesta<SalidaDelCuadroDto>>) => Promise<boolean>;

/**
 * El cuadro de una cotización y la forma de cambiarlo: `aplicar` recibe la llamada a una herramienta del cuadro, deja la vista
 * recalculada que devuelve el servidor en la caché y avisa si lo rechazó. Devuelve si se aplicó.
 */
export function useCuadro(id: string): { vista: Vista | undefined; cargando: boolean; error: string | null; aplicar: Aplicar } {
  const cliente = useQueryClient();
  const consulta = useQuery({ queryKey: claveDelCuadro(id), queryFn: async () => datosOError(await verCuadro(id)).cuadro, retry: false });
  const aplicar: Aplicar = useCallback(
    async (llamada) => {
      const r = await llamada;
      if (r.ok && 'datos' in r) {
        cliente.setQueryData(claveDelCuadro(id), r.datos.cuadro);
        return true;
      }
      if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
      return false;
    },
    [cliente, id],
  );
  return { vista: consulta.data, cargando: consulta.isPending, error: consulta.isError ? consulta.error.message : null, aplicar };
}

/** Lo que cada panel necesita: el cuadro, cómo cambiarlo y qué puede hacer la persona (costos y edición). */
export type ContextoDelCuadro = { id: string; vista: Vista; aplicar: Aplicar; editable: boolean; costos: boolean; configurar: boolean; emitir: boolean };
