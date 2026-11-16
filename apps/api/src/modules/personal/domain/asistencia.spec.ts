import { describe, expect, it } from 'vitest';
import { aplicarCorreccion, aplicarMarca, comprobarCorreccion } from './asistencia.js';

const t = (h: string) => new Date(`2026-03-10T${h}:00Z`);

describe('aplicarMarca', () => {
  it('marcar la entrada sin estado deja presente con la hora', () => {
    expect(aplicarMarca(null, { entrada: true }, t('08:00'))).toEqual({ ok: true, asistencia: { estado: 'presente', entrada: t('08:00'), salida: null, nota: null } });
  });

  it('entrada con tardanza, y luego la salida', () => {
    const a = aplicarMarca(null, { entrada: true, estado: 'tardanza' }, t('08:40'));
    if (!a.ok) throw new Error(a.motivo);
    expect(a.asistencia.estado).toBe('tardanza');
    const b = aplicarMarca(a.asistencia, { salida: true }, t('17:00'));
    expect(b).toMatchObject({ ok: true, asistencia: { estado: 'tardanza', entrada: t('08:40'), salida: t('17:00') } });
  });

  it('la salida exige entrada; ni la entrada ni la salida se marcan dos veces', () => {
    expect(aplicarMarca(null, { salida: true }, t('17:00'))).toEqual({ ok: false, motivo: 'Primero hay que marcar la entrada.' });
    const dia = { estado: 'presente' as const, entrada: t('08:00'), salida: t('17:00'), nota: null };
    expect(aplicarMarca(dia, { entrada: true }, t('18:00'))).toMatchObject({ ok: false });
    expect(aplicarMarca(dia, { salida: true }, t('18:00'))).toMatchObject({ ok: false });
  });

  it('falta, permiso y descanso limpian las horas y no admiten marcarlas', () => {
    const dia = { estado: 'presente' as const, entrada: t('08:00'), salida: null, nota: 'x' };
    expect(aplicarMarca(dia, { estado: 'falta' }, t('09:00'))).toEqual({ ok: true, asistencia: { estado: 'falta', entrada: null, salida: null, nota: 'x' } });
    expect(aplicarMarca(null, { estado: 'permiso', entrada: true }, t('09:00'))).toMatchObject({ ok: false });
  });

  it('marcar la entrada de quien figuraba con falta lo deja presente', () => {
    const dia = { estado: 'falta' as const, entrada: null, salida: null, nota: null };
    expect(aplicarMarca(dia, { entrada: true }, t('10:00'))).toMatchObject({ ok: true, asistencia: { estado: 'presente', entrada: t('10:00') } });
  });

  it('sin nada que marcar se rechaza; la nota vacía la borra', () => {
    expect(aplicarMarca(null, {}, t('08:00'))).toMatchObject({ ok: false });
    const dia = { estado: 'presente' as const, entrada: null, salida: null, nota: 'x' };
    expect(aplicarMarca(dia, { estado: 'presente', nota: '  ' }, t('08:00'))).toMatchObject({ ok: true, asistencia: { nota: null } });
  });
});

describe('corrección', () => {
  it('solo un día pasado', () => {
    expect(comprobarCorreccion('2026-03-09', '2026-03-10')).toEqual({ ok: true });
    expect(comprobarCorreccion('2026-03-10', '2026-03-10')).toMatchObject({ ok: false });
    expect(comprobarCorreccion('2026-03-11', '2026-03-10')).toMatchObject({ ok: false });
  });

  it('conserva las horas si el estado las admite y deja el motivo como nota', () => {
    const dia = { estado: 'falta' as const, entrada: t('08:00'), salida: null, nota: null };
    expect(aplicarCorreccion(dia, 'tardanza', ' llegó tarde ')).toEqual({ estado: 'tardanza', entrada: t('08:00'), salida: null, nota: 'Corrección: llegó tarde' });
    expect(aplicarCorreccion(dia, 'permiso', 'cita médica')).toMatchObject({ entrada: null });
    expect(aplicarCorreccion(null, 'falta', 'no vino')).toMatchObject({ estado: 'falta', entrada: null });
  });
});
