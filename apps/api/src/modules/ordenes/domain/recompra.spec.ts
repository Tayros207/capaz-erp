import { sumarDias } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { evaluarRecompra, mediana, mensajeDeRecompra, tarjetasDeRecompra, type ClienteConHistorial } from './recompra.js';

const hoy = '2026-11-20';
/** `n` compras cada `cada` días; la última hace `hace` días. */
const compras = (n: number, cada: number, hace: number): string[] => Array.from({ length: n }, (_, i) => sumarDias(hoy, -hace - cada * (n - 1 - i)));
const cliente = (id: string, extra: Partial<ClienteConHistorial> = {}): ClienteConHistorial => ({
  clienteId: id, clienteNombre: `Cliente ${id}`, clienteTelefono: '987654321', fechasDeCompra: compras(6, 7, 45), ventaDe12MesesCentimos: 100_000, ...extra,
});

describe('mediana', () => {
  it('impar: el del medio; par: promedio redondeado', () => {
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([1, 2, 3, 10])).toBe(3);
    expect(mediana([1, 2])).toBe(2);
    expect(mediana([])).toBe(0);
  });
});

describe('evaluarRecompra', () => {
  it('5 compras no califican, 6 sí', () => {
    expect(evaluarRecompra(compras(5, 7, 45), hoy)).toBeNull();
    expect(evaluarRecompra(compras(6, 7, 45), hoy)).toMatchObject({ ritmoEnDias: 7, diasSinComprar: 45 });
  });
  it('ritmo de 31 días no califica; 30 sí', () => {
    expect(evaluarRecompra(compras(6, 31, 100), hoy)).toBeNull();
    expect(evaluarRecompra(compras(6, 30, 100), hoy)).not.toBeNull();
  });
  it('d = 2M no avisa y d = 2M + 1 sí (M = 7, piso de 10 no pesa)', () => {
    expect(evaluarRecompra(compras(6, 7, 14), hoy)).toBeNull();
    expect(evaluarRecompra(compras(6, 7, 15), hoy)).not.toBeNull();
  });
  it('con M = 3, d = 9 no avisa y d = 11 sí (piso de 10)', () => {
    expect(evaluarRecompra(compras(6, 3, 9), hoy)).toBeNull();
    expect(evaluarRecompra(compras(6, 3, 10), hoy)).toBeNull();
    expect(evaluarRecompra(compras(6, 3, 11), hoy)).not.toBeNull();
  });
  it('d = 401 no avisa; 400 sí', () => {
    expect(evaluarRecompra(compras(6, 7, 401), hoy)).toBeNull();
    expect(evaluarRecompra(compras(6, 7, 400), hoy)).not.toBeNull();
  });
  it('el nivel cambia con d = 3M + 1', () => {
    expect(evaluarRecompra(compras(6, 7, 21), hoy)?.nivel).toBe('toca_volver');
    expect(evaluarRecompra(compras(6, 7, 22), hoy)?.nivel).toBe('enfriando');
  });
  it('fechas repetidas cuentan una sola vez', () => {
    expect(evaluarRecompra([...compras(5, 7, 45), ...compras(5, 7, 45)], hoy)).toBeNull();
  });
});

describe('tarjetasDeRecompra', () => {
  it('arma la tarjeta con su texto y mensaje', () => {
    const [t] = tarjetasDeRecompra([cliente('A')], hoy, 'Gráfica de Prueba');
    expect(t).toMatchObject({ clave: 'recompra:A', grupo: 'recompra', urgencia: 'info', titulo: 'Llamar a Cliente A', montoCentimos: null, acciones: [] });
    expect(t?.detalle).toBe('Compra cada ~7 días y no compra hace 45 días · Se está enfriando · S/ 1,000.00 en los últimos 12 meses');
    expect(t?.fecha).toBe(sumarDias(hoy, -38));
    expect(t?.mensaje?.texto).toContain('Hola Cliente A, te saluda Gráfica de Prueba. Hace un tiempo que no te vemos');
    expect(t?.mensaje?.enlaceWhatsapp).toContain('https://wa.me/51987654321');
  });
  it('ordena por venta y luego por días sin comprar, con tope de 15', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => cliente(`C${String(i).padStart(2, '0')}`, { ventaDe12MesesCentimos: 1000 + i }));
    const r = tarjetasDeRecompra(muchos, hoy, null);
    expect(r).toHaveLength(15);
    expect(r[0]?.clave).toBe('recompra:C19');
    const empate = tarjetasDeRecompra([cliente('X', { fechasDeCompra: compras(6, 7, 30) }), cliente('Y', { fechasDeCompra: compras(6, 7, 60) })], hoy, null);
    expect(empate.map((t) => t.clave)).toEqual(['recompra:Y', 'recompra:X']);
  });
  it('un teléfono fijo no da enlace; sin empresa, saludo cordial', () => {
    const m = mensajeDeRecompra('Ana Prueba', null, '(01) 456-7890');
    expect(m).toEqual({ texto: 'Hola Ana Prueba, un saludo cordial.', enlaceWhatsapp: null });
  });
});
