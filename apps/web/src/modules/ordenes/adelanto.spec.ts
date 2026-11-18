import { describe, expect, it, vi } from 'vitest';
import {
  ADELANTO_INICIAL, confirmarYCobrar, montoDeAdelanto, sePuedeCobrarAdelanto, sugerirAdelanto, validarAdelanto,
  type DependenciasDelAdelanto, type DeudaDelAdelanto, type PedidoConfirmado, type Res,
} from './adelanto.ts';

const formato = (c: number) => `S/ ${(c / 100).toFixed(2)}`;
const ok = <T>(datos: T): Res<T> => ({ ok: true, datos });
const mal = (codigo: string, mensaje = 'Falló.'): Res<never> => ({ ok: false, codigo, mensaje });
const pedido: PedidoConfirmado = { id: 'p1', codigo: 'PED-PRI-2026-0001', clienteId: 'c1', totalCentimos: 10_000 };
const deuda = (extra: Partial<DeudaDelAdelanto> = {}): DeudaDelAdelanto => ({ id: 'd1', codigo: 'CXC-1', totalCentimos: 10_000, abonadoCentimos: 0, saldoCentimos: 10_000, ...extra });
const params = { montoCentimos: 5_000, medio: 'efectivo' as const, formato };

function deps(extra: Partial<DependenciasDelAdelanto> = {}) {
  const d = {
    confirmar: vi.fn(async () => ok(pedido)),
    crearDeuda: vi.fn(async () => ok(deuda())),
    buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(null)),
    abonar: vi.fn(async () => ok(null as unknown)),
    ...extra,
  };
  return d;
}

describe('monto y permisos', () => {
  it('sugiere el 50 % redondeado al céntimo', () => {
    expect(sugerirAdelanto(11_800)).toBe(5_900);
    expect(sugerirAdelanto(10_001)).toBe(5_001);
    expect(sugerirAdelanto(1)).toBe(1);
    expect(sugerirAdelanto(0)).toBe(0);
  });
  it('valida el monto', () => {
    expect(validarAdelanto(5_000, 10_000)).toBeNull();
    expect(validarAdelanto(10_000, 10_000)).toBeNull();
    expect(validarAdelanto(null, 10_000)).toMatch(/monto/);
    expect(validarAdelanto(0, 10_000)).toMatch(/monto/);
    expect(validarAdelanto(10_001, 10_000)).toMatch(/mayor/);
    expect(validarAdelanto(1.5, 10_000)).toMatch(/monto/);
  });
  it('ofrece la casilla solo con permiso, cliente y total', () => {
    const base = { puedeEscribirEnRegistro: true, clienteId: 'c1', totalCentimos: 100 };
    expect(sePuedeCobrarAdelanto(base)).toBe(true);
    expect(sePuedeCobrarAdelanto({ ...base, puedeEscribirEnRegistro: false })).toBe(false);
    expect(sePuedeCobrarAdelanto({ ...base, clienteId: null })).toBe(false);
    expect(sePuedeCobrarAdelanto({ ...base, totalCentimos: 0 })).toBe(false);
    expect(sePuedeCobrarAdelanto({ ...base, totalCentimos: null })).toBe(false);
  });
});

describe('adelanto de la hoja', () => {
  it('el monto sigue al total mientras nadie lo toque', () => {
    expect(montoDeAdelanto(ADELANTO_INICIAL, 10_000)).toBe(5_000);
    expect(montoDeAdelanto(ADELANTO_INICIAL, 20_000)).toBe(10_000);
  });
  it('tocado, se queda con lo escrito aunque cambie el total (incluso vacío)', () => {
    expect(montoDeAdelanto({ ...ADELANTO_INICIAL, tocado: true, montoCentimos: 3_000 }, 20_000)).toBe(3_000);
    expect(montoDeAdelanto({ ...ADELANTO_INICIAL, tocado: true, montoCentimos: null }, 20_000)).toBeNull();
  });
});

