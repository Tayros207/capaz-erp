import { describe, expect, it } from 'vitest';
import type { ArgsDe, LineaDeGuiaDeEntrada } from '@capaz/shared';
import {
  codigoDeGuia,
  comprobarAnulacion,
  comprobarPedidoParaGuia,
  documentoDeCliente,
  motivoDeGuiasEmitidas,
  normalizarTraslado,
  prepararLineasDeGuia,
  textoDeCantidad,
  type LineaDePedidoParaGuia,
} from './guia.js';

const L1 = '0192f0c4-7b1e-7000-8000-000000000001';
const L2 = '0192f0c4-7b1e-7000-8000-000000000002';
const P1 = '0192f0c4-7b1e-7000-8000-0000000000a1';
const origen = (id: string, extra: Partial<LineaDePedidoParaGuia> = {}): LineaDePedidoParaGuia => ({
  id, pedidoId: P1, pedidoCodigo: 'PED-PRI-2026-0007', posicion: 0, productoId: null, descripcion: 'Tarjetas', unidad: 'millar', cantidadMilesimas: 5000, ...extra,
});
const mapa = (...l: LineaDePedidoParaGuia[]) => new Map(l.map((x) => [x.id, x]));
const deLinea = (id: string, cantidadMilesimas: number): LineaDeGuiaDeEntrada => ({ tipo: 'pedido', pedidoLineaId: id, cantidadMilesimas });

describe('codigo, cantidad y documento', () => {
  it('codigoDeGuia', () => {
    expect(codigoDeGuia('G001', 1)).toBe('G001-000001');
    expect(codigoDeGuia('G001', 1_234_567)).toBe('G001-1234567');
  });
  it('textoDeCantidad', () => {
    expect(textoDeCantidad(1000)).toBe('1');
    expect(textoDeCantidad(2500)).toBe('2.5');
    expect(textoDeCantidad(2375)).toBe('2.375');
  });
  it('documentoDeCliente', () => {
    expect(documentoDeCliente('ruc', '20123456789')).toBe('RUC 20123456789');
    expect(documentoDeCliente(null, '123')).toBe('123');
    expect(documentoDeCliente('ruc', null)).toBeNull();
  });
});

describe('prepararLineasDeGuia', () => {
  it('respeta orden y posiciones, copia los datos de la línea de pedido y da unidad a la libre', () => {
    const r = prepararLineasDeGuia(
      [{ tipo: 'libre', descripcion: 'Caja', cantidadMilesimas: 1000 }, deLinea(L1, 2000)],
      mapa(origen(L1, { productoId: 'prod' })),
      new Map(),
    );
    expect(r).toEqual({
      ok: true,
      lineas: [
        { posicion: 0, pedidoId: null, pedidoLineaId: null, productoId: null, descripcion: 'Caja', unidad: 'unidad', cantidadMilesimas: 1000 },
        { posicion: 1, pedidoId: P1, pedidoLineaId: L1, productoId: 'prod', descripcion: 'Tarjetas', unidad: 'millar', cantidadMilesimas: 2000 },
      ],
    });
  });

  it('duplicada e inexistente son argumentos inválidos', () => {
    expect(prepararLineasDeGuia([deLinea(L1, 1000), deLinea(L1, 1000)], mapa(origen(L1)), new Map())).toEqual({
      ok: false, codigo: 'argumentos_invalidos', motivo: 'Línea 2: esa línea de pedido ya está en la guía.',
    });
    expect(prepararLineasDeGuia([deLinea(L2, 1000)], mapa(origen(L1)), new Map())).toEqual({
      ok: false, codigo: 'argumentos_invalidos', motivo: 'Línea 1: esa línea de pedido no existe.',
    });
  });

  it('sin pendiente, o pidiendo de más, es conflicto con el texto exacto', () => {
    expect(prepararLineasDeGuia([deLinea(L1, 1000)], mapa(origen(L1)), new Map([[L1, 5000]]))).toEqual({
      ok: false, codigo: 'conflicto', motivo: 'Línea 1 (Tarjetas, PED-PRI-2026-0007): ya se envió completa.',
    });
    expect(prepararLineasDeGuia([deLinea(L1, 3000)], mapa(origen(L1)), new Map([[L1, 3000]]))).toEqual({
      ok: false, codigo: 'conflicto', motivo: 'Línea 1 (Tarjetas, PED-PRI-2026-0007): quedan 2 millar por enviar y pides 3.',
    });
  });

  it('enviar justo lo pendiente pasa', () => {
    expect(prepararLineasDeGuia([deLinea(L1, 2000)], mapa(origen(L1)), new Map([[L1, 3000]])).ok).toBe(true);
  });
});

