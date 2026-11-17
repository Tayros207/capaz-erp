import { describe, expect, it } from 'vitest';
import { centimosSchema, MENSAJE_DE_MOTIVO_REQUERIDO, type CotizacionCompletaDto } from '@capaz/shared';
import {
  FORMULARIO_VACIO, accionesVisibles, argumentosDeAceptar, argumentosDeAnulacion, argumentosDeCreacion, argumentosDeEdicion, argumentosDeEmision, argumentosDeRechazo,
  formularioDesdeCotizacion, lineaVacia, pideMotivoDeMargen, sePuede, textoDeAceptadas, textoDeEvento, textoDeMargen, validarAceptacion, validarFormulario, validarLinea,
  type FormularioDeCotizacion, type LineaDeFormulario,
} from './logica-cotizaciones.ts';

const todo = { editar: true, emitir: true, costos: false };
const lista: LineaDeFormulario = { ...lineaVacia('a'), lista: { id: 'l1', nombre: 'Volantes' }, cantidadMilesimas: 2_500_000 };
const manual: LineaDeFormulario = { ...lineaVacia('b', 'manual'), descripcion: ' Diseño ', cantidadMilesimas: 1000, precioUnitarioMilesimas: 50_000 };
const form = (extra: Partial<FormularioDeCotizacion> = {}): FormularioDeCotizacion => ({ ...FORMULARIO_VACIO, titulo: ' Feria ', lineas: [lista, manual], ...extra });

describe('acciones por estado', () => {
  it('borrador: editar, emitir, anular y duplicar', () => {
    expect(accionesVisibles('borrador', todo)).toEqual(['editar', 'emitir', 'anular', 'duplicar']);
  });
  it('emitida y enviada se pueden aceptar y rechazar; solo la emitida se marca enviada', () => {
    expect(sePuede('enviar', 'emitida')).toBe(true);
    expect(sePuede('enviar', 'enviada')).toBe(false);
    expect(sePuede('aceptar', 'enviada')).toBe(true);
    expect(sePuede('rechazar', 'emitida')).toBe(true);
  });
  it('rechazada admite nueva versión; aceptada y anulada no', () => {
    expect(sePuede('nueva_version', 'rechazada')).toBe(true);
    expect(sePuede('nueva_version', 'aceptada')).toBe(false);
    expect(sePuede('nueva_version', 'anulada')).toBe(false);
  });
  it('una anulada solo se duplica', () => {
    expect(accionesVisibles('anulada', todo)).toEqual(['duplicar']);
  });
  it('sin permiso de emitir no se ofrece emitir ni anular; sin editar, solo lo de emitir', () => {
    expect(accionesVisibles('borrador', { editar: true, emitir: false, costos: false })).toEqual(['editar', 'duplicar']);
    expect(accionesVisibles('emitida', { editar: false, emitir: true, costos: false })).toEqual(['anular']);
    expect(accionesVisibles('emitida', { editar: false, emitir: false, costos: false })).toEqual([]);
  });
});

describe('argumentos de las acciones', () => {
  it('aceptar sin opciones no lleva posiciones; con opciones las lleva ordenadas y exige una', () => {
    expect(argumentosDeAceptar('x', false, new Set())).toEqual({ id: 'x' });
    expect(argumentosDeAceptar('x', true, new Set([2, 0]))).toEqual({ id: 'x', posiciones: [0, 2] });
    expect(validarAceptacion(true, new Set())).toBe('Elige al menos una opción.');
    expect(validarAceptacion(false, new Set())).toBeUndefined();
    expect(validarAceptacion(true, new Set([1]))).toBeUndefined();
  });
  it('rechazar: el motivo es opcional; anular lo lleva limpio', () => {
    expect(argumentosDeRechazo('x', '  ')).toEqual({ id: 'x' });
    expect(argumentosDeRechazo('x', ' Muy caro ')).toEqual({ id: 'x', motivo: 'Muy caro' });
    expect(argumentosDeAnulacion('x', ' Duplicada ')).toEqual({ id: 'x', motivo: 'Duplicada' });
  });
  it('emitir lleva el motivo solo si lo hay; el aviso de margen del servidor se reconoce', () => {
    expect(argumentosDeEmision('x')).toEqual({ id: 'x' });
    expect(argumentosDeEmision('x', ' Cliente grande ')).toEqual({ id: 'x', motivoMargenBajo: 'Cliente grande' });
    expect(pideMotivoDeMargen('conflicto', MENSAJE_DE_MOTIVO_REQUERIDO)).toBe(true);
    expect(pideMotivoDeMargen('conflicto', 'margen')).toBe(false);
    expect(pideMotivoDeMargen('argumentos_invalidos', 'Falta el cliente')).toBe(false);
  });
  it('textos de líneas aceptadas', () => {
    expect(textoDeAceptadas(null, 3)).toBe('');
    expect(textoDeAceptadas([0, 1, 2], 3)).toBe('Todas las líneas');
    expect(textoDeAceptadas([1], 3)).toBe('Línea 2');
    expect(textoDeAceptadas([0, 2], 3)).toBe('Líneas 1 y 3');
  });
  it('texto del historial', () => {
    expect(textoDeEvento({ tipo: 'rechazada', version: 2, motivo: 'Muy caro' })).toBe('Rechazada (versión 2): Muy caro');
    expect(textoDeEvento({ tipo: 'enviada', version: 1, motivo: null })).toBe('Marcada como enviada (versión 1)');
  });
  it('el margen solo se muestra si el servidor lo devolvió', () => {
    expect(textoDeMargen(null)).toBeNull();
    expect(textoDeMargen('32.5')).toBe('32.5 %');
  });
});

