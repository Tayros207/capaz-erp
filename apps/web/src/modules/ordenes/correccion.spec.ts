import { describe, expect, it } from 'vitest';
import type { PedidoCompletoDto } from '@capaz/shared';
import { alternarDesglose, argumentosDeCorreccion, conIgvEncima, formularioDeCorreccion, hayCambios, sinIgvIncluido, validarCorreccion, vistaPrevia } from './correccion.ts';
import { lineaVacia } from './logica.ts';

const ID1 = '0192f0c4-7b1e-7000-8000-000000000001';
const ID2 = '0192f0c4-7b1e-7000-8000-000000000002';
const pedido = (extra: Partial<PedidoCompletoDto> = {}): PedidoCompletoDto =>
  ({
    id: '0192f0c4-7b1e-7000-8000-0000000000aa', codigo: 'PED-1', version: 1, estado: 'confirmado', clienteId: 'c', clienteNombre: 'Ana', fecha: '2026-11-01', igvPorcentaje: 18, totalCentimos: 11_800,
    detalle: [
      { id: ID1, posicion: 1, productoId: null, descripcion: 'Volantes', unidad: 'millar', cantidadMilesimas: 1000, precioUnitarioMilesimas: 100_000, afectoIgv: true, importeCentimos: 10_000 },
      { id: ID2, posicion: 2, productoId: null, descripcion: 'Flete', unidad: 'unidad', cantidadMilesimas: 2000, precioUnitarioMilesimas: 5_000, afectoIgv: false, importeCentimos: 1_000 },
    ],
    historial: [], versiones: [], ...extra,
  }) as unknown as PedidoCompletoDto;

describe('atajos de IGV', () => {
  const f = formularioDeCorreccion(pedido());
  it('«faltó sumar el IGV» sube solo las líneas afectas', () => {
    const l = conIgvEncima(f.lineas, 18);
    expect(l[0]?.precioUnitarioMilesimas).toBe(118_000);
    expect(l[1]?.precioUnitarioMilesimas).toBe(5_000);
  });
  it('«se cobró IGV de más» baja solo las afectas, con mitad hacia arriba', () => {
    const l = sinIgvIncluido(f.lineas, 18);
    expect(l[0]?.precioUnitarioMilesimas).toBe(84_746);
    expect(l[1]?.precioUnitarioMilesimas).toBe(5_000);
  });
  it('el desglose alterna sin tocar precios', () => {
    const a = alternarDesglose(f.lineas);
    expect(a.every((l) => l.afectoIgv)).toBe(true);
    expect(alternarDesglose(a).every((l) => !l.afectoIgv)).toBe(true);
    expect(a.map((l) => l.precioUnitarioMilesimas)).toEqual(f.lineas.map((l) => l.precioUnitarioMilesimas));
  });
});

describe('cambios y validación', () => {
  it('sin tocar nada no hay cambios ni se deja revisar', () => {
    const p = pedido();
    const f = { ...formularioDeCorreccion(p), motivo: 'igv' as const };
    expect(hayCambios(p, f)).toBe(false);
    expect(validarCorreccion(p, f).cambios).toBeTruthy();
  });
  it('pide motivo, y texto con «otro»', () => {
    const p = pedido();
    const f = { ...formularioDeCorreccion(p), lineas: conIgvEncima(formularioDeCorreccion(p).lineas, 18) };
    expect(validarCorreccion(p, f).motivo).toBeTruthy();
    expect(validarCorreccion(p, { ...f, motivo: 'otro' }).motivoTexto).toBeTruthy();
    expect(validarCorreccion(p, { ...f, motivo: 'otro', motivoTexto: 'x' })).toEqual({});
  });
  it('un total en cero se rechaza', () => {
    const p = pedido();
    const f = { ...formularioDeCorreccion(p), motivo: 'igv' as const, lineas: formularioDeCorreccion(p).lineas.map((l) => ({ ...l, precioUnitarioMilesimas: 0 })) };
    expect(validarCorreccion(p, f).total).toBeTruthy();
  });
});

describe('argumentos', () => {
  it('las filas existentes llevan id y las nuevas no; no envía lo que no cambió', () => {
    const p = pedido();
    const base = formularioDeCorreccion(p);
    const nueva = { ...lineaVacia('9f2c0000-0000-4000-8000-000000000009'), descripcion: 'Extra', precioUnitarioMilesimas: 1000 };
    const a = argumentosDeCorreccion(p, { ...base, lineas: [...base.lineas, nueva], motivo: 'lineas', motivoTexto: ' pidió más ' });
    expect(a.motivoCodigo).toBe('lineas');
    expect(a.motivoTexto).toBe('pidió más');
    expect(a.lineas?.map((l) => l.id)).toEqual([ID1, ID2, undefined]);
    expect(a.fijarTotalCentimos).toBeUndefined();
  });
  it('fijar total sin tocar líneas no envía las líneas', () => {
    const p = pedido();
    const a = argumentosDeCorreccion(p, { ...formularioDeCorreccion(p), motivo: 'precio_acordado', fijarTotalCentimos: 10_000 });
    expect(a).toEqual({ id: p.id, motivoCodigo: 'precio_acordado', fijarTotalCentimos: 10_000 });
  });
});

describe('vista previa «Qué cambia»', () => {
  it('muestra la línea cambiada, el total, lo pagado y lo que queda a favor', () => {
    const p = pedido();
    const f = { ...formularioDeCorreccion(p), motivo: 'igv' as const, fijarTotalCentimos: 9_000 };
    const v = vistaPrevia(p, f, 10_000);
    expect(v.deltaCentimos).toBe(-2_800);
    expect(v.pagadoCentimos).toBe(10_000);
    expect(v.faltaCentimos).toBe(0);
    expect(v.aFavorCentimos).toBe(1_000);
  });
  it('lista las líneas que cambian y las quitadas', () => {
    const p = pedido();
    const base = formularioDeCorreccion(p);
    const v = vistaPrevia(p, { ...base, lineas: conIgvEncima(base.lineas.slice(0, 1), 18) }, null);
    expect(v.filas.map((x) => [x.descripcion, x.despues === null])).toEqual([['Volantes', false], ['Flete', true]]);
    expect(v.pagadoCentimos).toBeNull();
  });
});
