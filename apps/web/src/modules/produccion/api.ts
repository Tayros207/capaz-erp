import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Las pantallas de producción solo hablan con el servidor por herramientas tipadas (auditables).

export const POR_PAGINA = 25;

export const listarOrdenes = (args: EntradaDe<'produccion_ordenes_listar'>) => llamar('produccion_ordenes_listar', args);
export const verOrden = (id: string) => llamar('produccion_orden_ver', { id });
export const crearOrden = (args: EntradaDe<'produccion_orden_crear'>) => llamar('produccion_orden_crear', args);
export const editarOrden = (args: EntradaDe<'produccion_orden_editar'>) => llamar('produccion_orden_editar', args);
export const cambiarEstado = (args: EntradaDe<'produccion_orden_estado'>) => llamar('produccion_orden_estado', args);
export const cobrarOrden = (id: string) => llamar('produccion_orden_cobrar', { id });
export const anularOrden = (args: EntradaDe<'produccion_orden_anular'>) => llamar('produccion_orden_anular', args);
export const buscarClientes = (texto: string) => llamar('clientes_buscar', { texto, limite: 8 });
