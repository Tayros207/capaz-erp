import { describe, expect, it } from 'vitest';
import { ESTADOS_DE_COMPRA, type CompraCompletaDto } from '@capaz/shared';
import {
  FORMULARIO_VACIO, argumentosDeCreacion, argumentosDeEdicion, conProducto, formatearDia, formularioDesde, importeDeLinea, lineaVacia, mensajeDeRechazo,
  FILTROS, etiquetaDeFiltro, pasoActual, recibidoCentimos, porRecibir, sePuedeCancelar, siguientePaso, textoPorRecibir, totalesDe, validarCompra, validarLinea, type LineaDeFormulario,
} from './logica.ts';

const linea = (extra: Partial<LineaDeFormulario> = {}): LineaDeFormulario => ({ ...lineaVacia('l1'), descripcion: 'Papel bond A4', costoUnitarioMilesimas: 23_600, ...extra });
const compra = (extra: Partial<CompraCompletaDto> = {}): CompraCompletaDto => ({
  id: 'c1', codigo: 'Borrador', numero: null, serie: null, anio: null, proveedorId: 'p1', proveedorNombre: 'Papelera Andina', estado: 'borrador', fecha: '2026-03-01',
  entregaEl: null, atrasada: false, igvPorcentaje: 18, subtotalCentimos: 4_000, igvCentimos: 720, totalCentimos: 4_720, notas: null, sucursalId: null,
  canceladoEn: null, motivoCancelacion: null, lineas: 1, lineasPorRecibir: 1, creadoPor: 'u1', creadoEn: '2026-03-01T10:00:00.000Z', actualizadoEn: '2026-03-01T10:00:00.000Z',
  detalle: [{ id: 'd1', posicion: 0, productoId: null, descripcion: 'Papel bond A4', unidad: 'millar', cantidadMilesimas: 2_000, costoUnitarioMilesimas: 23_600, afectoIgv: true, importeCentimos: 4_720, recibidoMilesimas: 0, pendienteMilesimas: 2_000 }],
  recepciones: [], ...extra,
});

describe('estados en pantalla', () => {
  it('el botón principal: enviar el borrador o registrar lo que llega', () => {
    expect(siguientePaso('borrador')).toEqual({ tipo: 'enviar', texto: 'Enviar al proveedor' });
    expect(siguientePaso('enviada')).toEqual({ tipo: 'recibir', texto: 'Registrar recepción' });
    expect(siguientePaso('recibida_parcial')?.tipo).toBe('recibir');
    expect(siguientePaso('recibida')).toBeNull();
    expect(siguientePaso('cancelada')).toBeNull();
  });
  it('la barra de estado, lo que falta recibir y la cancelación (como el servidor)', () => {
    expect(ESTADOS_DE_COMPRA.map(pasoActual)).toEqual([0, 1, 2, 3, -1]);
    expect(ESTADOS_DE_COMPRA.filter(porRecibir)).toEqual(['enviada', 'recibida_parcial']);
    expect(ESTADOS_DE_COMPRA.filter((e) => sePuedeCancelar(e, 0))).toEqual(['borrador', 'enviada']);
    expect(ESTADOS_DE_COMPRA.filter((e) => sePuedeCancelar(e, 1))).toEqual([]);
  });
  it('filtros de la lista y lo que falta recibir', () => {
    expect(FILTROS.map(etiquetaDeFiltro)).toEqual(['Abiertas', 'Por recibir', 'Borrador', 'Enviada', 'Recibida en parte', 'Recibida', 'Cancelada', 'Todas']);
    expect(textoPorRecibir({ estado: 'enviada', lineasPorRecibir: 1 })).toBe('1 línea');
    expect(textoPorRecibir({ estado: 'recibida_parcial', lineasPorRecibir: 2 })).toBe('2 líneas');
    expect(textoPorRecibir({ estado: 'borrador', lineasPorRecibir: 3 })).toBe('—');
    expect(textoPorRecibir({ estado: 'recibida', lineasPorRecibir: 0 })).toBe('—');
  });
  it('lo recibido es la suma de las recepciones', () => {
    const r = (numero: number, importeCentimos: number) => ({ id: `r${numero}`, numero, fecha: '2026-03-02', nota: null, importeCentimos, lineas: [], creadoPor: 'u1', creadoEn: '2026-03-02T10:00:00.000Z' });
    expect(recibidoCentimos({ recepciones: [] })).toBe(0);
    expect(recibidoCentimos({ recepciones: [r(1, 9_440), r(2, 20_060)] })).toBe(29_500);
  });
  it('días sin zona horaria', () => {
    expect(formatearDia('2026-03-10')).toBe('10/03/2026');
    expect(formatearDia(null)).toBe('—');
  });
});

