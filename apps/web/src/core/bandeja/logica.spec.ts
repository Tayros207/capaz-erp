import { describe, expect, it } from 'vitest';
import {
  accionDeAtajo,
  argumentosCorregidos,
  clavesCorregidas,
  etiquetaDeCampo,
  filasDeArgumentos,
  formularioDeCorreccion,
  hayCambios,
  mensajeDeRechazoAlAprobar,
  titularDeHerramienta,
  validarMotivo,
  valorLegible,
} from './logica.ts';

describe('textos legibles', () => {
  it('titula la herramienta', () => {
    expect(titularDeHerramienta('clientes_crear')).toBe('Crear · clientes');
    expect(titularDeHerramienta('ordenes_de_trabajo_anular')).toBe('Anular · ordenes de trabajo');
    expect(titularDeHerramienta('ping')).toBe('Ping');
  });
  it('etiqueta campos', () => {
    expect(etiquetaDeCampo('nombre_comercial')).toBe('Nombre comercial');
    expect(etiquetaDeCampo('nombreComercial')).toBe('Nombre comercial');
  });
  it('muestra valores', () => {
    expect(valorLegible(null)).toBe('—');
    expect(valorLegible(true)).toBe('Sí');
    expect(valorLegible(['a', 'b'])).toBe('a, b');
    expect(valorLegible(12)).toBe('12');
  });
  it('lista los argumentos y tolera lo que no es objeto', () => {
    expect(filasDeArgumentos({ telefono: '999', activo: false })).toEqual([
      { clave: 'telefono', etiqueta: 'Telefono', valor: '999' },
      { clave: 'activo', etiqueta: 'Activo', valor: 'No' },
    ]);
    expect(filasDeArgumentos(null)).toEqual([]);
    expect(filasDeArgumentos([1])).toEqual([]);
  });
});

describe('corrección de argumentos', () => {
  const original = { nombre: 'Ana', edad: 30, activo: true, extra: { a: 1 }, notas: null };
  it('marca lo corregido', () => {
    expect([...clavesCorregidas({ ...original, nombre: 'Ana P.' }, original)]).toEqual(['nombre']);
  });
  it('devuelve cada campo a su tipo', () => {
    const f = { ...formularioDeCorreccion(original), edad: '31,5', activo: 'no', extra: '{"a":2}' };
    expect(argumentosCorregidos(original, f)).toEqual({ ok: true, args: { nombre: 'Ana', edad: 31.5, activo: false, extra: { a: 2 }, notas: null } });
  });
  it('informa los errores por campo', () => {
    const r = argumentosCorregidos(original, { ...formularioDeCorreccion(original), edad: 'abc', extra: '{' , activo: 'quizá' });
    expect(r).toEqual({ ok: false, errores: { edad: 'Escribe un número.', extra: 'El formato no es válido.', activo: 'Escribe Sí o No.' } });
  });
  it('un campo vaciado pasa a vacío o null', () => {
    const r = argumentosCorregidos(original, { ...formularioDeCorreccion(original), nombre: '', edad: '' });
    expect(r).toEqual({ ok: true, args: { nombre: '', edad: null, activo: true, extra: { a: 1 }, notas: null } });
  });
  it('detecta si hay cambios', () => {
    expect(hayCambios(original, formularioDeCorreccion(original))).toBe(false);
    expect(hayCambios(original, { ...formularioDeCorreccion(original), nombre: 'Luis' })).toBe(true);
  });
});

describe('descarte y atajos', () => {
  it('exige motivo', () => {
    expect(validarMotivo('  ')).toMatch(/Indica/);
    expect(validarMotivo('duplicado')).toBeUndefined();
    expect(validarMotivo('x'.repeat(501))).toMatch(/500/);
  });
  it('A aprueba y C corrige, salvo al escribir o con modificadores', () => {
    expect(accionDeAtajo({ key: 'a', escribiendo: false })).toBe('aprobar');
    expect(accionDeAtajo({ key: 'C', escribiendo: false })).toBe('corregir');
    expect(accionDeAtajo({ key: 'a', escribiendo: true })).toBeNull();
    expect(accionDeAtajo({ key: 'a', ctrlKey: true, escribiendo: false })).toBeNull();
    expect(accionDeAtajo({ key: 'x', escribiendo: false })).toBeNull();
  });
});

describe('rechazos al aprobar', () => {
  it('explica cada caso', () => {
    expect(mensajeDeRechazoAlAprobar('sin_permiso', '')).toMatch(/sigue pendiente/i);
    expect(mensajeDeRechazoAlAprobar('confirmacion_solo_ui', '')).toMatch(/desde la pantalla/);
    expect(mensajeDeRechazoAlAprobar('confirmacion_vencida', '')).toMatch(/crítica/);
    expect(mensajeDeRechazoAlAprobar('otro', 'Texto del servidor')).toBe('Texto del servidor');
  });
});
