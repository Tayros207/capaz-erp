import { describe, expect, it } from 'vitest';
import type { Regla } from '@capaz/shared';
import {
  FORMULARIO_VACIO, argumentosDeGuardado, detalleLegible, formularioDeRegla, herramientasParaAcciones, objetoDeArgumentos,
  resumenDeCondicion, resumenDeDisparador, titularDeHerramienta, type FormularioDeRegla,
} from './logica.ts';

const valido: FormularioDeRegla = {
  ...FORMULARIO_VACIO,
  nombre: ' Avisar ',
  tipo: 'evento',
  evento: 'cliente.creado',
  condiciones: [{ campo: 'datos.total', op: 'mayor', valor: '100,5' }],
  acciones: [{ herramienta: 'clientes_crear', args: [{ nombre: 'nombre', valor: '{{datos.nombre}}', tipo: 'texto' }, { nombre: 'n', valor: '3', tipo: 'numero' }] }],
};

describe('resúmenes', () => {
  it('describe disparadores', () => {
    expect(resumenDeDisparador({ tipo: 'evento', evento: 'a.b' })).toBe('Evento a.b');
    expect(resumenDeDisparador({ tipo: 'tiempo', fuente: 'f', dias: 3 })).toBe('3 días después de f');
    expect(resumenDeDisparador({ tipo: 'tiempo', fuente: 'f', dias: -2 })).toBe('2 días antes de f');
    expect(resumenDeDisparador({ tipo: 'tiempo', fuente: 'f', dias: 0 })).toBe('El mismo día de f');
    expect(resumenDeDisparador({ tipo: 'manual' })).toBe('Manual');
  });
  it('describe condiciones', () => {
    expect(resumenDeCondicion({ campo: 'datos.x', op: 'mayor', valor: 5 })).toBe('datos.x es mayor que 5');
    expect(resumenDeCondicion({ campo: 'datos.x', op: 'existe', valor: false })).toBe('datos.x no existe');
  });
  it('titula herramientas y lee detalles', () => {
    expect(titularDeHerramienta('clientes_crear')).toBe('Crear · clientes');
    expect(detalleLegible({ resumen: 'ok' })).toBe('ok');
    expect(detalleLegible(null)).toBe('—');
    expect(detalleLegible({ a: 1 })).toBe('{"a":1}');
  });
});

describe('herramientas para acciones', () => {
  it('excluye las de la bandeja y las reglas', () => {
    expect(herramientasParaAcciones(['regla_activar', 'borrador_aprobar', 'clientes_crear', 'borradores_listar', 'a_b'])).toEqual(['a_b', 'clientes_crear']);
  });
  it('incluye herramientas reales del registro compartido', () => {
    const todas = herramientasParaAcciones();
    expect(todas).toContain('clientes_crear');
    expect(todas.some((n) => n.startsWith('regla_'))).toBe(false);
  });
});

describe('argumentos con tipo', () => {
  it('convierte cada tipo', () => {
    expect(objetoDeArgumentos([
      { nombre: 'a', valor: '12345678', tipo: 'texto' }, { nombre: 'b', valor: '1,5', tipo: 'numero' },
      { nombre: 'c', valor: 'Sí', tipo: 'booleano' }, { nombre: 'd', valor: '{"x":1}', tipo: 'json' },
    ])).toEqual({ ok: true, datos: { a: '12345678', b: 1.5, c: true, d: { x: 1 } } });
  });
  it('informa los errores', () => {
    expect(objetoDeArgumentos([{ nombre: 'b', valor: 'x', tipo: 'numero' }])).toMatchObject({ ok: false });
    expect(objetoDeArgumentos([{ nombre: 'c', valor: 'quizá', tipo: 'booleano' }])).toMatchObject({ ok: false });
    expect(objetoDeArgumentos([{ nombre: 'd', valor: '{', tipo: 'json' }])).toMatchObject({ ok: false });
    expect(objetoDeArgumentos([{ nombre: 'a', valor: '', tipo: 'texto' }, { nombre: 'a', valor: '', tipo: 'texto' }])).toMatchObject({ ok: false });
  });
});

describe('guardar la regla', () => {
  it('arma los argumentos de regla_guardar', () => {
    expect(argumentosDeGuardado(valido, 'id-1')).toEqual({
      ok: true,
      args: {
        id: 'id-1',
        nombre: 'Avisar',
        disparador: { tipo: 'evento', evento: 'cliente.creado' },
        condiciones: [{ campo: 'datos.total', op: 'mayor', valor: 100.5 }],
        acciones: [{ herramienta: 'clientes_crear', args: { nombre: '{{datos.nombre}}', n: 3 } }],
        modo: 'borrador',
        limiteDiario: 50,
      },
    });
  });
  it('pide lo que falta', () => {
    const r = argumentosDeGuardado(FORMULARIO_VACIO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(['acciones', 'disparador', 'nombre']);
  });
  it('valida tiempo, límite y condiciones', () => {
    const t = argumentosDeGuardado({ ...valido, tipo: 'tiempo', fuente: 'core.x', dias: '999', limiteDiario: '0' });
    expect(t.ok).toBe(false);
    if (!t.ok) expect(Object.keys(t.errores).sort()).toEqual(['disparador', 'limite']);
    const c = argumentosDeGuardado({ ...valido, condiciones: [{ campo: '1mal', op: 'igual', valor: 'x' }] });
    expect(c.ok).toBe(false);
    const m = argumentosDeGuardado({ ...valido, condiciones: [{ campo: 'datos.t', op: 'mayor', valor: 'abc' }] });
    expect(m.ok).toBe(false);
  });
  it('el operador «existe» no pide valor y «contiene» conserva el texto', () => {
    const r = argumentosDeGuardado({ ...valido, condiciones: [{ campo: 'datos.x', op: 'existe', valor: 'no' }, { campo: 'datos.n', op: 'contiene', valor: '123' }] });
    expect(r).toMatchObject({ ok: true, args: { condiciones: [{ campo: 'datos.x', op: 'existe', valor: false }, { campo: 'datos.n', op: 'contiene', valor: '123' }] } });
  });
  it('manual y webhook', () => {
    expect(argumentosDeGuardado({ ...valido, tipo: 'manual' })).toMatchObject({ ok: true, args: { disparador: { tipo: 'manual' } } });
    expect(argumentosDeGuardado({ ...valido, tipo: 'webhook', evento: '' }).ok).toBe(false);
  });
});

describe('de la regla al formulario', () => {
  it('ida y vuelta', () => {
    const regla: Regla = {
      id: 'i', nombre: 'R', descripcion: null, activa: false,
      disparador: { tipo: 'tiempo', fuente: 'core.f', dias: -3 },
      condiciones: [{ campo: 'datos.a', op: 'existe', valor: true }],
      acciones: [{ herramienta: 'clientes_crear', args: { nombre: 'x', n: 2, ok: true } }],
      modo: 'pide_aprobacion', limiteDiario: 10, creadoPor: 'u', creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z',
    };
    const f = formularioDeRegla(regla);
    expect(f).toMatchObject({ tipo: 'tiempo', fuente: 'core.f', dias: '-3', modo: 'pide_aprobacion', limiteDiario: '10' });
    const r = argumentosDeGuardado(f, 'i');
    expect(r).toMatchObject({ ok: true, args: { disparador: regla.disparador, condiciones: regla.condiciones, acciones: regla.acciones, modo: 'pide_aprobacion' } });
  });
});
