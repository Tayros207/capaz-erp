import { firstValueFrom, lastValueFrom, take, timeout, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { ContextoDePeticion } from '../../infra/http/contexto.js';
import { ServicioDeTurnos } from './servicio-de-turnos.js';

// El rechazo inmediato (asistente apagado) se emite ANTES de que Nest se suscriba al flujo. Con un sujeto simple se perdía y el
// latido no terminaba nunca. Esta prueba no necesita base de datos: el rechazo sale antes de tocarla.

const ctx = (o: Partial<ContextoDePeticion> = {}): ContextoDePeticion => ({
  requestId: 'r', empresaId: 'e1', usuarioId: 'u1', rol: 'member', permisos: [],
  modulos: [{ codigo: 'registro', motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null }], canal: 'ui', ...o,
});
const cuerpo = { turnoId: '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c01', mensaje: 'hola', origen: 'texto' as const };
const sinUsar = undefined as never;

function servicio(proveedor: 'apagado' | 'simulado'): ServicioDeTurnos {
  return new ServicioDeTurnos({ AGENTE_PROVEEDOR: proveedor } as never, sinUsar, sinUsar, sinUsar, sinUsar, sinUsar, { error: () => undefined } as never);
}

describe('ServicioDeTurnos.iniciar con el asistente apagado', () => {
  it('quien se suscribe DESPUÉS del rechazo igual lo recibe, y el flujo termina', async () => {
    const flujo = servicio('apagado').iniciar(ctx(), cuerpo);
    await new Promise((r) => setTimeout(r, 20)); // el rechazo ya se emitió antes de suscribirse
    const eventos = await lastValueFrom(flujo.pipe(toArray(), timeout(2_000)));
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ type: 'error', data: { type: 'error', motivo: 'apagado' } });
  });

  it('quien se suscribe antes también lo recibe y el flujo termina (sin latidos colgados)', async () => {
    const eventos = await lastValueFrom(servicio('apagado').iniciar(ctx(), cuerpo).pipe(toArray(), timeout(2_000)));
    expect(eventos.map((e) => e.type)).toEqual(['error']);
  });

  it('sin ningún módulo al que entrar, el motivo es el mismo y el mensaje lo explica', async () => {
    const e = await firstValueFrom(servicio('simulado').iniciar(ctx({ modulos: [] }), cuerpo).pipe(take(1), timeout(2_000)));
    expect(e.data).toMatchObject({ type: 'error', motivo: 'apagado', mensaje: expect.stringContaining('ningún módulo') });
  });

  it('el mensaje de la persona no se guarda ni se llama a nadie: no hay base ni modelo', async () => {
    // Los colaboradores son `undefined`: si el servicio los tocara, esta prueba reventaría.
    await expect(lastValueFrom(servicio('apagado').iniciar(ctx(), cuerpo).pipe(toArray(), timeout(2_000)))).resolves.toBeDefined();
  });

  it('un contexto sin empresa o sin persona falla de inmediato, antes de abrir ningún flujo', () => {
    expect(() => servicio('apagado').iniciar(ctx({ empresaId: null }), cuerpo)).toThrow();
    expect(() => servicio('apagado').iniciar(ctx({ usuarioId: null }), cuerpo)).toThrow();
  });
});
