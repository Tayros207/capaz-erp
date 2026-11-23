import { describe, expect, it } from 'vitest';
import { ESTADOS_DE_PEDIDO, type PedidoCompletoDto, type PedidoDto } from '@capaz/shared';
import {
  FORMULARIO_VACIO, agruparEntregas, argumentosDeCreacion, argumentosDeEdicion, columnasDeTablero, conProducto, diaEnZona, formatearDia, formularioDesde, igvDeLaHoja,
  importeDeLinea, lineaVacia, validarParaConfirmar, mensajeDeRechazo, otrosPasos, pasoActual, pasosPermitidos, sePuedeCancelar, siguientePaso, sumarDias, textoDeEvento, totalesDe,
  validarLinea, validarPedido, type LineaDeFormulario,
} from './logica.ts';

const linea = (extra: Partial<LineaDeFormulario> = {}): LineaDeFormulario => ({ ...lineaVacia('l1'), descripcion: 'Volantes', precioUnitarioMilesimas: 118_000, ...extra });
const pedido = (extra: Partial<PedidoDto> = {}): PedidoDto => ({
  id: 'p1', codigo: 'PED-PRI-2026-0001', numero: 1, serie: 'PRI', anio: 2026, clienteId: 'c1', clienteNombre: 'Imprenta Sol', estado: 'confirmado', version: 1, fecha: '2026-03-01',
  entregaEl: null, atrasado: false, responsableId: null, igvPorcentaje: 18, subtotalCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800, notas: null, sucursalId: null,
  origenTipo: null, origenId: null, confirmadoEn: null, entregadoEn: null, canceladoEn: null, motivoCancelacion: null, lineas: 1, creadoPor: 'u1',
  creadoEn: '2026-03-01T10:00:00.000Z', actualizadoEn: '2026-03-01T10:00:00.000Z', ...extra,
});
const completo = (extra: Partial<PedidoCompletoDto> = {}): PedidoCompletoDto => ({
  ...pedido({ estado: 'borrador', numero: null, serie: null, anio: null, codigo: 'Borrador' }),
  detalle: [{ id: 'd1', posicion: 0, productoId: null, descripcion: 'Volantes', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 118_000, afectoIgv: true, importeCentimos: 11_800, material: null, medida: null, colores: null, acabado: null }],
  historial: [], versiones: [], ...extra,
});

describe('pasos de la ficha y del tablero', () => {
  it('el botón principal sigue el recorrido y los finales no tienen', () => {
    expect(siguientePaso('borrador')).toEqual({ tipo: 'confirmar', texto: 'Confirmar pedido' });
    expect(siguientePaso('confirmado')).toMatchObject({ tipo: 'estado', estado: 'en_proceso' });
    expect(siguientePaso('en_proceso')).toMatchObject({ estado: 'listo' });
    expect(siguientePaso('listo')).toMatchObject({ estado: 'entregado', texto: 'Marcar como entregado' });
    expect(siguientePaso('entregado')).toBeNull();
    expect(siguientePaso('cancelado')).toBeNull();
  });
  it('«Pasar a…» ofrece solo lo que el servidor permite, sin repetir el principal', () => {
    expect(pasosPermitidos('confirmado').map((p) => p.tipo === 'estado' && p.estado)).toEqual(['en_proceso', 'listo', 'entregado']);
    expect(otrosPasos('confirmado').map((p) => p.tipo === 'estado' && p.estado)).toEqual(['listo', 'entregado']);
    expect(otrosPasos('en_proceso').map((p) => p.tipo === 'estado' && p.estado)).toEqual(['entregado', 'confirmado']);
    expect(otrosPasos('listo').map((p) => p.tipo === 'estado' && p.estado)).toEqual(['en_proceso']);
    for (const e of ['borrador', 'entregado', 'cancelado'] as const) expect(pasosPermitidos(e)).toEqual([]);
  });
  it('la barra de estado y la cancelación', () => {
    expect(ESTADOS_DE_PEDIDO.map(pasoActual)).toEqual([0, 1, 2, 3, 4, -1]);
    expect(ESTADOS_DE_PEDIDO.filter(sePuedeCancelar)).toEqual(['borrador', 'confirmado', 'en_proceso', 'listo']);
  });
});

describe('días', () => {
  it('formatea sin correr el día y calcula hoy en la zona', () => {
    expect(formatearDia('2026-03-10')).toBe('10/03/2026');
    expect(formatearDia(null)).toBe('—');
    expect(diaEnZona(new Date('2026-03-10T03:00:00Z'), 'America/Lima')).toBe('2026-03-09');
    expect(sumarDias('2026-12-28', 7)).toBe('2027-01-04');
  });
});

