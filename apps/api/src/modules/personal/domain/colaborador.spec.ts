import { describe, expect, it } from 'vitest';
import { aplicarCambios, prepararColaborador } from './colaborador.js';

describe('prepararColaborador', () => {
  it('normaliza el nombre y limpia los opcionales vacíos', () => {
    const r = prepararColaborador({ nombre: '  Ángela   Quispe ', cargo: '  ', telefono: '' });
    expect(r).toEqual({
      ok: true,
      datos: { nombre: 'Ángela Quispe', nombreNormalizado: 'angela quispe', documentoTipo: null, documentoNumero: null, telefono: null, cargo: null, cuentaId: null, fechaIngreso: null, sucursalId: null },
    });
  });

  it('valida el documento según su tipo y exige tipo y número juntos', () => {
    expect(prepararColaborador({ nombre: 'Ana', documentoTipo: 'dni', documentoNumero: '1234' })).toMatchObject({ ok: false, campo: 'documentoNumero' });
    expect(prepararColaborador({ nombre: 'Ana', documentoNumero: '12345678' })).toMatchObject({ ok: false, campo: 'documentoTipo' });
    expect(prepararColaborador({ nombre: 'Ana', documentoTipo: 'dni' })).toMatchObject({ ok: false, campo: 'documentoNumero' });
    expect(prepararColaborador({ nombre: 'Ana', documentoTipo: 'dni', documentoNumero: '12345678' })).toMatchObject({ ok: true, datos: { documentoNumero: '12345678' } });
  });

  it('rechaza un nombre vacío y un teléfono inválido; normaliza el teléfono', () => {
    expect(prepararColaborador({ nombre: '   ' })).toMatchObject({ ok: false, campo: 'nombre' });
    expect(prepararColaborador({ nombre: 'Ana', telefono: 'abc' })).toMatchObject({ ok: false, campo: 'telefono' });
    expect(prepararColaborador({ nombre: 'Ana', telefono: '+51 987 654 321' })).toMatchObject({ ok: true, datos: { telefono: '+51987654321' } });
  });
});

describe('aplicarCambios', () => {
  const base = { nombre: 'Ana', nombreNormalizado: 'ana', documentoTipo: 'dni', documentoNumero: '12345678', telefono: '987654321', cargo: 'Cajera', cuentaId: null, fechaIngreso: null, sucursalId: null };

  it('undefined conserva, null borra y el nombre nuevo se normaliza', () => {
    const r = aplicarCambios(base, { cargo: null, nombre: 'Ana María' });
    expect(r).toMatchObject({ ok: true, datos: { nombre: 'Ana María', nombreNormalizado: 'ana maria', cargo: null, telefono: '987654321', documentoNumero: '12345678' } });
  });

  it('borrar solo el número deja el tipo sin número: se rechaza', () => {
    expect(aplicarCambios(base, { documentoNumero: null })).toMatchObject({ ok: false, campo: 'documentoNumero' });
    expect(aplicarCambios(base, { documentoNumero: null, documentoTipo: null })).toMatchObject({ ok: true, datos: { documentoTipo: null } });
  });
});
