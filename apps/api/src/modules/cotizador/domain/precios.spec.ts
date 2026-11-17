import { describe, expect, it } from 'vitest';
import { cotizarDesdeLista, validarLista, type ListaParaCotizar, type PedidoDePrecio } from './precios.js';

// Casos C7 a C11 de Cotizín a través de la fachada, en céntimos y milésimas.
const C7: ListaParaCotizar = { p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000, modoIntermedio: 'curva', precioMinimoCentimos: null };
const pedido = (unidades: number, extra: Partial<PedidoDePrecio> = {}): PedidoDePrecio => ({
  cantidadMilesimas: unidades * 1000,
  ajusteClientePct: null,
  redondeo: 'ninguno',
  ajuste: { tipo: 'ninguno' },
  igvPorcentaje: 18,
  ...extra,
});
const importe = (l: ListaParaCotizar, p: PedidoDePrecio) => {
  const r = cotizarDesdeLista(l, p);
  if (!r.ok) throw new Error(r.mensaje);
  return r.valor;
};

describe('cotizarDesdeLista · curva', () => {
  it.each([
    [100, 19_000],
    [200, 26_586],
    [500, 41_450],
    [1_000, 58_000],
    [1_500, 69_659],
    [2_500, 87_739],
    [5_000, 120_000],
  ])('%i unidades → %i céntimos', (unidades, esperado) => {
    expect(importe(C7, pedido(unidades)).importeCentimos).toBe(esperado);
  });

  it('2.500 unidades: importe sin IGV, IGV y total, y el unitario en milésimas', () => {
    expect(importe(C7, pedido(2_500))).toMatchObject({
      precioListaCentimos: 87_739,
      importeCentimos: 87_739,
      igvCentimos: 15_793,
      totalCentimos: 103_532,
      precioUnitarioMilesimas: 351,
      minimoAplicado: false,
      ajusteClientePct: null,
    });
  });
});

describe('cotizarDesdeLista · escalón, mínimo y rango', () => {
  it('escalón: 2.500 unidades mantienen el unitario de 1.000', () => {
    expect(importe({ ...C7, modoIntermedio: 'escalon' }, pedido(2_500)).importeCentimos).toBe(145_000);
  });

  it('precio mínimo: con 100 unidades y mínimo 25000 se cobra el mínimo y se avisa', () => {
    expect(importe({ ...C7, precioMinimoCentimos: 25_000 }, pedido(100))).toMatchObject({ importeCentimos: 25_000, minimoAplicado: true });
  });

  it.each([99, 5_001])('%i unidades está fuera de rango: conflicto (hay que cotizar aparte)', (unidades) => {
    const r = cotizarDesdeLista(C7, pedido(unidades));
    expect(r).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(!r.ok && r.mensaje).toContain('fuera de 100 a 5.000 unidades: hay que cotizar aparte.');
  });

  it('cantidad menor a una unidad: no es un error de rango sino de datos ni revienta', () => {
    const r = cotizarDesdeLista(C7, pedido(0, { cantidadMilesimas: 1 }));
    expect(r.ok).toBe(false);
  });
});

describe('cotizarDesdeLista · redondeo comercial, ajuste del cliente y ajuste de la cotización', () => {
  it.each([
    ['ninguno', 79_326],
    ['1', 79_400],
    ['5', 79_500],
    ['10', 80_000],
  ] as const)('2.000 unidades con redondeo %s → %i', (redondeo, esperado) => {
    expect(importe(C7, pedido(2_000, { redondeo })).importeCentimos).toBe(esperado);
  });

  it('ajuste de cliente: -5 % y +10 % cambian el precio de lista y se devuelven en ajusteClientePct', () => {
    expect(importe(C7, pedido(1_000, { ajusteClientePct: '-5.000' }))).toMatchObject({ precioListaCentimos: 55_100, importeCentimos: 55_100, ajusteClientePct: '-5' });
    expect(importe(C7, pedido(1_000, { ajusteClientePct: '10.000' }))).toMatchObject({ precioListaCentimos: 63_800, importeCentimos: 63_800, ajusteClientePct: '10' });
  });

  it('ajuste de la cotización: precio fijo y monto con signo no tocan el precio de lista', () => {
    expect(importe(C7, pedido(1_000, { ajuste: { tipo: 'precio', importeCentimos: 50_000 } }))).toMatchObject({ precioListaCentimos: 58_000, importeCentimos: 50_000 });
    expect(importe(C7, pedido(1_000, { ajuste: { tipo: 'monto', importeCentimos: -8_000 } }))).toMatchObject({ precioListaCentimos: 58_000, importeCentimos: 50_000 });
  });

  it('un monto negativo que deja el precio en cero es argumentos_invalidos', () => {
    expect(cotizarDesdeLista(C7, pedido(1_000, { ajuste: { tipo: 'monto', importeCentimos: -58_000 } }))).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
  });

  it('el IGV se calcula con el porcentaje pedido: con 0 % el total es el importe', () => {
    expect(importe(C7, pedido(2_500, { igvPorcentaje: 0 }))).toMatchObject({ igvCentimos: 0, totalCentimos: 87_739 });
  });
});

describe('validarLista', () => {
  it('19000 / 58000 / 120000 es válida, sin bloqueos ni avisos', () => {
    expect(validarLista({ p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000 })).toEqual({ bloqueos: [], avisos: [] });
  });

  it('19000 / 15000 / 40000 bloquea (invariante B: el total crece)', () => {
    const v = validarLista({ p100Centimos: 19_000, p1000Centimos: 15_000, p5000Centimos: 40_000 });
    expect(v.bloqueos).toHaveLength(1);
    expect(v.bloqueos[0]).toContain('nadie paga menos por pedir más');
  });

  it('19000 / 200000 / 900000 solo avisa (invariante A: el unitario baja)', () => {
    const v = validarLista({ p100Centimos: 19_000, p1000Centimos: 200_000, p5000Centimos: 900_000 });
    expect(v.bloqueos).toEqual([]);
    expect(v.avisos).toHaveLength(1);
    expect(v.avisos[0]).toContain('El unitario no baja');
  });
});
