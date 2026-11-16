import { describe, expect, it } from 'vitest';
import type { ArticuloDto, SucursalDto } from '@capaz/shared';
import {
  argumentosDeActivar, argumentosDeAjuste, argumentosDeEdicion, argumentosDeExistencias, argumentosDeMovimiento, argumentosDeMovimientos, cantidadConSigno,
  detalleDeMovimiento, existenciaEn, faltaParaMinimo, FILTROS_DE_EXISTENCIAS, formularioDeArticulo, formularioDeMovimiento, mensajeDeRechazo, opcionDeArticulo,
  siguienteFormulario, sucursalesVigentes, textoDeCantidad, textoDeCosto, textoDeDiferencia, validarAjuste, validarArticulo, validarMovimiento,
} from './logica.ts';

const articulo = (extra: Partial<ArticuloDto> = {}): ArticuloDto => ({
  id: 'a1', productoId: 'p1', nombre: 'Papel bond A4', codigo: 'PB-A4', unidad: 'paquete', minimoMilesimas: 10_000, ultimoCostoMilesimas: null,
  existenciaTotalMilesimas: 12_500, bajoMinimo: false,
  existencias: [{ sucursalId: 's1', sucursalCodigo: 'PRI', sucursalNombre: 'Principal', cantidadMilesimas: 12_500, bajoMinimo: false }],
  archivadoEn: null, creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z', ...extra,
});
const sucursal = (id: string, codigo: string, extra: Partial<SucursalDto> = {}): SucursalDto => ({
  id, codigo, nombre: codigo, direccion: null, telefono: null, esPrincipal: false, archivadoEn: null, creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z', ...extra,
});
const ARTICULO = { id: 'a1', nombre: 'Papel bond A4' };

