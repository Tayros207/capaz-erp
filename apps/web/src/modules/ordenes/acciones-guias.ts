import type { EntradaDe, GuiaCompletaDto } from '@capaz/shared';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarPedidos } from './acciones.ts';
import { anularGuia, emitirGuia } from './api.ts';
import { mensajeDeRechazoDeGuia } from './armado-de-guia.ts';

/** Emite la guía, avisa y refresca. Devuelve la guía guardada, o nulo si el servidor la rechazó. */
export async function emitir(args: EntradaDe<'guia_emitir'>): Promise<GuiaCompletaDto | null> {
  const r = await emitirGuia(args);
  if (r.ok && 'datos' in r) {
    notificar(`Guía emitida: ${r.datos.codigo}.`, 'exito');
    await refrescarPedidos();
    return r.datos;
  }
  if ('error' in r) notificar(mensajeDeRechazoDeGuia(r.error.codigo, r.error.mensaje), 'error');
  return null;
}

/** Anula en dos pasos (la persona confirma el resumen del servidor). Devuelve si se anuló. */
export async function anular(id: string, motivo: string): Promise<boolean> {
  const r = await anularGuia(id, motivo);
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar('Guía anulada.', 'exito');
    await refrescarPedidos();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazoDeGuia(r.error.codigo, r.error.mensaje), 'error');
  return false;
}
