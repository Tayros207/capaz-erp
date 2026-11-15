import { describe, expect, it, vi } from 'vitest';
import type { Respuesta } from '@capaz/shared';
import type { EventoDelLlamador } from './estado-del-llamador.ts';
import { crearLlamadorEnSerie } from './llamar.ts';

const exito: Respuesta<unknown> = { ok: true, datos: 1, avisos: [] };
const caida: Respuesta<unknown> = { ok: false, error: { codigo: 'sin_conexion', mensaje: 'x' } };

function armar(enviar: (n: string, a: unknown, c: string | undefined, k: string) => Promise<Respuesta<unknown>>) {
  const eventos: EventoDelLlamador[] = [];
  let n = 0;
  const llamar = crearLlamadorEnSerie({
    enviar,
    anotar: (e) => eventos.push(e),
    nuevaClave: () => `clave-${++n}`,
    esperar: async () => undefined,
  });
  return { llamar, eventos };
}

describe('llamador en serie', () => {
  it('reintenta una caída de red con la MISMA clave de idempotencia', async () => {
    const enviar = vi.fn()
      .mockResolvedValueOnce(caida)
      .mockResolvedValueOnce(caida)
      .mockResolvedValueOnce(exito);
    const { llamar, eventos } = armar(enviar);
    expect(await llamar('x', { a: 1 })).toEqual(exito);
    expect(enviar.mock.calls.map((c) => c[3])).toEqual(['clave-1', 'clave-1', 'clave-1']);
    await Promise.resolve();
    expect(eventos).toEqual([{ tipo: 'salio' }, { tipo: 'termino', ok: true, sinConexion: false }]);
  });

  it('tras agotar los reintentos devuelve sin_conexion y lo anota', async () => {
    const { llamar, eventos } = armar(async () => caida);
    expect(await llamar('x')).toEqual(caida);
    await Promise.resolve();
    expect(eventos[1]).toEqual({ tipo: 'termino', ok: false, sinConexion: true });
  });

  it('no reintenta un rechazo del servidor', async () => {
    const no: Respuesta<unknown> = { ok: false, error: { codigo: 'sin_permiso', mensaje: 'No.' } };
    const enviar = vi.fn().mockResolvedValue(no);
    const { llamar } = armar(enviar);
    await llamar('x');
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('cada llamada nueva lleva su propia clave y salen de a una', async () => {
    const orden: string[] = [];
    const enviar = vi.fn(async (_n: string, a: unknown, _c: string | undefined, k: string) => {
      orden.push(`${String(a)}:${k}:inicio`);
      await new Promise((r) => setTimeout(r, 10));
      orden.push(`${String(a)}:fin`);
      return exito;
    });
    const { llamar } = armar(enviar);
    await Promise.all([llamar('x', 'a'), llamar('x', 'b')]);
    expect(orden).toEqual(['a:clave-1:inicio', 'a:fin', 'b:clave-2:inicio', 'b:fin']);
  });
});
