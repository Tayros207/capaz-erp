import { describe, expect, it } from 'vitest';
import { calcularTotalesDePedido, type PedidoCompletoDto } from '@capaz/shared';
import { alternarDesglose, argumentosDeCorreccion, conIgvEncima, diferenciaDelAtajo, formularioDeCorreccion, hayCambios, sinIgvIncluido, validarCorreccion, vistaPrevia } from './correccion.ts';
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

describe('precisión de los atajos (precio con tres decimales)', () => {
  const chico = (precio: number, cantidad: number) => ({ ...formularioDeCorreccion(pedido()).lineas[0]!, cantidadMilesimas: cantidad, precioUnitarioMilesimas: precio });
  it('1000 × S/ 0.085 más IGV: el precio queda en S/ 0.100 y el total en S/ 100.00, no en S/ 100.30; se avisa', () => {
    const antes = [chico(85, 1_000_000)];
    const despues = conIgvEncima(antes, 18);
    expect(despues[0]?.precioUnitarioMilesimas).toBe(100);
    expect(diferenciaDelAtajo(antes, despues, 18, 'encima')).toEqual({ exactoCentimos: 10_030, conPreciosCentimos: 10_000 });
  });
  it('con precios normales no hay nada que avisar (ida y vuelta exacta)', () => {
    const antes = formularioDeCorreccion(pedido()).lineas;
    expect(diferenciaDelAtajo(antes, conIgvEncima(antes, 18), 18, 'encima')).toBeNull();
    expect(diferenciaDelAtajo(antes, sinIgvIncluido(antes, 18), 18, 'quitar')).toBeNull();
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
    expect(a).toEqual({ id: p.id, versionEsperada: 1, motivoCodigo: 'precio_acordado', fijarTotalCentimos: 10_000 });
  });
  it('lleva la versión que se tiene a la vista (si otro corrigió antes, el servidor rechaza)', () => {
    const p = pedido({ version: 3 });
    expect(argumentosDeCorreccion(p, { ...formularioDeCorreccion(p), motivo: 'igv', fijarTotalCentimos: 9_000 }).versionEsperada).toBe(3);
  });
  it('líneas cambiadas con el total fijado en el mismo de antes: se envía el total fijado (la vista previa y el servidor dan lo mismo)', () => {
    const p = pedido();
    const base = formularioDeCorreccion(p);
    const nueva = { ...lineaVacia('9f2c0000-0000-4000-8000-000000000009'), descripcion: 'Extra', cantidadMilesimas: 1000, precioUnitarioMilesimas: 10_000 };
    const f = { ...base, lineas: [...base.lineas, nueva], motivo: 'lineas' as const, fijarTotalCentimos: p.totalCentimos };
    const a = argumentosDeCorreccion(p, f);
    expect(a.fijarTotalCentimos).toBe(11_800);
    expect(vistaPrevia(p, f, null).totalNuevoCentimos).toBe(11_800);
  });
});

describe('vista previa «Qué cambia»', () => {
  it('sin total fijado, el total de la vista previa es el mismo cálculo del servidor (calcularTotalesDePedido)', () => {
    const p = pedido();
    const base = formularioDeCorreccion(p);
    for (const lineas of [conIgvEncima(base.lineas, 18), sinIgvIncluido(base.lineas, 18), alternarDesglose(base.lineas)]) {
      const f = { ...base, lineas, motivo: 'igv' as const };
      const servidor = calcularTotalesDePedido(argumentosDeCorreccion(p, f).lineas ?? [], 18).totalCentimos;
      expect(vistaPrevia(p, f, null).totalNuevoCentimos).toBe(servidor);
    }
  });
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
