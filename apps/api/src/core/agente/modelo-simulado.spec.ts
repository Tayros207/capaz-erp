import { describe, expect, it } from 'vitest';
import { guion, ModeloSimulado } from './modelo-simulado.js';
import type { PeticionDeModelo, TrozoDeModelo } from './modelo-de-chat.js';

const peticion = (o: Partial<PeticionDeModelo> = {}): PeticionDeModelo => ({ modelo: 'simulado/uno', mensajes: [{ role: 'user', content: 'hola' }], herramientas: [], senal: new AbortController().signal, sesion: 's', ...o });
const leer = async (m: ModeloSimulado, p = peticion()) => {
  const salida: TrozoDeModelo[] = [];
  for await (const t of m.conversar(p)) salida.push(t);
  return salida;
};

describe('ModeloSimulado', () => {
  it('cada llamada consume la siguiente ronda del guion', async () => {
    const m = new ModeloSimulado().programar([guion.respuesta('uno'), guion.respuesta('dos')]);
    expect((await leer(m))[0]).toEqual({ tipo: 'texto', delta: 'uno' });
    expect((await leer(m))[0]).toEqual({ tipo: 'texto', delta: 'dos' });
  });

  it('sin guion responde algo inofensivo y no se cuelga', async () => {
    const trozos = await leer(new ModeloSimulado());
    expect(trozos.at(-1)).toMatchObject({ tipo: 'fin', motivo: 'stop' });
  });

  it('guarda lo que recibió para que la prueba lo revise', async () => {
    const m = new ModeloSimulado().programar([guion.respuesta('x')]);
    await leer(m, peticion({ modelo: 'otro/modelo' }));
    expect(m.peticiones).toHaveLength(1);
    expect(m.peticiones[0]?.modelo).toBe('otro/modelo');
  });

  it('puede lanzar un fallo programado una sola vez', async () => {
    const m = new ModeloSimulado().programar([guion.respuesta('x')]).programarFallo(new Error('boom'));
    await expect(leer(m)).rejects.toThrow('boom');
    expect((await leer(m))[0]).toMatchObject({ tipo: 'texto' });
  });

  it('un guion de llamada a herramienta trae los argumentos como texto JSON', async () => {
    const m = new ModeloSimulado().programar([[guion.llamar('c1', 'pedidos_listar', { limite: 5 })]]);
    const fin = (await leer(m)).at(-1);
    expect(fin).toMatchObject({ tipo: 'fin', motivo: 'tool_calls', llamadas: [{ id: 'c1', function: { name: 'pedidos_listar', arguments: '{"limite":5}' } }] });
  });

  it('se detiene si la señal ya se abortó', async () => {
    const c = new AbortController();
    c.abort();
    expect(await leer(new ModeloSimulado().programar([guion.respuesta('x')]), peticion({ senal: c.signal }))).toEqual([]);
  });
});
