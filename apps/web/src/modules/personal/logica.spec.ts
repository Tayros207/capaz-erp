import { describe, expect, it } from 'vitest';
import type { AdelantoDto, AsistenciaDto, Centimos, ColaboradorDto } from '@capaz/shared';
import {
  adelantoInicial, argumentosDeAdelanto, argumentosDeCreacion, argumentosDeEdicion, argumentosDeEstadoDeHoy, detalleDeColaborador, diaEnZona, filasDelDia, formatearDia,
  formularioDeColaborador, mensajeDeRechazo, modoDelDia, moverDia, puedeMarcarSalida, resumenDelDia, textoDeResumenDelDia, totalVigente, validarAdelanto, validarColaborador, COLABORADOR_VACIO,
} from './logica.ts';

const colab = (id: string, extra: Partial<ColaboradorDto> = {}): ColaboradorDto => ({
  id, nombre: `Persona ${id}`, documentoTipo: null, documentoNumero: null, telefono: null, cargo: null, cuentaId: null, fechaIngreso: null, sucursalId: null,
  archivado: false, archivadoEn: null, creadoPor: 'u', creadoEn: '2026-03-01T10:00:00.000Z', actualizadoEn: '2026-03-01T10:00:00.000Z', ...extra,
});
const asis = (colaboradorId: string, extra: Partial<AsistenciaDto> = {}): AsistenciaDto => ({
  id: `a-${colaboradorId}`, colaboradorId, colaboradorNombre: 'x', fecha: '2026-03-10', estado: 'presente', entrada: null, salida: null, nota: null, creadoPor: 'u',
  creadoEn: '2026-03-10T13:00:00.000Z', actualizadoEn: '2026-03-10T13:00:00.000Z', ...extra,
});

