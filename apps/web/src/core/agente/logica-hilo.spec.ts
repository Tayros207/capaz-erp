import type { CapturaPropuesta } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { reducirHilo, SUGERENCIAS_INICIALES, type ElementoDeHilo } from './logica-hilo.ts';

const borrador = (id: string): CapturaPropuesta['borradores'][number] => ({ id, herramienta: 'movimiento_registrar', resumen: `Resumen ${id}`, args: {}, sugerencias: [] });
const propuesta = (p: Partial<CapturaPropuesta>): CapturaPropuesta => ({ borradores: [], faltan: [], pista: null, interpretadoCon: 'reglas', ...p });

describe('reducirHilo', () => {
  it('persona_envia añade el mensaje de la persona al final', () => {
    const hilo = reducirHilo([], { tipo: 'persona_envia', id: 'm1', texto: 'Ingreso 500' });
    expect(hilo).toEqual([{ id: 'm1', tipo: 'persona', texto: 'Ingreso 500' }]);
  });

  it('no modifica el hilo anterior', () => {
    const antes: ElementoDeHilo[] = [{ id: 'a', tipo: 'persona', texto: 'x' }];
    reducirHilo(antes, { tipo: 'persona_envia', id: 'b', texto: 'y' });
    expect(antes).toHaveLength(1);
  });

  it('captura_respondio con un borrador pinta una tarjeta sin resolver', () => {
    const hilo = reducirHilo([], { tipo: 'captura_respondio', id: 'c1', propuesta: propuesta({ borradores: [borrador('b1')] }) });
    expect(hilo).toHaveLength(1);
    expect(hilo[0]).toMatchObject({ tipo: 'borrador', resuelto: null, propuesta: { id: 'b1' } });
  });

  it('con dos borradores pinta dos tarjetas con ids distintos', () => {
    const hilo = reducirHilo([], { tipo: 'captura_respondio', id: 'c1', propuesta: propuesta({ borradores: [borrador('b1'), borrador('b2')] }) });
    expect(hilo.map((e) => e.tipo)).toEqual(['borrador', 'borrador']);
    expect(new Set(hilo.map((e) => e.id)).size).toBe(2);
  });

  it('sin propuestas deja un aviso con lo que falta y la pista', () => {
    const hilo = reducirHilo([], { tipo: 'captura_respondio', id: 'c1', propuesta: propuesta({ faltan: ['el monto'], pista: 'Prueba diciendo el monto.' }) });
    expect(hilo).toHaveLength(1);
    expect(hilo[0]).toMatchObject({ tipo: 'aviso', tono: 'aviso' });
    const texto = (hilo[0] as { texto: string }).texto;
    expect(texto).toContain('No pude armar un registro con eso.');
    expect(texto).toContain('el monto');
    expect(texto).toContain('Prueba diciendo el monto.');
  });

  it('sin propuestas ni pistas el aviso es solo el mensaje base', () => {
    const hilo = reducirHilo([], { tipo: 'captura_respondio', id: 'c1', propuesta: propuesta({}) });
    expect(hilo).toEqual([{ id: 'c1-sin-registro', tipo: 'aviso', tono: 'aviso', texto: 'No pude armar un registro con eso.' }]);
  });

  it('con propuestas y faltantes añade un aviso «Revisa»', () => {
    const hilo = reducirHilo([], { tipo: 'captura_respondio', id: 'c1', propuesta: propuesta({ borradores: [borrador('b1')], faltan: ['el cliente', 'la fecha'] }) });
    expect(hilo.map((e) => e.tipo)).toEqual(['borrador', 'aviso']);
    expect((hilo[1] as { texto: string }).texto).toBe('Revisa: el cliente, la fecha.');
  });

  it('aviso conserva el enlace solo si lo hay', () => {
    const con = reducirHilo([], { tipo: 'aviso', id: 'x', tono: 'info', texto: 't', enlace: { texto: 'Ver', ruta: '/precios' } });
    const sin = reducirHilo([], { tipo: 'aviso', id: 'y', tono: 'error', texto: 't' });
    expect(con[0]).toMatchObject({ enlace: { texto: 'Ver', ruta: '/precios' } });
    expect(sin[0]).not.toHaveProperty('enlace');
  });

  it('resolver un borrador no toca al otro', () => {
    const base = reducirHilo([], { tipo: 'captura_respondio', id: 'c1', propuesta: propuesta({ borradores: [borrador('b1'), borrador('b2')] }) });
    const hilo = reducirHilo(base, { tipo: 'borrador_resuelto', borradorId: 'b1', resolucion: 'aprobado' });
    expect(hilo[0]).toMatchObject({ resuelto: 'aprobado' });
    expect(hilo[1]).toMatchObject({ resuelto: null });
  });

  it('resolver un id que no existe deja el hilo igual', () => {
    const base = reducirHilo([], { tipo: 'captura_respondio', id: 'c1', propuesta: propuesta({ borradores: [borrador('b1')] }) });
    expect(reducirHilo(base, { tipo: 'borrador_resuelto', borradorId: 'zz', resolucion: 'descartado' })).toEqual(base);
  });

  it('limpiar vacía el hilo', () => {
    const base = reducirHilo([], { tipo: 'persona_envia', id: 'm1', texto: 'hola' });
    expect(reducirHilo(base, { tipo: 'limpiar' })).toEqual([]);
  });
});

describe('SUGERENCIAS_INICIALES', () => {
  it('son tres frases de dictado no vacías', () => {
    expect(SUGERENCIAS_INICIALES).toHaveLength(3);
    expect(SUGERENCIAS_INICIALES.every((s) => s.trim().length > 0)).toBe(true);
    expect(SUGERENCIAS_INICIALES[0]).toBe('Ingreso 500 soles, cliente Juan Pérez, flyers');
  });
});
