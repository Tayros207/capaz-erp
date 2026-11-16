import { describe, expect, it } from 'vitest';
import { periodoDelPanelSchema } from '@capaz/shared';
import { bloqueDe, centimosATexto, filasPlanas, indicadoresDe, legible, nombreDeArchivo, ordenarModulos, seriesDe } from './composicion.js';

describe('legible', () => {
  it('separa camelCase y guiones bajos', () => {
    expect(legible('totalConfirmadoCentimos')).toBe('Total confirmado');
    expect(legible('en_proceso')).toBe('En proceso');
  });
});

describe('indicadoresDe', () => {
  const pedidos = {
    desde: '2026-03-01',
    hasta: '2026-03-31',
    porEstado: [{ estado: 'confirmado', cantidad: 3, totalCentimos: 30000 }],
    confirmados: 3,
    totalConfirmadoCentimos: 30000,
    atrasados: 1,
  };

  it('toma números sueltos, ignora el período y distingue dinero de cantidad', () => {
    const r = indicadoresDe(pedidos);
    expect(r.find((i) => i.id === 'confirmados')).toMatchObject({ etiqueta: 'Confirmados', tipo: 'cantidad', valor: 3 });
    expect(r.find((i) => i.id === 'totalConfirmadoCentimos')).toMatchObject({ tipo: 'dinero', valor: 30000 });
    expect(r.some((i) => i.id === 'desde')).toBe(false);
  });
  it('recorre listas y objetos anidados', () => {
    const r = indicadoresDe({ ...pedidos, hoy: { fecha: '2026-03-02', marcados: 4 } });
    expect(r.find((i) => i.id === 'porEstado.confirmado.cantidad')?.etiqueta).toBe('Por estado · Confirmado · cantidad');
    expect(r.find((i) => i.id === 'hoy.marcados')?.valor).toBe(4);
    expect(r.some((i) => i.id === 'hoy.fecha')).toBe(false);
  });
  it('no inventa: sin objeto, nada; decimales, ignorados', () => {
    expect(indicadoresDe(null)).toEqual([]);
    expect(indicadoresDe({ a: 1.5 })).toEqual([]);
  });
  it('distingue una cantidad y su monto con la misma etiqueta', () => {
    const r = indicadoresDe({ vencidasPorCobrar: 2, vencidasPorCobrarCentimos: 500 });
    expect(r.map((i) => i.etiqueta)).toEqual(['Vencidas por cobrar', 'Vencidas por cobrar (monto)']);
  });
});

describe('seriesDe', () => {
  it('sin serie no hay gráfico', () => expect(seriesDe({ confirmados: 1 })).toEqual([]));
  it('con serie válida la entrega y descarta puntos mal formados', () => {
    const r = seriesDe({ serie: [{ fecha: '2026-03-01', valor: 2 }, { fecha: 'x', valor: 1 }, { fecha: '2026-03-02', valor: 1.5 }] });
    expect(r).toHaveLength(1);
    expect(r[0]!.puntos).toEqual([{ fecha: '2026-03-01', valor: 2 }]);
  });
});

describe('panel y filas', () => {
  it('ordena los módulos y deja los desconocidos al final', () => {
    expect(ordenarModulos([{ modulo: 'zeta' }, { modulo: 'personal' }, { modulo: 'registro' }]).map((b) => b.modulo)).toEqual(['registro', 'personal', 'zeta']);
  });
  it('filas planas: encabezado, módulo, indicador, valor, unidad', () => {
    const b = bloqueDe('registro', { ingresosCentimos: 123450, cuantos: 2 }, false);
    expect(filasPlanas([b])).toEqual([
      ['Módulo', 'Indicador', 'Valor', 'Unidad'],
      ['Registro', 'Ingresos', '1234.50', 'soles'],
      ['Registro', 'Cuantos', '2', 'cantidad'],
    ]);
  });
  it('céntimos a texto, con negativos', () => {
    expect(centimosATexto(5)).toBe('0.05');
    expect(centimosATexto(-12345)).toBe('-123.45');
  });
  it('nombre del archivo lleva el período', () => expect(nombreDeArchivo('2026-03-01', '2026-03-31')).toBe('indicadores-2026-03-01_2026-03-31.csv'));
});

describe('validación del período', () => {
  const ok = (v: unknown) => periodoDelPanelSchema.safeParse(v).success;
  it('acepta un día y un año', () => {
    expect(ok({ desde: '2026-03-01', hasta: '2026-03-01' })).toBe(true);
    expect(ok({ desde: '2026-01-01', hasta: '2026-12-31' })).toBe(true);
  });
  it('rechaza invertido, demasiado largo, campos de más y fechas falsas', () => {
    expect(ok({ desde: '2026-03-02', hasta: '2026-03-01' })).toBe(false);
    expect(ok({ desde: '2025-01-01', hasta: '2026-03-01' })).toBe(false);
    expect(ok({ desde: '2026-03-01', hasta: '2026-03-02', x: 1 })).toBe(false);
    expect(ok({ desde: '2026-02-30', hasta: '2026-03-02' })).toBe(false);
  });
});

describe('protección de fórmulas en el CSV', () => {
  it('una etiqueta que parece fórmula sale prefijada con comilla', async () => {
    const { escribirCsv } = await import('../../../core/intercambio/csv.js');
    const b = bloqueDe('=cmd', { '=HYPERLINK("http://x")': 1, '@suma': 2 }, false);
    const csv = escribirCsv(filasPlanas([b]), { separador: ',', bom: false });
    for (const linea of csv.split('\r\n').filter(Boolean)) for (const celda of linea.split(',')) expect(celda.replace(/^"/, '')).not.toMatch(/^[=+@]/);
    expect(csv).toContain("'=hyperlink");
  });
});
