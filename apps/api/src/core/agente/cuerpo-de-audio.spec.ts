import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { esCuerpoDeAudio } from './cuerpo-de-audio.js';

const peticion = (method: string, url: string, tipo?: string) => ({ method, url, headers: tipo ? { 'content-type': tipo } : {} }) as unknown as IncomingMessage;

describe('esCuerpoDeAudio', () => {
  it('solo la ruta de transcripción, por POST y con JSON, usa el límite grande', () => {
    expect(esCuerpoDeAudio(peticion('POST', '/api/v1/agente/transcribir', 'application/json'))).toBe(true);
    expect(esCuerpoDeAudio(peticion('POST', '/api/v1/agente/transcribir?x=1', 'application/json; charset=utf-8'))).toBe(true);
  });
  it('cualquier otra ruta, método o tipo sigue con el límite de siempre', () => {
    expect(esCuerpoDeAudio(peticion('POST', '/api/v1/agente/turno', 'application/json'))).toBe(false);
    expect(esCuerpoDeAudio(peticion('POST', '/api/v1/agente/transcribir/otra', 'application/json'))).toBe(false);
    expect(esCuerpoDeAudio(peticion('PUT', '/api/v1/agente/transcribir', 'application/json'))).toBe(false);
    expect(esCuerpoDeAudio(peticion('POST', '/api/v1/agente/transcribir', 'text/plain'))).toBe(false);
    expect(esCuerpoDeAudio(peticion('POST', '/api/v1/agente/transcribir'))).toBe(false);
  });
});