describe('textos', () => {
  it('cantidades con unidad y signo, costos en soles', () => {
    expect(textoDeCantidad(12_500, 'kg')).toBe('12.5 kg');
    expect(textoDeCantidad(-2_500, 'kg')).toBe('-2.5 kg');
    expect(textoDeCantidad(0)).toBe('0');
    expect(textoDeCosto(12_500)).toBe('S/ 12.50');
    expect(textoDeCosto(12_505)).toBe('S/ 12.505');
    expect(textoDeCosto(null)).toBe('—');
  });

  it('el signo de un movimiento va en el texto, además del tono', () => {
    expect(cantidadConSigno({ cantidadMilesimas: 3_000, unidad: 'paquete', tipo: 'entrada' })).toEqual({ texto: '+3 paquete', tono: 'exito' });
    expect(cantidadConSigno({ cantidadMilesimas: -1_500, unidad: 'kg', tipo: 'salida' })).toEqual({ texto: '-1.5 kg', tono: 'peligro' });
    expect(cantidadConSigno({ cantidadMilesimas: -500, unidad: 'kg', tipo: 'ajuste' })).toEqual({ texto: '-0.5 kg', tono: 'aviso' });
  });

  it('lo que falta para el mínimo, lo que hay por sucursal y el detalle del historial', () => {
    expect(faltaParaMinimo({ cantidadMilesimas: 7_000, minimoMilesimas: 10_000 })).toBe(3_000);
    expect(faltaParaMinimo({ cantidadMilesimas: 12_000, minimoMilesimas: 10_000 })).toBe(0);
    expect(existenciaEn(articulo(), 's1')).toBe(12_500);
    expect(existenciaEn(articulo(), 's2')).toBe(0);
    expect(existenciaEn(null, 's1')).toBeNull();
    expect(existenciaEn(articulo(), '')).toBeNull();
    expect(detalleDeMovimiento({ motivo: 'Pedido 7', origenTipo: null })).toBe('Pedido 7');
    expect(detalleDeMovimiento({ motivo: null, origenTipo: 'recepcion' })).toBe('Recepción de compra');
    expect(detalleDeMovimiento({ motivo: null, origenTipo: null })).toBe('—');
  });

  it('opción del selector y sucursales vigentes con la principal primero', () => {
    expect(opcionDeArticulo(articulo())).toEqual({ id: 'a1', nombre: 'Papel bond A4', detalle: 'PB-A4 · Hay 12.5 paquete' });
    expect(opcionDeArticulo(articulo({ codigo: null, existenciaTotalMilesimas: 0 })).detalle).toBe('Hay 0 paquete');
    const lista = sucursalesVigentes([sucursal('n', 'NOR'), sucursal('x', 'AAA', { archivadoEn: '2026-01-02T00:00:00.000Z' }), sucursal('p', 'PRI', { esPrincipal: true }), sucursal('c', 'CEN')]);
    expect(lista.map((s) => s.codigo)).toEqual(['PRI', 'CEN', 'NOR']);
  });

  it('los rechazos de acceso se explican; los de negocio llegan redactados', () => {
    expect(mensajeDeRechazo('modulo_solo_lectura', 'x')).toMatch(/solo lectura/);
    expect(mensajeDeRechazo('conflicto', 'No alcanza: hay 3 y faltan 2.')).toBe('No alcanza: hay 3 y faltan 2.');
    expect(mensajeDeRechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.')).toBe('Tu acceso es solo a tus propios registros.');
  });
});

describe('hoja «Entrada / Salida»', () => {
  const lleno = { ...formularioDeMovimiento('salida', ARTICULO, 's1'), cantidad: 2_000 };

  it('pide artículo, sucursal y cantidad; avisa el faltante de una salida antes de enviar', () => {
    expect(validarMovimiento(formularioDeMovimiento('entrada', null, ''), null)).toEqual({ articulo: 'Elige el artículo.', sucursalId: 'Elige la sucursal.', cantidad: 'Escribe una cantidad mayor que cero.' });
    expect(validarMovimiento(lleno, 2_000)).toEqual({});
    expect(validarMovimiento({ ...lleno, cantidad: 5_000 }, 3_500, 'paquete')).toEqual({ cantidad: 'No alcanza: hay 3.5 paquete y faltan 1.5 paquete.' });
    expect(validarMovimiento({ ...lleno, tipo: 'entrada', cantidad: 5_000 }, 0)).toEqual({});
    expect(validarMovimiento({ ...lleno, cantidad: 5_000 }, null)).toEqual({});
    expect(validarMovimiento({ ...lleno, motivo: 'x'.repeat(301) }, null).motivo).toBeDefined();
  });

  it('arma los argumentos: el costo solo en entradas, sin vacíos', () => {
    expect(argumentosDeMovimiento({ ...lleno, costo: 900, motivo: '  ' })).toEqual({ articuloId: 'a1', tipo: 'salida', cantidadMilesimas: 2_000, sucursalId: 's1' });
    expect(argumentosDeMovimiento({ ...lleno, tipo: 'entrada', costo: 900, motivo: ' Compra al contado ' })).toEqual({
      articuloId: 'a1', tipo: 'entrada', cantidadMilesimas: 2_000, sucursalId: 's1', motivo: 'Compra al contado', costoUnitarioMilesimas: 900,
    });
    expect(argumentosDeMovimiento({ ...lleno, tipo: 'entrada', costo: 0 })).toMatchObject({ costoUnitarioMilesimas: 0 });
  });

  it('tras guardar conserva tipo y sucursal; el artículo solo si venía fijo', () => {
    expect(siguienteFormulario({ ...lleno, motivo: 'x' }, false)).toEqual(formularioDeMovimiento('salida', null, 's1'));
    expect(siguienteFormulario(lleno, true)).toEqual(formularioDeMovimiento('salida', ARTICULO, 's1'));
  });
});

describe('ajuste a lo contado', () => {
  it('pide sucursal, lo contado (puede ser cero) y el motivo; no ajusta a lo mismo', () => {
    expect(validarAjuste({ sucursalId: '', contada: null, motivo: ' ' }, null)).toEqual({ sucursalId: 'Elige la sucursal.', contada: 'Escribe lo que contaste (puede ser cero).', motivo: 'Indica por qué no coincidía.' });
    expect(validarAjuste({ sucursalId: 's1', contada: 0, motivo: 'Merma' }, 3_000)).toEqual({});
    expect(validarAjuste({ sucursalId: 's1', contada: 3_000, motivo: 'Conteo' }, 3_000)).toEqual({ contada: 'Es lo mismo que hay: no hay nada que ajustar.' });
  });

  it('anticipa la diferencia y arma los argumentos', () => {
    expect(textoDeDiferencia(12_000, 9_500, 'kg')).toBe('Se registrará un ajuste de -2.5 kg.');
    expect(textoDeDiferencia(0, 4_000, 'unidad')).toBe('Se registrará un ajuste de +4 unidad.');
    expect(textoDeDiferencia(4_000, 4_000, 'unidad')).toBe('');
    expect(textoDeDiferencia(null, 4_000, 'unidad')).toBe('');
    expect(argumentosDeAjuste('a1', { sucursalId: 's1', contada: 0, motivo: ' Merma ' })).toEqual({ articuloId: 'a1', existenciaNuevaMilesimas: 0, motivo: 'Merma', sucursalId: 's1' });
  });
});

describe('artículo', () => {
  it('controlar un producto: producto obligatorio; mínimo y unidad opcionales', () => {
    expect(validarArticulo(formularioDeArticulo())).toEqual({ producto: 'Elige el producto.' });
    expect(argumentosDeActivar({ producto: { id: 'p1', nombre: 'Tinta' }, minimo: null, unidad: ' ' })).toEqual({ productoId: 'p1' });
    expect(argumentosDeActivar({ producto: { id: 'p1', nombre: 'Tinta' }, minimo: 5_000, unidad: ' litro ' })).toEqual({ productoId: 'p1', minimoMilesimas: 5_000, unidad: 'litro' });
  });

  it('editar envía solo lo que cambió (un mínimo vacío es cero); sin cambios, nada', () => {
    const a = articulo();
    const f = formularioDeArticulo(a);
    expect(f).toEqual({ producto: { id: 'p1', nombre: 'Papel bond A4' }, minimo: 10_000, unidad: 'paquete' });
    expect(argumentosDeEdicion(a, f)).toBeNull();
    expect(argumentosDeEdicion(a, { ...f, minimo: 15_000 })).toEqual({ id: 'a1', minimoMilesimas: 15_000 });
    expect(argumentosDeEdicion(a, { ...f, minimo: null, unidad: 'resma' })).toEqual({ id: 'a1', minimoMilesimas: 0, unidad: 'resma' });
  });
});

describe('listados', () => {
  it('solo se envían los filtros con valor', () => {
    expect(argumentosDeExistencias(FILTROS_DE_EXISTENCIAS, 25)).toEqual({ limite: 25, soloBajoMinimo: false });
    expect(argumentosDeExistencias({ buscar: ' tinta ', sucursalId: 's1', soloBajoMinimo: true }, 25, 'c1')).toEqual({ limite: 25, soloBajoMinimo: true, buscar: 'tinta', sucursalId: 's1', cursor: 'c1' });
    expect(argumentosDeMovimientos({ tipo: '', sucursalId: '' }, 25)).toEqual({ limite: 25 });
    expect(argumentosDeMovimientos({ tipo: 'ajuste', sucursalId: 's1', articuloId: 'a1' }, 10, 'c')).toEqual({ limite: 10, articuloId: 'a1', tipo: 'ajuste', sucursalId: 's1', cursor: 'c' });
  });
});
