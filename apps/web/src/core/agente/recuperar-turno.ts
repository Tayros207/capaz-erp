import type { ConversacionConMensajes, Respuesta } from '@capaz/shared';
import { decidirRecuperacion, ESPERA_ENTRE_CONSULTAS_MS, ESPERA_INICIAL_MS, MAXIMO_DE_CONSULTAS, type Recuperacion } from './logica-turno.ts';

// Cuando la conexión se corta a mitad de un turno (el móvil pasó a segundo plano, cayó la red) el servidor puede haber terminado
// igual: el turno corre desligado de la conexión. Antes de dar nada por perdido se consulta la conversación guardada.

export type DependenciasDeRecuperacion = {
  consultar: (conversacionId: string) => Promise<Respuesta<ConversacionConMensajes>>;
  esperar: (ms: number) => Promise<void>;
  ahora: () => number;
};

/** Pregunta hasta 5 veces (3 s de espera inicial, 4 s entre consultas). Si no hay respuesta, el turno se da por interrumpido. */
export async function recuperarTurno(d: DependenciasDeRecuperacion, p: { conversacionId: string | null; turnoId: string }): Promise<Exclude<Recuperacion, { tipo: 'seguir' }>> {
  // Sin conversación no hay dónde mirar: el turno nunca llegó a empezar.
  if (!p.conversacionId) return { tipo: 'interrumpido', texto: '' };
  await d.esperar(ESPERA_INICIAL_MS);
  for (let i = 0; i < MAXIMO_DE_CONSULTAS; i++) {
    const r = await d.consultar(p.conversacionId);
    if (r.ok && 'datos' in r) {
      const decision = decidirRecuperacion(r.datos.mensajes, p.turnoId, d.ahora());
      if (decision.tipo !== 'seguir') return decision;
    }
    if (i < MAXIMO_DE_CONSULTAS - 1) await d.esperar(ESPERA_ENTRE_CONSULTAS_MS);
  }
  return { tipo: 'interrumpido', texto: '' };
}
