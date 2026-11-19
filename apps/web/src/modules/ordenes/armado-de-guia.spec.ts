import { describe, expect, it } from 'vitest';
import type { PedidoDto, PreparacionDeGuiaDto } from '@capaz/shared';
import { argumentosDeEmision, hayErrores, leerRutaDeGuiaNueva, mensajeDeRechazoDeGuia, rutaDeGuiaNueva, seleccionInicial, seleccionParaGuia, validarGuia, vistaPreviaDeGuia, type Armado } from './armado-de-guia.ts';
import { trasladoInicial } from './guias.ts';

const A = '0198a000-0000-7000-8000-000000000001';
const B = '0198a000-0000-7000-8000-000000000002';
const C = '0198a000-0000-7000-8000-000000000003';

const linea = (id: string, pendiente: number, extra = {}) => ({ pedidoLineaId: id, posicion: 0, productoId: null, descripcion: `Línea ${id}`, unidad: 'unidad', pedidaMilesimas: 5000, enviadaMilesimas: 5000 - pendiente, pendienteMilesimas: pendiente, ...extra });
const prep = (extra: Partial<PreparacionDeGuiaDto> = {}): PreparacionDeGuiaDto => ({
  cliente: { id: 'c1', nombre: 'Imprenta Sol', documento: 'RUC 20123456789', direccion: 'Jr. Cusco 2' },
  pedidos: [{ id: 'p1', codigo: 'PED-1', estado: 'listo', fecha: '2026-11-01', entregaEl: null, lineas: [linea('l1', 5000), linea('l2', 0)] }],
  candidatos: [],
  ...extra,
});
const traslado = () => ({ ...trasladoInicial('2026-11-20', { direccionFiscal: 'Av. Lima 1' }, { documento: null, direccion: 'Jr. Cusco 2' }) });
const armadoDe = (p: PreparacionDeGuiaDto, extra: Partial<Armado> = {}): Armado => ({ selecciones: seleccionInicial(p, {}), libres: [], traslado: traslado(), ...extra });

describe('seleccionInicial', () => {
  it('marca lo pendiente con su cantidad y deja sin marcar lo ya enviado', () => {
    expect(seleccionInicial(prep(), {})).toEqual({ l1: { incluir: true, cantidadMilesimas: 5000 }, l2: { incluir: false, cantidadMilesimas: null } });
  });
  it('conserva lo elegido al agregar otro pedido', () => {
    const previa = { l1: { incluir: false, cantidadMilesimas: 2000 } };
    const con = prep({ pedidos: [...prep().pedidos, { id: 'p2', codigo: 'PED-2', estado: 'listo', fecha: '2026-11-02', entregaEl: null, lineas: [linea('l3', 1000)] }] });
    expect(seleccionInicial(con, previa)).toMatchObject({ l1: { incluir: false, cantidadMilesimas: 2000 }, l3: { incluir: true, cantidadMilesimas: 1000 } });
  });
});

describe('validarGuia', () => {
  it('una guía completa no tiene errores', () => {
    const p = prep();
    expect(hayErrores(validarGuia(p, armadoDe(p)))).toBe(false);
  });
  it('sin ninguna línea pide agregar una', () => {
    const p = prep();
    const e = validarGuia(p, armadoDe(p, { selecciones: { l1: { incluir: false, cantidadMilesimas: 5000 } } }));
    expect(e.general).toBe('Agrega al menos una línea.');
  });
  it('la cantidad no puede ser cero ni pasar lo pendiente', () => {
    const p = prep();
    expect(validarGuia(p, armadoDe(p, { selecciones: { l1: { incluir: true, cantidadMilesimas: null } } })).lineas.l1).toMatch(/mayor que cero/);
    expect(validarGuia(p, armadoDe(p, { selecciones: { l1: { incluir: true, cantidadMilesimas: 6000 } } })).lineas.l1).toBe('Quedan 5 unidad por enviar.');
  });
  it('la línea libre pide descripción y cantidad', () => {
    const p = prep();
    const e = validarGuia(p, armadoDe(p, { libres: [{ clave: 'x', descripcion: ' ', unidad: 'unidad', cantidadMilesimas: 0 }] }));
    expect(e.libres.x).toEqual({ descripcion: 'Escribe la descripción.', cantidad: 'La cantidad debe ser mayor que cero.' });
  });
  it('el traslado pide partida, llegada y fecha', () => {
    const p = prep();
    const e = validarGuia(p, armadoDe(p, { traslado: { ...traslado(), puntoPartida: '', puntoLlegada: ' ', fechaTraslado: '' } }));
    expect(Object.keys(e.traslado).sort()).toEqual(['fechaTraslado', 'puntoLlegada', 'puntoPartida']);
  });
  it('«Otro» pide su detalle y el transporte público pide transportista', () => {
    const p = prep();
    const e = validarGuia(p, armadoDe(p, { traslado: { ...traslado(), motivo: 'otro', modalidad: 'publico' } }));
    expect(Object.keys(e.traslado).sort()).toEqual(['motivoDetalle', 'transportista']);
  });
  it('más de 200 líneas no se admiten', () => {
    const p = prep();
    const libres = Array.from({ length: 200 }, (_, i) => ({ clave: `k${i}`, descripcion: 'x', unidad: 'unidad', cantidadMilesimas: 1000 }));
    expect(validarGuia(p, armadoDe(p, { libres })).general).toMatch(/hasta 200/);
  });
});

