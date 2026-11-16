import { describe, expect, it } from 'vitest';
import { importeDeRecepcion } from '@capaz/shared';
import { cantidadComoTexto, comprobarFechaDeRecepcion, pendienteDe, prepararRecepcion, type LineaDeOrden } from './recepcion.js';

const papel: LineaDeOrden = { id: 'l1', productoId: 'p1', descripcion: 'Papel bond A4', unidad: 'millar', cantidadMilesimas: 10_000, costoUnitarioMilesimas: 23_600, recibidoMilesimas: 0 };
const flete: LineaDeOrden = { id: 'l2', productoId: null, descripcion: 'Flete', unidad: 'unidad', cantidadMilesimas: 1000, costoUnitarioMilesimas: 59_000, recibidoMilesimas: 0 };

describe('prepararRecepcion', () => {
  it('una recepción parcial devuelve sus líneas con producto y costo, su valor y «recibida_parcial»', () => {
    const r = prepararRecepcion([papel, flete], [{ ordenLineaId: 'l1', cantidadMilesimas: 4_000 }]);
    expect(r).toEqual({
      ok: true,
      lineas: [{ ordenLineaId: 'l1', productoId: 'p1', cantidadMilesimas: 4_000, costoUnitarioMilesimas: 23_600 }],
      totalRecibidoCentimos: 9_440,
      estadoNuevo: 'recibida_parcial',
    });
  });

  it('lo que completa todas las líneas deja la orden «recibida»', () => {
    const r = prepararRecepcion([{ ...papel, recibidoMilesimas: 4_000 }, flete], [{ ordenLineaId: 'l2', cantidadMilesimas: 1000 }, { ordenLineaId: 'l1', cantidadMilesimas: 6_000 }]);
    expect(r).toMatchObject({ ok: true, estadoNuevo: 'recibida', totalRecibidoCentimos: 5_900 + 14_160 });
    if (r.ok) expect(r.lineas.map((l) => l.productoId)).toEqual([null, 'p1']);
  });

  it('no recibe más de lo pendiente: es conflicto y dice cuánto falta', () => {
    expect(prepararRecepcion([{ ...papel, recibidoMilesimas: 8_500 }], [{ ordenLineaId: 'l1', cantidadMilesimas: 2_000 }])).toEqual({
      ok: false,
      codigo: 'conflicto',
      motivo: '«Papel bond A4»: llegan 2 millar y solo falta recibir 1.5 millar.',
    });
    expect(prepararRecepcion([{ ...flete, recibidoMilesimas: 1000 }], [{ ordenLineaId: 'l2', cantidadMilesimas: 1 }])).toEqual({
      ok: false,
      codigo: 'conflicto',
      motivo: '«Flete»: llegan 0.001 unidad y ya se recibió completa.',
    });
    // Justo lo pendiente sí.
    expect(prepararRecepcion([{ ...papel, recibidoMilesimas: 8_500 }], [{ ordenLineaId: 'l1', cantidadMilesimas: 1_500 }])).toMatchObject({ ok: true, estadoNuevo: 'recibida' });
  });

  it('rechaza líneas ajenas, repetidas, en cero o ninguna', () => {
    expect(prepararRecepcion([papel], [])).toEqual({ ok: false, codigo: 'argumentos_invalidos', motivo: 'Indica al menos una línea recibida.' });
    expect(prepararRecepcion([papel], [{ ordenLineaId: 'otra', cantidadMilesimas: 1 }])).toEqual({ ok: false, codigo: 'argumentos_invalidos', motivo: 'Línea 1: no es una línea de esta orden.' });
    expect(prepararRecepcion([papel], [{ ordenLineaId: 'l1', cantidadMilesimas: 1 }, { ordenLineaId: 'l1', cantidadMilesimas: 1 }])).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
    expect(prepararRecepcion([papel], [{ ordenLineaId: 'l1', cantidadMilesimas: 0 }])).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
    expect(prepararRecepcion([papel], [{ ordenLineaId: 'l1', cantidadMilesimas: 1.5 }])).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
  });
});

describe('importeDeRecepcion y pendientes', () => {
  it('suma importe(cantidad, costo) por línea, al céntimo y mitad hacia arriba', () => {
    expect(importeDeRecepcion([])).toBe(0);
    expect(importeDeRecepcion([{ cantidadMilesimas: 1000, costoUnitarioMilesimas: 5 }])).toBe(1); // 0.005 → 0.01
    expect(importeDeRecepcion([{ cantidadMilesimas: 1000, costoUnitarioMilesimas: 4 }, { cantidadMilesimas: 1000, costoUnitarioMilesimas: 4 }])).toBe(0);
    expect(() => importeDeRecepcion([{ cantidadMilesimas: 9_000_000_000_000_000, costoUnitarioMilesimas: 9_000_000_000_000_000 }])).toThrow();
  });
  it('pendiente = pedido − recibido', () => {
    expect(pendienteDe({ cantidadMilesimas: 10_000, recibidoMilesimas: 2_500 })).toBe(7_500);
  });
  it('cantidadComoTexto quita ceros sobrantes', () => {
    expect(cantidadComoTexto(12_000)).toBe('12');
    expect(cantidadComoTexto(12_500, ' m ')).toBe('12.5 m');
    expect(cantidadComoTexto(1)).toBe('0.001');
  });
});

describe('comprobarFechaDeRecepcion', () => {
  it('ni antes de la orden ni en el futuro', () => {
    expect(comprobarFechaDeRecepcion('2026-03-10', '2026-03-09', '2026-03-20')).toEqual({ ok: false, motivo: 'La recepción no puede ser anterior a la fecha de la orden.' });
    expect(comprobarFechaDeRecepcion('2026-03-10', '2026-03-21', '2026-03-20')).toEqual({ ok: false, motivo: 'La recepción no puede tener una fecha futura.' });
    expect(comprobarFechaDeRecepcion('2026-03-10', '2026-03-10', '2026-03-20').ok).toBe(true);
    expect(comprobarFechaDeRecepcion('2026-03-10', '2026-03-20', '2026-03-20').ok).toBe(true);
  });
});
