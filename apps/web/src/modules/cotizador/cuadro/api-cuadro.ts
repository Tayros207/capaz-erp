import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../../shared/api/herramientas.ts';

// El cuadro por partes solo habla con el servidor por herramientas tipadas. Ningún costo ni precio se calcula en la pantalla.

export const iniciarCuadro = (args: EntradaDe<'cuadro_iniciar'>) => llamar('cuadro_iniciar', args);
export const verCuadro = (id: string) => llamar('cuadro_ver', { id });
export const fijarTrabajo = (args: EntradaDe<'cuadro_fijar_trabajo'>) => llamar('cuadro_fijar_trabajo', args);
export const fijarImposicion = (args: EntradaDe<'cuadro_fijar_imposicion'>) => llamar('cuadro_fijar_imposicion', args);
export const agregarFila = (args: EntradaDe<'cuadro_linea_agregar'>) => llamar('cuadro_linea_agregar', args);
export const editarFila = (args: EntradaDe<'cuadro_linea_editar'>) => llamar('cuadro_linea_editar', args);
export const quitarFila = (args: EntradaDe<'cuadro_linea_quitar'>) => llamar('cuadro_linea_quitar', args);
export const fijarCostoDirecto = (args: EntradaDe<'cuadro_fijar_costo_directo'>) => llamar('cuadro_fijar_costo_directo', args);
export const fijarColumnas = (args: EntradaDe<'cuadro_fijar_columnas_a_enviar'>) => llamar('cuadro_fijar_columnas_a_enviar', args);
export const fijarUtilidad = (args: EntradaDe<'cuadro_fijar_utilidad'>) => llamar('cuadro_fijar_utilidad', args);
export const fijarPrecioFinal = (args: EntradaDe<'cuadro_fijar_precio_final'>) => llamar('cuadro_fijar_precio_final', args);
export const agregarItem = (args: EntradaDe<'cuadro_item_agregar'>) => llamar('cuadro_item_agregar', args);
export const editarItem = (args: EntradaDe<'cuadro_item_editar'>) => llamar('cuadro_item_editar', args);
export const quitarItem = (args: EntradaDe<'cuadro_item_quitar'>) => llamar('cuadro_item_quitar', args);
export const generarReferencias = (id: string) => llamar('cuadro_generar_referencias', { id });
/** Crítica: cambia lo que se cobra en la lista; el servidor devuelve el resumen y la persona confirma. */
export const guardarReferencias = (args: EntradaDe<'cuadro_guardar_referencias'>) =>
  llamarConfirmando('cuadro_guardar_referencias', args, { titulo: 'Guardar en la lista de precios', textoConfirmar: 'Guardar' });
