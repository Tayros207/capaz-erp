import { describe, expect, it } from 'vitest';
import {
  OPCIONES_DE_PAGO, PAGO_INICIAL, cuentaDeCobro, erroresEnVivo, errorDeMonto, errorDeVencimiento, montoDePago, pagoAlConfirmar, puedeDefinirPago, saldoDePago, textoDeConfirmar, validarPago,
  type CuentaParaCobrar, type PagoDeHoja,
} from './pago.ts';

const caja: CuentaParaCobrar = { id: 'k1', nombre: 'Caja', esPrincipal: true };
const banco: CuentaParaCobrar = { id: 'k2', nombre: 'BCP', esPrincipal: false };
const hoy = '2026-11-21';
const con = (extra: Partial<PagoDeHoja>): PagoDeHoja => ({ ...PAGO_INICIAL, ...extra });
const ctx = (extra: Partial<{ totalCentimos: number; cuentas: readonly CuentaParaCobrar[] | null }> = {}) => ({ totalCentimos: 10_000, hoy, cuentas: [caja, banco], ...extra });

describe('las tres opciones', () => {
  it('son «Pagó todo», «Deja adelanto» y «Sin pago», cada una con su frase de consecuencia', () => {
    expect(OPCIONES_DE_PAGO.map((o) => o.titulo)).toEqual(['Pagó todo', 'Deja adelanto', 'Sin pago']);
    expect(OPCIONES_DE_PAGO.map((o) => o.consecuencia)).toEqual([
      'Se anota el cobro completo.',
      'Se cobra el adelanto y el resto queda por cobrar.',
      'No se cobra nada hoy; queda todo por cobrar.',
    ]);
  });
  it('el botón de confirmar cambia con el caso', () => {
    expect(textoDeConfirmar('todo')).toBe('Confirmar y cobrar todo');
    expect(textoDeConfirmar('adelanto')).toBe('Confirmar y cobrar adelanto');
    expect(textoDeConfirmar('ninguno')).toBe('Confirmar, queda por cobrar');
    expect(textoDeConfirmar(null)).toBe('Confirmar pedido');
  });
  it('se puede definir el pago solo con cliente y total mayor que cero', () => {
    expect(puedeDefinirPago({ clienteId: 'c1', totalCentimos: 100 })).toBe(true);
    expect(puedeDefinirPago({ clienteId: undefined, totalCentimos: 100 })).toBe(false);
    expect(puedeDefinirPago({ clienteId: 'c1', totalCentimos: 0 })).toBe(false);
  });
});

describe('montos y saldo', () => {
  it('«Pagó todo» cobra el total y no deja saldo', () => {
    expect(montoDePago(con({ modo: 'todo' }), 11_800)).toBe(11_800);
    expect(saldoDePago(con({ modo: 'todo' }), 11_800)).toBe(0);
  });
  it('«Deja adelanto» sugiere el 50 % y sigue al total mientras nadie lo toque', () => {
    expect(montoDePago(con({ modo: 'adelanto' }), 11_800)).toBe(5_900);
    expect(montoDePago(con({ modo: 'adelanto' }), 20_000)).toBe(10_000);
    expect(saldoDePago(con({ modo: 'adelanto' }), 11_800)).toBe(5_900);
  });
  it('tocado, se queda con lo escrito aunque cambie el total (incluso vacío)', () => {
    expect(montoDePago(con({ modo: 'adelanto', tocado: true, montoCentimos: 3_000 }), 20_000)).toBe(3_000);
    expect(montoDePago(con({ modo: 'adelanto', tocado: true, montoCentimos: null }), 20_000)).toBeNull();
    expect(saldoDePago(con({ modo: 'adelanto', tocado: true, montoCentimos: 3_000 }), 20_000)).toBe(17_000);
  });
  it('el saldo de un adelanto inválido no se inventa', () => {
    expect(saldoDePago(con({ modo: 'adelanto', tocado: true, montoCentimos: 20_000 }), 20_000)).toBeNull();
    expect(saldoDePago(con({ modo: 'adelanto', tocado: true, montoCentimos: null }), 20_000)).toBeNull();
  });
  it('«Sin pago» no cobra nada y deja todo por cobrar; sin elegir no hay monto ni saldo', () => {
    expect(montoDePago(con({ modo: 'ninguno' }), 11_800)).toBe(0);
    expect(saldoDePago(con({ modo: 'ninguno' }), 11_800)).toBe(11_800);
    expect(montoDePago(PAGO_INICIAL, 11_800)).toBeNull();
    expect(saldoDePago(PAGO_INICIAL, 11_800)).toBeNull();
  });
});

