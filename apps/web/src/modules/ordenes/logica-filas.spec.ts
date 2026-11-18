import { describe, expect, it } from 'vitest';
import { agregarDesdeCatalogo, alEnterEnImporte, cambiarCantidad, cambiarImporte, cambiarPrecio, cambiarUnidad, cuadra, estaEnBlanco, importeMostrado, quitarFila, sinFilasEnBlanco, usarPrecioAnterior } from './logica-filas.ts';
import { argumentosDeCreacion, lineaDesdeDto, lineaVacia, validarPedido, type LineaDeFormulario } from './logica.ts';

const fila = (clave: string, extra: Partial<LineaDeFormulario> = {}): LineaDeFormulario => ({ ...lineaVacia(clave), ...extra });
const producto = { id: 'pr1', nombre: 'Tarjetas', unidad: 'millar', precioUnitarioMilesimas: 59_000, afectoIgv: true };

describe('lo último escrito manda', () => {
  it('escribir el importe y luego cambiar la cantidad recalcula el unitario', () => {
    let l = cambiarImporte(fila('a', { cantidadMilesimas: 2_000 }), 10_000);
    expect(l).toMatchObject({ manda: 'importe', precioUnitarioMilesimas: 50_000 });
    l = cambiarCantidad(l, 4_000);
    expect(l.precioUnitarioMilesimas).toBe(25_000);
    expect(importeMostrado(l)).toBe(10_000);
  });
  it('escribir el precio devuelve el mando y el importe sale de cantidad × precio', () => {
    const l = cambiarPrecio(cambiarImporte(fila('a', { cantidadMilesimas: 2_000 }), 10_000), 12_500);
    expect(l).toMatchObject({ manda: 'precio', importeEscritoCentimos: null, precioUnitarioMilesimas: 12_500 });
    expect(importeMostrado(cambiarCantidad(l, 4_000))).toBe(5_000);
  });
  it('7000 unidades a un importe de S/ 100 no cuadra y el importe queda en S/ 98.00', () => {
    const l = cambiarImporte(fila('a', { cantidadMilesimas: 7_000_000 }), 10_000);
    expect(cuadra(l)).toBe(false);
    expect(importeMostrado(l)).toBe(9_800);
    expect(cuadra(cambiarImporte(fila('b', { cantidadMilesimas: 3_000 }), 10_000))).toBe(true);
  });
});

describe('«Usar» un precio anterior', () => {
  it('en una fila nueva copia el precio y la unidad del precio anterior (la fila nace con «unidad»)', () => {
    const l = usarPrecioAnterior(cambiarImporte(fila('a', { cantidadMilesimas: 5_000 }), 10_000), 85_000, 'millar');
    expect(l).toMatchObject({ unidad: 'millar', precioUnitarioMilesimas: 85_000, manda: 'precio', importeEscritoCentimos: null });
  });
  it('si la persona eligió la unidad, se respeta', () => {
    expect(usarPrecioAnterior(cambiarUnidad(fila('a'), 'ciento'), 85_000, 'millar').unidad).toBe('ciento');
  });
  it('la unidad de un producto del catálogo o de un pedido guardado cuenta como elegida', () => {
    const delCatalogo = agregarDesdeCatalogo([fila('a')], { ...producto, unidad: 'caja' }, 'n')[0]!;
    expect(usarPrecioAnterior(delCatalogo, 85_000, 'millar').unidad).toBe('caja');
    const guardada = lineaDesdeDto({ id: 'l1', productoId: null, descripcion: 'Volantes', unidad: 'ciento', cantidadMilesimas: 1_000, precioUnitarioMilesimas: 1_000, afectoIgv: true } as Parameters<typeof lineaDesdeDto>[0]);
    expect(usarPrecioAnterior(guardada, 85_000, 'millar').unidad).toBe('ciento');
  });
});

describe('filas', () => {
  it('Enter en el importe solo agrega fila en la última', () => {
    const filas = [fila('a'), fila('b')];
    expect(alEnterEnImporte(filas, 'a', 'n')).toEqual({ lineas: filas, foco: null });
    const r = alEnterEnImporte(filas, 'b', 'n');
    expect(r.lineas.map((l) => l.clave)).toEqual(['a', 'b', 'n']);
    expect(r.foco).toBe('n');
  });
  it('quitar deja siempre una fila', () => {
    expect(quitarFila([fila('a'), fila('b')], 'a').map((l) => l.clave)).toEqual(['b']);
    expect(quitarFila([fila('a')], 'a')).toHaveLength(1);
  });
  it('las filas en blanco se ignoran al validar y al crear', () => {
    const l = fila('x', { descripcion: 'Volantes', precioUnitarioMilesimas: 1_000 });
    expect(estaEnBlanco(fila('a'))).toBe(true);
    expect(estaEnBlanco(l)).toBe(false);
    expect(sinFilasEnBlanco([fila('a'), l, fila('b')])).toEqual([l]);
    const f = { cliente: { id: 'c1', nombre: 'Sol' }, entregaEl: '', responsableId: '', notas: '', lineas: [fila('a'), l, fila('b')] };
    expect(validarPedido(f, '2026-03-10')).toEqual({});
    expect(argumentosDeCreacion(f).lineas).toHaveLength(1);
  });
  it('desde el catálogo llena la última fila en blanco o agrega una', () => {
    const vacias = agregarDesdeCatalogo([fila('a'), fila('b')], producto, 'n');
    expect(vacias.map((l) => l.clave)).toEqual(['a', 'b']);
    expect(vacias[1]).toMatchObject({ descripcion: 'Tarjetas', unidad: 'millar', precioUnitarioMilesimas: 59_000 });
    const llena = agregarDesdeCatalogo([fila('a', { descripcion: 'Algo', precioUnitarioMilesimas: 1 })], producto, 'n');
    expect(llena.map((l) => l.clave)).toEqual(['a', 'n']);
    expect(llena[1]?.descripcion).toBe('Tarjetas');
  });
});
