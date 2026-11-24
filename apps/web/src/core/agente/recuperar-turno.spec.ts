import { exito, rechazo, type ConversacionConMensajes, type MensajeDelAgente, type Respuesta } from '@capaz/shared';
import { describe, expect, it, vi } from 'vitest';
import { ESPERA_ENTRE_CONSULTAS_MS, ESPERA_INICIAL_MS, MAXIMO_DE_CONSULTAS } from './logica-turno.ts';
import { recuperarTurno } from './recuperar-turno.ts';

const T = '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c0d';
const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';
const AHORA = Date.parse('2026-11-24T15:00:00Z');
const mensaje = (o: Partial<MensajeDelAgente>): MensajeDelAgente => ({ id: ID, turnoId: T, rol: 'agente', estado: 'en_curso', contenido: '', metadatos: {}, creadoEn: new Date(AHORA - 5_000).toISOString(), ...o });
const conversacion = (...mensajes: MensajeDelAgente[]): Respuesta<ConversacionConMensajes> => exito({ id: ID, titulo: 't', favorita: false, actualizadoEn: new Date(AHORA).toISOString(), mensajes });

function montar(respuestas: Respuesta<ConversacionConMensajes>[]) {
  const esperas: number[] = [];
  let i = 0;
  const consultar = vi.fn(async () => respuestas[Math.min(i++, respuestas.length - 1)]!);
  return { esperas, consultar, d: { consultar, esperar: async (ms: number) => { esperas.push(ms); }, ahora: () => AHORA } };
}

describe('recuperarTurno', () => {
  it('espera 3 s y, si el turno ya terminó en el servidor, entrega lo guardado', async () => {
    const t = montar([conversacion(mensaje({ estado: 'completo', contenido: 'Listo.' }))]);
    expect(await recuperarTurno(t.d, { conversacionId: ID, turnoId: T })).toEqual({ tipo: 'completo', texto: 'Listo.' });
    expect(t.esperas).toEqual([ESPERA_INICIAL_MS]);
    expect(t.consultar).toHaveBeenCalledTimes(1);
  });

  it('si sigue en curso, vuelve a preguntar cada 4 s hasta que termina', async () => {
    const t = montar([conversacion(mensaje({})), conversacion(mensaje({})), conversacion(mensaje({ estado: 'completo', contenido: 'Ya.' }))]);
    expect(await recuperarTurno(t.d, { conversacionId: ID, turnoId: T })).toEqual({ tipo: 'completo', texto: 'Ya.' });
    expect(t.esperas).toEqual([ESPERA_INICIAL_MS, ESPERA_ENTRE_CONSULTAS_MS, ESPERA_ENTRE_CONSULTAS_MS]);
  });

  it('pregunta como máximo 5 veces y, si nunca hay respuesta, da el turno por interrumpido', async () => {
    const t = montar([conversacion(mensaje({}))]);
    expect(await recuperarTurno(t.d, { conversacionId: ID, turnoId: T })).toEqual({ tipo: 'interrumpido', texto: '' });
    expect(t.consultar).toHaveBeenCalledTimes(MAXIMO_DE_CONSULTAS);
    expect(t.esperas).toHaveLength(MAXIMO_DE_CONSULTAS); // la espera inicial y cuatro entre consultas
  });

  it('un fallo de red en una consulta no corta la recuperación', async () => {
    const t = montar([rechazo('sin_conexion', 'sin red'), conversacion(mensaje({ estado: 'completo', contenido: 'Volvió.' }))]);
    expect(await recuperarTurno(t.d, { conversacionId: ID, turnoId: T })).toEqual({ tipo: 'completo', texto: 'Volvió.' });
  });

  it('un turno que quedó interrumpido o con error se informa tal cual', async () => {
    expect((await recuperarTurno(montar([conversacion(mensaje({ estado: 'interrumpido', contenido: 'Voy a' }))]).d, { conversacionId: ID, turnoId: T }))).toEqual({ tipo: 'interrumpido', texto: 'Voy a' });
    expect((await recuperarTurno(montar([conversacion(mensaje({ estado: 'error' }))]).d, { conversacionId: ID, turnoId: T }))).toEqual({ tipo: 'error' });
  });

  it('sin conversación conocida no consulta nada: el turno nunca llegó a empezar', async () => {
    const t = montar([conversacion()]);
    expect(await recuperarTurno(t.d, { conversacionId: null, turnoId: T })).toEqual({ tipo: 'interrumpido', texto: '' });
    expect(t.consultar).not.toHaveBeenCalled();
    expect(t.esperas).toEqual([]);
  });
});
