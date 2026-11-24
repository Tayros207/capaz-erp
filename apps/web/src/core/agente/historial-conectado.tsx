import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { borrarConversacion, CLAVE_CONVERSACIONES, listarConversaciones, marcarFavorita, renombrarConversacion } from './api.ts';
import { ListaDeConversaciones } from './lista-de-conversaciones.tsx';
import { agruparConversaciones, filtrarPorTitulo } from './logica-historial.ts';

/** El historial real: trae las conversaciones del servidor, de 50 en 50, y aplica los cambios que pida la persona. */
export function HistorialConectado({ activaId, alAbrir, alBorrada }: { activaId: string | null; alAbrir: (id: string) => void; alBorrada: (id: string) => void }): ReactNode {
  const cliente = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const consulta = useInfiniteQuery({
    queryKey: CLAVE_CONVERSACIONES,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => datosOError(await listarConversaciones(pageParam)),
    getNextPageParam: (pagina) => (pagina.hayMas ? pagina.items.at(-1)?.actualizadoEn : undefined),
  });
  const items = consulta.data?.pages.flatMap((p) => p.items) ?? [];
  const refrescar = () => void cliente.invalidateQueries({ queryKey: CLAVE_CONVERSACIONES });

  const aplicar = async (accion: Promise<{ ok: boolean }>, falla: string) => {
    const r = await accion;
    if (r.ok) refrescar();
    else notificar(falla, 'error');
  };
  const borrar = async (id: string) => {
    if (!(await confirmar('Borrar la conversación', '¿Borrar esta conversación? No se puede deshacer. Lo que el asistente hizo sigue en el historial de la empresa.', { textoConfirmar: 'Borrar', peligroso: true }))) return;
    const r = await borrarConversacion(id);
    if (r.ok) {
      alBorrada(id);
      refrescar();
    } else notificar('No se pudo borrar la conversación.', 'error');
  };

  return (
    <ListaDeConversaciones
      estado={consulta.isPending ? 'cargando' : consulta.isError ? 'error' : 'listo'}
      mensajeDeError={consulta.error instanceof Error ? consulta.error.message : undefined}
      grupos={agruparConversaciones(filtrarPorTitulo(items, busqueda), new Date(consulta.dataUpdatedAt))}
      busqueda={busqueda}
      alBuscar={setBusqueda}
      hayMas={consulta.hasNextPage}
      cargandoMas={consulta.isFetchingNextPage}
      alVerMas={() => void consulta.fetchNextPage()}
      alReintentar={() => void consulta.refetch()}
      activaId={activaId}
      alAbrir={alAbrir}
      alFavorita={(id, f) => void aplicar(marcarFavorita(id, f), 'No se pudo cambiar la favorita.')}
      alRenombrar={(id, titulo) => void aplicar(renombrarConversacion(id, titulo), 'No se pudo renombrar la conversación.')}
      alBorrar={(id) => void borrar(id)}
    />
  );
}
