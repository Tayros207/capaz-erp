import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

// Las pantallas de compras solo hablan con el servidor por herramientas tipadas (auditables).

export const POR_PAGINA = 25;
export type FiltroDeEstado = NonNullable<EntradaDe<'compras_listar'>['estado']>;

export function listarCompras(filtros: Omit<EntradaDe<'compras_listar'>, 'cursor'>, cursor?: string) {
  return llamar('compras_listar', { limite: POR_PAGINA, ...filtros, ...(cursor && { cursor }) });
}

export const verCompra = (id: string) => llamar('compra_ver', { id });
export const crearCompra = (args: EntradaDe<'compra_crear'>) => llamar('compra_crear', args);
export const editarCompra = (args: EntradaDe<'compra_editar'>) => llamar('compra_editar', args);
export const enviarCompra = (id: string) => llamar('compra_enviar', { id });
export const recibirCompra = (args: EntradaDe<'compra_recibir'>) => llamar('compra_recibir', args);

/** Crítica: el servidor devuelve el resumen y la persona confirma antes de cancelar. */
export const cancelarCompra = (id: string, motivo: string) =>
  llamarConfirmando('compra_cancelar', { id, motivo }, { titulo: 'Cancelar orden de compra', textoConfirmar: 'Cancelar orden', peligroso: true });

export const buscarProveedores = (texto: string) => llamar('clientes_buscar', { texto, limite: 8 });
export const buscarProductos = (texto: string) => llamar('productos_buscar', { texto, limite: 8 });
