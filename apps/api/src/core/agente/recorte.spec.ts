import { exito, rechazo } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { recortar } from './recorte.js';

const fila = (i: number) => ({ id: `id-${i}`, nombre: `Cliente número ${i}`, nota: 'x'.repeat(40) });
const lista = (n: number) => Array.from({ length: n }, (_, i) => fila(i));

describe('recortar', () => {
  it('una respuesta corta sale tal cual, envuelta en ok y datos', () => {
    expect(JSON.parse(recortar(exito({ total: 3 })))).toEqual({ ok: true, datos: { total: 3 } });
  });

  it('los campos vacíos no viajan; el cero, el falso y el texto vacío sí', () => {
    expect(JSON.parse(recortar(exito({ items: [{ medida: null, total: 0, activo: false, notas: '' }] })))).toEqual({ ok: true, datos: { items: [{ total: 0, activo: false, notas: '' }] } });
  });

  it('los avisos comerciales viajan como texto; el recibo no', () => {
    const r = exito({ id: 'x' }, { avisos: [{ codigo: 'a', mensaje: 'Ojo con el mínimo', nivel: 'comercial' }], recibo: { comercial: { z: 1 } } });
    expect(JSON.parse(recortar(r))).toEqual({ ok: true, datos: { id: 'x' }, avisos: ['Ojo con el mínimo'] });
  });

  it('un rechazo llega con su código y su mensaje en español', () => {
    const r = JSON.parse(recortar(rechazo('sin_permiso', 'No tienes permiso.')));
    expect(r).toEqual({ ok: false, error: { codigo: 'sin_permiso', mensaje: 'No tienes permiso.' } });
  });

  it('un rechazo con candidatas las conserva: así el modelo puede preguntar «¿cuál Juan?»', () => {
    const r = JSON.parse(recortar(rechazo('conflicto', 'Hay dos.', [{ id: '1', nombre: 'Juan Pérez' }, { id: '2', nombre: 'Juan Soto' }])));
    expect(r.error.candidatas).toHaveLength(2);
  });

  it('una lista larga se recorta, sigue siendo JSON y dice cuántos se muestran de cuántos hay', () => {
    const salida = recortar(exito({ items: lista(500), pagina: 1 }), 2000);
    expect(salida.length).toBeLessThanOrEqual(2000);
    const r = JSON.parse(salida);
    expect(r.ok).toBe(true);
    expect(r.datos.pagina).toBe(1);
    expect(r.datos._recortado.total).toBe(500);
    expect(r.datos._recortado.mostrados).toBe(r.datos.items.length);
    expect(r.datos._recortado.mostrados).toBeGreaterThan(0);
    expect(r.datos._recortado.mostrados).toBeLessThan(500);
    expect(r.datos._recortado.aviso).toContain('INCOMPLETO');
  });

  it('recorta el arreglo que más pesa, no uno pequeño', () => {
    const salida = recortar(exito({ etiquetas: ['a', 'b'], pedidos: lista(400) }), 1500);
    const r = JSON.parse(salida);
    expect(r.datos.etiquetas).toEqual(['a', 'b']);
    expect(r.datos.pedidos.length).toBeLessThan(400);
  });

  it('si los datos son un arreglo directo, los recorta bajo `items`', () => {
    const r = JSON.parse(recortar(exito(lista(300)), 1500));
    expect(r.datos.items.length).toBeLessThan(300);
    expect(r.datos._recortado.total).toBe(300);
  });

  it('sin lista que recortar deja el principio y lo marca como parcial', () => {
    const salida = recortar(exito({ texto: 'palabra '.repeat(2000) }), 1000);
    expect(salida.length).toBeLessThanOrEqual(1000);
    const r = JSON.parse(salida);
    expect(r.datos._recortado.aviso).toContain('INCOMPLETO');
    expect(typeof r.datos.parcial).toBe('string');
  });

  it('nunca pasa del máximo, con cualquier tamaño de entrada', () => {
    for (const n of [0, 1, 10, 100, 1000, 5000]) {
      for (const maximo of [200, 500, 2000, 6000]) {
        const salida = recortar(exito({ items: lista(n) }), maximo);
        expect(salida.length, `n=${n} máximo=${maximo}`).toBeLessThanOrEqual(maximo);
        expect(() => JSON.parse(salida)).not.toThrow();
      }
    }
  });

  it('el tope por defecto es 6.000 caracteres', () => {
    expect(recortar(exito({ items: lista(2000) })).length).toBeLessThanOrEqual(6000);
  });

  it('una confirmación que llegara por error no filtra el token ni el resumen', () => {
    const salida = recortar({ ok: false, requiereConfirmacion: { resumen: 'Anular la deuda de S/ 5.000', token: 'TOKEN-SECRETO', venceEn: '2026-11-24T10:00:00Z' } });
    expect(salida).not.toContain('TOKEN-SECRETO');
    expect(salida).not.toContain('5.000');
    expect(JSON.parse(salida).error.codigo).toBe('confirmacion_solo_ui');
  });

  it('un máximo absurdamente pequeño sigue devolviendo un JSON válido', () => {
    expect(() => JSON.parse(recortar(exito({ items: lista(50) }), 10))).not.toThrow();
  });
});
