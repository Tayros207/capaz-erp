import { describe, expect, it } from 'vitest';
import { codigoDeOrden, comprobarAnulacion, comprobarCambioDeEstado, comprobarFechas, comprobarMontos, estaAtrasada, estadoDePago, resumenDeLineas, saldoDe, sePuedeAnular, sePuedeEditar } from './orden.js';

describe('codigoDeOrden', () => it('rellena el número', () => expect(codigoDeOrden(2026, 7)).toBe('OT-2026-0007')));

describe('cambio de estado (reglas de SF)', () => {
  it('se mueve libremente adelante y atrás mientras esté viva, y el mismo estado no es error', () => {
    expect(comprobarCambioDeEstado('pendiente', 'listo').ok).toBe(true);
    expect(comprobarCambioDeEstado('listo', 'pendiente').ok).toBe(true);
    expect(comprobarCambioDeEstado('en_maquina', 'en_maquina').ok).toBe(true);
    expect(comprobarCambioDeEstado('listo', 'entregado').ok).toBe(true);
  });
  it('entregada es final, también para repetir el estado hacia otro', () => {
    for (const a of ['pendiente', 'en_maquina', 'listo'] as const) expect(comprobarCambioDeEstado('entregado', a)).toMatchObject({ ok: false, motivo: expect.stringMatching(/ya se entregó/) });
    expect(comprobarCambioDeEstado('entregado', 'entregado').ok).toBe(true);
  });
  it('una anulada solo vuelve a pendiente', () => {
    expect(comprobarCambioDeEstado('anulada', 'pendiente').ok).toBe(true);
    for (const a of ['en_maquina', 'listo', 'entregado'] as const) expect(comprobarCambioDeEstado('anulada', a)).toMatchObject({ ok: false, motivo: expect.stringMatching(/solo puede volver a pendiente/) });
  });
  it('se anula y se edita solo mientras esté viva', () => {
    expect(['pendiente', 'en_maquina', 'listo', 'entregado', 'anulada'].map((e) => sePuedeAnular(e as never))).toEqual([true, true, true, false, false]);
    expect(['pendiente', 'en_maquina', 'listo', 'entregado', 'anulada'].map((e) => sePuedeEditar(e as never))).toEqual([true, true, true, false, false]);
  });
});

describe('saldo y estado de pago', () => {
  it('el saldo es lo que falta cancelar', () => expect(saldoDe(10_000, 4_000)).toBe(6_000));
  it('sin adelanto, con adelanto y pagado (el adelanto puede igualar al total)', () => {
    expect(estadoDePago(10_000, 0)).toBe('sin_adelanto');
    expect(estadoDePago(10_000, 4_000)).toBe('con_adelanto');
    expect(estadoDePago(10_000, 10_000)).toBe('pagado');
  });
});

describe('comprobarMontos', () => {
  it('el total es positivo y el adelanto va de cero al total', () => {
    expect(comprobarMontos({ totalCentimos: 100, adelantoCentimos: 100 }).ok).toBe(true);
    expect(comprobarMontos({ totalCentimos: 100, adelantoCentimos: 0 }).ok).toBe(true);
    expect(comprobarMontos({ totalCentimos: 0, adelantoCentimos: 0 })).toMatchObject({ ok: false, motivo: expect.stringMatching(/mayor a cero/) });
    expect(comprobarMontos({ totalCentimos: 100, adelantoCentimos: 101 })).toMatchObject({ ok: false, motivo: expect.stringMatching(/superar el total/) });
    expect(comprobarMontos({ totalCentimos: 100, adelantoCentimos: -1 }).ok).toBe(false);
  });
});

describe('fechas, resumen y anulación', () => {
  it('la entrega no es anterior a la fecha', () => {
    expect(comprobarFechas('2026-03-10', '2026-03-09').ok).toBe(false);
    expect(comprobarFechas('2026-03-10', '2026-03-10').ok).toBe(true);
    expect(comprobarFechas('2026-03-10', null).ok).toBe(true);
  });
  it('atrasada solo si sigue viva y ya pasó la entrega', () => {
    expect(estaAtrasada('en_maquina', '2026-03-01', '2026-03-02')).toBe(true);
    expect(estaAtrasada('entregado', '2026-03-01', '2026-03-02')).toBe(false);
    expect(estaAtrasada('anulada', '2026-03-01', '2026-03-02')).toBe(false);
    expect(estaAtrasada('listo', '2026-03-02', '2026-03-02')).toBe(false);
  });
  it('resume la primera línea y cuántas más hay', () => {
    expect(resumenDeLineas(['Volantes'])).toBe('Volantes');
    expect(resumenDeLineas(['Volantes', 'Tarjetas', 'Afiches'])).toBe('Volantes (+2 más)');
    expect(resumenDeLineas([])).toBe('Sin líneas');
  });
  it('anular con adelanto exige su destino', () => {
    expect(comprobarAnulacion(1_000, undefined).ok).toBe(false);
    expect(comprobarAnulacion(1_000, 'devuelto').ok).toBe(true);
    expect(comprobarAnulacion(0, undefined).ok).toBe(true);
  });
});
