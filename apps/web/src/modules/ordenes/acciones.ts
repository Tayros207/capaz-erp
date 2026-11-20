import type { EntradaDe, PedidoDto, VentaCorregidaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { anotarPedido, cambiarEstado, cancelarPedido, confirmarPedido, editarDatosDePedido, listarPedidos } from './api.ts';
import { CLAVE_PEDIDOS } from './claves.ts';
import { saldoTrasCorregir, type SaldoDelPedido } from './deuda-del-pedido.ts';
import { ETIQUETA_DE_ESTADO, mensajeDeRechazo, type Paso } from './logica.ts';

/** Qué puede hacer esta persona en Pedidos: escribir exige acceso completo al módulo y el permiso. */
export function usePermisosDePedidos(): { editar: boolean; cancelar: boolean } {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'ordenes');
  return { editar: escribe && puede(yo, 'ordenes:editar'), cancelar: escribe && puede(yo, 'ordenes:cancelar') };
}

export const refrescarPedidos = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_PEDIDOS });

/**
 * Tras «Corregir venta»: el pedido y su saldo se pintan ya con lo que devolvió el servidor (sin parpadeo del saldo anterior) y
 * después se vuelve a pedir todo lo que depende de esa venta: pedidos, Finanzas (la deuda), Mi día y la bandeja (propuestas de
 * cobro puestas al día). Las claves de los otros módulos van escritas aquí para no importarlos (regla 7).
 */
export async function refrescarTrasCorregir(r: VentaCorregidaDto): Promise<void> {
  clienteDeConsultas.setQueryData([...CLAVE_PEDIDOS, 'ficha', r.pedido.id], r.pedido);
  clienteDeConsultas.setQueryData<SaldoDelPedido | null>([...CLAVE_PEDIDOS, 'saldo', r.pedido.id], (previo) => saldoTrasCorregir(previo, r));
  await Promise.all([refrescarPedidos(), ...[['registro'], ['inicio'], ['bandeja']].map((queryKey) => clienteDeConsultas.invalidateQueries({ queryKey }))]);
}

/** Confirma o cambia de estado, avisa del resultado y refresca las listas. Devuelve si se aplicó. */
export async function aplicarPaso(id: string, paso: Paso): Promise<boolean> {
  const r = paso.tipo === 'confirmar' ? await confirmarPedido(id) : await cambiarEstado(id, paso.estado);
  if (r.ok && 'datos' in r) {
    notificar(paso.tipo === 'confirmar' ? `Pedido confirmado: ${r.datos.codigo}.` : `${r.datos.codigo}: ${ETIQUETA_DE_ESTADO[r.datos.estado]}.`, 'exito');
    await refrescarPedidos();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

/** Agrega una nota al historial. Devuelve si se aplicó. */
export async function anotar(id: string, nota: string): Promise<boolean> {
  const r = await anotarPedido(id, nota);
  if (r.ok && 'datos' in r) {
    notificar('Nota agregada.', 'exito');
    await refrescarPedidos();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

/** Corrige entrega, responsable o notas de un pedido confirmado. Devuelve si se aplicó. */
export async function corregirDatos(id: string, cambios: Omit<EntradaDe<'pedido_editar_datos'>, 'id'>): Promise<boolean> {
  const r = await editarDatosDePedido({ id, ...cambios });
  if (r.ok && 'datos' in r) {
    notificar('Datos del pedido corregidos.', 'exito');
    await refrescarPedidos();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

/** Cancela en dos pasos (la persona confirma el resumen del servidor). Devuelve si se canceló. */
export async function cancelar(id: string, motivo: string): Promise<boolean> {
  const r = await cancelarPedido(id, motivo);
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar('Pedido cancelado.', 'exito');
    await refrescarPedidos();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

const PAGINAS_COMO_MAXIMO = 5;

/** Los pedidos abiertos (hasta 500) para el tablero y las entregas; `hayMas` avisa si quedaron fuera. */
export async function cargarAbiertos(filtros: { entregaHasta?: string } = {}): Promise<{ items: PedidoDto[]; hayMas: boolean }> {
  const items: PedidoDto[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < PAGINAS_COMO_MAXIMO; i++) {
    const pagina = datosOError(await listarPedidos({ estado: 'abiertos', limite: 100, ...filtros }, cursor));
    items.push(...pagina.items);
    if (!pagina.siguiente) return { items, hayMas: false };
    cursor = pagina.siguiente;
  }
  return { items, hayMas: true };
}