describe('fechas y mensajes', () => {
  it('el día en la zona de Lima y el formato corto', () => {
    expect(diaEnZona(new Date('2026-03-11T03:30:00Z'))).toBe('2026-03-10');
    expect(formatearDia('2026-03-10')).toBe('10/03/2026');
    expect(formatearDia(null)).toBe('—');
  });
  it('mover un día cruza meses y años', () => {
    expect(moverDia('2026-03-01', -1)).toBe('2026-02-28');
    expect(moverDia('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('modo del día', () => {
    expect(modoDelDia('2026-03-10', '2026-03-10')).toBe('hoy');
    expect(modoDelDia('2026-03-09', '2026-03-10')).toBe('pasado');
    expect(modoDelDia('2026-03-11', '2026-03-10')).toBe('futuro');
  });
  it('los mensajes de negocio pasan tal cual y los de acceso se redactan', () => {
    expect(mensajeDeRechazo('conflicto', 'Ya hay un colaborador activo con ese nombre.')).toBe('Ya hay un colaborador activo con ese nombre.');
    expect(mensajeDeRechazo('modulo_solo_lectura', 'x')).toMatch(/solo lectura/);
    expect(mensajeDeRechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.')).toMatch(/Tu acceso/);
  });
});

describe('formulario de colaborador', () => {
  it('exige nombre y valida documento y teléfono', () => {
    expect(validarColaborador(COLABORADOR_VACIO, '2026-03-10')).toEqual({ nombre: 'Escribe el nombre.' });
    expect(validarColaborador({ ...COLABORADOR_VACIO, nombre: 'Ana', documentoNumero: '123' }, '2026-03-10').documentoTipo).toBeTruthy();
    expect(validarColaborador({ ...COLABORADOR_VACIO, nombre: 'Ana', documentoTipo: 'dni' }, '2026-03-10').documentoNumero).toBeTruthy();
    expect(validarColaborador({ ...COLABORADOR_VACIO, nombre: 'Ana', documentoTipo: 'dni', documentoNumero: '1234' }, '2026-03-10').documentoNumero).toMatch(/8 dígitos/);
    expect(validarColaborador({ ...COLABORADOR_VACIO, nombre: 'Ana', telefono: 'abc' }, '2026-03-10').telefono).toBeTruthy();
    expect(validarColaborador({ ...COLABORADOR_VACIO, nombre: 'Ana', fechaIngreso: '2026-03-11' }, '2026-03-10').fechaIngreso).toBeTruthy();
    expect(validarColaborador({ nombre: 'Ana', documentoTipo: 'dni', documentoNumero: '12345678', telefono: '987 654 321', cargo: '', fechaIngreso: '2026-03-10' }, '2026-03-10')).toEqual({});
  });

  it('la creación solo manda lo escrito', () => {
    expect(argumentosDeCreacion({ ...COLABORADOR_VACIO, nombre: ' Ana ' })).toEqual({ nombre: 'Ana' });
    expect(argumentosDeCreacion({ nombre: 'Ana', documentoTipo: 'dni', documentoNumero: ' 12345678 ', telefono: '987654321', cargo: 'Cajera', fechaIngreso: '2026-03-01' })).toEqual({
      nombre: 'Ana', documentoTipo: 'dni', documentoNumero: '12345678', telefono: '987654321', cargo: 'Cajera', fechaIngreso: '2026-03-01',
    });
  });

  it('la edición manda solo lo que cambió y null para lo vaciado; sin cambios es null', () => {
    const c = colab('1', { nombre: 'Ana', cargo: 'Cajera', telefono: '987654321' });
    expect(argumentosDeEdicion(c, formularioDeColaborador(c))).toBeNull();
    expect(argumentosDeEdicion(c, { ...formularioDeColaborador(c), cargo: '  ', nombre: 'Ana María' })).toEqual({ id: '1', nombre: 'Ana María', cargo: null });
  });

  it('el detalle une cargo y teléfono', () => {
    expect(detalleDeColaborador({ cargo: 'Cajera', telefono: '987' })).toBe('Cajera · 987');
    expect(detalleDeColaborador({ cargo: null, telefono: null })).toBe('');
  });
});

describe('parte del día', () => {
  const cs = [colab('1'), colab('2'), colab('3')];
  const filas = filasDelDia(cs, [asis('1'), asis('3', { estado: 'falta' })]);

  it('una fila por colaborador, con o sin marca', () => {
    expect(filas.map((f) => [f.colaborador.id, f.asistencia?.estado ?? null])).toEqual([['1', 'presente'], ['2', null], ['3', 'falta']]);
  });
  it('cuenta por estado y lo que falta marcar', () => {
    const r = resumenDelDia(filas);
    expect(r).toEqual({ total: 3, sinMarcar: 1, porEstado: { presente: 1, tardanza: 0, falta: 1, permiso: 0, descanso: 0 } });
    expect(textoDeResumenDelDia(r)).toBe('2 de 3 · faltan 1 por marcar');
    expect(textoDeResumenDelDia(resumenDelDia(filasDelDia(cs, cs.map((c) => asis(c.id)))))).toBe('3 de 3 · todos marcados');
    expect(textoDeResumenDelDia(resumenDelDia([]))).toBe('Sin colaboradores activos.');
  });
  it('presente o tardanza sin entrada marcan también la entrada; falta no', () => {
    expect(argumentosDeEstadoDeHoy(filas[1]!, 'presente')).toEqual({ colaboradorId: '2', estado: 'presente', entrada: true });
    expect(argumentosDeEstadoDeHoy(filas[1]!, 'tardanza')).toEqual({ colaboradorId: '2', estado: 'tardanza', entrada: true });
    expect(argumentosDeEstadoDeHoy(filas[1]!, 'falta')).toEqual({ colaboradorId: '2', estado: 'falta' });
    const conEntrada = { colaborador: cs[0]!, asistencia: asis('1', { entrada: '2026-03-10T13:00:00.000Z' }) };
    expect(argumentosDeEstadoDeHoy(conEntrada, 'tardanza')).toEqual({ colaboradorId: '1', estado: 'tardanza' });
  });
  it('la salida se ofrece solo con entrada y sin salida', () => {
    expect(puedeMarcarSalida(null)).toBe(false);
    expect(puedeMarcarSalida(asis('1'))).toBe(false);
    expect(puedeMarcarSalida(asis('1', { entrada: '2026-03-10T13:00:00.000Z' }))).toBe(true);
    expect(puedeMarcarSalida(asis('1', { entrada: '2026-03-10T13:00:00.000Z', salida: '2026-03-10T22:00:00.000Z' }))).toBe(false);
    expect(puedeMarcarSalida(asis('1', { estado: 'falta', entrada: '2026-03-10T13:00:00.000Z' }))).toBe(false);
  });
});

describe('formulario de adelanto', () => {
  it('valida persona, monto y fecha', () => {
    const base = adelantoInicial('2026-03-10');
    expect(validarAdelanto(base, '2026-03-10')).toEqual({ colaboradorId: 'Elige a la persona.', monto: 'Escribe un monto mayor que cero.' });
    expect(validarAdelanto({ ...base, colaboradorId: 'c', monto: 0 as Centimos }, '2026-03-10').monto).toBeTruthy();
    expect(validarAdelanto({ ...base, colaboradorId: 'c', monto: 5000 as Centimos, fecha: '2026-03-11' }, '2026-03-10').fecha).toMatch(/futura/);
    expect(validarAdelanto({ ...base, colaboradorId: 'c', monto: 5000 as Centimos, fecha: '' }, '2026-03-10').fecha).toBeTruthy();
    expect(validarAdelanto({ ...base, colaboradorId: 'c', monto: 5000 as Centimos }, '2026-03-10')).toEqual({});
  });
  it('los argumentos llevan céntimos enteros y omiten el motivo vacío', () => {
    expect(argumentosDeAdelanto({ colaboradorId: 'c', monto: 15050 as Centimos, fecha: '2026-03-10', motivo: ' ' })).toEqual({ colaboradorId: 'c', montoCentimos: 15050, fecha: '2026-03-10' });
    expect(argumentosDeAdelanto({ colaboradorId: 'c', monto: 100 as Centimos, fecha: '2026-03-10', motivo: ' Pasajes ' })).toMatchObject({ motivo: 'Pasajes' });
  });
  it('el total no cuenta los anulados', () => {
    const a = (estado: AdelantoDto['estado'], montoCentimos: number) => ({ estado, montoCentimos });
    expect(totalVigente([a('registrado', 1000), a('anulado', 500), a('registrado', 250)])).toBe(1250);
  });
});
