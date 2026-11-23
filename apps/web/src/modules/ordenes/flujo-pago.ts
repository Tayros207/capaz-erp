import { formatearSoles } from '../../shared/formato/soles.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import { confirmarPedido } from './api.ts';
import { confirmarYCobrarPedido, type DependenciasDelCobro, type PagoAlConfirmar, type ResultadoDelCobro } from './cobro-del-pedido.ts';
import { buscarDeudaDelPedido, deMinima, normalizar } from './flujo-adelanto.ts';

// Adaptadores del flujo «Confirmar» con el bloque Pago: llaman por NOMBRE a las herramientas de Finanzas
// (un módulo no importa a otro) y entregan los resultados a la lógica pura de `cobro-del-pedido.ts`.

const deConfirmado = (p: { id: string; codigo: string; clienteId: string; totalCentimos: number }) => ({ id: p.id, codigo: p.codigo, clienteId: p.clienteId, totalCentimos: p.totalCentimos });

export function dependenciasDelCobro(pedidoId: string): DependenciasDelCobro {
  return {
    confirmar: async () => normalizar(await confirmarPedido(pedidoId), deConfirmado),
    crearDeuda: async (a) => normalizar(await llamar('deuda_crear', { tipo: 'por_cobrar', ...a }), deMinima),
    crearDeudaConAdelanto: async ({ cuentaId, medio, ...a }) =>
      normalizar(await llamar('deuda_crear_con_adelanto', { tipo: 'por_cobrar', ...a, medioDePago: medio, ...(cuentaId && { cuentaId }) }), (r) => deMinima(r.deuda)),
    buscarDeuda: buscarDeudaDelPedido,
    abonar: async (id, montoCentimos, medioDePago, cuentaId) =>
      normalizar(await llamar('deuda_abonar', { id, montoCentimos, medioDePago, ...(cuentaId && { cuentaId }), descripcion: 'Cobro al confirmar el pedido' }), () => null),
  };
}

export const ejecutarPago = (pedidoId: string, pago: PagoAlConfirmar): Promise<ResultadoDelCobro> =>
  confirmarYCobrarPedido(dependenciasDelCobro(pedidoId), pago, formatearSoles);
