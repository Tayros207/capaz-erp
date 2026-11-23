import type { AjusteDeDeudaDto, VentaCorregidaDto } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';
import type { MedioDePago } from './adelanto.ts';
import type { EstadoDeLaDeuda } from './documentos.ts';
import { buscarDeudaDelPedido } from './flujo-adelanto.ts';

/** Lo que Finanzas sabe de un pedido: su deuda viva, lo pagado y lo que quedó a favor del cliente (no se devuelve). */
export type AbonoDelPedido = { fecha: string; montoCentimos: number; cuentaNombre: string; medio: MedioDePago };

export type SaldoDelPedido = {
  deudaId: string;
  codigo: string;
  totalCentimos: number;
  abonadoCentimos: number;
  saldoCentimos: number;
  aFavorCentimos: number;
  ajustes: AjusteDeDeudaDto[];
  /** Estado, vencimiento y abonos activos de la deuda (el más reciente primero). */
  estadoDeuda: EstadoDeLaDeuda;
  abonos: AbonoDelPedido[];
};

/**
 * Lo que respondió el servidor al corregir manda sobre lo que la caché aún tiene: así la tarjeta de pagos no muestra el saldo
 * anterior mientras se vuelve a pedir. Sin deuda en la respuesta (no la ve, o no tiene), queda lo que había.
 */
export function saldoTrasCorregir(previo: SaldoDelPedido | null | undefined, r: VentaCorregidaDto): SaldoDelPedido | null {
  if (!r.deuda) return previo ?? null;
  const ajustes = previo?.ajustes ?? [];
  return {
    deudaId: r.deuda.id,
    codigo: r.deuda.codigo,
    totalCentimos: r.deuda.totalCentimos,
    abonadoCentimos: r.deuda.abonadoCentimos,
    saldoCentimos: r.deuda.saldoCentimos,
    aFavorCentimos: r.aFavorCentimos,
    ajustes: r.ajuste ? [r.ajuste, ...ajustes.filter((a) => a.id !== r.ajuste?.id)] : ajustes,
    estadoDeuda: { estado: r.deuda.estado, vencida: r.deuda.vencida, venceEn: r.deuda.venceEn },
    abonos: previo?.abonos ?? [],
  };
}

/** `null` si el pedido no tiene deuda o la persona no ve Finanzas: ahí simplemente no se muestra. Nunca lanza. */
export async function verSaldoDelPedido(pedidoId: string, clienteId: string): Promise<SaldoDelPedido | null> {
  const viva = await buscarDeudaDelPedido(pedidoId, clienteId);
  if (!viva.ok || !viva.datos) return null;
  const r = await llamar('deuda_ver', { id: viva.datos.id });
  if (!r.ok || !('datos' in r)) return null;
  const d = r.datos;
  const abonos = d.abonos
    .filter((a) => a.estado === 'activo')
    .map((a) => ({ fecha: a.fecha, montoCentimos: a.montoCentimos, cuentaNombre: a.cuentaNombre, medio: a.medioDePago }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    deudaId: d.id,
    codigo: d.codigo,
    totalCentimos: d.totalCentimos,
    abonadoCentimos: d.abonadoCentimos,
    saldoCentimos: d.saldoCentimos,
    aFavorCentimos: d.aFavorCentimos,
    ajustes: d.ajustes,
    estadoDeuda: { estado: d.estado, vencida: d.vencida, venceEn: d.venceEn },
    abonos,
  };
}
