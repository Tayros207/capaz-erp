import { describe, expect, it, vi } from 'vitest';
import type { DeudaDelAdelanto, PedidoConfirmado, Res } from './adelanto.ts';
import { confirmarYCobrarPedido, type DependenciasDelCobro, type PagoAlConfirmar } from './cobro-del-pedido.ts';

const formato = (c: number) => `S/ ${(c / 100).toFixed(2)}`;
const ok = <T>(datos: T): Res<T> => ({ ok: true, datos });
const mal = (codigo: string, mensaje = 'Falló.'): Res<never> => ({ ok: false, codigo, mensaje });
const pedido: PedidoConfirmado = { id: 'p1', codigo: 'PED-PRI-2026-0001', clienteId: 'c1', totalCentimos: 10_000 };
const deuda = (extra: Partial<DeudaDelAdelanto> = {}): DeudaDelAdelanto => ({ id: 'd1', codigo: 'CXC-1', totalCentimos: 10_000, abonadoCentimos: 0, saldoCentimos: 10_000, ...extra });
const conAdelanto = (adelanto: number) => deuda({ abonadoCentimos: adelanto, saldoCentimos: 10_000 - adelanto });

const todo: PagoAlConfirmar = { modo: 'todo', medio: 'yape', cuentaId: 'k1' };
const adelanto: PagoAlConfirmar = { modo: 'adelanto', montoCentimos: 4_000, medio: 'transferencia', cuentaId: 'k2', venceEn: '2026-12-15' };
const ninguno: PagoAlConfirmar = { modo: 'ninguno', venceEn: '2026-12-01' };

function deps(extra: Partial<DependenciasDelCobro> = {}) {
  return {
    confirmar: vi.fn(async () => ok(pedido)),
    crearDeuda: vi.fn(async () => ok(deuda())),
    crearDeudaConAdelanto: vi.fn(async () => ok(conAdelanto(4_000))),
    buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(null)),
    abonar: vi.fn(async () => ok(null as unknown)),
    ...extra,
  };
}
const correr = (d: DependenciasDelCobro, pago: PagoAlConfirmar) => confirmarYCobrarPedido(d, pago, formato);