describe('líneas', () => {
  it('valida descripción, cantidad y precio', () => {
    expect(validarLinea(linea())).toEqual({});
    expect(Object.keys(validarLinea(lineaVacia('x')))).toEqual(['descripcion', 'precio']);
    expect(validarLinea(linea({ cantidadMilesimas: 0 })).cantidad).toBeDefined();
    expect(validarLinea(linea({ precioUnitarioMilesimas: 0 }))).toEqual({});
  });
  it('elegir un producto llena la línea y conserva la cantidad', () => {
    const l = conProducto(linea({ cantidadMilesimas: 2500 }), { id: 'pr1', nombre: 'Tarjetas', unidad: 'millar', precioUnitarioMilesimas: 59_000, afectoIgv: false });
    expect(l).toMatchObject({ producto: { id: 'pr1', nombre: 'Tarjetas' }, descripcion: 'Tarjetas', unidad: 'millar', precioUnitarioMilesimas: 59_000, afectoIgv: false, cantidadMilesimas: 2500 });
    expect(conProducto(l, null)).toMatchObject({ producto: null, descripcion: 'Tarjetas' });
  });
  it('importe y totales con las funciones del servidor; lo incompleto no suma', () => {
    expect(importeDeLinea(linea({ cantidadMilesimas: 2375, precioUnitarioMilesimas: 12_345 }))).toBe(2932);
    expect(importeDeLinea(linea({ precioUnitarioMilesimas: null }))).toBeNull();
    const t = totalesDe([linea(), linea({ precioUnitarioMilesimas: 50_000, cantidadMilesimas: 2000, afectoIgv: false }), lineaVacia('z')], 18);
    expect(t).toMatchObject({ subtotalCentimos: 20_000, igvCentimos: 1_800, totalCentimos: 21_800 });
    expect(totalesDe([linea({ cantidadMilesimas: 9e15, precioUnitarioMilesimas: 9e15 })], 18)).toBeNull();
  });
});

describe('formulario del pedido', () => {
  it('exige cliente, entrega no anterior a la fecha y líneas completas', () => {
    expect(Object.keys(validarPedido(FORMULARIO_VACIO, '2026-03-10'))).toEqual(['cliente']);
    const f = { ...FORMULARIO_VACIO, cliente: { id: 'c1', nombre: 'Sol' }, entregaEl: '2026-03-09', lineas: [lineaVacia('a')] };
    expect(Object.keys(validarPedido(f, '2026-03-10'))).toEqual(['entregaEl']);
    const incompleta = { ...f, lineas: [linea({ clave: 'x', descripcion: 'Algo', precioUnitarioMilesimas: null })] };
    const e = validarPedido({ ...incompleta, entregaEl: '' }, '2026-03-10');
    expect(e.lineas).toBe('Completa o borra las filas señaladas.');
    expect(e.porLinea).toEqual({ x: { precio: expect.any(String) } });
    expect(validarPedido({ ...f, entregaEl: '' }, '2026-03-10').porLinea).toBeUndefined();
    expect(validarPedido({ ...f, entregaEl: '2026-03-10', lineas: [linea()] }, '2026-03-10')).toEqual({});
  });
  it('confirmar exige al menos una fila con algo escrito', () => {
    const f = { ...FORMULARIO_VACIO, cliente: { id: 'c1', nombre: 'Sol' }, lineas: [lineaVacia('a')] };
    expect(validarParaConfirmar(f, '2026-03-10').lineas).toMatch(/al menos una fila/);
    expect(validarParaConfirmar({ ...f, lineas: [] }, '2026-03-10').lineas).toMatch(/al menos una fila/);
    expect(validarParaConfirmar({ ...f, lineas: [linea()] }, '2026-03-10')).toEqual({});
  });
  it('crear envía solo lo que tiene valor', () => {
    const args = argumentosDeCreacion({ cliente: { id: 'c1', nombre: 'Sol' }, entregaEl: '', responsableId: '', notas: '  ', conIgv: false, lineas: [linea({ producto: { id: 'pr1', nombre: 'X' } })] });
    expect(args).toEqual({ clienteId: 'c1', conIgv: false, lineas: [{ productoId: 'pr1', descripcion: 'Volantes', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 118_000, afectoIgv: true }] });
  });
  it('el IGV viene apagado en la hoja vacía y se manda tal cual', () => {
    expect(FORMULARIO_VACIO.conIgv).toBe(false);
    expect(igvDeLaHoja({ conIgv: false })).toBe(0);
    expect(igvDeLaHoja({ conIgv: true })).toBe(18);
    expect(argumentosDeCreacion({ ...FORMULARIO_VACIO, cliente: { id: 'c1', nombre: 'Sol' }, conIgv: true, lineas: [linea()] }).conIgv).toBe(true);
  });
  it('editar: encender o apagar el IGV manda también todas las líneas', () => {
    const p = completo({});
    const f = formularioDesde(p);
    const cambiado = argumentosDeEdicion(p, { ...f, conIgv: !f.conIgv });
    expect(cambiado).toMatchObject({ id: 'p1', conIgv: !f.conIgv });
    expect(cambiado?.lineas).toHaveLength(p.detalle.length);
  });
  it('editar envía solo lo que cambió, y nulo si nada cambió', () => {
    const p = completo({ notas: 'vieja', entregaEl: '2026-03-20' });
    const f = formularioDesde(p);
    expect(argumentosDeEdicion(p, f)).toBeNull();
    expect(argumentosDeEdicion(p, { ...f, notas: '', entregaEl: '2026-03-21' })).toEqual({ id: 'p1', notas: null, entregaEl: '2026-03-21' });
    const conOtraLinea = argumentosDeEdicion(p, { ...f, lineas: [...f.lineas, linea({ clave: 'n', descripcion: 'Afiches' })] });
    expect(conOtraLinea?.lineas).toHaveLength(2);
    expect(argumentosDeEdicion(p, { ...f, lineas: [{ ...f.lineas[0]!, cantidadMilesimas: 2000 }] })?.lineas?.[0]?.cantidadMilesimas).toBe(2000);
    expect(argumentosDeEdicion(p, { ...f, cliente: { id: 'c2', nombre: 'Otro' } })).toEqual({ id: 'p1', clienteId: 'c2' });
  });
});

