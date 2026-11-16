import { describe, expect, it } from 'vitest';
import {
  AVANCES_DE_PEDIDO,
  ESTADOS_DE_PEDIDO,
  calcularTotalesDePedido,
  contratosDeOrdenes,
  crearPedidoSchema,
  editarPedidoSchema,
  lineaDeEntradaSchema,
} from './ordenes.js';

const linea = (cantidadMilesimas: number, precioUnitarioMilesimas: number, afectoIgv = true) => ({ cantidadMilesimas, precioUnitarioMilesimas, afectoIgv });
const UUID = '0192f0c4-7b1e-7000-8000-000000000001';

describe('calcularTotalesDePedido (los precios incluyen IGV)', () => {
  it('una línea de 118.00 da 100.00 + 18.00', () => {
    expect(calcularTotalesDePedido([linea(1000, 118_000)], 18)).toEqual({
      lineas: [{ importeCentimos: 11_800, baseCentimos: 10_000, igvCentimos: 1_800 }],
      subtotalCentimos: 10_000,
      igvCentimos: 1_800,
      totalCentimos: 11_800,
    });
  });

  it('tres líneas de 0.10: el redondeo es por línea (8 + 2 cada una)', () => {
    const t = calcularTotalesDePedido([linea(1000, 100), linea(1000, 100), linea(1000, 100)], 18);
    expect(t.lineas).toEqual(Array(3).fill({ importeCentimos: 10, baseCentimos: 8, igvCentimos: 2 }));
    expect(t).toMatchObject({ subtotalCentimos: 24, igvCentimos: 6, totalCentimos: 30 });
  });

  it('cantidades con tres decimales', () => {
    // 2.375 × S/ 12.345 = 29.319375 → S/ 29.32; base 2932 × 100 / 118 = 2484.75 → 2485.
    const t = calcularTotalesDePedido([linea(2375, 12_345)], 18);
    expect(t).toMatchObject({ subtotalCentimos: 2485, igvCentimos: 447, totalCentimos: 2932 });
  });

  it('mezcla de afectas y no afectas: la no afecta no lleva IGV', () => {
    const t = calcularTotalesDePedido([linea(1000, 118_000), linea(2000, 50_000, false)], 18);
    expect(t.lineas[1]).toEqual({ importeCentimos: 10_000, baseCentimos: 10_000, igvCentimos: 0 });
    expect(t).toMatchObject({ subtotalCentimos: 20_000, igvCentimos: 1_800, totalCentimos: 21_800 });
  });

  it('con IGV 0 todo es base', () => {
    expect(calcularTotalesDePedido([linea(3000, 33_333)], 0)).toMatchObject({ subtotalCentimos: 10_000, igvCentimos: 0, totalCentimos: 10_000 });
  });

  it('la mitad exacta sube: 59 céntimos al 18 % son 50 de base', () => {
    // 59 × 100 / 118 = 50 exacto; 177 × 100 / 118 = 150 exacto; 3 × 100 / 8 no existe: se prueba con IGV 100.
    expect(calcularTotalesDePedido([linea(1000, 590)], 18).subtotalCentimos).toBe(50);
    // IGV 100 %: 0.01 → 0.5 céntimos de base → sube a 1, IGV 0.
    expect(calcularTotalesDePedido([linea(1000, 10)], 100)).toMatchObject({ subtotalCentimos: 1, igvCentimos: 0, totalCentimos: 1 });
  });

  it('total = subtotal + igv = suma de importes, siempre (lo exige la base)', () => {
    let semilla = 7;
    const azar = (max: number) => (semilla = (semilla * 48_271) % 2_147_483_647) % max;
    for (let i = 0; i < 300; i++) {
      const lineas = Array.from({ length: 1 + azar(8) }, () => linea(1 + azar(50_000), azar(900_000), azar(4) !== 0));
      const t = calcularTotalesDePedido(lineas, [0, 10, 18][azar(3)]!);
      expect(t.totalCentimos).toBe(t.subtotalCentimos + t.igvCentimos);
      expect(t.totalCentimos).toBe(t.lineas.reduce((s, l) => s + l.importeCentimos, 0));
      expect(t.igvCentimos).toBeGreaterThanOrEqual(0);
      for (const l of t.lineas) expect(l.baseCentimos + l.igvCentimos).toBe(l.importeCentimos);
    }
  });

  it('sin líneas todo es cero', () => {
    expect(calcularTotalesDePedido([], 18)).toEqual({ lineas: [], subtotalCentimos: 0, igvCentimos: 0, totalCentimos: 0 });
  });

  it('rechaza porcentajes fuera de rango, negativos y sumas que no caben en un entero seguro', () => {
    expect(() => calcularTotalesDePedido([], 101)).toThrow(RangeError);
    expect(() => calcularTotalesDePedido([], 18.5)).toThrow(RangeError);
    expect(() => calcularTotalesDePedido([linea(-1000, 100)], 18)).toThrow(RangeError);
    const enorme = linea(3_000_000_000, 20_000_000_000);
    expect(() => calcularTotalesDePedido([enorme, enorme], 18)).toThrow();
  });
});

