import { describe, expect, it } from 'vitest';
import { milesimasATextoPlano } from '../../../shared/api/logica-precio-anterior.ts';
import { alEnterEnImporte, argumentosDeHojaDirecta, calcularFila, condicionesIniciales, filaVacia, igvDeLaHojaDirecta, opcionesDeUnidad, opcionesDeValidez, precioLeido, quitarFila, tituloDeHoja, totalesDeHoja, usarPrecioAnterior, validarHoja, type FilaDirecta, type HojaDirecta } from './logica-directa.ts';

const fila = (extra: Partial<FilaDirecta> = {}): FilaDirecta => ({ ...filaVacia('a'), descripcion: 'Volantes', cantidad: '1.000', precio: '0,42', ...extra });
const hoja = (extra: Partial<HojaDirecta> = {}): HojaDirecta => ({ cliente: { id: 'c1', nombre: 'Sol' }, referencia: '', filas: [fila()], conIgv: false, incluyeIgv: false, validezDias: 15, plazoEntrega: '', formaPago: '', ...extra });
const config = (c: Partial<{ validezDias: number | null; plazoEntrega: string; formaPago: string }>, unidades: string[] = []) =>
  ({ condiciones: { validezDias: null, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '', ...c }, unidades });

describe('calcularFila', () => {
  it('manda el precio: 1.000 × 0,42 = 420,00', () => {
    const c = calcularFila(fila(), false);
    expect(c).toMatchObject({ cantidadMilesimas: 1_000_000, precioMilesimas: 420, importeBrutoCentimos: 42_000, neto: 42_000, igv: 7_560, total: 49_560, textoDelOtro: '420,00' });
  });
  it('manda el importe: 7 u. con 100,00 → unitario 14,286', () => {
    const c = calcularFila(fila({ cantidad: '7', precio: '', importe: '100', manda: 'importe' }), false);
    expect(c).toMatchObject({ precioMilesimas: 14_286, importeBrutoCentimos: 10_000, exacto: true, textoDelOtro: '14,286', neto: 10_000 });
  });
  it('con IGV incluido el importe escrito se descompone: 118,00 → 100,00 + 18,00', () => {
    const c = calcularFila(fila({ cantidad: '1', precio: '', importe: '118', manda: 'importe' }), true);
    expect(c).toMatchObject({ neto: 10_000, igv: 1_800, total: 11_800 });
  });
  it('100,00 con IGV incluido deja 84,75 + 15,26 (el céntimo se documenta)', () => {
    const c = calcularFila(fila({ cantidad: '1', precio: '', importe: '100', manda: 'importe' }), true);
    expect(c).toMatchObject({ neto: 8_475, igv: 1_526, total: 10_001 });
  });
  it('sin cantidad o sin precio no hay importe', () => {
    expect(calcularFila(fila({ cantidad: '' }), false).neto).toBeNull();
    expect(calcularFila(fila({ precio: '' }), false).neto).toBeNull();
  });
  it('el precio «1.250» es S/ 1.25 (no S/ 1250): 1000 × 1,25 = 1250,00; la cantidad «1.000» sigue siendo mil', () => {
    const c = calcularFila(fila({ precio: '1.250' }), false);
    expect(c).toMatchObject({ cantidadMilesimas: 1_000_000, precioMilesimas: 1_250, importeBrutoCentimos: 125_000 });
  });
  it('el unitario calculado que se muestra («14,286») se vuelve a leer igual si la persona lo retoca', () => {
    const otro = calcularFila(fila({ cantidad: '7', precio: '', importe: '100', manda: 'importe' }), false).textoDelOtro;
    expect(calcularFila(fila({ cantidad: '7', precio: otro, manda: 'precio' }), false).precioMilesimas).toBe(14_286);
  });
});

describe('precio anterior y precio leído', () => {
  it('el texto de «Usar» se lee como el mismo precio (nunca ×1000)', () => {
    for (const m of [12_505, 1_085, 85, 240, 118_000, 1_234_500]) {
      expect(calcularFila(fila({ precio: milesimasATextoPlano(m) }), false).precioMilesimas).toBe(m);
    }
  });
  it('«Usar» copia la unidad del precio anterior si la persona no eligió una; si la eligió, la respeta', () => {
    expect(usarPrecioAnterior(filaVacia('a'), '85', 'millar')).toMatchObject({ precio: '85', manda: 'precio', unidad: 'millar' });
    expect(usarPrecioAnterior({ ...filaVacia('a'), unidad: 'ciento', unidadElegida: true }, '85', 'millar').unidad).toBe('ciento');
    expect(usarPrecioAnterior({ ...filaVacia('a'), manda: 'importe', importe: '10' }, '0.085', 'unidad')).toMatchObject({ manda: 'precio', precio: '0.085' });
  });
  it('precioLeido: lo interpretado, «ilegible» o nada si manda el importe', () => {
    expect(precioLeido({ precio: '1.250', manda: 'precio' })).toBe(1_250);
    expect(precioLeido({ precio: '0.0855', manda: 'precio' })).toBe('ilegible');
    expect(precioLeido({ precio: '', manda: 'precio' })).toBeNull();
    expect(precioLeido({ precio: '5', manda: 'importe' })).toBeNull();
  });
  it('un precio que no se entiende se señala como tal', () => {
    const r = validarHoja(hoja({ filas: [fila({ precio: '0.0855' })] }));
    expect(r.errores.porFila.a?.precio).toMatch(/No se entiende/);
  });
});