describe('formulario', () => {
  it('valida título, líneas y validez', () => {
    expect(validarFormulario(FORMULARIO_VACIO)).toEqual({ titulo: 'Escribe un título.', lineas: 'Agrega al menos una línea.' });
    expect(validarFormulario(form())).toEqual({});
    expect(validarFormulario(form({ lineas: [lineaVacia('z')] })).lineas).toMatch(/incompletas/);
    expect(validarFormulario(form({ validezDias: '400' })).validezDias).toBeDefined();
  });
  it('valida cada línea según su tipo', () => {
    expect(Object.keys(validarLinea(lineaVacia('a'))).sort()).toEqual(['cantidad', 'lista']);
    expect(Object.keys(validarLinea(lineaVacia('b', 'manual'))).sort()).toEqual(['cantidad', 'descripcion', 'precio']);
  });
  it('crear: la línea de lista no lleva precio, la manual sí; lo vacío no se envía', () => {
    expect(argumentosDeCreacion(form())).toEqual({
      titulo: 'Feria',
      lineas: [
        { tipo: 'lista', listaId: 'l1', cantidadMilesimas: 2_500_000 },
        { tipo: 'manual', descripcion: 'Diseño', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 50_000 },
      ],
      conOpciones: false,
    });
  });
  it('crear con cliente, opciones, condiciones y costo', () => {
    const a = argumentosDeCreacion(form({ cliente: { id: 'c1', nombre: 'Ana' }, conOpciones: true, validezDias: '15', formaPago: ' 50 % adelanto ', costo: centimosSchema.parse(10_000) }));
    expect(a).toMatchObject({ clienteId: 'c1', conOpciones: true, condiciones: { validezDias: 15, formaPago: '50 % adelanto' }, costoCentimos: 10_000 });
    expect(a.condiciones).not.toHaveProperty('plazoEntrega');
  });
  it('editar envía todo; el costo solo con permiso', () => {
    const e = argumentosDeEdicion('x', form(), false);
    expect(e).toMatchObject({ id: 'x', titulo: 'Feria', clienteId: null, notas: null });
    expect(e).not.toHaveProperty('costoCentimos');
    expect(argumentosDeEdicion('x', form({ costo: centimosSchema.parse(500) }), true)).toMatchObject({ costoCentimos: 500 });
  });
  it('el formulario de edición sale de la cotización', () => {
    const c = {
      id: 'q', titulo: 'T', clienteId: 'c1', clienteNombre: 'Ana', conOpciones: false, notas: null, costoCentimos: null,
      condiciones: { validezDias: 7, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' },
      lineas: [
        { posicion: 1, tipo: 'manual', productoId: null, listaId: null, descripcion: 'B', unidad: 'u', cantidadMilesimas: 1000, precioUnitarioMilesimas: 5000, importeCentimos: 500, igvCentimos: 90, totalCentimos: 590 },
        { posicion: 0, tipo: 'lista', productoId: null, listaId: 'l1', descripcion: 'A', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 100, importeCentimos: 1, igvCentimos: 0, totalCentimos: 1 },
      ],
    } as unknown as CotizacionCompletaDto;
    const f = formularioDesdeCotizacion(c, (n) => centimosSchema.parse(n));
    expect(f.lineas.map((l) => [l.tipo, l.descripcion])).toEqual([['lista', 'A'], ['manual', 'B']]);
    expect(f.lineas[0]?.lista).toEqual({ id: 'l1', nombre: 'A' });
    expect(f).toMatchObject({ cliente: { id: 'c1', nombre: 'Ana' }, validezDias: '7', costo: null });
  });
});
