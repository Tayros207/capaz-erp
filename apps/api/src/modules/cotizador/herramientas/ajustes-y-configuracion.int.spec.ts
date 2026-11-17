import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, datosDe, LISTA_C7 } from './pruebas-de-cotizador.js';

// Módulo `cotizador` (s1) por HTTP real, parte 2: ajustes por cliente y configuración (R17).

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion;
let ajeno: Sesion;
let A: string;
let lista: any;
let botica: any;

const consultar = (s: Sesion, args: Record<string, unknown> = {}) => s.herramienta('precio_consultar', { listaId: lista.id, cantidadMilesimas: 1_000_000, ...args });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lector', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Ajustes A');
  const B = await crearEmpresa(ajeno, 'Ajustes B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
  lista = await datosDe(dueno, 'lista_precio_crear', LISTA_C7);
  botica = await datosDe(dueno, 'clientes_crear', { nombre: 'Botica Central' });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('ajuste por cliente', () => {
  it('sin ajustes la lista sale vacía; fijar -5 cambia el precio de lista y aparece en ajusteClientePct', async () => {
    expect(await datosDe(dueno, 'ajustes_cliente_listar')).toEqual({ items: [], siguiente: null });
    const r = await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: botica.id, porcentaje: '-5', nota: '  Mayorista ' });
    expect(r).toMatchObject({ clienteId: botica.id, ajuste: { clienteNombre: 'Botica Central', porcentaje: '-5.000', nota: 'Mayorista' } });
    expect((await datosDe(dueno, 'ajustes_cliente_listar')).items).toEqual([expect.objectContaining({ clienteId: botica.id, porcentaje: '-5.000' })]);
    expect((await consultar(dueno, { clienteId: botica.id })).cuerpo.datos).toMatchObject({ precioListaCentimos: 55_100, importeCentimos: 55_100, igvCentimos: 9_918, totalCentimos: 65_018, ajusteClientePct: '-5' });
    expect((await consultar(dueno)).cuerpo.datos).toMatchObject({ precioListaCentimos: 58_000, ajusteClientePct: null });
  });

  it('cambiar el ajuste lo reemplaza (+10) y conserva la nota si no llega; el ajuste de la cotización va aparte', async () => {
    const r = await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: botica.id, porcentaje: '10' });
    expect(r.ajuste).toMatchObject({ porcentaje: '10.000', nota: 'Mayorista' });
    expect((await datosDe(dueno, 'ajustes_cliente_listar')).items).toHaveLength(1);
    expect((await consultar(dueno, { clienteId: botica.id })).cuerpo.datos).toMatchObject({ precioListaCentimos: 63_800, ajusteClientePct: '10' });
    expect((await consultar(dueno, { clienteId: botica.id, ajuste: { tipo: 'precio', importeCentimos: 60_000 } })).cuerpo.datos).toMatchObject({ precioListaCentimos: 63_800, importeCentimos: 60_000 });
  });

  it('valida el rango, el cliente y los campos; null o 0 quitan el ajuste', async () => {
    const fijar = (args: Record<string, unknown>) => dueno.herramienta('ajuste_cliente_fijar', args);
    expect(codigoDe(await fijar({ clienteId: botica.id, porcentaje: '-100' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await fijar({ clienteId: botica.id, porcentaje: '501' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await fijar({ clienteId: botica.id, porcentaje: 'diez' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await fijar({ clienteId: botica.id, porcentaje: '5', extra: 1 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await fijar({ clienteId: randomUUID(), porcentaje: '5' }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('ajuste_cliente_fijar', { clienteId: botica.id, porcentaje: '5' }))).toBe('no_encontrado');
    expect(await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: botica.id, porcentaje: '0' })).toEqual({ clienteId: botica.id, ajuste: null });
    expect((await datosDe(dueno, 'ajustes_cliente_listar')).items).toEqual([]);
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: botica.id, porcentaje: '3' });
    expect(await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: botica.id, porcentaje: null })).toEqual({ clienteId: botica.id, ajuste: null });
  });

  it('el lector ve y consulta; el de otra empresa no ve nada', async () => {
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: botica.id, porcentaje: '-5' });
    expect((await datosDe(lector, 'ajustes_cliente_listar')).items).toHaveLength(1);
    expect((await datosDe(ajeno, 'ajustes_cliente_listar')).items).toEqual([]);
    expect((await consultar(lector, { clienteId: botica.id })).cuerpo.datos.ajusteClientePct).toBe('-5');
    expect(codigoDe(await consultar(ajeno))).toBe('no_encontrado');
  });
});

