import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

/** Crítica: el servidor devuelve el resumen («¿Envío la cotización… al cliente?») y la persona confirma. */
export const generarEnlace = (args: EntradaDe<'enlace_generar'>) =>
  llamarConfirmando('enlace_generar', args, { titulo: 'Enviar la cotización al cliente', textoConfirmar: 'Generar enlace' });
export const listarEnlaces = (cotizacionId: string) => llamar('enlaces_listar', { cotizacionId });
export const revocarEnlace = (id: string) => llamar('enlace_revocar', { id });
