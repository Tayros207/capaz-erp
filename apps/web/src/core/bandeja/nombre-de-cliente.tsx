import { useQuery } from '@tanstack/react-query';
import { datosOError } from '../../shared/api/consultas.ts';
import { CLAVE_CAPTURA, verCliente } from '../captura/api.ts';

/** El nombre de un cliente a partir de su identificador, para no mostrar el uuid. */
export function NombreDeCliente({ id }: { id: string }) {
  const ficha = useQuery({ queryKey: [...CLAVE_CAPTURA, 'cliente', id], queryFn: async () => datosOError(await verCliente(id)), staleTime: 60_000 });
  if (ficha.isPending) return <>Cargando…</>;
  return <>{ficha.data?.nombre ?? 'Cliente no encontrado'}</>;
}
