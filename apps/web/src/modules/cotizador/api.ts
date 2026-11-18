import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

export { buscarProductos as buscarProductosDelCatalogo } from '../../core/productos/api.ts';

// Las pantallas del Cotizador solo hablan con el servidor por herramientas tipadas. Ningún precio se calcula aquí.

export const POR_PAGINA = 25;
export type EstadoDeListas = NonNullable<EntradaDe<'listas_precio_listar'>['estado']>;

export function listarListas(filtros: Omit<EntradaDe<'listas_precio_listar'>, 'cursor' | 'limite'>, cursor?: string, limite = POR_PAGINA) {
  return llamar('listas_precio_listar', { limite, ...filtros, ...(cursor && { cursor }) });
}
/** El buscador de «qué cotizar»: catálogo y listas heredadas, con el origen del precio de cada resultado. */
export const buscarProductosParaCotizar = (texto: string, limite = 8) => llamar('cotizador_productos_buscar', { texto, limite });
export const crearLista = (args: EntradaDe<'lista_precio_crear'>) => llamar('lista_precio_crear', args);
/** Crítica: el servidor devuelve el resumen del cambio y la persona confirma. */
export const editarLista = (args: EntradaDe<'lista_precio_editar'>) =>
  llamarConfirmando('lista_precio_editar', args, { titulo: 'Cambiar la lista de precios', textoConfirmar: 'Guardar cambios' });
export const archivarLista = (id: string) => llamar('lista_precio_archivar', { id });
export const restaurarLista = (id: string) => llamar('lista_precio_restaurar', { id });
/** Crítica: el servidor devuelve cuántas listas cambian y ejemplos; la persona confirma. */
export const ajustarListasEnBloque = (args: EntradaDe<'listas_precio_ajustar_en_bloque'>) =>
  llamarConfirmando('listas_precio_ajustar_en_bloque', args, { titulo: 'Cambiar precios en bloque', textoConfirmar: 'Confirmar y cambiar' });
export const historialDeLista = (id: string, cursor?: string, limite = 20) => llamar('lista_precio_historial', { id, limite, ...(cursor && { cursor }) });

export const consultarPrecio = (args: EntradaDe<'precio_consultar'>) => llamar('precio_consultar', args);
export const crearCotizacion = (args: EntradaDe<'cotizacion_crear'>) => llamar('cotizacion_crear', args);

export const iniciarCotizador = () => llamar('cotizador_iniciar', {});
export const verConfiguracion = () => llamar('cotizador_configuracion_ver', {});
export const configurarCotizador = (args: EntradaDe<'cotizador_configurar'>) => llamar('cotizador_configurar', args);
export const listarAjustes = () => llamar('ajustes_cliente_listar', {});
export const fijarAjuste = (args: EntradaDe<'ajuste_cliente_fijar'>) => llamar('ajuste_cliente_fijar', args);

export const buscarClientes = (texto: string) => llamar('clientes_buscar', { texto, limite: 8 });
export const primerosClientes = () => llamar('clientes_listar', { estado: 'activos', limite: 8 });
