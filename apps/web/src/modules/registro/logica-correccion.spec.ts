import type { Centimos, MovimientoDto } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { argumentosDeCorreccion, formularioDeCorreccion, puedeRestaurarseEnPantalla, validarCorreccion } from './logica-correccion.ts';

const M = {
  id: 'm1', codigo: 'MOV-2026-000001', tipo: 'egreso', fecha: '2026-03-10', montoCentimos: 35_000, cuentaId: 'c1', categoriaId: 'k1', contactoId: 'p1', contactoNombre: 'Imprenta Sur',
  medioDePago: 'efectivo', descripcion: 'Tinta', estado: 'activo', transferenciaId: null, reemplazadoPor: null,
} as unknown as MovimientoDto;

describe('corregir un movimiento', () => {
  it('el formulario parte de lo guardado y sin cambios no se envía nada', () => {
    const f = formularioDeCorreccion(M);
    expect(f).toMatchObject({ monto: 35_000, fecha: '2026-03-10', categoriaId: 'k1', contacto: { id: 'p1', nombre: 'Imprenta Sur' }, descripcion: 'Tinta' });
    expect(argumentosDeCorreccion(M, f)).toBeNull();
  });

  it('solo viaja lo que cambia; vaciar categoría, contacto o descripción manda null', () => {
    const f = { ...formularioDeCorreccion(M), monto: 38_000 as Centimos, categoriaId: '', contacto: null, descripcion: '  ', motivo: ' Me equivoqué ' };
    expect(argumentosDeCorreccion(M, f)).toEqual({ id: 'm1', montoCentimos: 38_000, categoriaId: null, contactoId: null, descripcion: null, motivo: 'Me equivoqué' });
  });

  it('valida monto, fecha futura y cuenta', () => {
    const f = { ...formularioDeCorreccion(M), monto: null, fecha: '2099-01-01', cuentaId: '' };
    expect(Object.keys(validarCorreccion(f, '2026-03-10')).sort()).toEqual(['cuentaId', 'fecha', 'monto']);
    expect(validarCorreccion(formularioDeCorreccion(M), '2026-03-10')).toEqual({});
  });

  it('«Restaurar» solo en anulados que no son transferencia ni tienen versión vigente', () => {
    expect(puedeRestaurarseEnPantalla({ estado: 'anulado', transferenciaId: null, reemplazadoPor: null })).toBe(true);
    expect(puedeRestaurarseEnPantalla({ estado: 'activo', transferenciaId: null, reemplazadoPor: null })).toBe(false);
    expect(puedeRestaurarseEnPantalla({ estado: 'anulado', transferenciaId: 't', reemplazadoPor: null })).toBe(false);
    expect(puedeRestaurarseEnPantalla({ estado: 'anulado', transferenciaId: null, reemplazadoPor: { id: 'x', codigo: 'MOV' } })).toBe(false);
  });
});
