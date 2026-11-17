import { useQuery } from '@tanstack/react-query';
import { datosOError } from '../../shared/api/consultas.ts';
import { verConfiguracion } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';

/** Las unidades que la empresa configuró (comparte la consulta de la pantalla de Ajustes). Vacío mientras carga o si falla. */
export function useUnidadesDeLaEmpresa(): string[] {
  const q = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'configuracion'], queryFn: async () => datosOError(await verConfiguracion()), staleTime: 60_000 });
  return q.data?.unidades ?? [];
}
