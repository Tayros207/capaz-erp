import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando, llamarConfirmandoCon } from '../../shared/api/herramientas.ts';

// Las pantallas de pedidos solo hablan con el servidor por herramientas tipadas.

export const POR_PAGINA = 25;
export type FiltroDeEstado = NonNullable<EntradaDe<'pedidos_listar'>['estado']>;

export function listarPedidos(filtros: Omit<EntradaDe<'pedidos_listar'>, 'cursor'>, cursor?: string) {
  return llamar('pedidos_listar', { limite: POR_PAGINA, ...filtros, ...(cursor && { cursor }) });
}

export const verPedido = (id: string) => llamar('pedido_ver', { id });
export const crearPedido = (args: EntradaDe<'pedido_crear'>) => llamar('pedido_crear', args);
export const editarPedido = (args: EntradaDe<'pedido_editar'>) => llamar('pedido_editar', args);
export const editarDatosDePedido = (args: EntradaDe<'pedido_editar_datos'>) => llamar('pedido_editar_datos', args);
export const anotarPedido = (id: string, nota: string) => llamar('pedido_anotar', { id, nota });
export const confirmarPedido = (id: string) => llamar('pedido_confirmar', { id });
export const cambiarEstado = (id: string, estado: EntradaDe<'pedido_cambiar_estado'>['estado']) => llamar('pedido_cambiar_estado', { id, estado });

/** Crítica: el servidor devuelve el resumen y la persona confirma antes de cancelar. */
export const cancelarPedido = (id: string, motivo: string) =>
  llamarConfirmando('pedido_cancelar', { id, motivo }, { titulo: 'Cancelar pedido', textoConfirmar: 'Cancelar pedido', peligroso: true });

/**
 * Crítica: corrige el pedido y ajusta su deuda con UNA sola confirmación. `preguntar` recibe el resumen del servidor
 * (la hoja «Qué cambia» lo muestra con sus botones) y devuelve si la persona acepta.
 */
export const corregirVenta = (args: EntradaDe<'venta_corregir'>, preguntar: (resumen: string, vencio: boolean) => Promise<boolean>) => llamarConfirmandoCon('venta_corregir', args, preguntar);

export function listarCorrecciones(filtros: Omit<EntradaDe<'correcciones_listar'>, 'cursor'>, cursor?: string) {
  return llamar('correcciones_listar', { limite: POR_PAGINA, ...filtros, ...(cursor && { cursor }) });
}

export const buscarProductos = (texto: string) => llamar('productos_buscar', { texto, limite: 8 });
/** Lo que muestran los selectores al abrirse sin haber escrito nada: los primeros por orden alfabético. */
export const primerosProductos = () => llamar('productos_listar', { estado: 'activos', limite: 8 });
export const listarMiembros = () => llamar('miembros_listar', {});

// Guías de remisión (control interno).
export const prepararGuia = (args: EntradaDe<'guia_preparar'>) => llamar('guia_preparar', args);
export const emitirGuia = (args: EntradaDe<'guia_emitir'>) => llamar('guia_emitir', args);
export const verGuia = (id: string) => llamar('guia_ver', { id });
export function listarGuias(filtros: Omit<EntradaDe<'guias_listar'>, 'cursor'>, cursor?: string) {
  return llamar('guias_listar', { limite: POR_PAGINA, ...filtros, ...(cursor && { cursor }) });
}
/** Crítica: el servidor devuelve el resumen y la persona confirma antes de anular. */
export const anularGuia = (id: string, motivo: string) =>
  llamarConfirmando('guia_anular', { id, motivo }, { titulo: 'Anular guía', textoConfirmar: 'Anular guía', peligroso: true });
