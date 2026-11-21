import { describe, expect, it } from 'vitest';
import type { LineaDePedidoDto, PedidoCompletoDto } from '@capaz/shared';
import { argumentosDeCorreccion, formularioDeCorreccion, lineasCambiaron, vistaPrevia } from './correccion.ts';
import { filasDelDocumento, formatoDelDocumento } from './documentos.ts';
import { textoDeLineaCorregida } from './huella-de-correccion.ts';
import { aLineaDeEntrada, argumentosDeEdicion, estaEnBlanco, formularioDesde, lineaDesdeDto, lineaVacia } from './logica.ts';

const dto = (extra: Partial<LineaDePedidoDto> = {}): LineaDePedidoDto => ({ id: 'l1', posicion: 0, productoId: null, descripcion: 'Polo', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 15_000, afectoIgv: true, importeCentimos: 1500, material: null, medida: null, colores: null, acabado: null, ...extra });
const pedido = (extra: Partial<LineaDePedidoDto> = {}): PedidoCompletoDto =>
  ({ id: 'p1', codigo: 'PED-1', numero: 1, serie: 'PRI', anio: 2026, estado: 'confirmado', clienteId: 'c1', clienteNombre: 'Imprenta Sol', entregaEl: null, responsableId: null, notas: null, version: 1, igvPorcentaje: 18, fecha: '2026-03-01', subtotalCentimos: 1271, igvCentimos: 229, totalCentimos: 1500, detalle: [dto(extra)], historial: [], versiones: [] }) as unknown as PedidoCompletoDto;

describe('ficha en el formulario (W3, W4)', () => {
  it('lineaDesdeDto trae la ficha y deja vacío lo que no hay', () => {
    expect(lineaDesdeDto(dto({ material: 'couché 150g' }))).toMatchObject({ material: 'couché 150g', medida: '' });
  });
  it('aLineaDeEntrada recorta y omite lo vacío', () => {
    const l = { ...lineaVacia('x'), descripcion: 'Polo', cantidadMilesimas: 1000, precioUnitarioMilesimas: 15000, material: ' couché 150g ', medida: '' };
    expect(aLineaDeEntrada(l)).toEqual({ descripcion: 'Polo', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 15000, afectoIgv: true, material: 'couché 150g' });
  });
  it('una fila con solo ficha no está en blanco', () => {
    expect(estaEnBlanco({ ...lineaVacia('x'), material: 'couché' })).toBe(false);
    expect(estaEnBlanco(lineaVacia('x'))).toBe(true);
  });
});

describe('editar pedido (W5)', () => {
  it('sin tocar nada no hay cambio espurio', () => {
    const p = pedido({ material: 'a' });
    expect(argumentosDeEdicion(p, formularioDesde(p))).toBeNull();
    expect(argumentosDeEdicion(pedido(), formularioDesde(pedido()))).toBeNull();
  });
  it('un material cambiado viaja', () => {
    const p = pedido({ material: 'a' });
    const f = formularioDesde(p);
    const args = argumentosDeEdicion(p, { ...f, lineas: f.lineas.map((l) => ({ ...l, material: 'b' })) });
    expect(args?.lineas?.[0]?.material).toBe('b');
  });
});

describe('corregir pedido (W6, W7)', () => {
  it('un cambio solo de ficha cuenta y viaja con las cuatro claves', () => {
    const p = pedido({ material: 'couché 150g' });
    const f = formularioDeCorreccion(p);
    expect(lineasCambiaron(p, f)).toBe(false);
    const g = { ...f, motivo: 'lineas' as const, lineas: f.lineas.map((l) => ({ ...l, material: 'couché 200g' })) };
    expect(lineasCambiaron(p, g)).toBe(true);
    expect(argumentosDeCorreccion(p, g).lineas?.[0]).toMatchObject({ id: 'l1', material: 'couché 200g', medida: null, colores: null, acabado: null });
  });
  it('la vista previa muestra la ficha antes y después', () => {
    const p = pedido({ material: 'couché 150g' });
    const f = formularioDeCorreccion(p);
    const fila = vistaPrevia(p, { ...f, lineas: f.lineas.map((l) => ({ ...l, material: 'couché 200g' })) }, null).filas[0];
    expect(fila?.antes).toContain('couché 150g');
    expect(fila?.despues).toContain('couché 200g');
  });
});

describe('documentos (W8, W9)', () => {
  it('con precios la ficha va pegada a la descripción', () => {
    const f = filasDelDocumento([dto({ material: 'couché 150g', medida: 'A5' })], true)[0]!;
    expect(f.descripcion).toBe('Polo — couché 150g · A5');
    expect('ficha' in f).toBe(false);
  });
  it('sin precios va aparte, con etiquetas', () => {
    expect(filasDelDocumento([dto({ material: 'couché 150g', medida: 'A5' })], false)[0]).toMatchObject({ descripcion: 'Polo', ficha: 'Material: couché 150g · Medida: A5' });
    expect('ficha' in filasDelDocumento([dto()], false)[0]!).toBe(false);
  });
  it('la ficha de la orden de trabajo cuenta como renglón', () => {
    const una = { detalle: [dto({ material: 'couché' })], notas: null };
    const dos = { detalle: [dto({ material: 'couché' }), dto({ id: 'l2', material: 'bond' })], notas: null };
    expect(formatoDelDocumento('orden-de-trabajo', una)).toBe('a6');
    expect(formatoDelDocumento('orden-de-trabajo', dos)).toBe('a5');
    expect(formatoDelDocumento('nota', una)).toBe('a6');
  });
});

describe('huella (W10)', () => {
  const v = { cantidadMilesimas: 1000, unidad: 'unidad', precioUnitarioMilesimas: 15_000, afectoIgv: true, importeCentimos: 1500 };
  it('solo cambia la ficha', () => {
    expect(textoDeLineaCorregida({ descripcion: 'Polo', antes: { ...v, material: 'couché 150g' }, despues: { ...v, material: 'couché 200g' } } as never)).toBe('«Polo»: ficha: couché 150g → couché 200g');
  });
  it('sin ficha y con otro precio, el formato de siempre', () => {
    const t = textoDeLineaCorregida({ descripcion: 'Polo', antes: v, despues: { ...v, precioUnitarioMilesimas: 16_000, importeCentimos: 1600 } } as never);
    expect(t).not.toContain('ficha');
    expect(t).toContain('→');
  });
});
