import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

export const buscarRepetidos = (umbral: number) => llamar('clientes_similares', { umbral, limite: 30 });

/** Crítica: el servidor cuenta lo que moverá y la persona confirma; la fusión no se deshace. */
export const fusionarClientes = (origenId: string, destinoId: string) =>
  llamarConfirmando('clientes_fusionar', { origenId, destinoId }, { titulo: 'Fusionar clientes', textoConfirmar: 'Fusionar', peligroso: true });
