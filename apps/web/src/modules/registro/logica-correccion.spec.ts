import type { Centimos, MovimientoDto } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { argumentosDeCorreccion, formularioDeCorreccion, montoDeLaCorreccion, puedeRestaurarseEnPantalla, validarCorreccion } from './logica-correccion.ts';
import { filaConCantidad, filaLibre, filaConPrecio } from './logica-lineas.ts';

const M = {
  id: 'm1', codigo: 'MOV-2026-000001', tipo: 'egreso', fecha: '2026-03-10', montoCentimos: 35_000, cuentaId: 'c1', categoriaId: 'k1', contactoId: 'p1', contactoNombre: 'Imprenta Sur',
  medioDePago: 'efectivo', descripcion: 'Tinta', estado: 'activo', transferenciaId: null, reemplazadoPor: null, lineas: [],
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

describe('corregir un movimiento con productos', () => {
  const linea = { id: 'l1', orden: 0, productoId: null, descripcion: 'Etiquetas', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 65_000, subtotalCentimos: 13_000 };
  const CON = { ...M, tipo: 'ingreso', montoCentimos: 13_000, lineas: [linea] } as unknown as MovimientoDto;

  it('el formulario trae los productos guardados y su suma manda sobre el monto', () => {
    const f = formularioDeCorreccion(CON);
    expect(f.productos).toHaveLength(1);
    expect(montoDeLaCorreccion(f)).toBe(13_000);
    expect(argumentosDeCorreccion(CON, f)).toBeNull();
  });

  it('cambiar una cantidad envía la lista completa y no el monto (el servidor lo calcula)', () => {
    const f = formularioDeCorreccion(CON);
    const cambiado = { ...f, productos: [filaConCantidad(f.productos[0]!, 3000)] };
    expect(argumentosDeCorreccion(CON, cambiado)).toEqual({ id: 'm1', lineas: [{ descripcion: 'Etiquetas', unidad: 'millar', cantidadMilesimas: 3000, precioUnitarioMilesimas: 65_000 }] });
  });

  it('quitar todos los productos manda lineas vacío y vuelve a valer el monto tecleado', () => {
    const f = { ...formularioDeCorreccion(CON), productos: [] };
    expect(argumentosDeCorreccion(CON, f)).toEqual({ id: 'm1', lineas: [] });
    expect(montoDeLaCorreccion(f)).toBe(13_000);
    expect(validarCorreccion({ ...f, monto: null }, '2026-03-10').monto).toBeDefined();
  });

  it('agregar productos a un movimiento sin ellos; valida que estén completos', () => {
    const f = { ...formularioDeCorreccion(M), productos: [filaLibre('n1', 'Diseño')] };
    expect(validarCorreccion(f, '2026-03-10').productos).toBe('Producto 1: Falta el precio.');
    const listo = { ...f, productos: [filaConPrecio(f.productos[0]!, 5_000)] };
    expect(validarCorreccion(listo, '2026-03-10')).toEqual({});
    expect(argumentosDeCorreccion(M, listo)).toEqual({ id: 'm1', lineas: [{ descripcion: 'Diseño', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 5_000 }] });
  });
});