describe('tabla de avances', () => {
  it('cubre los seis estados y los finales no avanzan', () => {
    expect(Object.keys(AVANCES_DE_PEDIDO).sort()).toEqual([...ESTADOS_DE_PEDIDO].sort());
    expect(AVANCES_DE_PEDIDO.entregado).toEqual([]);
    expect(AVANCES_DE_PEDIDO.cancelado).toEqual([]);
    expect(AVANCES_DE_PEDIDO.borrador).toEqual([]);
  });
});

describe('contratos de pedidos', () => {
  it('una línea sin producto necesita descripción y precio', () => {
    expect(lineaDeEntradaSchema.safeParse({ cantidadMilesimas: 1000 }).success).toBe(false);
    expect(lineaDeEntradaSchema.safeParse({ cantidadMilesimas: 1000, descripcion: 'Volantes' }).success).toBe(false);
    expect(lineaDeEntradaSchema.safeParse({ cantidadMilesimas: 1000, descripcion: '   ', precioUnitarioMilesimas: 100 }).success).toBe(false);
    expect(lineaDeEntradaSchema.safeParse({ cantidadMilesimas: 1000, descripcion: 'Volantes', precioUnitarioMilesimas: 0 }).success).toBe(true);
    expect(lineaDeEntradaSchema.safeParse({ cantidadMilesimas: 1000, productoId: UUID }).success).toBe(true);
  });

  it('cantidad cero, decimales y campos de más se rechazan', () => {
    expect(lineaDeEntradaSchema.safeParse({ productoId: UUID, cantidadMilesimas: 0 }).success).toBe(false);
    expect(lineaDeEntradaSchema.safeParse({ productoId: UUID, cantidadMilesimas: 1.5 }).success).toBe(false);
    expect(lineaDeEntradaSchema.safeParse({ productoId: UUID, cantidadMilesimas: 1000, descuento: 5 }).success).toBe(false);
    expect(crearPedidoSchema.safeParse({ clienteId: UUID, empresaId: 'x' }).success).toBe(false);
  });

  it('crear: las líneas son opcionales (borrador vacío), máximo 100, y el origen va completo', () => {
    expect(crearPedidoSchema.parse({ clienteId: UUID }).lineas).toEqual([]);
    const cien = Array.from({ length: 101 }, () => ({ productoId: UUID, cantidadMilesimas: 1000 }));
    expect(crearPedidoSchema.safeParse({ clienteId: UUID, lineas: cien }).success).toBe(false);
    expect(crearPedidoSchema.safeParse({ clienteId: UUID, origenTipo: 'cotizacion' }).success).toBe(false);
    expect(crearPedidoSchema.safeParse({ clienteId: UUID, origenTipo: 'cotizacion', origenId: 'c-1' }).success).toBe(true);
  });

  it('editar exige al menos un cambio y acepta null para borrar un opcional', () => {
    expect(editarPedidoSchema.safeParse({ id: UUID }).success).toBe(false);
    expect(editarPedidoSchema.safeParse({ id: UUID, entregaEl: null }).success).toBe(true);
    expect(editarPedidoSchema.safeParse({ id: UUID, lineas: [] }).success).toBe(true);
    expect(editarPedidoSchema.safeParse({ id: UUID, fecha: '2026-01-01' }).success).toBe(false);
  });

  it('listar filtra por «abiertos» si no se indica, y cambiar de estado no admite borrador ni cancelado', () => {
    expect(contratosDeOrdenes.pedidos_listar.entrada.parse({})).toMatchObject({ estado: 'abiertos', limite: 25 });
    const cambiar = contratosDeOrdenes.pedido_cambiar_estado.entrada;
    expect(cambiar.safeParse({ id: UUID, estado: 'cancelado' }).success).toBe(false);
    expect(cambiar.safeParse({ id: UUID, estado: 'borrador' }).success).toBe(false);
    expect(cambiar.safeParse({ id: UUID, estado: 'listo' }).success).toBe(true);
  });

  it('el resumen exige un período ordenado y cancelar exige motivo', () => {
    expect(contratosDeOrdenes.ordenes_resumen.entrada.safeParse({ desde: '2026-02-01', hasta: '2026-01-01' }).success).toBe(false);
    expect(contratosDeOrdenes.pedido_cancelar.entrada.safeParse({ id: UUID, motivo: '  ' }).success).toBe(false);
  });
});
