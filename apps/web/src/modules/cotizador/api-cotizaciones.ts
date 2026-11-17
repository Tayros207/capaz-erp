import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';
import { POR_PAGINA } from './api.ts';

export function listarCotizaciones(filtros: Omit<EntradaDe<'cotizaciones_listar'>, 'cursor' | 'limite'>, cursor?: string, limite = POR_PAGINA) {
  return llamar('cotizaciones_listar', { limite, ...filtros, ...(cursor && { cursor }) });
}
export const verCotizacion = (id: string) => llamar('cotizacion_ver', { id });
export const editarCotizacion = (args: EntradaDe<'cotizacion_editar'>) => llamar('cotizacion_editar', args);
/** Crítica: el servidor devuelve el resumen y la persona confirma. */
export const emitirCotizacion = (args: EntradaDe<'cotizacion_emitir'>) =>
  llamarConfirmando('cotizacion_emitir', args, { titulo: 'Emitir la cotización', textoConfirmar: 'Emitir' });
export const anularCotizacion = (args: EntradaDe<'cotizacion_anular'>) =>
  llamarConfirmando('cotizacion_anular', args, { titulo: 'Anular la cotización', textoConfirmar: 'Anular', peligroso: true });
export const nuevaVersion = (id: string) => llamar('cotizacion_nueva_version', { id });
export const duplicarCotizacion = (id: string) => llamar('cotizacion_duplicar', { id });
export const marcarEnviada = (id: string) => llamar('cotizacion_marcar_enviada', { id });
export const aceptarCotizacion = (args: EntradaDe<'cotizacion_aceptar'>) => llamar('cotizacion_aceptar', args);
export const rechazarCotizacion = (args: EntradaDe<'cotizacion_rechazar'>) => llamar('cotizacion_rechazar', args);
export const verClienteParaWhatsApp = (id: string) => llamar('clientes_ver', { id });