describe('confirmarYCobrar', () => {
  it('camino feliz: confirma, crea la deuda con su origen y abona, en ese orden', async () => {
    const orden: string[] = [];
    const d = deps({
      confirmar: vi.fn(async () => (orden.push('confirmar'), ok(pedido))),
      crearDeuda: vi.fn(async () => (orden.push('deuda'), ok(deuda()))),
      abonar: vi.fn(async () => (orden.push('abono'), ok(null as unknown))),
    });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('completo');
    expect(orden).toEqual(['confirmar', 'deuda', 'abono']);
    expect(d.crearDeuda).toHaveBeenCalledWith({ contactoId: 'c1', concepto: 'Pedido PED-PRI-2026-0001', totalCentimos: 10_000, origenTipo: 'pedido', origenId: 'p1' });
    expect(d.abonar).toHaveBeenCalledWith('d1', 5_000, 'efectivo');
  });

  it('si falla confirmar no se hace nada más', async () => {
    const d = deps({ confirmar: vi.fn(async () => mal('estado_invalido', 'Ya no es borrador.')) });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_confirmar');
    expect(r.mensaje).toContain('No se cobró nada');
    expect(d.crearDeuda).not.toHaveBeenCalled();
    expect(d.buscarDeuda).not.toHaveBeenCalled();
    expect(d.abonar).not.toHaveBeenCalled();
  });

  it('el total final menor que el adelanto detiene el cobro y deja el pedido confirmado', async () => {
    const d = deps({ confirmar: vi.fn(async () => ok({ ...pedido, totalCentimos: 4_000 })) });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_deuda');
    expect(d.crearDeuda).not.toHaveBeenCalled();
    expect(r.mensaje).toContain('confirmado');
  });

  it('conflicto de origen: reutiliza la deuda existente y no duplica', async () => {
    const d = deps({
      crearDeuda: vi.fn(async () => mal('conflicto', 'Ese documento de origen ya tiene una deuda.')),
      buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ id: 'previa' }))),
    });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('completo');
    expect(d.abonar).toHaveBeenCalledWith('previa', 5_000, 'efectivo');
    expect(d.buscarDeuda).toHaveBeenCalledWith('p1', 'c1');
  });

  it('conflicto pero la deuda no aparece: avisa y no abona', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('conflicto', 'Ya tiene deuda.')) });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('quedó confirmado');
    expect(d.abonar).not.toHaveBeenCalled();
  });

  it('conflicto y la búsqueda también falla: no abona', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('conflicto')), buscarDeuda: vi.fn(async () => mal('sin_conexion')) });
    expect((await confirmarYCobrar(d, params)).estado).toBe('sin_deuda');
    expect(d.abonar).not.toHaveBeenCalled();
  });

  it('crear la deuda cae por red pero sí se creó: la reutiliza', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('sin_conexion')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda())) });
    expect((await confirmarYCobrar(d, params)).estado).toBe('completo');
    expect(d.abonar).toHaveBeenCalledTimes(1);
  });

  it('un error de negocio al crear la deuda no busca ni abona', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('sin_permiso', 'No puedes crear deudas.')) });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('No puedes crear deudas.');
    expect(d.buscarDeuda).not.toHaveBeenCalled();
    expect(d.abonar).not.toHaveBeenCalled();
  });

  it('si falla el abono dice qué quedó hecho y qué falta, con la deuda para el enlace', async () => {
    const d = deps({
      abonar: vi.fn(async () => mal('sin_permiso', 'No hay cuenta.')),
      buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda())),
    });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_abono');
    if (r.estado !== 'sin_abono') return;
    expect(r.deuda.id).toBe('d1');
    expect(r.mensaje).toContain('confirmado');
    expect(r.mensaje).toContain('CXC-1');
    expect(r.mensaje).toContain('Por cobrar');
  });

  it('el abono cae por red pero sí llegó: se da por cobrado, sin repetir', async () => {
    const d = deps({
      abonar: vi.fn(async () => mal('sin_conexion')),
      buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ abonadoCentimos: 5_000, saldoCentimos: 5_000 }))),
    });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('completo');
    expect(d.abonar).toHaveBeenCalledTimes(1);
  });

  it('el abono falla y no se puede comprobar: pide revisar antes de repetir', async () => {
    const d = deps({ abonar: vi.fn(async () => mal('sin_conexion')), buscarDeuda: vi.fn(async () => mal('sin_conexion')) });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_abono');
    expect(r.mensaje).toContain('No pudimos comprobar');
  });

  it('deuda reutilizada que ya tiene el adelanto abonado: no abona otra vez', async () => {
    const d = deps({
      crearDeuda: vi.fn(async () => mal('conflicto')),
      buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ abonadoCentimos: 6_000, saldoCentimos: 4_000 }))),
    });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('completo');
    expect(r.mensaje).toContain('no se registró otro adelanto');
    expect(d.abonar).not.toHaveBeenCalled();
  });

  it('deuda reutilizada con saldo menor que el adelanto: no abona y avisa', async () => {
    const d = deps({
      crearDeuda: vi.fn(async () => mal('conflicto')),
      buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ abonadoCentimos: 4_000, saldoCentimos: 3_000, totalCentimos: 7_000 }))),
    });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_abono');
    expect(d.abonar).not.toHaveBeenCalled();
  });

  it('el abono falla y la deuda sigue sin abonos: dice que falta', async () => {
    const d = deps({ abonar: vi.fn(async () => mal('valor_invalido')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda())) });
    const r = await confirmarYCobrar(d, params);
    expect(r.estado).toBe('sin_abono');
    expect(r.mensaje).toContain('Falta el adelanto');
  });
});