describe('«Pagó todo»', () => {
  it('confirma, crea la deuda por el total con su origen y abona el total, en ese orden', async () => {
    const orden: string[] = [];
    const d = deps({
      confirmar: vi.fn(async () => (orden.push('confirmar'), ok(pedido))),
      crearDeuda: vi.fn(async () => (orden.push('deuda'), ok(deuda()))),
      abonar: vi.fn(async () => (orden.push('abono'), ok(null as unknown))),
    });
    const r = await correr(d, todo);
    expect(orden).toEqual(['confirmar', 'deuda', 'abono']);
    expect(d.crearDeuda).toHaveBeenCalledWith({ contactoId: 'c1', concepto: 'Pedido PED-PRI-2026-0001', totalCentimos: 10_000, origenTipo: 'pedido', origenId: 'p1' });
    expect(d.abonar).toHaveBeenCalledWith('d1', 10_000, 'yape', 'k1');
    expect(d.crearDeudaConAdelanto).not.toHaveBeenCalled();
    expect(r).toMatchObject({ estado: 'completo', pedidoCodigo: 'PED-PRI-2026-0001', mensaje: 'Pedido PED-PRI-2026-0001 confirmado y cobrado por completo (S/ 100.00).' });
    if (r.estado === 'completo') expect(r.deuda).toMatchObject({ id: 'd1', abonadoCentimos: 10_000, saldoCentimos: 0 });
  });
  it('cobra el total que confirmó el servidor, aunque la hoja mostrara otro', async () => {
    const d = deps({ confirmar: vi.fn(async () => ok({ ...pedido, totalCentimos: 11_800 })), crearDeuda: vi.fn(async () => ok(deuda({ totalCentimos: 11_800, saldoCentimos: 11_800 }))) });
    await correr(d, todo);
    expect(d.abonar).toHaveBeenCalledWith('d1', 11_800, 'yape', 'k1');
  });
  it('sin cuenta elegida la manda como nula (el servidor usa la principal)', async () => {
    const d = deps();
    await correr(d, { modo: 'todo', medio: 'efectivo', cuentaId: null });
    expect(d.abonar).toHaveBeenCalledWith('d1', 10_000, 'efectivo', null);
  });
  it('confirmado pero sin deuda: no abona y dice que no se cobró nada', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('sin_permiso', 'No puedes crear deudas.')) });
    const r = await correr(d, todo);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('quedó confirmado');
    expect(r.mensaje).toContain('No puedes crear deudas.');
    expect(r.mensaje).toContain('No se cobró nada');
    expect(d.buscarDeuda).not.toHaveBeenCalled();
    expect(d.abonar).not.toHaveBeenCalled();
  });
  it('deuda creada pero sin abono: dice qué quedó hecho y qué falta, con la deuda para el enlace', async () => {
    const d = deps({ abonar: vi.fn(async () => mal('sin_permiso', 'No hay cuenta.')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda())) });
    const r = await correr(d, todo);
    expect(r.estado).toBe('sin_abono');
    if (r.estado !== 'sin_abono') return;
    expect(r.deuda.id).toBe('d1');
    expect(r.mensaje).toContain('confirmado');
    expect(r.mensaje).toContain('CXC-1');
    expect(r.mensaje).toContain('Falta el cobro de S/ 100.00');
    expect(r.mensaje).toContain('Por cobrar');
  });
  it('el abono cae por red pero sí llegó: se da por cobrado, sin repetir', async () => {
    const d = deps({ abonar: vi.fn(async () => mal('sin_conexion')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ abonadoCentimos: 10_000, saldoCentimos: 0 }))) });
    expect((await correr(d, todo)).estado).toBe('completo');
    expect(d.abonar).toHaveBeenCalledTimes(1);
  });
  it('el abono falla y no se puede comprobar: pide revisar antes de repetir', async () => {
    const d = deps({ abonar: vi.fn(async () => mal('sin_conexion')), buscarDeuda: vi.fn(async () => mal('sin_conexion')) });
    const r = await correr(d, todo);
    expect(r.estado).toBe('sin_abono');
    expect(r.mensaje).toContain('No pudimos comprobar');
  });
  it('conflicto de origen: reutiliza la deuda existente y no duplica', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('conflicto', 'Ya tiene deuda.')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ id: 'previa' }))) });
    expect((await correr(d, todo)).estado).toBe('completo');
    expect(d.abonar).toHaveBeenCalledWith('previa', 10_000, 'yape', 'k1');
    expect(d.buscarDeuda).toHaveBeenCalledWith('p1', 'c1');
  });
  it('la deuda reutilizada ya estaba pagada: no cobra otra vez', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('conflicto')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ abonadoCentimos: 10_000, saldoCentimos: 0 }))) });
    const r = await correr(d, todo);
    expect(r.estado).toBe('completo');
    expect(r.mensaje).toContain('no se registró el cobro otra vez');
    expect(d.abonar).not.toHaveBeenCalled();
  });
  it('conflicto pero la deuda no aparece (p. ej. sin cuenta principal): avisa con el motivo y no abona', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('conflicto', 'No hay una cuenta principal.')) });
    const r = await correr(d, todo);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('No hay una cuenta principal.');
    expect(r.mensaje).not.toContain('No pudimos comprobar');
    expect(d.abonar).not.toHaveBeenCalled();
  });
});

