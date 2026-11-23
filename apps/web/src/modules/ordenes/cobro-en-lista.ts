import type { PedidoDto } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';
import { ORIGEN_DE_PEDIDO } from './adelanto.ts';

/** Lo que debe un pedido en la lista: viene de su deuda abierta en Finanzas. */
export type CobroAbierto = { totalCentimos: number; abonadoCentimos: number; saldoCentimos: number; vencida: boolean };

export type FiltroDeCobro = 'todos' | 'con_saldo' | 'sin_adelanto';
export const FILTROS_DE_COBRO: readonly FiltroDeCobro[] = ['todos', 'con_saldo', 'sin_adelanto'];
export const ETIQUETA_DE_FILTRO_DE_COBRO: Readonly<Record<FiltroDeCobro, string>> = { todos: 'Todos', con_saldo: 'Con saldo por cobrar', sin_adelanto: 'Sin adelanto' };

const PAGINAS_MAXIMAS = 5;

/**
 * Las deudas abiertas por cobrar que nacieron de un pedido, por id de pedido. Una sola consulta paginada (hasta 500 deudas):
 * no se pide una deuda por fila. Si la persona no ve Finanzas o falla, devuelve `null` y la columna simplemente no se muestra.
 */
export async function cobrosAbiertosPorPedido(): Promise<Map<string, CobroAbierto> | null> {
  const mapa = new Map<string, CobroAbierto>();
  let cursor: string | undefined;
  for (let i = 0; i < PAGINAS_MAXIMAS; i += 1) {
    const r = await llamar('deudas_listar', { tipo: 'por_cobrar', estado: 'abiertas', limite: 100, ...(cursor && { cursor }) });
    if (!r.ok || !('datos' in r)) return null;
    for (const d of r.datos.items) {
      if (d.origenTipo === ORIGEN_DE_PEDIDO && d.origenId) mapa.set(d.origenId, { totalCentimos: d.totalCentimos, abonadoCentimos: d.abonadoCentimos, saldoCentimos: d.saldoCentimos, vencida: d.vencida });
    }
    if (!r.datos.siguiente) break;
    cursor = r.datos.siguiente;
  }
  return mapa;
}

/** Solo los pedidos que dejaron de ser borrador o cancelado pueden deber algo. */
const puedeTenerDeuda = (p: Pick<PedidoDto, 'estado'>) => p.estado !== 'borrador' && p.estado !== 'cancelado';

export function filtrarPorCobro<T extends Pick<PedidoDto, 'id'>>(filas: readonly T[], cobros: ReadonlyMap<string, CobroAbierto> | null, filtro: FiltroDeCobro): readonly T[] {
  if (filtro === 'todos' || !cobros) return filas;
  return filas.filter((p) => {
    const c = cobros.get(p.id);
    return c !== undefined && c.saldoCentimos > 0 && (filtro === 'con_saldo' || c.abonadoCentimos <= 0);
  });
}

/** Contenido de la celda: lo que falta y, si corresponde, «Vencida» o «Sin adelanto». Sin deuda abierta no hay nada que decir. */
export function datosDeSaldo(p: Pick<PedidoDto, 'estado'>, c: CobroAbierto | undefined): { saldoCentimos: number; nota: string | null; tono: 'neutro' | 'aviso' | 'peligro' } | null {
  if (!puedeTenerDeuda(p) || !c || c.saldoCentimos <= 0) return null;
  const nota = c.vencida ? 'Vencida' : c.abonadoCentimos <= 0 ? 'Sin adelanto' : null;
  return { saldoCentimos: c.saldoCentimos, nota, tono: c.vencida ? 'peligro' : c.abonadoCentimos <= 0 ? 'aviso' : 'neutro' };
}
