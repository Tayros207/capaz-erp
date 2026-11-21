import { montoMinimoEfectivo } from '@capaz/shared';
import { useQuery } from '@tanstack/react-query';
import { clienteDeConsultas } from './cliente-de-consultas.ts';
import { datosOError } from './consultas.ts';
import { llamar } from './herramientas.ts';

/** Clave de la consulta del monto mínimo: «Ajustes › Empresa» la invalida al guardar. */
export const CLAVE_MONTO_MINIMO = ['empresa', 'monto-minimo'] as const;

export const refrescarMontoMinimo = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_MONTO_MINIMO });

/**
 * Monto mínimo por trabajo de la empresa, en céntimos: el configurado, o el de fábrica si no se tocó (`0` = aviso apagado).
 * Con caché de 5 minutos. Devuelve `null` mientras carga o si no se pudo leer: entonces NO hay aviso.
 */
export function useMontoMinimo(): number | null {
  const consulta = useQuery({
    queryKey: CLAVE_MONTO_MINIMO,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => datosOError(await llamar('empresa_ver_configuracion', {})).montoMinimoCentimos,
  });
  if (consulta.data === undefined) return null;
  return montoMinimoEfectivo(consulta.data);
}