describe('«Deja adelanto»', () => {
  it('confirma y crea la deuda con su adelanto en UNA sola operación, con cuenta, medio, vencimiento y origen', async () => {
    const d = deps();
    const r = await correr(d, adelanto);
    expect(d.crearDeudaConAdelanto).toHaveBeenCalledTimes(1);
    expect(d.crearDeudaConAdelanto).toHaveBeenCalledWith({
      contactoId: 'c1', concepto: 'Pedido PED-PRI-2026-0001', totalCentimos: 10_000, origenTipo: 'pedido', origenId: 'p1', venceEn: '2026-12-15', adelantoCentimos: 4_000, medio: 'transferencia', cuentaId: 'k2',
    });
    // No hay segundo paso que pueda fallar: no se llama a crearDeuda ni a abonar.
    expect(d.crearDeuda).not.toHaveBeenCalled();
    expect(d.abonar).not.toHaveBeenCalled();
    expect(r).toMatchObject({ estado: 'completo', mensaje: 'Pedido PED-PRI-2026-0001 confirmado y adelanto de S/ 40.00 cobrado. Saldo por cobrar: S/ 60.00.' });
  });
  it('sin vencimiento no manda la clave', async () => {
    const d = deps();
    await correr(d, { ...adelanto, venceEn: null, cuentaId: null } as PagoAlConfirmar);
    const [args] = vi.mocked(d.crearDeudaConAdelanto).mock.calls[0] ?? [];
    expect(args).not.toHaveProperty('venceEn');
    expect(args).toMatchObject({ cuentaId: null });
  });
  it('si no se confirma el pedido no se hace nada más', async () => {
    const d = deps({ confirmar: vi.fn(async () => mal('estado_invalido', 'Ya no es borrador.')) });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('sin_confirmar');
    expect(r.mensaje).toContain('No se cobró nada');
    expect(d.crearDeudaConAdelanto).not.toHaveBeenCalled();
    expect(d.buscarDeuda).not.toHaveBeenCalled();
  });
  it('un total final que no encaja con el adelanto (menor o igual) deja el pedido confirmado y no cobra', async () => {
    for (const total of [4_000, 3_000]) {
      const d = deps({ confirmar: vi.fn(async () => ok({ ...pedido, totalCentimos: total })) });
      const r = await correr(d, adelanto);
      expect(r.estado).toBe('sin_deuda');
      expect(r.mensaje).toContain('confirmado');
      expect(r.mensaje).toContain('No se cobró nada');
      expect(d.crearDeudaConAdelanto).not.toHaveBeenCalled();
    }
  });
  it('un error de negocio (p. ej. la cuenta ya no existe) deja el pedido confirmado, sin deuda y sin cobro', async () => {
    const d = deps({ crearDeudaConAdelanto: vi.fn(async () => mal('no_encontrado', 'No existe esa cuenta.')) });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('No existe esa cuenta.');
    expect(r.mensaje).toContain('No se cobró nada');
    expect(d.buscarDeuda).not.toHaveBeenCalled();
    expect(d.abonar).not.toHaveBeenCalled();
  });
  it('la respuesta se perdió por red pero la deuda con su adelanto sí quedó: la reconoce y no cobra dos veces', async () => {
    const d = deps({ crearDeudaConAdelanto: vi.fn(async () => mal('sin_conexion')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(conAdelanto(4_000))) });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('completo');
    expect(d.abonar).not.toHaveBeenCalled();
    expect(d.crearDeudaConAdelanto).toHaveBeenCalledTimes(1);
  });
  it('conflicto: el pedido ya tenía una deuda sin abonos; la reutiliza y le anota el adelanto', async () => {
    const d = deps({ crearDeudaConAdelanto: vi.fn(async () => mal('conflicto')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ id: 'previa' }))) });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('completo');
    expect(d.abonar).toHaveBeenCalledWith('previa', 4_000, 'transferencia', 'k2');
    expect(r.mensaje).toContain('adelanto de S/ 40.00 cobrado');
  });
  it('conflicto con la deuda reutilizada y el abono falla: queda con deuda pero sin abono', async () => {
    const d = deps({
      crearDeudaConAdelanto: vi.fn(async () => mal('conflicto')),
      buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ id: 'previa' }))),
      abonar: vi.fn(async () => mal('sin_permiso', 'No hay cuenta.')),
    });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('sin_abono');
    expect(r.mensaje).toContain('Falta el adelanto de S/ 40.00');
  });
  it('la deuda reutilizada ya tiene el adelanto (o más): no lo repite', async () => {
    const d = deps({ crearDeudaConAdelanto: vi.fn(async () => mal('conflicto')), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(conAdelanto(6_000))) });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('completo');
    expect(r.mensaje).toContain('no se registró el adelanto otra vez');
    expect(d.abonar).not.toHaveBeenCalled();
  });
  it('sin conexión y sin poder comprobar: no repite y pide revisar Por cobrar', async () => {
    const d = deps({ crearDeudaConAdelanto: vi.fn(async () => mal('sin_conexion', 'Sin conexión.')), buscarDeuda: vi.fn(async () => mal('sin_conexion')) });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('No pudimos comprobar si se creó');
    expect(r.mensaje).not.toContain('No se cobró nada');
    expect(d.abonar).not.toHaveBeenCalled();
  });
  it('sin conexión, comprobado que la deuda no existe: se dice que no se cobró nada', async () => {
    const d = deps({ crearDeudaConAdelanto: vi.fn(async () => mal('sin_conexion', 'Sin conexión.')) });
    const r = await correr(d, adelanto);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('No se cobró nada');
  });
});