describe('comprobarPedidoParaGuia', () => {
  const p = (estado: Parameters<typeof comprobarPedidoParaGuia>[0]['estado'], clienteId = 'c1') => ({ estado, clienteId, codigo: 'PED-PRI-2026-0007' });
  it('listo y entregado pasan; los demás estados fallan', () => {
    expect(comprobarPedidoParaGuia(p('listo'), 'c1').ok).toBe(true);
    expect(comprobarPedidoParaGuia(p('entregado'), 'c1').ok).toBe(true);
    for (const e of ['borrador', 'confirmado', 'en_proceso', 'cancelado'] as const) expect(comprobarPedidoParaGuia(p(e), 'c1').ok, e).toBe(false);
    expect(comprobarPedidoParaGuia(p('confirmado'), 'c1')).toEqual({
      ok: false, motivo: 'El pedido PED-PRI-2026-0007 está «confirmado»: la guía se emite con el pedido listo o entregado.',
    });
  });
  it('otro cliente falla', () => {
    expect(comprobarPedidoParaGuia(p('listo', 'c2'), 'c1')).toEqual({
      ok: false, motivo: 'El pedido PED-PRI-2026-0007 es de otro cliente: una guía lleva pedidos de un solo cliente.',
    });
  });
});

describe('normalizarTraslado', () => {
  const args = (extra: Partial<ArgsDe<'guia_emitir'>> = {}): ArgsDe<'guia_emitir'> => ({
    clienteId: L1, fechaTraslado: '2026-03-10', puntoPartida: ' Av. A ', puntoLlegada: ' Jr. B ', motivo: 'venta', modalidad: 'privado',
    lineas: [{ tipo: 'libre', descripcion: 'x', cantidadMilesimas: 1 }], ...extra,
  });
  it('recorta, pasa vacío a null, y descarta transportista y detalle que no aplican', () => {
    expect(normalizarTraslado(args({ placa: '  ', conductor: ' Luis ', transportista: 'Cruz', motivoDetalle: 'algo' }))).toMatchObject({
      puntoPartida: 'Av. A', puntoLlegada: 'Jr. B', placa: null, conductor: 'Luis', transportista: null, motivoDetalle: null, bultos: null,
    });
  });
  it('conserva transportista en público y detalle en «otro»', () => {
    expect(normalizarTraslado(args({ modalidad: 'publico', transportista: ' Cruz ', motivo: 'otro', motivoDetalle: ' Muestra ' }))).toMatchObject({
      transportista: 'Cruz', motivoDetalle: 'Muestra',
    });
  });
});

describe('anulación y cancelación', () => {
  it('comprobarAnulacion', () => {
    expect(comprobarAnulacion('emitida').ok).toBe(true);
    expect(comprobarAnulacion('anulada')).toEqual({ ok: false, motivo: 'La guía ya estaba anulada.' });
  });
  it('motivoDeGuiasEmitidas en singular y plural', () => {
    expect(motivoDeGuiasEmitidas([])).toBeNull();
    expect(motivoDeGuiasEmitidas(['G001-000003'])).toBe('El pedido tiene la guía G001-000003 emitida: anúlala antes de cancelar el pedido.');
    expect(motivoDeGuiasEmitidas(['G001-000003', 'G001-000004'])).toBe('El pedido tiene las guías G001-000003, G001-000004 emitidas: anúlalas antes de cancelar el pedido.');
  });
});
