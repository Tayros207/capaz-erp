import { describe, expect, it } from 'vitest';
import {
  fichaNormalizada,
  fichaSinVacios,
  mismaFicha,
  normalizarCampoDeFicha,
  textoDeFicha,
  textoDeFichaConEtiquetas,
  tieneFicha,
} from './ficha-de-maquina.js';
import { correccionDePedidoSchema, lineaDeEntradaSchema, lineaDePedidoSchema } from './ordenes.js';
import { lineaACorregirSchema } from './ordenes-correccion.js';
import { lineaDeOrdenEntradaSchema } from './produccion.js';

const base = { descripcion: 'Tarjetas', cantidadMilesimas: 1000, precioUnitarioMilesimas: 100 };
const id = '0192f0c4-7b1e-7000-8000-000000000010';

describe('ficha de máquina: contratos', () => {
  it('C1 recorta el texto', () => {
    const r = lineaDeEntradaSchema.safeParse({ ...base, material: '  couché 300 g ' });
    expect(r.success && r.data.material).toBe('couché 300 g');
  });
  it('C2 vacío y null pasan', () => {
    const a = lineaDeEntradaSchema.safeParse({ ...base, material: '' });
    const b = lineaDeEntradaSchema.safeParse({ ...base, material: null });
    expect(a.success && a.data.material).toBe('');
    expect(b.success && b.data.material).toBe(null);
  });
  it('C3 el máximo es 120', () => {
    const r = lineaDeEntradaSchema.safeParse({ ...base, material: 'x'.repeat(121) });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('hasta 120 caracteres.');
    expect(lineaDeEntradaSchema.safeParse({ ...base, material: 'x'.repeat(120) }).success).toBe(true);
  });
  it('C4 una clave «ficha» no existe', () => {
    expect(lineaDeEntradaSchema.safeParse({ ...base, ficha: 'x' }).success).toBe(false);
  });
  it('C5 la salida exige los cuatro campos', () => {
    const l = { id: 'a', posicion: 1, productoId: null, descripcion: 'x', unidad: 'u', cantidadMilesimas: 1, precioUnitarioMilesimas: 1, afectoIgv: true, importeCentimos: 1 };
    expect(lineaDePedidoSchema.safeParse(l).success).toBe(false);
    expect(lineaDePedidoSchema.safeParse({ ...l, material: null, medida: null, colores: null, acabado: null }).success).toBe(true);
  });
  it('C6 al corregir, sin ficha no aparece la clave', () => {
    const r = lineaACorregirSchema.safeParse({ descripcion: 'x', unidad: 'u', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1, afectoIgv: true });
    expect(r.success).toBe(true);
    expect(r.success && 'material' in r.data).toBe(false);
  });
  it('C7 la huella vieja (sin ficha) y la nueva valen', () => {
    const v = { descripcion: 'x', unidad: 'u', cantidadMilesimas: 1, precioUnitarioMilesimas: 1, afectoIgv: true, importeCentimos: 1 };
    const h = (antes: object) => ({
      versionAnterior: 1, versionNueva: 2, motivoCodigo: 'lineas', motivoTexto: null, estadoAlCorregir: 'confirmado',
      totalAnteriorCentimos: 1, totalNuevoCentimos: 1, deltaCentimos: 0, subtotalAnteriorCentimos: 1, subtotalNuevoCentimos: 1, igvAnteriorCentimos: 0, igvNuevoCentimos: 0,
      lineas: [{ cambio: 'cambiada', lineaId: id, descripcion: 'x', antes, despues: v }], datos: [], abonadoCentimos: null, aFavorCentimos: null,
    });
    expect(correccionDePedidoSchema.safeParse(h(v)).success).toBe(true);
    expect(correccionDePedidoSchema.safeParse(h({ ...v, material: 'a', medida: null })).success).toBe(true);
  });
  it('C8 Producción reutiliza el mismo límite', () => {
    const l = { descripcion: 'x', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1 };
    expect(lineaDeOrdenEntradaSchema.safeParse({ ...l, material: 'A5' }).success).toBe(true);
    expect(lineaDeOrdenEntradaSchema.safeParse({ ...l, material: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('ficha de máquina: funciones', () => {
  it('C9', () => {
    expect(normalizarCampoDeFicha('  ')).toBeNull();
    expect(fichaNormalizada({ material: ' a ' })).toEqual({ material: 'a', medida: null, colores: null, acabado: null });
    expect(fichaSinVacios({ material: ' a ', medida: '' })).toEqual({ material: 'a' });
    expect(mismaFicha({ material: 'a' }, { material: ' a ', medida: '' })).toBe(true);
    expect(mismaFicha({ material: 'a' }, { material: 'b' })).toBe(false);
    expect(tieneFicha({ medida: ' ' })).toBe(false);
    const f = { material: 'couché 150g', colores: 'full color' };
    expect(textoDeFicha(f)).toBe('couché 150g · full color');
    expect(textoDeFichaConEtiquetas(f)).toBe('Material: couché 150g · Colores: full color');
  });
});