describe('«Sin pago»', () => {
  it('confirma y crea solo la deuda por el total, con su vencimiento y origen; no abona ni mueve dinero', async () => {
    const d = deps();
    const r = await correr(d, ninguno);
    expect(d.crearDeuda).toHaveBeenCalledWith({ contactoId: 'c1', concepto: 'Pedido PED-PRI-2026-0001', totalCentimos: 10_000, origenTipo: 'pedido', origenId: 'p1', venceEn: '2026-12-01' });
    expect(d.abonar).not.toHaveBeenCalled();
    expect(d.crearDeudaConAdelanto).not.toHaveBeenCalled();
    expect(r).toMatchObject({ estado: 'completo', mensaje: 'Pedido PED-PRI-2026-0001 confirmado. No se cobró nada hoy: queda por cobrar S/ 100.00.' });
    if (r.estado === 'completo') expect(r.deuda.id).toBe('d1');
  });
  it('sin vencimiento no manda la clave', async () => {
    const d = deps();
    await correr(d, { modo: 'ninguno', venceEn: null });
    expect(vi.mocked(d.crearDeuda).mock.calls[0]?.[0]).not.toHaveProperty('venceEn');
  });
  it('si no se confirma, no crea deuda y el mensaje no habla de cobros', async () => {
    const d = deps({ confirmar: vi.fn(async () => mal('estado_invalido', 'Falta stock.')) });
    const r = await correr(d, ninguno);
    expect(r).toEqual({ estado: 'sin_confirmar', mensaje: 'No se confirmó el pedido: Falta stock.' });
    expect(d.crearDeuda).not.toHaveBeenCalled();
  });
  it('confirmado pero sin deuda: avisa y pide crearla desde Por cobrar para no perder el cobro', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('sin_permiso', 'No puedes crear deudas.')) });
    const r = await correr(d, ninguno);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('quedó confirmado');
    expect(r.mensaje).toContain('No puedes crear deudas.');
    expect(r.mensaje).toContain('para no perder el cobro');
  });
  it('conflicto o sin conexión pero la deuda ya estaba: la reconoce y no duplica', async () => {
    for (const codigo of ['conflicto', 'sin_conexion']) {
      const d = deps({ crearDeuda: vi.fn(async () => mal(codigo)), buscarDeuda: vi.fn(async () => ok<DeudaDelAdelanto | null>(deuda({ id: 'previa' }))) });
      const r = await correr(d, ninguno);
      expect(r.estado).toBe('completo');
      expect(d.crearDeuda).toHaveBeenCalledTimes(1);
      expect(d.abonar).not.toHaveBeenCalled();
    }
  });
  it('sin conexión y sin poder comprobar: pide revisar Por cobrar antes de repetir', async () => {
    const d = deps({ crearDeuda: vi.fn(async () => mal('sin_conexion', 'Sin conexión.')), buscarDeuda: vi.fn(async () => mal('sin_conexion')) });
    const r = await correr(d, ninguno);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('revisa Por cobrar');
  });
});

describe('el total que confirma el servidor manda', () => {
  it.each([todo, adelanto, ninguno])('con total en cero no crea deuda ni cobra (%o)', async (pago) => {
    const d = deps({ confirmar: vi.fn(async () => ok({ ...pedido, totalCentimos: 0 })) });
    const r = await correr(d, pago);
    expect(r.estado).toBe('sin_deuda');
    expect(r.mensaje).toContain('confirmado');
    expect(d.crearDeuda).not.toHaveBeenCalled();
    expect(d.crearDeudaConAdelanto).not.toHaveBeenCalled();
    expect(d.abonar).not.toHaveBeenCalled();
  });
});
