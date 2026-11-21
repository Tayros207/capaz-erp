import { describe, expect, it } from 'vitest';
import type { CoberturaDelMesDto } from '@capaz/shared';
import { diasQueQuedan, nombreDelMes, textoDeCobertura } from './logica-cobertura.ts';

const base: CoberturaDelMesDto = {
  mes: '2026-11', desde: '2026-11-01', hasta: '2026-11-30', ingresosCentimos: 54_000, compromisosCentimos: 100_000,
  compromisosPagadosCentimos: 0, faltaCentimos: 46_000, porcentaje: 54, compromisos: 3,
};

describe('cobertura del mes', () => {
  it('nombra el mes y cuenta los días que quedan', () => {
    expect(nombreDelMes('2026-11')).toBe('noviembre');
    expect(nombreDelMes('raro')).toBe('raro');
    expect(diasQueQuedan('2026-11-20', '2026-11-30')).toBe(10);
    expect(diasQueQuedan('2026-12-02', '2026-11-30')).toBe(0);
  });
  it('arma la frase con lo que falta', () => {
    expect(textoDeCobertura(base, '2026-11-20')).toBe('Pagos de noviembre: llevas S/ 540.00 de S/ 1,000.00 (54 %). Faltan S/ 460.00 y quedan 10 días.');
    expect(textoDeCobertura(base, '2026-11-29')).toContain('queda 1 día.');
  });
  it('si ya se cubrió, no dice «Faltan»', () => {
    const t = textoDeCobertura({ ...base, ingresosCentimos: 120_000, faltaCentimos: 0, porcentaje: 120 }, '2026-11-20');
    expect(t).toContain('(120 %)');
    expect(t).not.toContain('Faltan');
  });
});