describe('validaciones', () => {
  it('el adelanto es mayor que cero y menor que el total', () => {
    expect(errorDeMonto(5_000, 10_000)).toBeNull();
    expect(errorDeMonto(9_999, 10_000)).toBeNull();
    expect(errorDeMonto(null, 10_000)).toMatch(/monto/);
    expect(errorDeMonto(0, 10_000)).toMatch(/monto/);
    expect(errorDeMonto(1.5, 10_000)).toMatch(/monto/);
    expect(errorDeMonto(10_000, 10_000)).toMatch(/Pagó todo/);
    expect(errorDeMonto(10_001, 10_000)).toMatch(/menor que el total/);
  });
  it('el vencimiento no puede ser anterior a hoy; vacío, hoy o después sirven', () => {
    expect(errorDeVencimiento('', hoy)).toBeNull();
    expect(errorDeVencimiento(hoy, hoy)).toBeNull();
    expect(errorDeVencimiento('2026-12-30', hoy)).toBeNull();
    expect(errorDeVencimiento('2026-11-20', hoy)).toBe('El vencimiento no puede ser anterior a hoy.');
  });
  it('sin elegir, confirmar pide elegir (nunca se asume un pago)', () => {
    expect(validarPago(PAGO_INICIAL, ctx())).toEqual({ modo: 'Elige cómo paga el cliente.' });
  });
  it('«Pagó todo» con la cuenta principal por defecto no tiene errores', () => {
    expect(validarPago(con({ modo: 'todo' }), ctx())).toEqual({});
  });
  it('«Deja adelanto» valida monto y vencimiento; «Sin pago» solo el vencimiento', () => {
    expect(validarPago(con({ modo: 'adelanto', tocado: true, montoCentimos: 10_000, venceEn: '2026-11-01' }), ctx())).toEqual({
      monto: expect.stringContaining('Pagó todo'),
      venceEn: 'El vencimiento no puede ser anterior a hoy.',
    });
    expect(validarPago(con({ modo: 'ninguno', venceEn: '2026-11-01' }), ctx())).toEqual({ venceEn: 'El vencimiento no puede ser anterior a hoy.' });
    expect(validarPago(con({ modo: 'ninguno', venceEn: '2026-12-01' }), ctx())).toEqual({});
  });
  it('en «Pagó todo» el vencimiento no cuenta (no queda saldo)', () => {
    expect(validarPago(con({ modo: 'todo', venceEn: '2026-11-01' }), ctx())).toEqual({});
  });
  it('pide la cuenta cuando no hay principal ni una sola; avisa si no existe ninguna', () => {
    expect(validarPago(con({ modo: 'todo' }), ctx({ cuentas: [{ ...caja, esPrincipal: false }, banco] }))).toEqual({ cuenta: 'Elige la cuenta donde entra el dinero.' });
    expect(validarPago(con({ modo: 'todo', cuentaId: 'k2' }), ctx({ cuentas: [{ ...caja, esPrincipal: false }, banco] }))).toEqual({});
    expect(validarPago(con({ modo: 'adelanto' }), ctx({ cuentas: [] }))).toEqual({ cuenta: expect.stringContaining('No hay cuentas') });
    // «Sin pago» no mueve dinero: no necesita cuenta.
    expect(validarPago(con({ modo: 'ninguno' }), ctx({ cuentas: [] }))).toEqual({});
  });
  it('con las cuentas sin cargar no objeta la cuenta: el servidor usa la principal', () => {
    expect(validarPago(con({ modo: 'todo' }), ctx({ cuentas: null }))).toEqual({});
  });
  it('antes de intentar confirmar solo se ven los errores que se corrigen al escribir', () => {
    expect(erroresEnVivo({ modo: 'a', monto: 'b', cuenta: 'c', venceEn: 'd' })).toEqual({ monto: 'b', venceEn: 'd' });
    expect(erroresEnVivo({ modo: 'a' })).toEqual({});
  });
});

describe('cuenta donde entra', () => {
  it('por defecto la principal; elegida, la elegida', () => {
    expect(cuentaDeCobro(null, [banco, caja])).toBe('k1');
    expect(cuentaDeCobro('k2', [banco, caja])).toBe('k2');
  });
  it('sin principal usa la única cuenta; con varias no adivina', () => {
    expect(cuentaDeCobro(null, [banco])).toBe('k2');
    expect(cuentaDeCobro(null, [banco, { ...banco, id: 'k3' }])).toBeNull();
    expect(cuentaDeCobro(null, [])).toBeNull();
  });
  it('una cuenta elegida que ya no está en la lista (se archivó) vuelve a la principal', () => {
    expect(cuentaDeCobro('vieja', [caja, banco])).toBe('k1');
  });
  it('con la lista sin cargar respeta la elegida y, si no hay, deja que el servidor decida', () => {
    expect(cuentaDeCobro('k2', null)).toBe('k2');
    expect(cuentaDeCobro(null, null)).toBeNull();
  });
});

describe('lo que se envía al confirmar', () => {
  const cuentas = [caja, banco];
  it('«Pagó todo»: medio y cuenta, sin monto (cobra el total que confirme el servidor)', () => {
    expect(pagoAlConfirmar(con({ modo: 'todo', medio: 'yape', cuentaId: 'k2' }), 10_000, cuentas)).toEqual({ modo: 'todo', medio: 'yape', cuentaId: 'k2' });
  });
  it('«Deja adelanto»: monto vigente, medio, cuenta principal por defecto y vencimiento', () => {
    expect(pagoAlConfirmar(con({ modo: 'adelanto', medio: 'transferencia', venceEn: '2026-12-15' }), 11_800, cuentas)).toEqual({
      modo: 'adelanto', montoCentimos: 5_900, medio: 'transferencia', cuentaId: 'k1', venceEn: '2026-12-15',
    });
  });
  it('«Sin pago»: solo el vencimiento (vacío es sin vencimiento)', () => {
    expect(pagoAlConfirmar(con({ modo: 'ninguno', venceEn: '2026-12-15' }), 10_000, cuentas)).toEqual({ modo: 'ninguno', venceEn: '2026-12-15' });
    expect(pagoAlConfirmar(con({ modo: 'ninguno' }), 10_000, cuentas)).toEqual({ modo: 'ninguno', venceEn: null });
  });
  it('sin elegir no hay nada que enviar', () => {
    expect(pagoAlConfirmar(PAGO_INICIAL, 10_000, cuentas)).toBeNull();
  });
});