describe('totalesDeHoja', () => {
  it('suma línea por línea e ignora las filas a medias', () => {
    const filas = [fila(), fila({ clave: 'b', cantidad: '3', precio: '0,10' }), fila({ clave: 'c', descripcion: '' }), filaVacia('d')];
    expect(totalesDeHoja(filas, false)).toEqual({ subtotalCentimos: 42_030, igvCentimos: 7_565, totalCentimos: 49_595 });
  });
  it('con 0 % de IGV el total es el subtotal', () => {
    expect(totalesDeHoja([fila()], false, 0)).toEqual({ subtotalCentimos: 42_000, igvCentimos: 0, totalCentimos: 42_000 });
  });
});

describe('filas', () => {
  it('Enter en el importe de la última fila agrega otra y la enfoca; en las demás, no', () => {
    const filas = [fila(), fila({ clave: 'b' })];
    expect(alEnterEnImporte(filas, 'b', 'n')).toMatchObject({ foco: 'n', filas: [{ clave: 'a' }, { clave: 'b' }, { clave: 'n' }] });
    expect(alEnterEnImporte(filas, 'a', 'n')).toEqual({ filas, foco: null });
  });
  it('quitar deja siempre una fila', () => {
    expect(quitarFila([fila(), fila({ clave: 'b' })], 'a').map((f) => f.clave)).toEqual(['b']);
    expect(quitarFila([fila()], 'a')).toHaveLength(1);
  });
});

describe('condiciones y unidades', () => {
  it('toma las de Ajustes; sin validez, 15', () => {
    expect(condicionesIniciales(config({ validezDias: 30, plazoEntrega: '5 días', formaPago: '50 %' }))).toEqual({ validezDias: 30, plazoEntrega: '5 días', formaPago: '50 %' });
    expect(condicionesIniciales(config({})).validezDias).toBe(15);
    expect(condicionesIniciales(undefined)).toEqual({ validezDias: 15, plazoEntrega: '', formaPago: '' });
  });
  it('ofrece 7, 15 y 30 y el valor propio de Ajustes', () => {
    expect(opcionesDeValidez(config({ validezDias: 10 }))).toEqual([7, 10, 15, 30]);
    expect(opcionesDeValidez(config({ validezDias: 15 }))).toEqual([7, 15, 30]);
  });
  it('las unidades de la empresa se suman sin repetir', () => {
    expect(opcionesDeUnidad(config({}, ['Millar', 'caja', ' ']))).toEqual(['unidad', 'millar', 'ciento', 'servicio', 'metro', 'pliego', 'caja']);
  });
});

describe('validarHoja', () => {
  it('pide cliente y al menos una fila', () => {
    const r = validarHoja(hoja({ cliente: null, filas: [filaVacia('a')] }));
    expect(r.ok).toBe(false);
    expect(r.errores).toMatchObject({ cliente: expect.any(String), filas: expect.any(String) });
  });
  it('señala las filas a medias e ignora las vacías', () => {
    const r = validarHoja(hoja({ filas: [fila(), fila({ clave: 'b', precio: '' }), filaVacia('c')] }));
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errores.porFila)).toEqual(['b']);
    expect(validarHoja(hoja({ filas: [fila(), filaVacia('c')] })).ok).toBe(true);
  });
  it('más de 100 filas completas no pasa', () => {
    const muchas = Array.from({ length: 101 }, (_, i) => fila({ clave: `f${i}` }));
    expect(validarHoja(hoja({ filas: muchas })).errores.filas).toMatch(/100/);
  });
});

describe('argumentosDeHojaDirecta', () => {
  it('título: la referencia o la primera descripción, hasta 200', () => {
    expect(tituloDeHoja(hoja({ referencia: ' Campaña ' }))).toBe('Campaña');
    expect(tituloDeHoja(hoja())).toBe('Volantes');
    expect(tituloDeHoja(hoja({ filas: [fila({ descripcion: 'x'.repeat(300) })] }))).toHaveLength(200);
  });
  it('sin IGV la hoja no lo manda ni lo cobra, aunque «precios con IGV» haya quedado marcado', () => {
    const a = argumentosDeHojaDirecta(hoja({ conIgv: false, incluyeIgv: true }));
    expect(a.conIgv).toBe(false);
    expect(a.preciosIncluyenIgv).toBe(false);
    expect(igvDeLaHojaDirecta({ conIgv: false })).toBe(0);
    expect(igvDeLaHojaDirecta({ conIgv: true })).toBe(18);
  });
  it('cada línea lleva importeCentimos y el unitario; las vacías no viajan; condiciones y flag', () => {
    const a = argumentosDeHojaDirecta(hoja({ conIgv: true, incluyeIgv: true, plazoEntrega: ' 3 días ', filas: [fila(), fila({ clave: 'b', cantidad: '7', precio: '', importe: '100', manda: 'importe', unidad: 'millar' }), filaVacia('c')] }));
    expect(a).toEqual({
      titulo: 'Volantes',
      clienteId: 'c1',
      lineas: [
        { tipo: 'manual', descripcion: 'Volantes', unidad: 'unidad', cantidadMilesimas: 1_000_000, importeCentimos: 42_000, precioUnitarioMilesimas: 420 },
        { tipo: 'manual', descripcion: 'Volantes', unidad: 'millar', cantidadMilesimas: 7_000, importeCentimos: 10_000, precioUnitarioMilesimas: 14_286 },
      ],
      conIgv: true,
      preciosIncluyenIgv: true,
      condiciones: { validezDias: 15, plazoEntrega: '3 días', formaPago: '' },
    });
  });
});