describe('tablero y entregas', () => {
  it('una columna por estado abierto, con su total', () => {
    const c = columnasDeTablero([pedido(), pedido({ id: 'p2' }), pedido({ id: 'p3', estado: 'listo' }), pedido({ id: 'p4', estado: 'entregado' })]);
    expect(c.map((x) => [x.id, x.filas.length, x.resumen])).toEqual([['borrador', 0, 'S/ 0.00'], ['confirmado', 2, 'S/ 236.00'], ['en_proceso', 0, 'S/ 0.00'], ['listo', 1, 'S/ 118.00']]);
  });
  it('agrupa en atrasados, hoy y próximos siete días, por fecha', () => {
    const g = agruparEntregas(
      [
        pedido({ id: 'a', entregaEl: '2026-03-08', atrasado: true }), pedido({ id: 'b', entregaEl: '2026-03-10' }), pedido({ id: 'c', entregaEl: '2026-03-17' }),
        pedido({ id: 'd', entregaEl: '2026-03-12' }), pedido({ id: 'e', entregaEl: '2026-03-18' }), pedido({ id: 'f', entregaEl: null }),
        pedido({ id: 'g', entregaEl: '2026-03-01', estado: 'borrador', atrasado: false }),
      ],
      '2026-03-10',
    );
    expect(g.map((x) => [x.id, x.pedidos.map((p) => p.id)])).toEqual([['atrasados', ['a']], ['hoy', ['b']], ['proximos', ['d', 'c']]]);
  });
});

describe('historial y errores', () => {
  it('describe cada evento', () => {
    expect(textoDeEvento({ tipo: 'estado', estadoAnterior: 'confirmado', estadoNuevo: 'en_proceso', nota: null })).toBe('Pasó de Confirmado a En proceso');
    expect(textoDeEvento({ tipo: 'nota', estadoAnterior: null, estadoNuevo: null, nota: 'Recoge el viernes' })).toBe('Recoge el viernes');
    expect(textoDeEvento({ tipo: 'datos_editados', estadoAnterior: null, estadoNuevo: null, nota: null })).toBe('Se corrigieron los datos del pedido');
    expect(textoDeEvento({ tipo: 'guia_emitida', estadoAnterior: null, estadoNuevo: null, nota: null, guia: { id: 'g1', codigo: 'G001-000007' } })).toBe('Se emitió la guía de remisión G001-000007');
    expect(textoDeEvento({ tipo: 'guia_anulada', estadoAnterior: null, estadoNuevo: null, nota: 'Error de cantidad', guia: { id: 'g1', codigo: 'G001-000007' } })).toBe('Se anuló la guía de remisión G001-000007: Error de cantidad');
    expect(textoDeEvento({ tipo: 'cancelado', estadoAnterior: 'listo', estadoNuevo: 'cancelado', nota: null })).toBe('Se canceló (estaba Listo)');
  });
  it('los códigos de acceso se explican; lo demás usa el mensaje del servidor', () => {
    expect(mensajeDeRechazo('modulo_solo_lectura', 'x')).toMatch(/solo lectura/);
    expect(mensajeDeRechazo('conflicto', 'Solo se edita un pedido en borrador.')).toBe('Solo se edita un pedido en borrador.');
  });
});
