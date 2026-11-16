import { useQuery } from '@tanstack/react-query';
import type { ResumenDeBorradores } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';
import { datosOError } from './api.ts';
import { CLAVE_BANDEJA } from './claves.ts';

const SIN_PENDIENTES: ResumenDeBorradores = { pendientes: 0, deAltaPrioridad: 0 };

/**
 * Cuántos borradores esperan a esta persona (insignia del menú y tarjeta de Inicio). Se refresca cada
 * minuto y al resolver un borrador (la bandeja invalida `CLAVE_BANDEJA`). Sin permiso o con error, ceros.
 */
export function usePendientes(habilitado: boolean): ResumenDeBorradores {
  const consulta = useQuery({
    queryKey: [...CLAVE_BANDEJA, 'resumen'],
    queryFn: async () => datosOError(await llamar('borradores_resumen', {})),
    enabled: habilitado,
    refetchInterval: 60_000,
  });
  return consulta.data ?? SIN_PENDIENTES;
}
