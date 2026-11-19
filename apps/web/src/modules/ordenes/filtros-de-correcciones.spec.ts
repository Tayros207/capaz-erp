import { describe, expect, it } from 'vitest';
import { SIN_FILTROS, argumentosDeFiltros, errorDeFiltros, hayFiltros, textoDeAjuste } from './filtros-de-correcciones.ts';

describe('filtros de correcciones', () => {
  it('solo envía lo que tiene valor', () => {
    expect(argumentosDeFiltros(SIN_FILTROS)).toEqual({});
    expect(argumentosDeFiltros({ ...SIN_FILTROS, desde: '2026-11-01', autorId: 'u1' })).toEqual({ desde: '2026-11-01', autorId: 'u1' });
    expect(hayFiltros(SIN_FILTROS)).toBe(false);
  });
  it('avisa si el período está al revés', () => {
    expect(errorDeFiltros({ ...SIN_FILTROS, desde: '2026-11-10', hasta: '2026-11-01' })).toBeTruthy();
    expect(errorDeFiltros({ ...SIN_FILTROS, desde: '2026-11-01', hasta: '2026-11-10' })).toBeNull();
  });
  it('lee el ajuste de deuda', () => {
    expect(textoDeAjuste(null)).toBe('Sin ajuste de deuda');
    const a = { montoCentimos: -2_000, aFavorCentimos: 500, deudaCodigo: 'DEU-1' } as Parameters<typeof textoDeAjuste>[0];
    expect(textoDeAjuste(a)).toBe('Deuda DEU-1: −S/ 20.00 · a favor del cliente S/ 5.00');
  });
});
