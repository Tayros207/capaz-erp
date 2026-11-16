import { describe, expect, it } from 'vitest';
import type { BloqueDelPanelDto } from '@capaz/shared';
import { diaEnZona, diasEntre, errorDeRango, esDiaValido, nombreDeArchivoSeguro, periodoDe, seriesParaGrafico, textoDelPeriodo, tonoDeIndicador, valorDeIndicador } from './logica.ts';

const RANGO = { desde: '2026-01-01', hasta: '2026-01-02' };

describe('periodoDe', () => {
  it('hoy, 7 días y mes', () => {
    expect(periodoDe('hoy', '2026-03-15', RANGO)).toEqual({ desde: '2026-03-15', hasta: '2026-03-15' });
    expect(periodoDe('semana', '2026-03-03', RANGO)).toEqual({ desde: '2026-02-25', hasta: '2026-03-03' });
    expect(periodoDe('mes', '2026-03-15', RANGO)).toEqual({ desde: '2026-03-01', hasta: '2026-03-15' });
  });
  it('rango usa lo escrito', () => expect(periodoDe('rango', '2026-03-15', RANGO)).toEqual(RANGO));
});

describe('errorDeRango', () => {
  it('acepta un rango bueno', () => expect(errorDeRango(RANGO)).toBeNull());
  it('rechaza vacío, falso, invertido y demasiado largo', () => {
    expect(errorDeRango({ desde: '', hasta: '2026-01-02' })).toMatch(/dos fechas/);
    expect(errorDeRango({ desde: '2026-02-30', hasta: '2026-03-02' })).toMatch(/dos fechas/);
    expect(errorDeRango({ desde: '2026-03-02', hasta: '2026-03-01' })).toMatch(/anterior/);
    expect(errorDeRango({ desde: '2025-01-01', hasta: '2026-03-01' })).toMatch(/366/);
  });
});

describe('fechas', () => {
  it('esDiaValido y diasEntre', () => {
    expect(esDiaValido('2024-02-29')).toBe(true);
    expect(esDiaValido('2026-02-29')).toBe(false);
    expect(diasEntre('2026-03-01', '2026-03-01')).toBe(1);
    expect(textoDelPeriodo({ desde: '2026-03-01', hasta: '2026-03-31' })).toBe('01/03/2026 al 31/03/2026');
    expect(textoDelPeriodo({ desde: '2026-03-01', hasta: '2026-03-01' })).toBe('01/03/2026');
  });
});

describe('formato de cifras', () => {
  it('dinero en soles y cantidad con miles', () => {
    expect(valorDeIndicador({ tipo: 'dinero', valor: 123450 })).toBe('S/ 1,234.50');
    expect(valorDeIndicador({ tipo: 'cantidad', valor: 1200 })).toMatch(/1.200/);
  });
  it('atención solo en atrasos y vencidos con valor', () => {
    expect(tonoDeIndicador({ etiqueta: 'Atrasados', valor: 2 })).toBe('peligro');
    expect(tonoDeIndicador({ etiqueta: 'Atrasados', valor: 0 })).toBe('neutro');
    expect(tonoDeIndicador({ etiqueta: 'Confirmados', valor: 5 })).toBe('neutro');
  });
});

describe('seriesParaGrafico', () => {
  const base: BloqueDelPanelDto = { modulo: 'ordenes', nombre: 'Pedidos', soloLectura: false, indicadores: [], series: [] };
  it('sin serie, sin gráficos', () => expect(seriesParaGrafico(base)).toEqual([]));
  it('con serie, un gráfico con sus puntos', () => {
    const r = seriesParaGrafico({ ...base, series: [{ id: 's', etiqueta: 'Por día', tipo: 'dinero', puntos: [{ fecha: '2026-03-01', valor: 500 }] }] });
    expect(r).toHaveLength(1);
    expect(r[0]!.series[0]!.puntos).toEqual([{ x: '01/03', y: 500 }]);
    expect(r[0]!.formato(500)).toBe('S/ 5.00');
  });
});

describe('nombreDeArchivoSeguro', () => {
  it('no deja separadores de ruta', () => {
    expect(nombreDeArchivoSeguro('../../x/ind icadores.csv')).toBe('_.._x_ind_icadores.csv');
    expect(nombreDeArchivoSeguro('indicadores-2026-03-01_2026-03-31.csv')).toBe('indicadores-2026-03-01_2026-03-31.csv');
  });
});

describe('diaEnZona', () => {
  it('usa el día de Lima, no el de UTC', () => expect(diaEnZona(new Date('2026-03-02T03:00:00Z'))).toBe('2026-03-01'));
});
