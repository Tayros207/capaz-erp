import type { AjusteDeDeudaDto } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';
import { buscarDeudaDelPedido } from './flujo-adelanto.ts';

/** Lo que Finanzas sabe de un pedido: su deuda viva, lo pagado y lo que quedó a favor del cliente (no se devuelve). */
export type SaldoDelPedido = {
  deudaId: string;
  codigo: string;
  totalCentimos: number;
  abonadoCentimos: number;
  saldoCentimos: number;
  aFavorCentimos: number;
  ajustes: AjusteDeDeudaDto[];
};

/** `null` si el pedido no tiene deuda o la persona no ve Finanzas: ahí simplemente no se muestra. Nunca lanza. */
export async function verSaldoDelPedido(pedidoId: string, clienteId: string): Promise<SaldoDelPedido | null> {
  const viva = await buscarDeudaDelPedido(pedidoId, clienteId);
  if (!viva.ok || !viva.datos) return null;
  const r = await llamar('deuda_ver', { id: viva.datos.id });
  if (!r.ok || !('datos' in r)) return null;
  const d = r.datos;
  return { deudaId: d.id, codigo: d.codigo, totalCentimos: d.totalCentimos, abonadoCentimos: d.abonadoCentimos, saldoCentimos: d.saldoCentimos, aFavorCentimos: d.aFavorCentimos, ajustes: d.ajustes };
}
