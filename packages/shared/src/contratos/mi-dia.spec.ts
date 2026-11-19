import { describe, expect, it } from 'vitest';
import { diasEntreDias, limitarTarjetas, sumarDias, urgenciaDeFecha, type UrgenciaDeMiDia } from './mi-dia.js';

const t = (clave: string, urgencia: UrgenciaDeMiDia, fecha: string | null) => ({ clave, urgencia, fecha });

describe('ayudas de Mi día', () => {
  it('días y urgencia por calendario (sin zona ni horario de verano)', () => {
    expect(diasEntreDias('2026-11-18', '2026-11-19')).toBe(1);
    expect(diasEntreDias('2026-12-31', '2027-01-01')).toBe(1);
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
    expect(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-25'].map((f) => urgenciaDeFecha(f, '2026-11-18'))).toEqual(['atrasado', 'hoy', 'manana', 'pronto']);
  });

  it('al cortar, lo de hoy y mañana nunca se pierde aunque haya muchos atrasados', () => {
    const atrasadas = Array.from({ length: 60 }, (_, i) => t(`a${String(i).padStart(2, '0')}`, 'atrasado', `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`));
    const r = limitarTarjetas([...atrasadas, t('h', 'hoy', '2026-11-18'), t('m', 'manana', '2026-11-19'), t('p', 'pronto', '2026-12-01')], 50);
    expect(r.total).toBe(63);
    expect(r.tarjetas).toHaveLength(50);
    expect(r.tarjetas.map((x) => x.clave)).toEqual(expect.arrayContaining(['h', 'm']));
    expect(r.tarjetas.some((x) => x.clave === 'p')).toBe(false);
    // Se entregan ordenadas por urgencia y fecha: primero las atrasadas, la más antigua primero.
    expect(r.tarjetas.slice(-2).map((x) => x.clave)).toEqual(['h', 'm']);
    expect(r.tarjetas[0]!.fecha).toBe('2026-10-01');
  });
});
