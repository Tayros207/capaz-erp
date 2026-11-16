import { describe, expect, it } from 'vitest';
import { CONTRATOS, diasDelRango } from '@capaz/shared';

// Los contratos del módulo son la primera barrera del dinero: aquí se comprueba lo que rechazan antes de llegar a una herramienta.

const ID = '0192f0c4-7b1e-7000-8000-000000000001';
const entra = (nombre: keyof typeof CONTRATOS, args: unknown) => CONTRATOS[nombre].entrada.safeParse(args).success;

describe('contratos de registro', () => {
  it('el monto es un entero de céntimos mayor que cero', () => {
    const base = { tipo: 'ingreso' };
    expect(entra('movimiento_registrar', { ...base, montoCentimos: 1 })).toBe(true);
    for (const montoCentimos of [0, -100, 10.5, '100', Number.MAX_SAFE_INTEGER + 2, Number.NaN]) {
      expect(entra('movimiento_registrar', { ...base, montoCentimos })).toBe(false);
    }
    expect(entra('deuda_abonar', { id: ID, montoCentimos: 0 })).toBe(false);
    expect(entra('deuda_crear', { tipo: 'por_cobrar', contactoId: ID, concepto: 'Venta', totalCentimos: 0.5 })).toBe(false);
  });

  it('los valores por defecto de un movimiento: efectivo y tecleado', () => {
    const r = CONTRATOS.movimiento_registrar.entrada.parse({ tipo: 'egreso', montoCentimos: 500 });
    expect(r).toMatchObject({ medioDePago: 'efectivo', origen: 'teclado' });
  });

  it('no acepta campos de más ni fechas mal escritas', () => {
    expect(entra('movimiento_registrar', { tipo: 'ingreso', montoCentimos: 1, sorpresa: true })).toBe(false);
    expect(entra('movimiento_registrar', { tipo: 'ingreso', montoCentimos: 1, fecha: '10/03/2026' })).toBe(false);
    expect(entra('movimiento_registrar', { tipo: 'ingreso', montoCentimos: 1, fecha: '2026-02-30' })).toBe(false);
  });

  it('el origen de una deuda va completo o no va', () => {
    const base = { tipo: 'por_cobrar', contactoId: ID, concepto: 'Pedido', totalCentimos: 100 };
    expect(entra('deuda_crear', base)).toBe(true);
    expect(entra('deuda_crear', { ...base, origenTipo: 'pedido', origenId: 'abc' })).toBe(true);
    expect(entra('deuda_crear', { ...base, origenTipo: 'pedido' })).toBe(false);
    expect(entra('deuda_crear', { ...base, origenId: 'abc' })).toBe(false);
  });

  it('editar exige al menos un cambio y anular exige motivo', () => {
    expect(entra('deuda_editar', { id: ID })).toBe(false);
    expect(entra('deuda_editar', { id: ID, venceEn: null })).toBe(true);
    expect(entra('cuenta_editar', { id: ID })).toBe(false);
    expect(entra('cuenta_editar', { id: ID, sucursalId: null })).toBe(true);
    expect(entra('movimiento_anular', { id: ID, motivo: '   ' })).toBe(false);
    expect(entra('deuda_anular', { id: ID })).toBe(false);
    expect(entra('deuda_anular', { id: ID, motivo: 'Se registró dos veces' })).toBe(true);
  });

  it('el resumen pide un rango ordenado de 366 días como máximo', () => {
    expect(diasDelRango('2026-01-01', '2026-01-01')).toBe(1);
    expect(diasDelRango('2024-01-01', '2024-12-31')).toBe(366);
    expect(entra('registro_resumen', { desde: '2026-01-01', hasta: '2026-01-31' })).toBe(true);
    expect(entra('registro_resumen', { desde: '2024-01-01', hasta: '2024-12-31' })).toBe(true);
    expect(entra('registro_resumen', { desde: '2026-02-01', hasta: '2026-01-31' })).toBe(false);
    expect(entra('registro_resumen', { desde: '2025-01-01', hasta: '2026-01-02' })).toBe(false);
  });

  it('ninguna herramienta del módulo pide empresa, usuario ni permisos', () => {
    const prohibidos = ['empresaId', 'tenantId', 'usuarioId', 'permisos', 'creadoPor'];
    for (const [nombre, c] of Object.entries(CONTRATOS)) {
      const forma = (c.entrada as { shape?: Record<string, unknown> }).shape ?? {};
      for (const p of prohibidos) expect(Object.keys(forma), `${nombre} pide «${p}»`).not.toContain(p);
    }
  });
});
