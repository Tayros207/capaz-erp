import { QueryClient } from '@tanstack/react-query';

/** El cliente de consultas único de la web: caché de 30 s, sin reintentos ni recarga al volver a la pestaña. */
export function crearClienteDeConsultas(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } } });
}

export const clienteDeConsultas = crearClienteDeConsultas();