describe('líneas', () => {
  it('validación: descripción, cantidad y costo', () => {
    expect(validarLinea(linea())).toEqual({});
    expect(validarLinea(linea({ descripcion: ' ', cantidadMilesimas: 0, costoUnitarioMilesimas: null }))).toEqual({
      descripcion: 'Elige un producto o escribe qué se compra.', cantidad: 'La cantidad debe ser mayor que cero.', costo: 'Indica el costo (ya con IGV).',
    });
    expect(validarLinea(linea({ costoUnitarioMilesimas: 0 }))).toEqual({});
  });
  it('elegir un producto toma nombre, unidad y afectación pero no el costo', () => {
    const l = conProducto(linea({ costoUnitarioMilesimas: 5_000 }), { id: 'p9', nombre: 'Tinta', unidad: 'frasco', afectoIgv: false });
    expect(l).toMatchObject({ producto: { id: 'p9', nombre: 'Tinta' }, descripcion: 'Tinta', unidad: 'frasco', afectoIgv: false, costoUnitarioMilesimas: 5_000 });
    expect(conProducto(l, null).producto).toBeNull();
  });
  it('importe y totales con la cuenta del servidor; lo incompleto no suma', () => {
    expect(importeDeLinea(linea({ cantidadMilesimas: 2_000 }))).toBe(4_720);
    expect(importeDeLinea(linea({ costoUnitarioMilesimas: null }))).toBeNull();
    const t = totalesDe([linea({ cantidadMilesimas: 2_000 }), linea({ clave: 'l2', costoUnitarioMilesimas: null }), linea({ clave: 'l3', costoUnitarioMilesimas: 100, afectoIgv: true })], 18);
    // 47.20 → 40.00 + 7.20 · 0.10 → 0.08 + 0.02.
    expect(t).toMatchObject({ subtotalCentimos: 4_008, igvCentimos: 722, totalCentimos: 4_730 });
    expect(totalesDe([linea({ cantidadMilesimas: 9_000_000_000_000_000, costoUnitarioMilesimas: 9_000_000_000_000_000 })], 18)).toBeNull();
  });
});

describe('formulario de la orden', () => {
  it('validación del formulario', () => {
    expect(validarCompra(FORMULARIO_VACIO, '2026-03-01')).toEqual({ proveedor: 'Elige el proveedor.' });
    const f = { ...FORMULARIO_VACIO, proveedor: { id: 'p1', nombre: 'P' }, entregaEl: '2026-02-28', lineas: [linea({ descripcion: '' })] };
    expect(validarCompra(f, '2026-03-01')).toEqual({ entregaEl: 'La entrega no puede ser anterior a la fecha de la orden.', lineas: 'Hay líneas incompletas: ábrelas y complétalas.' });
  });
  it('argumentos de creación: solo lo que tiene valor', () => {
    const f = { proveedor: { id: 'p1', nombre: 'P' }, entregaEl: '', notas: '  ', lineas: [linea({ producto: { id: 'x', nombre: 'Papel' }, unidad: ' ' })] };
    expect(argumentosDeCreacion(f)).toEqual({
      proveedorId: 'p1',
      lineas: [{ productoId: 'x', descripcion: 'Papel bond A4', unidad: 'unidad', cantidadMilesimas: 1000, costoUnitarioMilesimas: 23_600, afectoIgv: true }],
    });
  });
  it('edición: nulo si nada cambió; si cambia una línea van todas', () => {
    const c = compra();
    expect(argumentosDeEdicion(c, formularioDesde(c))).toBeNull();
    const f = formularioDesde(c);
    expect(argumentosDeEdicion(c, { ...f, notas: ' Urgente ', entregaEl: '2026-03-05' })).toEqual({ id: 'c1', notas: 'Urgente', entregaEl: '2026-03-05' });
    const conLinea = argumentosDeEdicion(c, { ...f, lineas: [{ ...f.lineas[0]!, cantidadMilesimas: 3_000 }] });
    expect(conLinea?.lineas).toEqual([{ descripcion: 'Papel bond A4', unidad: 'millar', cantidadMilesimas: 3_000, costoUnitarioMilesimas: 23_600, afectoIgv: true }]);
    expect(argumentosDeEdicion(c, { ...f, proveedor: { id: 'p2', nombre: 'Otro' } })).toEqual({ id: 'c1', proveedorId: 'p2' });
    expect(argumentosDeEdicion(compra({ notas: 'x' }), { ...formularioDesde(compra({ notas: 'x' })), notas: '' })).toEqual({ id: 'c1', notas: null });
  });
  it('los códigos de acceso se explican con palabras de la pantalla; lo demás, el servidor', () => {
    expect(mensajeDeRechazo('modulo_solo_lectura', 'x')).toBe('Tu acceso a Compras es de solo lectura.');
    expect(mensajeDeRechazo('conflicto', 'La orden ya tiene recepciones: no se puede cancelar.')).toBe('La orden ya tiene recepciones: no se puede cancelar.');
  });
});
