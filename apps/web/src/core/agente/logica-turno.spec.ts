import type { EventoDelAgente, MensajeDelAgente } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import type { ElementoDeHilo } from './logica-hilo.ts';
import { aplicarDetencion, aplicarEvento, aplicarRecuperacion, decidirRecuperacion, idDelAgente, limpiarParaReintentar, MS_PARA_DAR_POR_INTERRUMPIDO, puedeReintentar } from './logica-turno.ts';

const T = '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c0d';
const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';
const aplicar = (hilo: readonly ElementoDeHilo[], ...eventos: EventoDelAgente[]) => eventos.reduce<ElementoDeHilo[]>((h, e) => aplicarEvento(h, e, T), [...hilo]);
const inicio: EventoDelAgente = { type: 'inicio', conversacionId: ID, turnoId: T, modelo: 'm' };
const texto = (delta: string): EventoDelAgente => ({ type: 'texto', delta });

describe('aplicarEvento', () => {
  it('«inicio» abre la burbuja del asistente, vacía y escribiendo', () => {
    expect(aplicar([], inicio)).toEqual([{ id: idDelAgente(T), tipo: 'agente', texto: '', estado: 'escribiendo' }]);
  });

  it('el texto se va sumando en la misma burbuja', () => {
    const h = aplicar([], inicio, texto('Hola, '), texto('Moisés.'));
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ tipo: 'agente', texto: 'Hola, Moisés.', estado: 'escribiendo' });
  });

  it('un texto sin «inicio» previo crea la burbuja igual', () => {
    expect(aplicar([], texto('x'))[0]).toMatchObject({ tipo: 'agente', texto: 'x' });
  });

  it('«fin» cierra la burbuja como completa, o como interrumpida', () => {
    expect(aplicar([], inicio, texto('x'), { type: 'fin', mensajeId: ID, estado: 'completo' })[0]).toMatchObject({ estado: 'completo' });
    expect(aplicar([], inicio, texto('x'), { type: 'fin', mensajeId: ID, estado: 'interrumpido' })[0]).toMatchObject({ estado: 'interrumpido' });
  });

  it('una herramienta aparece «en curso» y luego «lista» con su nota, sin datos', () => {
    const h = aplicar([], inicio, { type: 'herramienta_inicio', id: 'c1', nombre: 'pedidos_listar', titulo: 'Ver pedidos' }, { type: 'herramienta_fin', id: 'c1', ok: true, nota: '12 resultados' });
    expect(h.find((e) => e.tipo === 'herramienta')).toEqual({ id: 'herramienta-c1', tipo: 'herramienta', titulo: 'Ver pedidos', estado: 'listo', nota: '12 resultados' });
  });

  it('una herramienta que falló queda «fallo»', () => {
    const h = aplicar([], { type: 'herramienta_inicio', id: 'c1', nombre: 'x', titulo: 'X' }, { type: 'herramienta_fin', id: 'c1', ok: false, nota: 'sin permiso' });
    expect(h[0]).toMatchObject({ estado: 'fallo', nota: 'sin permiso' });
  });

  it('un borrador propuesto aparece como tarjeta sin resolver', () => {
    const borrador = { id: 'b1', herramienta: 'movimiento_registrar', resumen: 'Ingreso', args: {}, sugerencias: [] };
    expect(aplicar([], { type: 'borrador', borrador, critica: false })[0]).toEqual({ id: 'borrador-b1', tipo: 'borrador', propuesta: borrador, resuelto: null });
  });

  it('una acción hecha se avisa con su título', () => {
    expect(aplicar([], { type: 'accion', herramienta: 'pedido_editar', titulo: 'Editar pedido', entidadTipo: 'pedido', entidadId: ID })[0]).toMatchObject({ tipo: 'aviso', tono: 'info', texto: 'Hecho: Editar pedido.' });
  });

  it('el uso no cambia el hilo', () => {
    const h = aplicar([], inicio, texto('x'));
    expect(aplicarEvento(h, { type: 'uso', modelo: 'm', tokensEntrada: 1, tokensSalida: 1, tokensCache: 0, costoMicrousd: 5, rondas: 1, duracionMs: 10 }, T)).toEqual(h);
  });

  it('un error deja un aviso con el mensaje del servidor y quita la burbuja si estaba vacía', () => {
    const h = aplicar([], inicio, { type: 'error', motivo: 'modelo_no_disponible', mensaje: 'El modelo no está disponible.' });
    expect(h).toEqual([{ id: `error-${T}`, tipo: 'aviso', tono: 'error', texto: 'El modelo no está disponible.' }]);
  });

  it('un error con texto ya escrito conserva la burbuja, marcada como error', () => {
    const h = aplicar([], inicio, texto('Voy a'), { type: 'error', motivo: 'interno', mensaje: 'Falló.' });
    expect(h[0]).toMatchObject({ tipo: 'agente', texto: 'Voy a', estado: 'error' });
    expect(h[1]).toMatchObject({ tipo: 'aviso', tono: 'error' });
  });

  it('al terminar, ninguna herramienta queda «en curso»', () => {
    const abierta = { type: 'herramienta_inicio', id: 'c1', nombre: 'x', titulo: 'X' } as const;
    expect(aplicar([], inicio, abierta, { type: 'fin', mensajeId: ID, estado: 'completo' }).find((e) => e.tipo === 'herramienta')).toMatchObject({ estado: 'listo' });
    expect(aplicar([], inicio, abierta, { type: 'error', motivo: 'interno', mensaje: 'x' }).find((e) => e.tipo === 'herramienta')).toMatchObject({ estado: 'fallo' });
  });

  it('un segundo error del mismo turno reemplaza al primero, no se duplica', () => {
    const h = aplicar([], inicio, { type: 'error', motivo: 'interno', mensaje: 'uno' }, { type: 'error', motivo: 'interno', mensaje: 'dos' });
    expect(h.filter((e) => e.tipo === 'aviso')).toHaveLength(1);
    expect(h.find((e) => e.tipo === 'aviso')).toMatchObject({ texto: 'dos' });
  });

  it('no muta el hilo recibido', () => {
    const antes: ElementoDeHilo[] = [{ id: 'a', tipo: 'persona', texto: 'x' }];
    aplicarEvento(antes, inicio, T);
    expect(antes).toHaveLength(1);
  });
});

