import { describe, expect, it } from 'vitest';
import {
  aplicarCorreccion, correccionDeReferencia, esCorregible, esOrigenReservado, motivoDeCorreccion, puedeCorregirse, puedeRestaurarse, puedeRestaurarseElAbono,
  raizDeFamilia, referenciaDeCorreccion, type DatosCorregibles,
} from './correccion.js';

const ACTUAL: DatosCorregibles = { montoCentimos: 35_000, fecha: '2026-03-10', cuentaId: 'c1', categoriaId: 'k1', contactoId: 'p1', medioDePago: 'efectivo', descripcion: 'Banner' };
const suelto = { estado: 'activo', deudaId: null, origenRef: null };

describe('familia de correcciones', () => {
  it('la raíz de un movimiento sin corrección es él mismo; la de un reemplazo es la raíz de la cadena', () => {
    expect(raizDeFamilia({ id: 'm1', origenRef: null })).toBe('m1');
    expect(raizDeFamilia({ id: 'm3', origenRef: referenciaDeCorreccion('m1') })).toBe('m1');
    expect(correccionDeReferencia(referenciaDeCorreccion('m1'))).toBe('m1');
    expect(correccionDeReferencia(null)).toBeNull();
    expect(correccionDeReferencia('transferencia:x')).toBeNull();
  });

  it('los orígenes de transferencia y de corrección están reservados al sistema', () => {
    expect(esOrigenReservado('correccion:abc')).toBe(true);
    expect(esOrigenReservado('transferencia:abc')).toBe(true);
    expect(esOrigenReservado('compra:abc')).toBe(false);
    expect(esOrigenReservado(undefined)).toBe(false);
  });
});

describe('puedeCorregirse', () => {
  it('acepta un movimiento activo y suelto, o ya corregido antes', () => {
    expect(puedeCorregirse(suelto).ok).toBe(true);
    expect(esCorregible({ ...suelto, origenRef: referenciaDeCorreccion('m1') })).toBe(true);
  });

  it('rechaza anulados, abonos, transferencias y movimientos de otro módulo', () => {
    expect(puedeCorregirse({ ...suelto, estado: 'anulado' }).ok).toBe(false);
    expect(puedeCorregirse({ ...suelto, deudaId: 'd1' }).ok).toBe(false);
    expect(puedeCorregirse({ ...suelto, origenRef: 'transferencia:t1' }).ok).toBe(false);
    expect(puedeCorregirse({ ...suelto, origenRef: 'adelanto:a1' }).ok).toBe(false);
  });
});

describe('aplicarCorreccion', () => {
  it('solo cuenta como cambio lo que difiere del dato actual', () => {
    const r = aplicarCorreccion(ACTUAL, { montoCentimos: 38_000, fecha: '2026-03-10', medioDePago: 'efectivo' });
    expect(r).toMatchObject({ ok: true, final: { ...ACTUAL, montoCentimos: 38_000 } });
    if (r.ok) expect(r.cambios.map((c) => c.campo)).toEqual(['monto']);
  });

  it('null quita la categoría y el contacto; el texto vacío equivale a null', () => {
    const r = aplicarCorreccion(ACTUAL, { categoriaId: null, contactoId: null, descripcion: '   ' });
    expect(r).toMatchObject({ ok: true, final: { categoriaId: null, contactoId: null, descripcion: null } });
  });

  it('sin ningún cambio real se rechaza', () => {
    const r = aplicarCorreccion(ACTUAL, { montoCentimos: 35_000, descripcion: 'Banner' });
    expect(r).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
  });

  it('el motivo detalla lo corregido y añade la nota libre sin pasar de 300 caracteres', () => {
    const r = aplicarCorreccion(ACTUAL, { montoCentimos: 38_000 });
    if (!r.ok) throw new Error('debía pasar');
    expect(motivoDeCorreccion(r.cambios, undefined)).toBe('Corregido: monto S/ 350.00 → S/ 380.00');
    expect(motivoDeCorreccion(r.cambios, ' Me equivoqué ')).toBe('Corregido: monto S/ 350.00 → S/ 380.00. Me equivoqué');
    expect(motivoDeCorreccion(r.cambios, 'x'.repeat(500))).toHaveLength(300);
  });
});

describe('restaurar', () => {
  it('solo se restaura lo anulado, que no sea transferencia y sin versión vigente', () => {
    expect(puedeRestaurarse({ estado: 'anulado', origenRef: null }, null).ok).toBe(true);
    expect(puedeRestaurarse({ estado: 'activo', origenRef: null }, null).ok).toBe(false);
    expect(puedeRestaurarse({ estado: 'anulado', origenRef: 'transferencia:t1' }, null).ok).toBe(false);
    const r = puedeRestaurarse({ estado: 'anulado', origenRef: null }, { codigo: 'MOV-2026-000007' });
    expect(r).toMatchObject({ ok: false, codigo: 'conflicto' });
    if (!r.ok) expect(r.mensaje).toContain('MOV-2026-000007');
  });

  it('un abono se restaura solo si la deuda está abierta y el monto cabe en su saldo', () => {
    const abierta = { estado: 'parcial' as const, totalCentimos: 10_000, abonadoCentimos: 4_000 };
    expect(puedeRestaurarseElAbono(abierta, 6_000)).toMatchObject({ ok: true, quedaPagada: true, saldoCentimos: 0 });
    expect(puedeRestaurarseElAbono(abierta, 3_000)).toMatchObject({ ok: true, quedaPagada: false, saldoCentimos: 3_000 });
    expect(puedeRestaurarseElAbono(abierta, 6_001)).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(puedeRestaurarseElAbono({ ...abierta, estado: 'anulada' }, 1_000).ok).toBe(false);
    expect(puedeRestaurarseElAbono({ ...abierta, estado: 'pagada', abonadoCentimos: 10_000 }, 1_000).ok).toBe(false);
  });
});
