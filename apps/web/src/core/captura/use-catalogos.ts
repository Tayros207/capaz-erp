import { useQuery } from '@tanstack/react-query';
import { datosOError } from '../../shared/api/consultas.ts';
import { CLAVE_CAPTURA, listarCategorias, listarCuentas } from './api.ts';

/** Cuentas y categorías vivas para los selectores de las tarjetas (se leen una vez y se comparten). */
export function useCatalogos() {
  const cuentas = useQuery({ queryKey: [...CLAVE_CAPTURA, 'cuentas'], queryFn: async () => datosOError(await listarCuentas()), staleTime: 60_000 });
  const categorias = useQuery({ queryKey: [...CLAVE_CAPTURA, 'categorias'], queryFn: async () => datosOError(await listarCategorias()), staleTime: 60_000 });
  return { cuentas: cuentas.data?.items ?? [], categorias: categorias.data?.items ?? [] };
}