describe('puedeReintentar', () => {
  it('no se ofrece con el tope alcanzado ni con el asistente apagado', () => {
    expect(puedeReintentar('tope_mensual')).toBe(false);
    expect(puedeReintentar('apagado')).toBe(false);
  });
  it('se ofrece con los fallos pasajeros', () => {
    for (const m of ['interno', 'modelo_no_disponible', 'tiempo_agotado', 'limite_de_ritmo', 'turno_en_curso'] as const) expect(puedeReintentar(m), m).toBe(true);
  });
});

describe('decidirRecuperacion', () => {
  const AHORA = Date.parse('2026-11-24T15:00:00Z');
  const mensaje = (o: Partial<MensajeDelAgente> = {}): MensajeDelAgente => ({ id: ID, turnoId: T, rol: 'agente', estado: 'en_curso', contenido: '', metadatos: {}, creadoEn: new Date(AHORA - 10_000).toISOString(), ...o });

  it('si el turno terminó en el servidor, se pinta lo guardado', () => {
    expect(decidirRecuperacion([mensaje({ estado: 'completo', contenido: 'Listo.' })], T, AHORA)).toEqual({ tipo: 'completo', texto: 'Listo.' });
  });
  it('si quedó interrumpido, se muestra lo que alcanzó a decir', () => {
    expect(decidirRecuperacion([mensaje({ estado: 'interrumpido', contenido: 'Voy a' })], T, AHORA)).toEqual({ tipo: 'interrumpido', texto: 'Voy a' });
  });
  it('si falló, es un error', () => {
    expect(decidirRecuperacion([mensaje({ estado: 'error' })], T, AHORA)).toEqual({ tipo: 'error' });
  });
  it('si sigue en curso y es reciente, se sigue esperando', () => {
    expect(decidirRecuperacion([mensaje()], T, AHORA)).toEqual({ tipo: 'seguir' });
  });
  it('si sigue «en curso» pero ya pasaron 150 s, se da por interrumpido', () => {
    const viejo = mensaje({ creadoEn: new Date(AHORA - MS_PARA_DAR_POR_INTERRUMPIDO).toISOString() });
    expect(decidirRecuperacion([viejo], T, AHORA).tipo).toBe('interrumpido');
    const casi = mensaje({ creadoEn: new Date(AHORA - MS_PARA_DAR_POR_INTERRUMPIDO + 1000).toISOString() });
    expect(decidirRecuperacion([casi], T, AHORA).tipo).toBe('seguir');
  });
  it('un mensaje de otro turno, o sin mensaje del asistente, no cuenta', () => {
    expect(decidirRecuperacion([mensaje({ turnoId: ID, estado: 'completo', contenido: 'otro' })], T, AHORA)).toEqual({ tipo: 'seguir' });
    expect(decidirRecuperacion([mensaje({ rol: 'persona', estado: 'completo' })], T, AHORA)).toEqual({ tipo: 'seguir' });
    expect(decidirRecuperacion([], T, AHORA)).toEqual({ tipo: 'seguir' });
  });
});

