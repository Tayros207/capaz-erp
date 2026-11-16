import { describe, expect, it } from 'vitest';
import type { CategoriaDto, Centimos, CuentaDto } from '@capaz/shared';
import {
  argumentosDeListado, argumentosDeMovimiento, categoriasDe, debeIniciar, detalleDeMovimiento, diaEnZona, errorDeRango, FILTROS_VACIOS, formatearDia,
  formularioInicial, mensajeDeRechazo, montoConSigno, siguienteFormulario, validarMovimiento,
} from './logica.ts';

const c = (n: number) => n as Centimos;
const cuenta = (id: string, extra: Partial<CuentaDto> = {}): CuentaDto => ({
  id, nombre: id, tipo: 'caja', sucursalId: null, esPrincipal: false, saldoInicialCentimos: 0, saldoCentimos: 0, archivadoEn: null,
  creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z', ...extra,
});
const HOY = '2026-03-10';

describe('fechas', () => {
  it('el día se toma en la zona de la empresa, no en UTC', () => {
    expect(diaEnZona(new Date('2026-03-11T04:30:00Z'))).toBe('2026-03-10');
    expect(diaEnZona(new Date('2026-03-11T05:00:00Z'))).toBe('2026-03-11');
    expect(diaEnZona(new Date('2026-01-01T02:00:00Z'))).toBe('2025-12-31');
  });
  it('muestra el día como día/mes/año', () => {
    expect(formatearDia('2026-03-10')).toBe('10/03/2026');
    expect(formatearDia('raro')).toBe('raro');
  });
});

describe('signo y tono de los montos', () => {
  it('el ingreso suma y el egreso resta; el anulado pierde el tono', () => {
    expect(montoConSigno({ tipo: 'ingreso', montoCentimos: 15_000, estado: 'activo' })).toEqual({ texto: '+ S/ 150.00', tono: 'exito', anulado: false });
    expect(montoConSigno({ tipo: 'egreso', montoCentimos: 4_550, estado: 'activo' })).toEqual({ texto: '− S/ 45.50', tono: 'peligro', anulado: false });
    expect(montoConSigno({ tipo: 'egreso', montoCentimos: 1, estado: 'anulado' })).toEqual({ texto: '− S/ 0.01', tono: 'neutro', anulado: true });
  });
  it('el detalle es la descripción o, si falta, el contacto', () => {
    expect(detalleDeMovimiento({ descripcion: 'Tinta', contactoNombre: 'José' })).toBe('Tinta');
    expect(detalleDeMovimiento({ descripcion: null, contactoNombre: 'José' })).toBe('José');
    expect(detalleDeMovimiento({ descripcion: null, contactoNombre: null })).toBe('—');
  });
});

