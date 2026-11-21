import { describe, expect, it } from 'vitest';
import type { Centimos, CuentaDto } from '@capaz/shared';
import { faltaCancelar, validarMovimiento } from './logica.ts';
import { CAMPOS_EN_ORDEN, formularioParaCaptura, masDatosNaceAbierto, preguntasDe, primeraPista, resumenDeMasDatos, siguienteParaCaptura, textoDelBoton } from './logica-hoja.ts';
import { filaConCantidad, filaDeCatalogo } from './logica-lineas.ts';

const HOY = '2026-03-10';
const cuentas = [{ id: 'caja', nombre: 'Caja', esPrincipal: true, archivadoEn: null }] as unknown as CuentaDto[];
const etiquetas = filaConCantidad(filaDeCatalogo('a', { id: 'p1', nombre: 'Etiquetas adhesivas', unidad: 'millar', precioUnitarioMilesimas: 65_000 }), 2000); // S/ 130.00
const cli = { id: 'cli', nombre: 'Cristina' };

describe('hoja de nuevo ingreso: arranque y textos', () => {
  it('arranca con una fila de producto lista, sin adelanto, hoy y la cuenta principal', () => {
    const f = formularioParaCaptura('ingreso', HOY, cuentas);
    expect(f).toMatchObject({ conAdelanto: false, fecha: HOY, cuentaId: 'caja', medioDePago: 'efectivo' });
    expect(f.productos).toHaveLength(1);
    expect(f.productos[0]?.elegida).toBe(false);
  });

  it('tras guardar vuelve a una fila lista y conserva fecha, cuenta, medio y categoría', () => {
    const lleno = { ...formularioParaCaptura('egreso', HOY, cuentas), categoriaId: 'cat', medioDePago: 'yape' as const, contacto: cli, conAdelanto: true, adelanto: 100 as Centimos, productos: [etiquetas] };
    const s = siguienteParaCaptura(lleno);
    expect(s).toMatchObject({ conAdelanto: false, contacto: null, categoriaId: 'cat', medioDePago: 'yape', adelanto: null, fecha: HOY });
    expect(s.productos).toHaveLength(1);
    expect(s.productos[0]?.elegida).toBe(false);
  });

  it('las preguntas usan el lenguaje de quien vende o de quien compra', () => {
    expect(preguntasDe('ingreso')).toMatchObject({ persona: '¿Quién es el cliente?', productos: '¿Qué vendiste?' });
    expect(preguntasDe('egreso')).toMatchObject({ persona: '¿A quién le compraste?', productos: '¿Qué compraste?' });
  });

  it('el botón principal dice qué se va a registrar', () => {
    expect(textoDelBoton({ tipo: 'ingreso', conAdelanto: false })).toBe('Registrar ingreso');
    expect(textoDelBoton({ tipo: 'egreso', conAdelanto: false })).toBe('Registrar egreso');
    expect(textoDelBoton({ tipo: 'ingreso', conAdelanto: true })).toBe('Registrar con adelanto');
  });
});

describe('hoja: «Más datos»', () => {
  const base = { fecha: HOY, medioDePago: 'efectivo' as const, descripcion: '' };

  it('resume en una línea lo que quedó por defecto', () => {
    expect(resumenDeMasDatos(base, HOY, 'Caja', null)).toBe('Hoy · Caja · Efectivo');
    expect(resumenDeMasDatos({ ...base, medioDePago: 'yape', descripcion: 'x' }, HOY, 'Caja', 'Ventas')).toBe('Hoy · Caja · Yape · Ventas · con nota');
    expect(resumenDeMasDatos({ ...base, fecha: '2026-03-01' }, HOY, null, null)).toMatch(/^01\/03\/2026 · Sin cuenta · Efectivo$/);
  });

  it('nace abierto solo si hay algo distinto de lo habitual o un error ahí', () => {
    expect(masDatosNaceAbierto(base, HOY, {})).toBe(false);
    expect(masDatosNaceAbierto({ ...base, fecha: '2026-03-01' }, HOY, {})).toBe(true);
    expect(masDatosNaceAbierto({ ...base, medioDePago: 'yape' }, HOY, {})).toBe(true);
    expect(masDatosNaceAbierto({ ...base, descripcion: 'Pedido 7' }, HOY, {})).toBe(true);
    expect(masDatosNaceAbierto(base, HOY, { fecha: 'x' })).toBe(true);
  });
});

describe('hoja: qué falta', () => {
  const vacio = formularioParaCaptura('ingreso', HOY, cuentas);

  it('señala primero lo que falta, en el orden en que se lee', () => {
    expect(CAMPOS_EN_ORDEN[0]).toBe('contacto');
    expect(primeraPista(validarMovimiento(vacio, HOY))).toEqual({ campo: 'productos', texto: 'Elige el producto o usa «Solo el importe».' });
    expect(primeraPista(validarMovimiento({ ...vacio, productos: [etiquetas] }, HOY))).toBeNull();
  });

  it('con adelanto pide el cliente y cuánto dejó, antes que lo demás', () => {
    const f = { ...vacio, productos: [], monto: 24_000 as Centimos, conAdelanto: true };
    expect(primeraPista(validarMovimiento(f, HOY))?.campo).toBe('contacto');
    expect(primeraPista(validarMovimiento({ ...f, contacto: cli }, HOY))?.campo).toBe('adelanto');
    expect(primeraPista(validarMovimiento({ ...f, contacto: cli, adelanto: 10_000 as Centimos }, HOY))).toBeNull();
    expect(faltaCancelar({ ...f, adelanto: 10_000 as Centimos })).toBe(14_000);
  });
});
