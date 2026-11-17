import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe, eventosDe } from './pruebas-de-cotizador.js';
import { armarCasoDeReferencia, sembrarTaller, type Taller } from './pruebas-de-cuadro.js';

// El caso de referencia de Cotizín (`armar-caso-de-referencia.ts`), rehecho SOLO con herramientas de Capaz por HTTP: 2.500 volantes A5,
// 4/4, couché 150 g. Debe dar costo 225.15, precio 346.38 y 172 pliegos madre, con el semáforo de `caso-de-referencia.ts`.
// Después: emitir, aceptar y guardar las referencias en la lista de precios.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let A: string;
let cliente: string;
let taller: Taller;
let id: string;
let producto: string;

const filas = (sql: string, args: unknown[] = []) => comoEmpresa(appPool, A, async (c) => (await c.query(sql, args)).rows as any[]);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  dueno = await abrirSesion(app, 'Dueña');
  A = await crearEmpresa(dueno, 'Imprenta del caso');
  await activarModulo(A, 'cotizador');
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  taller = await sembrarTaller(dueno);
  id = await armarCasoDeReferencia(dueno, taller, cliente);
  producto = (await datosDe(dueno, 'productos_crear', { nombre: 'Volantes A5 4/4 couché 150 g', unidad: 'und' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('el caso de referencia armado solo con herramientas', () => {
  it('da costo 225.15, precio 346.38 y 172 pliegos madre; el semáforo es verde con 35 % sobre la venta', async () => {
    const r = await datosDe(dueno, 'cuadro_calcular', { id });
    expect(r.cantidad).toBe('2500');
    expect(r.comercial.precioCentimos).toBe(34_638);
    expect(r.interno.costoCentimos).toBe(22_515);
    expect(r.pliegos).toMatchObject({ poses: '4', pliegosMadre: '172', pliegosPorMadre: '4' });
    expect(r.interno).toMatchObject({ precioSugeridoCentimos: 34_638, utilidadCentimos: 12_123, margenPct: '35.00', semaforo: 'verde' });
    expect(r.interno.porFactorCentimos).toEqual({ material: 7_740, planchas: 4_000, impresion: 2_400, diseno: 4_000, acabado: 4_375, indirectos: 0 });
  });

  it('con 35 % sobre el costo el margen real baja y sale en ámbar; con 35 % sobre la venta vuelve a verde', async () => {
    await datosDe(dueno, 'cuadro_fijar_utilidad', { id, base: 'costo' });
    const costo = await datosDe(dueno, 'cuadro_calcular', { id });
    expect(costo.interno).toMatchObject({ semaforo: 'ambar', costoCentimos: 22_515 });
    await datosDe(dueno, 'cuadro_fijar_utilidad', { id, base: 'venta' });
    expect((await datosDe(dueno, 'cuadro_calcular', { id })).interno.semaforo).toBe('verde');
  });

  it('la vista de cuadro_ver trae el papel calculado por el motor, las planchas en 8 y las filas en el orden del cuadro', async () => {
    const { cuadro } = await datosDe(dueno, 'cuadro_ver', { id });
    expect(cuadro.lineas.map((l: any) => [l.numero, l.factor])).toEqual([[1, 'material'], [2, 'planchas'], [3, 'impresion'], [4, 'diseno'], [5, 'acabado'], [6, 'acabado']]);
    expect(cuadro.lineas[0]).toMatchObject({ cantidad: '172', automatica: 'papel', interno: { costoUnitario: '0.4500', subtotalCentimos: 7_740 } });
    expect(cuadro.imposicion.calculada).toMatchObject({ poses: '4', pliegosMadre: '172' });
    expect(cuadro.comercial).toMatchObject({ precioCentimos: 34_638, impuesto: { nombre: 'IGV', pct: '18.00', montoCentimos: 6_235 }, totalConImpuestoCentimos: 40_873 });
  });
});

describe('emitir, aceptar y guardar las referencias', () => {
  it('emitir da una línea en céntimos coherente: subtotal sin IGV = precio del cuadro, IGV 18 % y total', async () => {
    const e = (await confirmando(dueno, 'cotizacion_emitir', { id })).respuesta.cuerpo.datos;
    expect(e).toMatchObject({ estado: 'emitida', modo: 'cuadro', codigo: expect.stringMatching(/^COT-\d{4}-0001$/), subtotalCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873, costoCentimos: 22_515, margenPct: '35.000', conOpciones: false, cantidadDeLineas: 1 });
    expect(e.lineas).toEqual([
      expect.objectContaining({ posicion: 0, tipo: 'manual', descripcion: 'Volantes A5', unidad: 'unidad', cantidadMilesimas: 2_500_000, precioUnitarioMilesimas: 139, importeCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873 }),
    ]);
    expect(e.cuadro).toMatchObject({ estado: 'emitida', comercial: { precioCentimos: 34_638 }, interno: { costos: { costoCentimos: 22_515, semaforo: 'verde' } } });
    const [fila] = await filas('select modo, resultado, entrada from cotizador.versiones');
    expect(fila.modo).toBe('cuadro');
    expect(fila.resultado.configuracion).toMatchObject({ moneda: 'PEN', locale: 'es-PE', impuestoPct: '18' });
    expect(fila.resultado.calculo).toMatchObject({ costoTotal: '225.15', precio: '346.38', semaforo: 'verde' });
    expect(fila.resultado.imposicion.pliegosMadre).toBe('172');
  });

  it('una emitida no se edita: las herramientas del cuadro responden «conflicto»', async () => {
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_trabajo', { id, producto: 'Otro' }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('cuadro_linea_quitar', { id, linea: { numero: 1 } }))).toBe('conflicto');
  });

  it('aceptar emite cotizacion.aceptada con la línea del cuadro con IGV', async () => {
    await datosDe(dueno, 'cotizacion_aceptar', { id });
    const aceptada = (await eventosDe(appPool, A)).find((x) => x.tipo === 'cotizacion.aceptada');
    expect(aceptada?.carga).toMatchObject({ id, subtotalCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873 });
    expect((aceptada?.carga as any).lineas).toEqual([
      { productoId: null, descripcion: '2.500 unidades · Volantes A5', unidad: 'lote', cantidadMilesimas: 1000, precioUnitarioMilesimas: 408_730, afectoIgv: true },
    ]);
  });

  it('generar_referencias da los tres precios en céntimos; guardar_referencias crea la lista enlazada al producto y precio_consultar la usa', async () => {
    const { margenes, referencias, validacion } = await datosDe(dueno, 'cuadro_generar_referencias', { id });
    expect(validacion.bloqueos).toEqual([]);
    expect(referencias.p100Centimos).toBeLessThan(referencias.p1000Centimos);
    expect(referencias.p1000Centimos).toBeLessThan(referencias.p5000Centimos);
    expect(margenes.map((m: any) => m.cantidad)).toEqual(['100', '1000', '5000']);
    const { respuesta, resumen } = await confirmando(dueno, 'cuadro_guardar_referencias', { id, productoId: producto, nombre: 'Volantes A5 desde el cuadro' });
    expect(resumen).toContain('Se creará la lista «Volantes A5 desde el cuadro»');
    const lista = respuesta.cuerpo.datos;
    expect(lista).toMatchObject({ productoId: producto, nombre: 'Volantes A5 desde el cuadro', p100Centimos: referencias.p100Centimos, p1000Centimos: referencias.p1000Centimos, p5000Centimos: referencias.p5000Centimos });
    const precio = await datosDe(dueno, 'precio_consultar', { listaId: lista.id, cantidadMilesimas: 1_000_000 });
    expect(precio.importeCentimos).toBe(referencias.p1000Centimos);
    // Una lista por producto: guardar otra vez actualiza la misma (crítica: pide confirmación y dice «Cambiarás…»).
    const otra = await confirmando(dueno, 'cuadro_guardar_referencias', { id, productoId: producto, nombre: 'Volantes A5 desde el cuadro', precioMinimoCentimos: 20_000 });
    expect(otra.resumen).toContain('Cambiarás');
    expect(otra.respuesta.cuerpo.datos).toMatchObject({ id: lista.id, precioMinimoCentimos: 20_000 });
  });
});
