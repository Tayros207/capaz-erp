import { describe, expect, it } from 'vitest';
import { cambiosDeDatos, codigoDePedido, comprobarFechas, comprobarLineasParaConfirmar, prepararLineas, type ProductoParaLinea } from './pedido.js';

const P1 = '0192f0c4-7b1e-7000-8000-000000000001';
const P2 = '0192f0c4-7b1e-7000-8000-000000000002';
const producto = (id: string, extra: Partial<ProductoParaLinea> = {}): ProductoParaLinea => ({ id, nombre: 'Tarjetas', unidad: 'millar', precioUnitarioMilesimas: 118_000, afectoIgv: true, archivado: false, ...extra });
const catalogo = (...p: ProductoParaLinea[]) => new Map(p.map((x) => [x.id, x]));

describe('codigoDePedido', () => {
  it('arma PED-serie-año-número con cuatro cifras como mínimo', () => {
    expect(codigoDePedido('PRI', 2026, 7)).toBe('PED-PRI-2026-0007');
    expect(codigoDePedido('SUR', 2027, 12_345)).toBe('PED-SUR-2027-12345');
  });
  it('sin número muestra «Borrador»', () => {
    expect(codigoDePedido(null, null, null)).toBe('Borrador');
  });
});

describe('fechas y cantidad de líneas', () => {
  it('la entrega no puede ser anterior a la fecha', () => {
    expect(comprobarFechas('2026-03-10', '2026-03-09').ok).toBe(false);
    expect(comprobarFechas('2026-03-10', '2026-03-10').ok).toBe(true);
    expect(comprobarFechas('2026-03-10', null).ok).toBe(true);
  });
  it('se confirma con 1 a 100 líneas', () => {
    expect(comprobarLineasParaConfirmar(0).ok).toBe(false);
    expect(comprobarLineasParaConfirmar(1).ok).toBe(true);
    expect(comprobarLineasParaConfirmar(100).ok).toBe(true);
    expect(comprobarLineasParaConfirmar(101).ok).toBe(false);
  });
});

describe('prepararLineas', () => {
  it('D7 la ficha se recorta y lo vacío queda null', () => {
    const r = prepararLineas([{ descripcion: 'Tarjetas', cantidadMilesimas: 1000, precioUnitarioMilesimas: 100, material: ' couché 300 g ', medida: '', colores: null }], catalogo(), 18);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.lineas[0]).toMatchObject({ material: 'couché 300 g', medida: null, colores: null, acabado: null });
  });

  it('lo que no llega se toma del producto; lo que llega manda', () => {
    const r = prepararLineas(
      [
        { productoId: P1, cantidadMilesimas: 1000 },
        { productoId: P1, cantidadMilesimas: 2000, descripcion: 'Tarjetas mate', unidad: 'ciento', precioUnitarioMilesimas: 50_000, afectoIgv: false },
      ],
      catalogo(producto(P1)),
      18,
    );
    if (!r.ok) throw new Error(r.motivo);
    expect(r.lineas[0]).toEqual({ posicion: 0, productoId: P1, descripcion: 'Tarjetas', unidad: 'millar', cantidadMilesimas: 1000, precioUnitarioMilesimas: 118_000, afectoIgv: true, importeCentimos: 11_800, material: null, medida: null, colores: null, acabado: null });
    expect(r.lineas[1]).toMatchObject({ posicion: 1, descripcion: 'Tarjetas mate', unidad: 'ciento', precioUnitarioMilesimas: 50_000, afectoIgv: false, importeCentimos: 10_000 });
    expect(r).toMatchObject({ subtotalCentimos: 20_000, igvCentimos: 1_800, totalCentimos: 21_800 });
  });

  it('tres líneas (una sin producto, una no afecta) dan los totales de la prueba de totales', () => {
    const r = prepararLineas(
      [
        { productoId: P1, cantidadMilesimas: 1000 },
        { descripcion: 'Diseño de logotipo', cantidadMilesimas: 1000, precioUnitarioMilesimas: 100 },
        { productoId: P2, cantidadMilesimas: 2000 },
      ],
      catalogo(producto(P1), producto(P2, { nombre: 'Libro', unidad: 'unidad', precioUnitarioMilesimas: 50_000, afectoIgv: false })),
      18,
    );
    if (!r.ok) throw new Error(r.motivo);
    expect(r.lineas[1]).toMatchObject({ productoId: null, unidad: 'unidad', afectoIgv: true, importeCentimos: 10 });
    // 118.00 → 100.00 + 18.00 · 0.10 → 0.08 + 0.02 · 100.00 no afecta.
    expect(r).toMatchObject({ subtotalCentimos: 20_008, igvCentimos: 1_802, totalCentimos: 21_810 });
  });

  it('un producto que no existe o está archivado se rechaza con el número de línea', () => {
    expect(prepararLineas([{ productoId: P1, cantidadMilesimas: 1000 }], catalogo(), 18)).toEqual({ ok: false, motivo: 'Línea 1: el producto no existe o está archivado.' });
    const r = prepararLineas([{ productoId: P1, cantidadMilesimas: 1000 }, { productoId: P2, cantidadMilesimas: 1000 }], catalogo(producto(P1), producto(P2, { archivado: true })), 18);
    expect(r).toEqual({ ok: false, motivo: 'Línea 2: el producto no existe o está archivado.' });
  });

  it('sin producto exige descripción y precio (defensa además del contrato)', () => {
    expect(prepararLineas([{ cantidadMilesimas: 1000, descripcion: 'Algo' }], catalogo(), 18).ok).toBe(false);
    expect(prepararLineas([{ cantidadMilesimas: 1000, precioUnitarioMilesimas: 100 }], catalogo(), 18).ok).toBe(false);
  });

  it('un importe que no cabe se rechaza en vez de reventar', () => {
    const r = prepararLineas([{ descripcion: 'Enorme', cantidadMilesimas: 9_000_000_000_000_000, precioUnitarioMilesimas: 9_000_000_000_000_000 }], catalogo(), 18);
    expect(r).toEqual({ ok: false, motivo: 'El importe del pedido es demasiado grande.' });
  });

  it('sin líneas: totales en cero', () => {
    expect(prepararLineas([], catalogo(), 18)).toEqual({ ok: true, lineas: [], subtotalCentimos: 0, igvCentimos: 0, totalCentimos: 0 });
  });
});

describe('cambiosDeDatos', () => {
  const actual = { entregaEl: '2099-02-01', responsableId: 'u1', notas: 'Vieja' };
  it('solo lista lo que llega y difiere, con su antes y después', () => {
    expect(cambiosDeDatos(actual, { entregaEl: '2099-02-10', notas: 'Vieja' })).toEqual([{ campo: 'entregaEl', antes: '2099-02-01', despues: '2099-02-10' }]);
  });
  it('vacío o null quita el valor; lo que no llega no se toca', () => {
    expect(cambiosDeDatos(actual, { entregaEl: null, notas: '  ' })).toEqual([
      { campo: 'entregaEl', antes: '2099-02-01', despues: null },
      { campo: 'notas', antes: 'Vieja', despues: null },
    ]);
  });
  it('sin cambios reales devuelve vacío (también quitar lo que ya estaba quitado)', () => {
    expect(cambiosDeDatos(actual, {})).toEqual([]);
    expect(cambiosDeDatos({ entregaEl: null, responsableId: null, notas: null }, { entregaEl: null, responsableId: '', notas: '' })).toEqual([]);
  });
});