describe('aplicarRecuperacion', () => {
  const aMedias = aplicar([], inicio, texto('Voy a mir'), { type: 'herramienta_inicio', id: 'c1', nombre: 'x', titulo: 'X' });

  it('si el turno terminó, la respuesta guardada reemplaza a la que quedó a medias', () => {
    const h = aplicarRecuperacion(aMedias, { tipo: 'completo', texto: 'Voy a mirar. Hay 3 pedidos.' }, T);
    expect(h.find((e) => e.tipo === 'agente')).toMatchObject({ texto: 'Voy a mirar. Hay 3 pedidos.', estado: 'completo' });
    expect(h.find((e) => e.tipo === 'herramienta')).toMatchObject({ estado: 'listo' });
  });

  it('si se cortó, la burbuja queda interrumpida con un aviso; lo ya dicho se conserva', () => {
    const h = aplicarRecuperacion(aMedias, { tipo: 'interrumpido', texto: '' }, T);
    expect(h.find((e) => e.tipo === 'agente')).toMatchObject({ texto: 'Voy a mir', estado: 'interrumpido' });
    expect(h.at(-1)).toMatchObject({ tipo: 'aviso', texto: 'La respuesta se interrumpió.' });
  });

  it('si el servidor guardó más texto que el que llegó, se muestra el guardado', () => {
    expect(aplicarRecuperacion(aMedias, { tipo: 'interrumpido', texto: 'Voy a mirar los pedidos' }, T).find((e) => e.tipo === 'agente')).toMatchObject({ texto: 'Voy a mirar los pedidos' });
  });

  it('un error guardado se avisa como tal', () => {
    expect(aplicarRecuperacion(aMedias, { tipo: 'error' }, T).at(-1)).toMatchObject({ texto: 'No se pudo terminar la respuesta.' });
  });

  it('no deja avisos duplicados si se recupera dos veces', () => {
    const una = aplicarRecuperacion(aMedias, { tipo: 'interrumpido', texto: '' }, T);
    expect(aplicarRecuperacion(una, { tipo: 'interrumpido', texto: '' }, T).filter((e) => e.tipo === 'aviso')).toHaveLength(1);
  });
});

describe('aplicarDetencion y limpiarParaReintentar', () => {
  it('detener deja la respuesta interrumpida, con un aviso, y cierra las herramientas', () => {
    const h = aplicarDetencion(aplicar([], inicio, texto('Voy'), { type: 'herramienta_inicio', id: 'c1', nombre: 'x', titulo: 'X' }), T);
    expect(h.find((e) => e.tipo === 'agente')).toMatchObject({ estado: 'interrumpido', texto: 'Voy' });
    expect(h.find((e) => e.tipo === 'herramienta')).toMatchObject({ estado: 'fallo' });
    expect(h.at(-1)).toMatchObject({ texto: 'Detuviste la respuesta.' });
  });

  it('detener sin haber escrito nada quita la burbuja vacía', () => {
    expect(aplicarDetencion(aplicar([], inicio), T).some((e) => e.tipo === 'agente')).toBe(false);
  });

  it('reintentar quita el aviso del intento anterior pero deja la conversación', () => {
    const conError = aplicar([{ id: 'p', tipo: 'persona', texto: 'hola' }], inicio, { type: 'error', motivo: 'interno', mensaje: 'Falló.' });
    expect(limpiarParaReintentar(conError, T).map((e) => e.tipo)).toEqual(['persona']);
  });
});
