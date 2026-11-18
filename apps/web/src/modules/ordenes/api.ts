import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

// Las pantallas de pedidos solo hablan con el servidor por herramientas tipadas.

export const POR_PAGINA = 25;
export type FiltroDeEstado = NonNullable<EntradaDe<'pedidos_listar'>['estado']>;

export function listarPedidos(filtros: Omit<EntradaDe<'pedidos_listar'>, 'cursor'>, cursor?: string) {
  return llamar('pedidos_listar', { limite: POR_PAGINA, ...filtros, ...(cursor && { cursor }) });
}

export const verPedido = (id: string) => llamar('pedido_ver', { id });
export const crearPedido = (args: EntradaDe<'pedido_crear'>) => llamar('pedido_crear', args);
export const editarPedido = (args: EntradaDe<'pedido_editar'>) => llamar('pedido_editar', args);
export const anotarPedido = (id: string, nota: string) => llamar('pedido_anotar', { id, nota });
export const confirmarPedido = (id: string) => llamar('pedido_confirmar', { id });
export const cambiarEstado = (id: string, estado: EntradaDe<'pedido_cambiar_estado'>['estado']) => llamar('pedido_cambiar_estado', { id, estado });

/** Crítica: el servidor devuelve el resumen y la persona confirma antes de cancelar. */
export const cancelarPedido = (id: string, motivo: string) =>
  llamarConfirmando('pedido_cancelar', { id, motivo }, { titulo: 'Cancelar pedido', textoConfirmar: 'Cancelar pedido', peligroso: true });

export const buscarClientes = (texto: string) => llamar('clientes_buscar', { texto, limite: 8 });
export const buscarProductos = (texto: string) => llamar('productos_buscar', { texto, limite: 8 });
/** Lo que muestran los selectores al abrirse sin haber escrito nada: los primeros por orden alfabético. */
export const primerosClientes = () => llamar('clientes_listar', { estado: 'activos', limite: 8 });
export const primerosProductos = () => llamar('productos_listar', { estado: 'activos', limite: 8 });
export const listarMiembros = () => llamar('miembros_listar', {});
