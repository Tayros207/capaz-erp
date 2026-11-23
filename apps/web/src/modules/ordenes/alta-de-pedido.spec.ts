import { describe, expect, it, vi } from 'vitest';
import type { Res } from './adelanto.ts';
import { crearYConfirmar, type DependenciasDeAlta } from './alta-de-pedido.ts';
import type { PagoAlConfirmar, ResultadoDelCobro } from './cobro-del-pedido.ts';

const ARGS = { clienteId: 'c1', lineas: [] };
const ok = <T>(datos: T): Res<T> => ({ ok: true, datos });
const mal = (mensaje: string): Res<never> => ({ ok: false, codigo: 'x', mensaje });
const deuda = { id: 'd1', codigo: 'CXC-1', totalCentimos: 100, abonadoCentimos: 50, saldoCentimos: 50 };
const completo: ResultadoDelCobro = { estado: 'completo', mensaje: 'listo', pedidoCodigo: 'PED-1', deuda };

const adelanto: PagoAlConfirmar = { modo: 'adelanto', montoCentimos: 50, medio: 'yape', cuentaId: 'k1', venceEn: null };
const todo: PagoAlConfirmar = { modo: 'todo', medio: 'efectivo', cuentaId: null };
const ninguno: PagoAlConfirmar = { modo: 'ninguno', venceEn: '2026-12-01' };

function deps(extra: Partial<DependenciasDeAlta> = {}) {
  return {
    crear: vi.fn(async () => ok({ id: 'p1' })),
    confirmar: vi.fn(async () => ok({ id: 'p1', codigo: 'PED-1' })),
    confirmarYCobrar: vi.fn(async () => completo),
    ...extra,
  };
}

describe('crearYConfirmar', () => {
  it('si crear falla no confirma nada y no hay borrador', async () => {
    const d = deps({ crear: vi.fn(async () => mal('Cliente inválido.')) });
    expect(await crearYConfirmar(d, ARGS, adelanto)).toEqual({ estado: 'sin_crear', mensaje: 'Cliente inválido.' });
    expect(d.confirmar).not.toHaveBeenCalled();
    expect(d.confirmarYCobrar).not.toHaveBeenCalled();
  });
  it('si crear lanza, tampoco confirma (nunca lanza hacia fuera)', async () => {
    const d = deps({ crear: vi.fn(async () => { throw new Error('red'); }) });
    expect(await crearYConfirmar(d, ARGS, null)).toEqual({ estado: 'sin_crear', mensaje: 'red' });
  });
  it('creado pero sin poder confirmar: queda como borrador con su id y crear se llamó una sola vez', async () => {
    const d = deps({ confirmar: vi.fn(async () => mal('Sin líneas.')) });
    const r = await crearYConfirmar(d, ARGS, null);
    expect(r).toEqual({ estado: 'borrador', id: 'p1', mensaje: 'Se guardó como borrador, pero no se pudo confirmar: Sin líneas.' });
    expect(d.crear).toHaveBeenCalledTimes(1);
  });
  it('sin pago que definir (sin acceso a Registro, sin total) solo confirma: no hay deuda ni cobro', async () => {
    const d = deps();
    expect(await crearYConfirmar(d, ARGS, null)).toEqual({ estado: 'confirmado', id: 'p1', codigo: 'PED-1', cobro: null });
    expect(d.confirmar).toHaveBeenCalledWith('p1');
    expect(d.confirmarYCobrar).not.toHaveBeenCalled();
  });
  it.each([['adelanto', adelanto], ['todo', todo], ['ninguno', ninguno]])('con el pago «%s» delega en confirmarYCobrar y devuelve su desenlace', async (_n, pago) => {
    const d = deps();
    const r = await crearYConfirmar(d, ARGS, pago);
    expect(d.confirmarYCobrar).toHaveBeenCalledWith('p1', pago);
    expect(d.confirmar).not.toHaveBeenCalled();
    expect(r).toEqual({ estado: 'confirmado', id: 'p1', codigo: 'PED-1', cobro: completo });
  });
  it('con pago, si no se confirmó queda como borrador (y el pedido no se vuelve a crear)', async () => {
    const sin = deps({ confirmarYCobrar: vi.fn(async () => ({ estado: 'sin_confirmar' as const, mensaje: 'No se confirmó el pedido: Falta stock. No se cobró nada.' })) });
    expect(await crearYConfirmar(sin, ARGS, adelanto)).toEqual({ estado: 'borrador', id: 'p1', mensaje: 'Se guardó como borrador, pero no se pudo confirmar: Falta stock. No se cobró nada.' });
    expect(sin.crear).toHaveBeenCalledTimes(1);
  });
  it('confirmado pero sin deuda, o con deuda pero sin abono: sigue confirmado y trae el desenlace parcial', async () => {
    const sinDeuda: ResultadoDelCobro = { estado: 'sin_deuda', mensaje: 'sin deuda', pedidoCodigo: 'PED-1' };
    const a = deps({ confirmarYCobrar: vi.fn(async () => sinDeuda) });
    expect(await crearYConfirmar(a, ARGS, ninguno)).toMatchObject({ estado: 'confirmado', cobro: sinDeuda });
    const sinAbono: ResultadoDelCobro = { estado: 'sin_abono', mensaje: 'sin abono', pedidoCodigo: 'PED-1', deuda };
    const b = deps({ confirmarYCobrar: vi.fn(async () => sinAbono) });
    expect(await crearYConfirmar(b, ARGS, todo)).toMatchObject({ estado: 'confirmado', cobro: sinAbono });
  });
  it('si el flujo de cobro lanza, queda como borrador con el motivo (nunca lanza hacia fuera)', async () => {
    const d = deps({ confirmarYCobrar: vi.fn(async () => { throw new Error('boom'); }) });
    expect(await crearYConfirmar(d, ARGS, todo)).toEqual({ estado: 'borrador', id: 'p1', mensaje: 'Se guardó como borrador, pero no se pudo confirmar: boom' });
  });
});
