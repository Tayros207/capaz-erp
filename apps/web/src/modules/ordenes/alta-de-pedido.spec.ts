import { describe, expect, it, vi } from 'vitest';
import type { Res, ResultadoDelAdelanto } from './adelanto.ts';
import { crearYConfirmar, type DependenciasDeAlta } from './alta-de-pedido.ts';

const ARGS = { clienteId: 'c1', lineas: [] };
const ok = <T>(datos: T): Res<T> => ({ ok: true, datos });
const mal = (mensaje: string): Res<never> => ({ ok: false, codigo: 'x', mensaje });
const completo: ResultadoDelAdelanto = { estado: 'completo', mensaje: 'listo', pedidoCodigo: 'PED-1', deuda: { id: 'd1', codigo: 'CXC-1', totalCentimos: 100, abonadoCentimos: 50, saldoCentimos: 50 } };

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
    expect(await crearYConfirmar(d, ARGS, null)).toEqual({ estado: 'sin_crear', mensaje: 'Cliente inválido.' });
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
  it('sin adelanto solo confirma', async () => {
    const d = deps();
    expect(await crearYConfirmar(d, ARGS, null)).toEqual({ estado: 'confirmado', id: 'p1', codigo: 'PED-1', adelanto: null });
    expect(d.confirmar).toHaveBeenCalledWith('p1');
    expect(d.confirmarYCobrar).not.toHaveBeenCalled();
  });
  it('con adelanto delega en confirmarYCobrar y devuelve su desenlace', async () => {
    const d = deps();
    const r = await crearYConfirmar(d, ARGS, { montoCentimos: 50, medio: 'yape' });
    expect(d.confirmarYCobrar).toHaveBeenCalledWith('p1', 50, 'yape');
    expect(d.confirmar).not.toHaveBeenCalled();
    expect(r).toEqual({ estado: 'confirmado', id: 'p1', codigo: 'PED-1', adelanto: completo });
  });
  it('con adelanto, si no se confirmó queda como borrador; si falla la deuda sigue confirmado', async () => {
    const sin = deps({ confirmarYCobrar: vi.fn(async () => ({ estado: 'sin_confirmar' as const, mensaje: 'No se confirmó el pedido: Falta stock. No se cobró nada.' })) });
    expect(await crearYConfirmar(sin, ARGS, { montoCentimos: 50, medio: 'efectivo' })).toEqual({ estado: 'borrador', id: 'p1', mensaje: 'Se guardó como borrador, pero no se pudo confirmar: Falta stock. No se cobró nada.' });
    const parcial: ResultadoDelAdelanto = { estado: 'sin_deuda', mensaje: 'sin deuda', pedidoCodigo: 'PED-1' };
    const conDeuda = deps({ confirmarYCobrar: vi.fn(async () => parcial) });
    expect(await crearYConfirmar(conDeuda, ARGS, { montoCentimos: 50, medio: 'efectivo' })).toMatchObject({ estado: 'confirmado', adelanto: parcial });
  });
});
