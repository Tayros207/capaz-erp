import type { DeudaDto, PedidoCompletoDto, Respuesta } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { ORIGEN_DE_PEDIDO, confirmarYCobrar, type DependenciasDelAdelanto, type MedioDePago, type Res, type ResultadoDelAdelanto } from './adelanto.ts';
import { confirmarPedido } from './api.ts';
import { mensajeDeRechazo } from './logica.ts';

// Adaptadores del flujo «Confirmar y cobrar adelanto»: llaman por NOMBRE a las herramientas de
// Finanzas (un módulo no importa a otro) y entregan los resultados a la lógica pura de `adelanto.ts`.

const PAGINAS_COMO_MAXIMO = 5;

function normalizar<T, U>(r: Respuesta<T>, mapa: (d: T) => U): Res<U> {
  if (r.ok && 'datos' in r) return { ok: true, datos: mapa(r.datos) };
  if ('error' in r) return { ok: false, codigo: r.error.codigo, mensaje: mensajeDeRechazo(r.error.codigo, r.error.mensaje) };
  return { ok: false, codigo: 'requiere_confirmacion', mensaje: 'Esta operación pide una confirmación que aquí no está disponible.' };
}

const deMinima = (d: DeudaDto) => ({ id: d.id, codigo: d.codigo, totalCentimos: d.totalCentimos, abonadoCentimos: d.abonadoCentimos, saldoCentimos: d.saldoCentimos });

/** La deuda viva del pedido: se recorre la lista del cliente y se compara el origen (no hay filtro por origen en la herramienta). */
export async function buscarDeudaDelPedido(pedidoId: string, clienteId: string): Promise<Res<ReturnType<typeof deMinima> | null>> {
  let cursor: string | undefined;
  for (let i = 0; i < PAGINAS_COMO_MAXIMO; i++) {
    const r = await llamar('deudas_listar', { tipo: 'por_cobrar', estado: 'todas', contactoId: clienteId, limite: 100, ...(cursor && { cursor }) });
    if (!r.ok || !('datos' in r)) return normalizar(r, () => null);
    const viva = r.datos.items.find((d) => d.origenTipo === ORIGEN_DE_PEDIDO && d.origenId === pedidoId && d.estado !== 'anulada');
    if (viva) return { ok: true, datos: deMinima(viva) };
    if (!r.datos.siguiente) return { ok: true, datos: null };
    cursor = r.datos.siguiente;
  }
  return { ok: false, codigo: 'incompleto', mensaje: 'No se pudo revisar toda la lista de deudas del cliente.' };
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
