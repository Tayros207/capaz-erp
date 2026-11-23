import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BloqueDePago } from './bloque-pago.tsx';
import { PAGO_INICIAL, type CuentaParaCobrar, type PagoDeHoja } from './pago.ts';

const cuentas: CuentaParaCobrar[] = [{ id: 'k1', nombre: 'Caja chica', esPrincipal: true }, { id: 'k2', nombre: 'BCP Soles', esPrincipal: false }];

function html(extra: Partial<{ habilitado: boolean; total: number; pago: Partial<PagoDeHoja>; errores: Record<string, string>; cuentas: CuentaParaCobrar[] | null; cargando: boolean }> = {}) {
  return renderToStaticMarkup(
    <BloqueDePago
      habilitado={extra.habilitado ?? true}
      totalCentimos={extra.total ?? 11_800}
      hoy="2026-11-21"
      pago={{ ...PAGO_INICIAL, ...extra.pago }}
      errores={extra.errores ?? {}}
      cuentas={extra.cuentas === undefined ? cuentas : extra.cuentas}
      cargandoCuentas={extra.cargando ?? false}
      alCambiar={() => undefined}
    />,
  );
}

describe('BloqueDePago', () => {
  it('lleva el título «Pago», la pregunta y las tres opciones como radios', () => {
    const h = html();
    expect(h).toContain('>Pago</h2>');
    expect(h).toContain('¿Cómo paga el cliente?');
    expect(h).toContain('role="radiogroup"');
    for (const t of ['Pagó todo', 'Deja adelanto', 'Sin pago']) expect(h).toContain(t);
    expect(h.match(/type="radio"/g)).toHaveLength(3);
  });
  it('sin elegir no muestra campos ni frases de consecuencia', () => {
    const h = html();
    expect(h).not.toContain('Método de pago');
    expect(h).not.toContain('Saldo por cobrar');
    expect(h).not.toContain('Se anota el cobro completo');
  });
  it('«Pagó todo»: monto del total (solo lectura), método, cuenta principal por defecto y saldo en cero', () => {
    const h = html({ pago: { modo: 'todo' } });
    expect(h).toContain('Se anota el cobro completo.');
    expect(h).toContain('Monto cobrado');
    expect(h).toContain('readOnly');
    expect(h).toContain('118.00');
    expect(h).toContain('Método de pago');
    expect(h).toContain('Yape');
    expect(h).toContain('Cuenta donde entra');
    expect(h).toContain('Caja chica (principal)');
    expect(h).toContain('Saldo por cobrar');
    expect(h).toContain('S/ 0.00');
    expect(h).not.toContain('Vence');
  });
  it('«Deja adelanto»: monto sugerido del 50 %, saldo en vivo y vencimiento opcional', () => {
    const h = html({ pago: { modo: 'adelanto' } });
    expect(h).toContain('Se cobra el adelanto y el resto queda por cobrar.');
    expect(h).toContain('Monto del adelanto');
    expect(h).toContain('59.00');
    expect(h).toContain('Sugerido: el 50 % de S/ 118.00.');
    expect(h).toContain('Saldo por cobrar');
    expect(h).toContain('S/ 59.00');
    expect(h).toContain('Vence el saldo');
    expect(h).toContain('min="2026-11-21"');
  });
  it('«Deja adelanto» con un monto escrito: el saldo sigue lo escrito', () => {
    const h = html({ pago: { modo: 'adelanto', tocado: true, montoCentimos: 3_000 } });
    expect(h).toContain('S/ 88.00');
  });
  it('«Sin pago»: sin monto, método ni cuenta; el saldo es todo el total y hay vencimiento', () => {
    const h = html({ pago: { modo: 'ninguno' } });
    expect(h).toContain('No se cobra nada hoy; queda todo por cobrar.');
    expect(h).not.toContain('Método de pago');
    expect(h).not.toContain('Cuenta donde entra');
    expect(h).toContain('S/ 118.00');
    expect(h).toContain('Vence el cobro');
  });
  it('sin cliente o sin total se ve apagado, con la pista, y no ofrece campos ni opción marcada', () => {
    const h = html({ habilitado: false, pago: { modo: 'todo' } });
    expect(h).toContain('Elige un cliente y agrega productos para definir el pago.');
    expect(h.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
    expect(h).not.toContain('checked=""');
    expect(h).not.toContain('Método de pago');
  });
  it('con el bloque habilitado no muestra la pista', () => {
    expect(html()).not.toContain('Elige un cliente y agrega productos');
  });
  it('los errores salen junto a su campo, con mensajes específicos', () => {
    expect(html({ errores: { modo: 'Elige cómo paga el cliente.' } })).toContain('Elige cómo paga el cliente.');
    const a = html({ pago: { modo: 'adelanto', tocado: true, montoCentimos: 11_800 }, errores: { monto: 'El adelanto debe ser menor que el total. Si pagó todo, elige «Pagó todo».', venceEn: 'El vencimiento no puede ser anterior a hoy.' } });
    expect(a).toContain('El adelanto debe ser menor que el total.');
    expect(a).toContain('El vencimiento no puede ser anterior a hoy.');
    expect(a).toContain('aria-invalid="true"');
  });
  it('las cuentas: cargando, sin poder leerlas y sin ninguna', () => {
    expect(html({ pago: { modo: 'todo' }, cuentas: null, cargando: true })).toContain('Cargando cuentas…');
    const fallo = html({ pago: { modo: 'todo' }, cuentas: null });
    expect(fallo).toContain('Cuenta principal');
    expect(fallo).toContain('No pudimos leer tus cuentas');
    const vacio = html({ pago: { modo: 'todo' }, cuentas: [], errores: { cuenta: 'No hay cuentas donde anotar el cobro. Crea una en Registro.' } });
    expect(vacio).toContain('Sin cuentas');
    expect(vacio).toContain('No hay cuentas donde anotar el cobro.');
  });
});
