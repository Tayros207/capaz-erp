import { describe, expect, it } from 'vitest';
import { calcularTotalesDeCompra, calcularTotalesDePedido } from '@capaz/shared';
import { codigoDeOrden, comprobarFechas, comprobarLineasParaEnviar, prepararLineas, type ProductoParaLinea } from './orden.js';

const P1 = '0192f0c4-7b1e-7000-8000-000000000001';
const P2 = '0192f0c4-7b1e-7000-8000-000000000002';
const producto = (id: string, extra: Partial<ProductoParaLinea> = {}): ProductoParaLinea => ({ id, nombre: 'Papel bond A4', unidad: 'millar', afectoIgv: true, archivado: false, ...extra });
const catalogo = (...p: ProductoParaLinea[]) => new Map(p.map((x) => [x.id, x]));

describe('codigoDeOrden', () => {
  it('arma OC-serie-año-número con cuatro cifras como mínimo', () => {
    expect(codigoDeOrden('PRI', 2026, 1)).toBe('OC-PRI-2026-0001');
    expect(codigoDeOrden('SUR', 2027, 12_345)).toBe('OC-SUR-2027-12345');
  });
  it('sin número muestra «Borrador»', () => {
    expect(codigoDeOrden(null, null, null)).toBe('Borrador');
    expect(codigoDeOrden('PRI', null, 1)).toBe('Borrador');
  });
});

describe('fechas y cantidad de líneas', () => {
  it('la entrega no puede ser anterior a la fecha', () => {
    expect(comprobarFechas('2026-03-10', '2026-03-09')).toEqual({ ok: false, motivo: 'La entrega no puede ser anterior a la fecha de la orden.' });
    expect(comprobarFechas('2026-03-10', '2026-03-10').ok).toBe(true);
    expect(comprobarFechas('2026-03-10', null).ok).toBe(true);
  });
  it('se envía con 1 a 100 líneas', () => {
    expect(comprobarLineasParaEnviar(0)).toEqual({ ok: false, motivo: 'Agrega al menos una línea antes de enviar la orden.' });
    expect(comprobarLineasParaEnviar(1).ok).toBe(true);
    expect(comprobarLineasParaEnviar(100).ok).toBe(true);
    expect(comprobarLineasParaEnviar(101).ok).toBe(false);
  });
});

describe('totales (IGV incluido, como Pedidos)', () => {
  it('es la misma cuenta que la de Pedidos con el costo en lugar del precio', () => {
    const lineas = [
      { cantidadMilesimas: 1000, costoUnitarioMilesimas: 118_000, afectoIgv: true },
      { cantidadMilesimas: 1000, costoUnitarioMilesimas: 100, afectoIgv: true },
      { cantidadMilesimas: 2000, costoUnitarioMilesimas: 50_000, afectoIgv: false },
    ];
    const t = calcularTotalesDeCompra(lineas, 18);
    expect(t).toEqual(calcularTotalesDePedido(lineas.map((l) => ({ ...l, precioUnitarioMilesimas: l.costoUnitarioMilesimas })), 18));
    // 118.00 → 100.00 + 18.00 · 0.10 → 0.08 + 0.02 (mitad hacia arriba) · 100.00 no afecta.
    expect(t).toMatchObject({ subtotalCentimos: 20_008, igvCentimos: 1_802, totalCentimos: 21_810 });
    expect(t.totalCentimos).toBe(t.lineas.reduce((s, l) => s + l.importeCentimos, 0));
  });
});

describe('prepararLineas', () => {
  it('descripción, unidad y afectación salen del producto si no llegan; el costo siempre llega', () => {
    const r = prepararLineas(
      [
        { productoId: P1, cantidadMilesimas: 2000, costoUnitarioMilesimas: 23_600 },
        { productoId: P1, cantidadMilesimas: 1500, descripcion: 'Papel bond 80 g', unidad: 'paquete', costoUnitarioMilesimas: 10_000, afectoIgv: false },
      ],
      catalogo(producto(P1)),
      18,
    );
    if (!r.ok) throw new Error(r.motivo);
    expect(r.lineas[0]).toEqual({ posicion: 0, productoId: P1, descripcion: 'Papel bond A4', unidad: 'millar', cantidadMilesimas: 2000, costoUnitarioMilesimas: 23_600, afectoIgv: true, importeCentimos: 4_720 });
    expect(r.lineas[1]).toMatchObject({ posicion: 1, descripcion: 'Papel bond 80 g', unidad: 'paquete', afectoIgv: false, importeCentimos: 1_500 });
    expect(r).toMatchObject({ subtotalCentimos: 4_000 + 1_500, igvCentimos: 720, totalCentimos: 6_220 });
  });

  it('una línea sin producto es un gasto: necesita descripción y queda afecta por defecto', () => {
    const r = prepararLineas([{ descripcion: 'Flete', cantidadMilesimas: 1000, costoUnitarioMilesimas: 59_000 }], catalogo(), 18);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.lineas[0]).toMatchObject({ productoId: null, unidad: 'unidad', afectoIgv: true, importeCentimos: 5_900 });
    expect(r).toMatchObject({ subtotalCentimos: 5_000, igvCentimos: 900 });
    expect(prepararLineas([{ cantidadMilesimas: 1000, costoUnitarioMilesimas: 100 }], catalogo(), 18)).toEqual({ ok: false, motivo: 'Línea 1: una línea sin producto necesita descripción.' });
  });

  it('un producto que no existe o está archivado se rechaza con el número de línea', () => {
    expect(prepararLineas([{ productoId: P1, cantidadMilesimas: 1000, costoUnitarioMilesimas: 1 }], catalogo(), 18)).toEqual({ ok: false, motivo: 'Línea 1: el producto no existe o está archivado.' });
    const r = prepararLineas(
      [{ productoId: P1, cantidadMilesimas: 1000, costoUnitarioMilesimas: 1 }, { productoId: P2, cantidadMilesimas: 1000, costoUnitarioMilesimas: 1 }],
      catalogo(producto(P1), producto(P2, { archivado: true })),
      18,
    );
    expect(r).toEqual({ ok: false, motivo: 'Línea 2: el producto no existe o está archivado.' });
  });

  it('costo cero se admite (muestra gratis) y suma cero', () => {
    const r = prepararLineas([{ descripcion: 'Muestra', cantidadMilesimas: 1000, costoUnitarioMilesimas: 0 }], catalogo(), 18);
    expect(r).toMatchObject({ ok: true, totalCentimos: 0 });
  });

  it('un importe que no cabe se rechaza en vez de reventar', () => {
    const r = prepararLineas([{ descripcion: 'Enorme', cantidadMilesimas: 9_000_000_000_000_000, costoUnitarioMilesimas: 9_000_000_000_000_000 }], catalogo(), 18);
    expect(r).toEqual({ ok: false, motivo: 'El importe de la orden es demasiado grande.' });
  });

  it('sin líneas: totales en cero', () => {
    expect(prepararLineas([], catalogo(), 18)).toEqual({ ok: true, lineas: [], subtotalCentimos: 0, igvCentimos: 0, totalCentimos: 0 });
  });
});