describe('argumentosDeEmision', () => {
  it('manda las líneas de pedido primero, las libres después, y recorta y anula lo vacío', () => {
    const p = prep();
    const a = argumentosDeEmision(p, armadoDe(p, {
      libres: [{ clave: 'x', descripcion: '  Flete ', unidad: ' ', cantidadMilesimas: 1000 }],
      traslado: { ...traslado(), puntoLlegada: '  Jr. Cusco 2 ', bultos: '  ', transportista: 'Olva', motivoDetalle: 'x' },
    }));
    expect(a.clienteId).toBe('c1');
    expect(a.lineas).toEqual([{ tipo: 'pedido', pedidoLineaId: 'l1', cantidadMilesimas: 5000 }, { tipo: 'libre', descripcion: 'Flete', cantidadMilesimas: 1000 }]);
    expect(a).toMatchObject({ puntoLlegada: 'Jr. Cusco 2', bultos: null, destinatarioDocumento: null, transportista: null, motivoDetalle: null });
  });
  it('con transporte público manda el transportista, y con «Otro», el detalle', () => {
    const p = prep();
    const a = argumentosDeEmision(p, armadoDe(p, { traslado: { ...traslado(), modalidad: 'publico', transportista: ' Olva ', motivo: 'otro', motivoDetalle: ' Muestra ' } }));
    expect(a).toMatchObject({ modalidad: 'publico', transportista: 'Olva', motivo: 'otro', motivoDetalle: 'Muestra' });
  });
});

describe('vistaPreviaDeGuia', () => {
  it('sin código, con los pedidos y solo las líneas completas', () => {
    const p = prep();
    const v = vistaPreviaDeGuia(p, armadoDe(p, { libres: [{ clave: 'x', descripcion: 'Flete', unidad: '', cantidadMilesimas: 1000 }, { clave: 'y', descripcion: '', unidad: 'unidad', cantidadMilesimas: 1000 }] }), '2026-11-19');
    expect(v.codigo).toBeNull();
    expect(v.pedidos).toEqual(['PED-1']);
    expect(v.lineas.map((l) => [l.pedido, l.descripcion, l.unidad])).toEqual([['PED-1', 'Línea l1', 'unidad'], [null, 'Flete', 'unidad']]);
  });
});

describe('seleccionParaGuia', () => {
  const ped = (id: string, extra: Partial<PedidoDto> = {}) => ({ id, codigo: `PED-${id}`, clienteId: 'c1', estado: 'listo', ...extra }) as PedidoDto;
  const filas = [ped('1'), ped('2'), ped('3', { clienteId: 'c2' }), ped('4', { estado: 'en_proceso' }), ped('5', { estado: 'entregado' })];
  it('sin nada marcado avisa', () => {
    expect(seleccionParaGuia(filas, new Set())).toEqual({ ok: false, mensaje: 'Marca al menos un pedido.' });
  });
  it('más de 20 no pasa', () => {
    const muchos = Array.from({ length: 21 }, (_, i) => ped(String(i)));
    const r = seleccionParaGuia(muchos, new Set(muchos.map((p) => p.id)));
    expect(r).toMatchObject({ ok: false });
  });
  it('dos clientes no pasan', () => {
    expect(seleccionParaGuia(filas, new Set(['1', '3']))).toEqual({ ok: false, mensaje: 'Una guía lleva pedidos de un solo cliente.' });
  });
  it('un estado que no admite guía no pasa', () => {
    expect(seleccionParaGuia(filas, new Set(['1', '4']))).toMatchObject({ ok: false, mensaje: expect.stringContaining('PED-4') });
  });
  it('listo y entregado del mismo cliente pasan', () => {
    expect(seleccionParaGuia(filas, new Set(['1', '5']))).toEqual({ ok: true, pedidoIds: ['1', '5'] });
  });
});

describe('ruta de la guía nueva', () => {
  it('ida y vuelta con pedidos', () => {
    const ruta = rutaDeGuiaNueva({ pedidoIds: [A, B] });
    expect(ruta).toBe(`/m/ordenes/guias/nueva?pedidos=${A},${B}`);
    expect(leerRutaDeGuiaNueva(new URL(ruta, 'http://x').searchParams)).toEqual({ pedidoIds: [A, B], clienteId: null });
  });
  it('ida y vuelta con cliente', () => {
    const ruta = rutaDeGuiaNueva({ clienteId: C });
    expect(leerRutaDeGuiaNueva(new URL(ruta, 'http://x').searchParams)).toEqual({ pedidoIds: [], clienteId: C });
  });
  it('descarta lo que no es uuid, los repetidos y pasa de 20', () => {
    const p = new URLSearchParams({ pedidos: `${A},basura,${A},${B}`, cliente: 'no' });
    expect(leerRutaDeGuiaNueva(p)).toEqual({ pedidoIds: [A, B], clienteId: null });
    const muchos = Array.from({ length: 25 }, (_, i) => `0198a000-0000-7000-8000-${String(i).padStart(12, '0')}`);
    expect(leerRutaDeGuiaNueva(new URLSearchParams({ pedidos: muchos.join(',') })).pedidoIds).toHaveLength(20);
  });
});

describe('mensajeDeRechazoDeGuia', () => {
  it('en «no encontrado» manda el servidor; en lo demás, el catálogo de pedidos', () => {
    expect(mensajeDeRechazoDeGuia('no_encontrado', 'No existe esa guía.')).toBe('No existe esa guía.');
    expect(mensajeDeRechazoDeGuia('sin_permiso', 'x')).toMatch(/permiso/);
    expect(mensajeDeRechazoDeGuia('conflicto', 'Ya se envió.')).toBe('Ya se envió.');
  });
});