describe('configuración', () => {
  it('cambia el redondeo comercial y se nota en precio_consultar (2.000 unidades: 79326 → 79500 con redondeo 5)', async () => {
    expect((await consultar(dueno, { cantidadMilesimas: 2_000_000 })).cuerpo.datos.importeCentimos).toBe(79_326);
    const c = await datosDe(dueno, 'cotizador_configurar', { redondeoComercial: '5' });
    expect(c).toMatchObject({ redondeoComercial: '5', utilidadPct: '35.000', igvPorcentaje: 18, actualizadoEn: expect.any(String) });
    expect((await consultar(dueno, { cantidadMilesimas: 2_000_000 })).cuerpo.datos).toMatchObject({ importeCentimos: 79_500, redondeoComercial: '5' });
    await datosDe(dueno, 'cotizador_configurar', { redondeoComercial: 'ninguno' });
  });

  it('con IGV 0 % el total es el importe; solo se admite 18 o 0', async () => {
    await datosDe(dueno, 'cotizador_configurar', { igvPorcentaje: 0 });
    expect((await consultar(dueno, { cantidadMilesimas: 2_500_000 })).cuerpo.datos).toMatchObject({ importeCentimos: 87_739, igvCentimos: 0, totalCentimos: 87_739, igvPorcentaje: 0 });
    expect(codigoDe(await dueno.herramienta('cotizador_configurar', { igvPorcentaje: 10 }))).toBe('argumentos_invalidos');
    await datosDe(dueno, 'cotizador_configurar', { igvPorcentaje: 18 });
  });

  it('guarda condiciones y el mensaje de WhatsApp (vacío lo quita); la lectura los devuelve', async () => {
    const condiciones = { validezDias: 15, plazoEntrega: '3 días hábiles', formaPago: '50 % adelanto', tolerancia: '', noIncluye: 'Diseño' };
    const c = await datosDe(dueno, 'cotizador_configurar', { condiciones, mensajeWhatsapp: 'Hola, te envío tu cotización' });
    expect(c).toMatchObject({ condiciones, mensajeWhatsapp: 'Hola, te envío tu cotización' });
    expect(await datosDe(lector, 'cotizador_configuracion_ver')).toMatchObject({ condiciones, mensajeWhatsapp: 'Hola, te envío tu cotización' });
    expect((await datosDe(dueno, 'cotizador_configurar', { mensajeWhatsapp: '  ' })).mensajeWhatsapp).toBeNull();
  });

  it('valida: umbral mínimo menor que el verde, utilidad menor que 100 sobre la venta, al menos un dato, campos de más', async () => {
    const configurar = (args: Record<string, unknown>) => dueno.herramienta('cotizador_configurar', args);
    expect(codigoDe(await configurar({ umbralMinimoPct: '30' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await configurar({ umbralVerdePct: '10' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await configurar({ utilidadPct: '100' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await configurar({}))).toBe('argumentos_invalidos');
    expect(codigoDe(await configurar({ utilidadPct: '35', extra: 1 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await configurar({ redondeoComercial: '7' }))).toBe('argumentos_invalidos');
    expect(await datosDe(dueno, 'cotizador_configurar', { utilidadBase: 'costo', utilidadPct: '150' })).toMatchObject({ utilidadBase: 'costo', utilidadPct: '150.000' });
    expect(codigoDe(await configurar({ utilidadBase: 'venta' }))).toBe('argumentos_invalidos');
    expect((await datosDe(dueno, 'cotizador_configuracion_ver')).utilidadPct).toBe('150.000');
  });

  it('cotizador:configurar y los ajustes de otra empresa: la configuración es de cada empresa', async () => {
    expect((await datosDe(ajeno, 'cotizador_configuracion_ver')).utilidadPct).toBe('35.000');
    expect(await comoEmpresa(appPool, A, async (c) => (await c.query('select count(*)::int as n from cotizador.configuracion')).rows[0].n)).toBe(1);
  });
});

describe('unidades de la empresa', () => {
  const configurar = (args: Record<string, unknown>) => dueno.herramienta('cotizador_configurar', args);
  it('por defecto trae las ocho de la migración, también sin fila de configuración', async () => {
    expect((await datosDe(ajeno, 'cotizador_configuracion_ver')).unidades).toEqual(['unidad', 'ciento', 'millar', 'pliego', 'm2', 'hora', 'juego', 'talonario']);
  });
  it('guarda unas válidas, normalizadas y en su orden, y las devuelve al ver', async () => {
    const r = await datosDe(dueno, 'cotizador_configurar', { unidades: ['  caja ', 'unidad', 'Rollo  grande'] });
    expect(r.unidades).toEqual(['caja', 'unidad', 'Rollo grande']);
    expect((await datosDe(dueno, 'cotizador_configuracion_ver')).unidades).toEqual(['caja', 'unidad', 'Rollo grande']);
    expect((await datosDe(ajeno, 'cotizador_configuracion_ver')).unidades).toHaveLength(8);
  });
  it('rechaza repetidas (tras normalizar), vacías, largas, ninguna y más de 40', async () => {
    for (const mal of [['a', ' A '], ['Millar', 'millár'], ['a', '  '], [''], ['x'.repeat(21)], [], Array.from({ length: 41 }, (_, i) => `u${i}`)]) {
      expect(codigoDe(await configurar({ unidades: mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
    expect((await datosDe(dueno, 'cotizador_configurar', { unidades: Array.from({ length: 40 }, (_, i) => `u${i}`) })).unidades).toHaveLength(40);
  });
  it('quien solo puede ver no las cambia', async () => {
    expect(codigoDe(await lector.herramienta('cotizador_configurar', { unidades: ['x'] }))).toBe('modulo_solo_lectura');
  });
});
