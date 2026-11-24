import type { ConversacionDelAgente, MensajeDelAgente } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { agruparConversaciones, filtrarPorTitulo, mensajesAHilo } from './logica-historial.ts';

const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';
const T = '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c0d';
// 24 de noviembre de 2026, 15:00 en Lima.
const AHORA = new Date('2026-11-24T20:00:00Z');
const conv = (titulo: string, actualizadoEn: string, favorita = false): ConversacionDelAgente => ({ id: `${titulo}-id`, titulo, favorita, actualizadoEn });

describe('agruparConversaciones', () => {
  it('reparte en Hoy, Ayer, Esta semana y Anteriores, en ese orden, sin grupos vacíos', () => {
    const g = agruparConversaciones([
      conv('hoy', '2026-11-24T18:00:00Z'), conv('ayer', '2026-11-23T18:00:00Z'), conv('semana', '2026-11-20T18:00:00Z'), conv('vieja', '2026-11-01T18:00:00Z'),
    ], AHORA);
    expect(g.map((x) => [x.titulo, x.items.map((i) => i.titulo)])).toEqual([['Hoy', ['hoy']], ['Ayer', ['ayer']], ['Esta semana', ['semana']], ['Anteriores', ['vieja']]]);
  });

  it('las favoritas van arriba, aunque sean viejas', () => {
    const g = agruparConversaciones([conv('normal', '2026-11-24T18:00:00Z'), conv('fija', '2026-09-01T18:00:00Z', true)], AHORA);
    expect(g.map((x) => x.titulo)).toEqual(['Favoritas', 'Hoy']);
    expect(g[0]?.items[0]?.titulo).toBe('fija');
  });

  it('«hoy» se cuenta en la zona de la empresa: las 23:30 de Lima del 23 ya son «ayer», aunque en UTC sea el 24', () => {
    const g = agruparConversaciones([conv('tarde', '2026-11-24T04:30:00Z')], AHORA);
    expect(g[0]?.titulo).toBe('Ayer');
  });

  it('el límite de la semana: 6 días atrás todavía es «esta semana», 7 ya es «anteriores»', () => {
    const g = agruparConversaciones([conv('seis', '2026-11-18T18:00:00Z'), conv('siete', '2026-11-17T18:00:00Z')], AHORA);
    expect(g.map((x) => [x.titulo, x.items[0]?.titulo])).toEqual([['Esta semana', 'seis'], ['Anteriores', 'siete']]);
  });

  it('conserva el orden recibido dentro de cada grupo y una lista vacía no da grupos', () => {
    expect(agruparConversaciones([conv('b', '2026-11-24T19:00:00Z'), conv('a', '2026-11-24T10:00:00Z')], AHORA)[0]?.items.map((i) => i.titulo)).toEqual(['b', 'a']);
    expect(agruparConversaciones([], AHORA)).toEqual([]);
  });

  it('una fecha futura (reloj desfasado) se cuenta como hoy', () => {
    expect(agruparConversaciones([conv('futuro', '2026-11-25T20:00:00Z')], AHORA)[0]?.titulo).toBe('Hoy');
  });
});

describe('filtrarPorTitulo', () => {
  const items = [conv('Pedidos de Cristina', '2026-11-24T18:00:00Z'), conv('Cuánto me debe Rosa', '2026-11-24T18:00:00Z')];
  it('busca sin distinguir mayúsculas ni tildes', () => {
    expect(filtrarPorTitulo(items, 'cuanto').map((i) => i.titulo)).toEqual(['Cuánto me debe Rosa']);
    expect(filtrarPorTitulo(items, 'PEDIDOS').map((i) => i.titulo)).toEqual(['Pedidos de Cristina']);
  });
  it('una búsqueda vacía o de solo espacios no filtra', () => {
    expect(filtrarPorTitulo(items, '')).toHaveLength(2);
    expect(filtrarPorTitulo(items, '   ')).toHaveLength(2);
  });
  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filtrarPorTitulo(items, 'zzz')).toEqual([]);
  });
});

describe('mensajesAHilo', () => {
  const msg = (o: Partial<MensajeDelAgente>): MensajeDelAgente => ({ id: ID, turnoId: T, rol: 'agente', estado: 'completo', contenido: '', metadatos: {}, creadoEn: '2026-11-24T18:00:00Z', ...o });

  it('vuelve a pintar la pregunta y la respuesta', () => {
    const h = mensajesAHilo([msg({ id: 'p1', rol: 'persona', contenido: 'Hola' }), msg({ id: 'a1', contenido: 'Buenas.' })]);
    expect(h).toEqual([{ id: 'persona-p1', tipo: 'persona', texto: 'Hola' }, { id: `agente-${T}`, tipo: 'agente', texto: 'Buenas.', estado: 'completo' }]);
  });

  it('lo que el asistente hizo y propuso sale como líneas, con el enlace a la Bandeja', () => {
    const h = mensajesAHilo([msg({ contenido: 'Listo.', metadatos: { acciones: [{ titulo: 'Crear cliente' }], borradores: [{ resumen: 'Ingreso de S/ 500' }] } })]);
    expect(h.map((e) => e.tipo)).toEqual(['agente', 'aviso', 'aviso']);
    expect(h[1]).toMatchObject({ texto: 'Hecho: Crear cliente.' });
    expect(h[2]).toMatchObject({ texto: 'Propuso: Ingreso de S/ 500. Falta aprobarlo.', enlace: { ruta: '/bandeja' } });
  });

  it('una respuesta que quedó «en curso» o interrumpida se muestra como interrumpida', () => {
    expect(mensajesAHilo([msg({ estado: 'en_curso', contenido: 'Voy a' })])[0]).toMatchObject({ estado: 'interrumpido' });
    expect(mensajesAHilo([msg({ estado: 'error', contenido: 'x' })])[0]).toMatchObject({ estado: 'error' });
  });

  it('una respuesta cortada sin texto ni hechos deja un aviso en lugar de una burbuja vacía', () => {
    expect(mensajesAHilo([msg({ estado: 'interrumpido', contenido: '' })])).toEqual([{ id: `cortada-${ID}`, tipo: 'aviso', tono: 'aviso', texto: 'La respuesta se interrumpió.' }]);
  });

  it('una respuesta completa sin texto no deja nada vacío', () => {
    expect(mensajesAHilo([msg({ contenido: '' })])).toEqual([]);
  });

  it('lee con tolerancia: metadatos raros no rompen', () => {
    expect(() => mensajesAHilo([msg({ contenido: 'x', metadatos: { acciones: 'no', borradores: [null, 5, { resumen: 7 }] } })])).not.toThrow();
    expect(mensajesAHilo([msg({ contenido: 'x', metadatos: { acciones: 'no', borradores: [null, 5, { resumen: 7 }] } })])).toHaveLength(1);
  });
});
