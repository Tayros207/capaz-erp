import { describe, expect, it } from 'vitest';
import { argumentosDeRecepcion, filasDeRecepcion, recibirTodo, sinErrores, validarRecepcion, vistaPrevia, type FilaDeRecepcion } from './logica-recepcion.ts';
import type { CompraCompletaDto } from '@capaz/shared';

const orden: CompraCompletaDto = {
  id: 'c1', codigo: 'OC-PRI-2026-0001', numero: 1, serie: 'PRI', anio: 2026, proveedorId: 'p1', proveedorNombre: 'Papelera Andina', estado: 'recibida_parcial', fecha: '2026-03-01',
  entregaEl: null, atrasada: false, igvPorcentaje: 18, subtotalCentimos: 25_085, igvCentimos: 4_515, totalCentimos: 29_600, notas: null, sucursalId: null,
  canceladoEn: null, motivoCancelacion: null, lineas: 3, lineasPorRecibir: 2, creadoPor: 'u1', creadoEn: '2026-03-01T10:00:00.000Z', actualizadoEn: '2026-03-01T10:00:00.000Z', recepciones: [],
  detalle: [
    { id: 'd1', posicion: 0, productoId: 'p1', descripcion: 'Papel bond A4', unidad: 'millar', cantidadMilesimas: 10_000, costoUnitarioMilesimas: 23_600, afectoIgv: true, importeCentimos: 23_600, recibidoMilesimas: 4_000, pendienteMilesimas: 6_000 },
    { id: 'd2', posicion: 1, productoId: null, descripcion: 'Flete', unidad: 'unidad', cantidadMilesimas: 1_000, costoUnitarioMilesimas: 59_000, afectoIgv: true, importeCentimos: 5_900, recibidoMilesimas: 0, pendienteMilesimas: 1_000 },
    { id: 'd3', posicion: 2, productoId: null, descripcion: 'Sobres', unidad: 'ciento', cantidadMilesimas: 1_000, costoUnitarioMilesimas: 1_000, afectoIgv: true, importeCentimos: 100, recibidoMilesimas: 1_000, pendienteMilesimas: 0 },
  ],
};
const limites = { fechaDeLaOrden: '2026-03-01', hoy: '2026-03-20' };
const con = (filas: FilaDeRecepcion[], ...cantidades: Array<number | null>) => filas.map((f, i) => ({ ...f, cantidadMilesimas: cantidades[i] ?? null }));

describe('pantalla de recepción', () => {
  it('una fila por línea con algo pendiente, vacía al empezar', () => {
    const filas = filasDeRecepcion(orden);
    expect(filas.map((f) => [f.ordenLineaId, f.pendienteMilesimas, f.cantidadMilesimas])).toEqual([['d1', 6_000, null], ['d2', 1_000, null]]);
  });

  it('«llegó todo» llena cada fila con su pendiente y la orden quedará recibida', () => {
    const todo = recibirTodo(filasDeRecepcion(orden));
    expect(todo.map((f) => f.cantidadMilesimas)).toEqual([6_000, 1_000]);
    expect(vistaPrevia(todo)).toEqual({ lineas: 2, importeCentimos: 14_160 + 5_900, completa: true });
  });

  it('una parte: solo cuentan las filas con cantidad y la orden sigue en parte', () => {
    const filas = con(filasDeRecepcion(orden), 2_500, 0);
    expect(vistaPrevia(filas)).toEqual({ lineas: 1, importeCentimos: 5_900, completa: false });
    expect(argumentosDeRecepcion('c1', filas, '2026-03-10', '  Caja abierta ')).toEqual({ id: 'c1', fecha: '2026-03-10', nota: 'Caja abierta', lineas: [{ ordenLineaId: 'd1', cantidadMilesimas: 2_500 }] });
    expect(argumentosDeRecepcion('c1', filas, '2026-03-10', '')).not.toHaveProperty('nota');
  });

  it('validación: nada que recibir, más de lo pendiente y fecha fuera de rango', () => {
    const vacias = filasDeRecepcion(orden);
    expect(validarRecepcion(vacias, '2026-03-10', limites)).toEqual({ filas: {}, general: 'Anota lo que llegó de al menos una línea.' });
    const demas = con(vacias, 6_500, 1_000);
    expect(validarRecepcion(demas, '2026-03-10', limites)).toEqual({ filas: { d1: 'Solo falta recibir 6 millar.' } });
    expect(vistaPrevia(demas).completa).toBe(false);
    const bien = con(vacias, 1_000);
    expect(sinErrores(validarRecepcion(bien, '2026-03-10', limites))).toBe(true);
    expect(validarRecepcion(bien, '', limites).fecha).toBe('Indica el día en que llegó.');
    expect(validarRecepcion(bien, '2026-02-28', limites).fecha).toBe('No puede ser anterior a la fecha de la orden.');
    expect(validarRecepcion(bien, '2026-03-21', limites).fecha).toBe('No puede ser una fecha futura.');
  });

  it('sin filas pendientes no hay nada completo que mostrar', () => {
    expect(vistaPrevia([])).toEqual({ lineas: 0, importeCentimos: 0, completa: false });
  });
});