describe('formulario de movimiento', () => {
  const cuentas = [cuenta('banco', { tipo: 'banco' }), cuenta('caja', { esPrincipal: true }), cuenta('vieja', { archivadoEn: '2026-02-01T00:00:00.000Z' })];

  it('empieza con la fecha de hoy, la cuenta principal y efectivo', () => {
    expect(formularioInicial('egreso', HOY, cuentas)).toEqual({ tipo: 'egreso', monto: null, fecha: HOY, cuentaId: 'caja', categoriaId: '', contacto: null, medioDePago: 'efectivo', descripcion: '' });
    expect(formularioInicial('ingreso', HOY, [cuentas[2]!, cuentas[0]!]).cuentaId).toBe('banco');
    expect(formularioInicial('ingreso', HOY, []).cuentaId).toBe('');
  });

  it('valida el monto y la fecha', () => {
    const base = formularioInicial('ingreso', HOY, cuentas);
    expect(validarMovimiento(base, HOY)).toEqual({ monto: 'Escribe el monto.' });
    expect(validarMovimiento({ ...base, monto: c(0) }, HOY)).toEqual({ monto: 'El monto debe ser mayor que cero.' });
    expect(validarMovimiento({ ...base, monto: c(100), fecha: '2026-03-11' }, HOY)).toEqual({ fecha: 'La fecha no puede ser futura.' });
    expect(validarMovimiento({ ...base, monto: c(100), fecha: '' }, HOY)).toEqual({ fecha: 'Elige la fecha.' });
    expect(validarMovimiento({ ...base, monto: c(100), descripcion: 'x'.repeat(501) }, HOY)).toHaveProperty('descripcion');
    expect(validarMovimiento({ ...base, monto: c(100) }, HOY)).toEqual({});
  });

  it('arma los argumentos solo con lo elegido, en céntimos enteros', () => {
    const base = { ...formularioInicial('egreso', HOY, cuentas), monto: c(4_550) };
    expect(argumentosDeMovimiento(base)).toEqual({ tipo: 'egreso', montoCentimos: 4_550, fecha: HOY, medioDePago: 'efectivo', cuentaId: 'caja' });
    expect(argumentosDeMovimiento({ ...base, cuentaId: '', categoriaId: 'cat', contacto: { id: 'cli', nombre: 'José' }, medioDePago: 'yape', descripcion: '  Tinta  ' })).toEqual({
      tipo: 'egreso', montoCentimos: 4_550, fecha: HOY, medioDePago: 'yape', categoriaId: 'cat', contactoId: 'cli', descripcion: 'Tinta',
    });
    expect(() => argumentosDeMovimiento({ ...base, monto: null })).toThrow();
  });

  it('tras guardar queda listo para el siguiente, con el mismo tipo, fecha, cuenta y medio', () => {
    const lleno = { ...formularioInicial('egreso', '2026-03-09', cuentas), monto: c(100), categoriaId: 'cat', contacto: { id: 'cli', nombre: 'José' }, medioDePago: 'yape' as const, descripcion: 'Tinta' };
    expect(siguienteFormulario(lleno)).toEqual({ tipo: 'egreso', monto: null, fecha: '2026-03-09', cuentaId: 'caja', categoriaId: '', contacto: null, medioDePago: 'yape', descripcion: '' });
  });

  it('ofrece solo las categorías vivas del tipo', () => {
    const cats: CategoriaDto[] = [
      { id: '1', nombre: 'Ventas', tipo: 'ingreso', archivadoEn: null },
      { id: '2', nombre: 'Compras', tipo: 'egreso', archivadoEn: null },
      { id: '3', nombre: 'Vieja', tipo: 'egreso', archivadoEn: '2026-01-01T00:00:00.000Z' },
    ];
    expect(categoriasDe('egreso', cats).map((x) => x.id)).toEqual(['2']);
    expect(categoriasDe('ingreso', cats).map((x) => x.id)).toEqual(['1']);
  });
});

describe('listado', () => {
  it('los filtros vacíos no viajan y se piden también los anulados', () => {
    expect(argumentosDeListado(FILTROS_VACIOS, 25)).toEqual({ limite: 25, estado: 'todos' });
    expect(argumentosDeListado({ desde: '2026-03-01', hasta: '2026-03-31', tipo: 'egreso', cuentaId: 'caja' }, 25, 'abc')).toEqual({
      limite: 25, estado: 'todos', desde: '2026-03-01', hasta: '2026-03-31', tipo: 'egreso', cuentaId: 'caja', cursor: 'abc',
    });
  });
  it('avisa de un rango al revés', () => {
    expect(errorDeRango({ desde: '2026-03-10', hasta: '2026-03-01' })).toBe('La fecha final es anterior a la inicial.');
    expect(errorDeRango({ desde: '2026-03-01', hasta: '2026-03-01' })).toBeUndefined();
    expect(errorDeRango({ desde: '', hasta: '2026-03-01' })).toBeUndefined();
  });
  it('prepara los catálogos solo si no hay cuentas y la persona puede editar', () => {
    expect(debeIniciar([], true)).toBe(true);
    expect(debeIniciar([], false)).toBe(false);
    expect(debeIniciar(undefined, true)).toBe(false);
    expect(debeIniciar([{}], true)).toBe(false);
  });
});

describe('mensajes por código de error', () => {
  it('traduce los de acceso y deja pasar los de negocio', () => {
    expect(mensajeDeRechazo('modulo_solo_lectura', 'x')).toContain('solo lectura');
    expect(mensajeDeRechazo('modulo_no_disponible', 'x')).toContain('no tiene activo');
    expect(mensajeDeRechazo('sin_permiso', 'No tienes permiso para usar «x».')).toBe('No tienes permiso para hacer esto.');
    expect(mensajeDeRechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.')).toBe('Tu acceso es solo a tus propios registros.');
    expect(mensajeDeRechazo('conflicto', 'La cuenta «BCP» está archivada.')).toBe('La cuenta «BCP» está archivada.');
    expect(mensajeDeRechazo('argumentos_invalidos', 'La fecha de un movimiento no puede ser futura.')).toBe('La fecha de un movimiento no puede ser futura.');
  });
});
