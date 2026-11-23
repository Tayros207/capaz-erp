import type { DeudaDto, PedidoCompletoDto, Respuesta } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { ORIGEN_DE_PEDIDO, confirmarYCobrar, type DependenciasDelAdelanto, type MedioDePago, type Res, type ResultadoDelAdelanto } from './adelanto.ts';
import { confirmarPedido } from './api.ts';
import { mensajeDeRechazo } from './logica.ts';

// Adaptadores del flujo «Confirmar y cobrar adelanto»: llaman por NOMBRE a las herramientas de
// Finanzas (un módulo no importa a otro) y entregan los resultados a la lógica pura de `adelanto.ts`.

export function normalizar<T, U>(r: Respuesta<T>, mapa: (d: T) => U): Res<U> {
  if (r.ok && 'datos' in r) return { ok: true, datos: mapa(r.datos) };
  if ('error' in r) return { ok: false, codigo: r.error.codigo, mensaje: mensajeDeRechazo(r.error.codigo, r.error.mensaje) };
  return { ok: false, codigo: 'requiere_confirmacion', mensaje: 'Esta operación pide una confirmación que aquí no está disponible.' };
}

/** La deuda con lo que necesitan el cobro y el documento: importes, su estado real y el vencimiento (`vencida` lo calcula Finanzas). */
export const deMinima = (d: DeudaDto) => ({
  id: d.id,
  codigo: d.codigo,
  totalCentimos: d.totalCentimos,
  abonadoCentimos: d.abonadoCentimos,
  saldoCentimos: d.saldoCentimos,
  estado: d.estado,
  venceEn: d.venceEn,
  vencida: d.vencida,
});

/** La deuda viva del pedido: una sola consulta con el filtro por origen (sin recorrer páginas). */
export async function buscarDeudaDelPedido(pedidoId: string, _clienteId: string): Promise<Res<ReturnType<typeof deMinima> | null>> {
  const r = await llamar('deudas_listar', { tipo: 'por_cobrar', estado: 'todas', origenTipo: ORIGEN_DE_PEDIDO, origenId: pedidoId, limite: 10 });
  if (!r.ok || !('datos' in r)) return normalizar(r, () => null);
  const viva = r.datos.items.find((d) => d.estado !== 'anulada');
  return { ok: true, datos: viva ? deMinima(viva) : null };
}

const deConfirmado = (p: PedidoCompletoDto) => ({ id: p.id, codigo: p.codigo, clienteId: p.clienteId, totalCentimos: p.totalCentimos });

export function dependenciasDelAdelanto(pedidoId: string): DependenciasDelAdelanto {
  return {
    confirmar: async () => normalizar(await confirmarPedido(pedidoId), deConfirmado),
    crearDeuda: async (a) => normalizar(await llamar('deuda_crear', { tipo: 'por_cobrar', ...a }), deMinima),
    buscarDeuda: buscarDeudaDelPedido,
    abonar: async (id, montoCentimos, medioDePago) => normalizar(await llamar('deuda_abonar', { id, montoCentimos, medioDePago, descripcion: 'Adelanto al confirmar el pedido' }), () => null),
  };
}

export const ejecutarAdelanto = (pedidoId: string, montoCentimos: number, medio: MedioDePago): Promise<ResultadoDelAdelanto> =>
  confirmarYCobrar(dependenciasDelAdelanto(pedidoId), { montoCentimos, medio, formato: formatearSoles });
