import type { EventoDelAgente } from '@capaz/shared';
import { describe, expect, it, vi } from 'vitest';
import { analizarBloques, enviarTurno, eventoDeBloque } from './transporte-sse.ts';

const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';
const OTRO = '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c0d';
const enc = new TextEncoder();
const bloque = (e: EventoDelAgente) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
const inicio: EventoDelAgente = { type: 'inicio', conversacionId: ID, turnoId: OTRO, modelo: 'm' };
const texto = (delta: string): EventoDelAgente => ({ type: 'texto', delta });
const fin: EventoDelAgente = { type: 'fin', mensajeId: ID, estado: 'completo' };

function flujo(...trozos: string[]): Response {
  return new Response(new ReadableStream<Uint8Array>({ start(c) { for (const t of trozos) c.enqueue(enc.encode(t)); c.close(); } }), { status: 200 });
}
const turno = { turnoId: OTRO, mensaje: 'hola' };
async function correr(respuesta: Response | Error, senal = new AbortController().signal) {
  const eventos: EventoDelAgente[] = [];
  const f = vi.fn<typeof fetch>(async () => { if (respuesta instanceof Error) throw respuesta; return respuesta; });
  const resultado = await enviarTurno(turno, (e) => eventos.push(e), senal, f);
  return { resultado, eventos, f };
}

describe('analizarBloques', () => {
  it('separa los bloques completos y deja lo que quedó a medias', () => {
    const r = analizarBloques('event: a\ndata: 1\n\nevent: b\ndata: 2\n\nevent: c\ndata: 3');
    expect(r.bloques).toEqual([{ nombre: 'a', datos: '1' }, { nombre: 'b', datos: '2' }]);
    expect(r.resto).toBe('event: c\ndata: 3');
  });
  it('salta los comentarios de latido', () => {
    expect(analizarBloques(': latido\n\nevent: a\ndata: 1\n\n').bloques).toEqual([{ nombre: 'a', datos: '1' }]);
  });
  it('acepta saltos de línea de Windows', () => {
    expect(analizarBloques('event: a\r\ndata: 1\r\n\r\n').bloques).toEqual([{ nombre: 'a', datos: '1' }]);
  });
  it('une varias líneas data de un mismo bloque', () => {
    expect(analizarBloques('data: uno\ndata: dos\n\n').bloques).toEqual([{ nombre: null, datos: 'uno\ndos' }]);
  });
  it('un bloque sin datos no produce nada', () => {
    expect(analizarBloques('event: solo-nombre\n\n').bloques).toEqual([]);
  });
});

describe('eventoDeBloque', () => {
  it('lee un evento válido', () => {
    expect(eventoDeBloque({ nombre: 'texto', datos: JSON.stringify(texto('hola')) })).toEqual(texto('hola'));
  });
  it('ignora lo que no es JSON y lo que no cumple el contrato', () => {
    expect(eventoDeBloque({ nombre: null, datos: '{roto' })).toBeNull();
    expect(eventoDeBloque({ nombre: null, datos: '{"type":"magia"}' })).toBeNull();
    expect(eventoDeBloque({ nombre: null, datos: '{"type":"texto","delta":42}' })).toBeNull();
  });
});

describe('enviarTurno', () => {
  it('entrega los eventos en orden y termina en «fin»', async () => {
    const { resultado, eventos } = await correr(flujo(bloque(inicio), bloque(texto('Hola')), bloque(fin)));
    expect(resultado).toBe('fin');
    expect(eventos).toEqual([inicio, texto('Hola'), fin]);
  });

  it('aguanta que la red parta un bloque por la mitad', async () => {
    const todo = bloque(inicio) + bloque(texto('Hola, Moisés')) + bloque(fin);
    const trozos = [todo.slice(0, 20), todo.slice(20, 75), todo.slice(75)];
    const { resultado, eventos } = await correr(flujo(...trozos));
    expect(resultado).toBe('fin');
    expect(eventos.map((e) => e.type)).toEqual(['inicio', 'texto', 'fin']);
  });

  it('manda el cuerpo como JSON a la ruta del turno, con las cookies del sitio', async () => {
    const { f } = await correr(flujo(bloque(fin)));
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('/api/v1/agente/turno');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    expect(JSON.parse(String(init!.body))).toEqual(turno);
  });

  it('un evento «error» termina en «error» y se entrega', async () => {
    const error: EventoDelAgente = { type: 'error', motivo: 'tope_mensual', mensaje: 'Se alcanzó el tope de uso de este mes.' };
    const { resultado, eventos } = await correr(flujo(bloque(error)));
    expect(resultado).toBe('error');
    expect(eventos).toEqual([error]);
  });

  it('si el flujo se cierra sin «fin» ni «error», queda «cortado» y se conserva lo ya recibido', async () => {
    const { resultado, eventos } = await correr(flujo(bloque(inicio), bloque(texto('Voy a'))));
    expect(resultado).toBe('cortado');
    expect(eventos.map((e) => e.type)).toEqual(['inicio', 'texto']);
  });

  it('un flujo que se rompe a mitad queda «cortado», no lanza', async () => {
    // Como en una red real: primero llega lo que llegó, y la caída se nota en la lectura siguiente.
    let lecturas = 0;
    const cuerpo = new ReadableStream<Uint8Array>({
      pull(c) {
        if (lecturas++ === 0) c.enqueue(enc.encode(bloque(inicio)));
        else c.error(new TypeError('red caída'));
      },
    });
    const { resultado, eventos } = await correr(new Response(cuerpo, { status: 200 }));
    expect(resultado).toBe('cortado');
    expect(eventos).toEqual([inicio]);
  });

  it('ignora los eventos raros y los latidos sin romper el turno', async () => {
    const { resultado, eventos } = await correr(flujo(': latido\n\n', 'event: x\ndata: {roto\n\n', bloque(texto('ok')), bloque(fin)));
    expect(resultado).toBe('fin');
    expect(eventos).toEqual([texto('ok'), fin]);
  });

  it('si el servidor rechaza antes de empezar (400, 401, 403), lo cuenta como un error con mensaje en español', async () => {
    for (const [estado, parte] of [[401, 'sesión'], [403, 'permiso'], [400, 'No se pudo enviar']] as const) {
      const { resultado, eventos } = await correr(new Response('{"ok":false}', { status: estado }));
      expect(resultado, String(estado)).toBe('error');
      expect(eventos).toHaveLength(1);
      expect((eventos[0] as { mensaje: string }).mensaje).toContain(parte);
    }
  });

  it('sin conexión (fetch falla) avisa que el mensaje sigue ahí', async () => {
    const { resultado, eventos } = await correr(new TypeError('Failed to fetch'));
    expect(resultado).toBe('error');
    expect((eventos[0] as { mensaje: string }).mensaje).toContain('Tu mensaje sigue aquí');
  });

  it('si la persona cancela, queda «cortado» y no se muestra como error de red', async () => {
    const c = new AbortController();
    c.abort();
    const { resultado, eventos } = await correr(new DOMException('abortado', 'AbortError'), c.signal);
    expect(resultado).toBe('cortado');
    expect(eventos).toEqual([]);
  });
});
