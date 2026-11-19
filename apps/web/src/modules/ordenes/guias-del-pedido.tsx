import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { listarGuias } from './api.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { COLUMNAS_DE_GUIAS } from './columnas-de-guias.tsx';

/** Sección «Guías de remisión» de la ficha del pedido. No muestra nada si el pedido no tiene guías (ni si falla la consulta). */
export function GuiasDelPedido({ pedidoId }: { pedidoId: string }) {
  const navegar = useNavigate();
  const consulta = useQuery({
    queryKey: [...CLAVE_PEDIDOS, 'guias', 'del-pedido', pedidoId],
    queryFn: async () => datosOError(await listarGuias({ pedidoId, estado: 'todas', limite: 25 })),
    retry: false,
  });
  const guias = consulta.data?.items ?? [];
  if (guias.length === 0) return null;
  return (
    <section aria-label="Guías de remisión del pedido" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Guías de remisión</h2>
      <Lista etiqueta="Guías del pedido" columnas={COLUMNAS_DE_GUIAS} filas={guias} clave={(g) => g.id} onAbrir={(g) => void navegar(`/m/ordenes/guias/${g.id}`)} />
    </section>
  );
}
