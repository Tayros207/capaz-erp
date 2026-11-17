import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe } from './pruebas-de-cotizador.js';
import { armarCasoDeReferencia, sembrarTaller, type Taller } from './pruebas-de-cuadro.js';

// PARIDAD con Cotizín · cuadro por partes: escalado a 100 / 1.000 / 5.000, tres referencias, cuadro directo, semáforo, ítems y orígenes.
// Vectores de `cotizacion/testing/vectores-de-escalado.ts`, `generar-referencias.test.ts`, `cuadro-directo.test.ts` y `semaforo.test.ts`.

let app: AppDePruebas;
let dueno: Sesion; // con taller sembrado (caso de referencia)
let libre: Sesion; // sin taller: cuadros en blanco con las seis filas y sin ítems
let cliente: string;
let taller: Taller;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, libre] = await Promise.all([abrirSesion(app, 'Dueña paridad cuadro'), abrirSesion(app, 'Libre paridad cuadro')]);
  const A = await crearEmpresa(dueno, 'Paridad cuadro A');
  const B = await crearEmpresa(libre, 'Paridad cuadro B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  taller = await sembrarTaller(dueno);
});
afterAll(async () => {
  await app.cerrar();
});

const calcular = (s: Sesion, id: string) => datosDe(s, 'cuadro_calcular', { id });
const col = (r: any, c: string) => r.directo.columnas[c];
const costo = (r: any, c: string) => col(r, c).interno.costoCentimos;
const precio = (r: any, c: string) => col(r, c).comercial.precioCentimos;
const celda = (r: any, fila: string, c: string) => r.directo.interno.filas.find((f: any) => f.clave === fila).celdas[c];

/** El caso de referencia a 1.000 con las cantidades de fila del vector de Cotizín (l3 0.348, l5 y l6 0.435); el papel y las planchas los pone el motor. */
async function casoDelVectorA1000(): Promise<string> {
  const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Vector 1000', '1000');
  await datosDe(dueno, 'cuadro_linea_editar', { id, linea: { numero: 3 }, campo: 'cantidad', valor: '0.348' });
  await datosDe(dueno, 'cuadro_linea_editar', { id, linea: { numero: 5 }, campo: 'cantidad', valor: '0.435' });
  await datosDe(dueno, 'cuadro_linea_editar', { id, linea: { numero: 6 }, campo: 'cantidad', valor: '0.435' });
  return id;
}

describe('escalado del caso de referencia (vectores-de-escalado.ts)', () => {
  it('desde la base 2.500: costo y precio a 100 / 1.000 / 5.000 son 94.16 → 144.86, 143.22 → 220.34 y 361.29 → 555.83, con margen 35.00 y verde', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente);
    const r = await calcular(dueno, id);
    expect(r.directo.base).toBeNull();
    expect(['100', '1000', '5000'].map((c) => [costo(r, c), precio(r, c), col(r, c).interno.margenPct, col(r, c).interno.semaforo])).toEqual([
      [9_416, 14_486, '35.00', 'verde'], [14_322, 22_034, '35.00', 'verde'], [36_129, 55_583, '35.00', 'verde'],
    ]);
  });

  it('desde la base 1.000 con las cantidades del vector: costos por fila 7.65 / 40.00 / 2.31 / 40.00 / 4.20 a 100; 33.75 / … / 19.03 a 1.000; 149.85 / … / 84.88 a 5.000', async () => {
    const id = await casoDelVectorA1000();
    const r = await calcular(dueno, id);
    expect(r.directo.base).toBe('1000');
    expect(r.pliegos).toMatchObject({ pliegosNetos: '250', pliegosDeMaquina: '298', pliegosMadre: '75' });
    const porFactor = (c: string) => ['material', 'planchas', 'impresion', 'diseno', 'acabado'].map((f) => celda(r, f, c).valorCentimos);
    expect(porFactor('100')).toEqual([765, 4_000, 231, 4_000, 420]);
    expect(porFactor('1000')).toEqual([3_375, 4_000, 1_044, 4_000, 1_903]);
    expect(porFactor('5000')).toEqual([14_985, 4_000, 4_656, 4_000, 8_488]);
    expect(['100', '1000', '5000'].map((c) => [costo(r, c), precio(r, c)])).toEqual([[9_416, 14_486], [14_322, 22_034], [36_129, 55_583]]);
  });

  it('la columna base es la misma cuenta que el cuadro: a 1.000 el precio que rige es 220.34, con IGV 39.66 y total 260.00', async () => {
    const r = await calcular(dueno, await casoDelVectorA1000());
    expect(r.comercial).toMatchObject({ precioCentimos: 22_034, impuesto: { nombre: 'IGV', pct: '18.00', montoCentimos: 3_966 }, totalConImpuestoCentimos: 26_000 });
  });

  it('con recargo de 35 % sobre el costo los precios son 127.12 / 193.35 / 487.74 y el margen real baja a 25.93 (ámbar)', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Recargo');
    await datosDe(dueno, 'cuadro_fijar_utilidad', { id, pct: '35', base: 'costo' });
    const r = await calcular(dueno, id);
    expect(['100', '1000', '5000'].map((c) => precio(r, c))).toEqual([12_712, 19_335, 48_774]);
    expect(col(r, '1000').interno).toMatchObject({ margenPct: '25.93', semaforo: 'ambar', baseDeUtilidad: 'costo', equivalentePct: '25.93' });
  });
});

describe('las tres referencias (generar-referencias.test.ts)', () => {
  it('35 % sobre la venta: 144.86 / 220.34 / 555.83 con margen 35.00 verde y sin bloqueos ni avisos', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Refs venta');
    const g = await datosDe(dueno, 'cuadro_generar_referencias', { id });
    expect(g.referencias).toEqual({ p100Centimos: 14_486, p1000Centimos: 22_034, p5000Centimos: 55_583 });
    expect(g.validacion).toEqual({ bloqueos: [], avisos: [] });
    expect(g.margenes).toEqual([{ cantidad: '100', margenPct: '35.00', semaforo: 'verde' }, { cantidad: '1000', margenPct: '35.00', semaforo: 'verde' }, { cantidad: '5000', margenPct: '35.00', semaforo: 'verde' }]);
  });

  it('con recargo de 35 % sobre el costo: 127.12 / 193.35 / 487.74', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Refs costo');
    await datosDe(dueno, 'cuadro_fijar_utilidad', { id, pct: '35', base: 'costo' });
    expect((await datosDe(dueno, 'cuadro_generar_referencias', { id })).referencias).toEqual({ p100Centimos: 12_712, p1000Centimos: 19_335, p5000Centimos: 48_774 });
  });

  it('guardadas en una lista pasan exactas por las tres referencias; a 2.500 la curva da 373.14 y el cuadro exacto 346.38 (la curva solo interpola)', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Refs guardar');
    const producto = (await datosDe(dueno, 'productos_crear', { nombre: 'Volantes del vector', unidad: 'und' })).id;
    const { respuesta } = await confirmando(dueno, 'cuadro_guardar_referencias', { id, productoId: producto, nombre: 'Volantes del vector' });
    const lista = respuesta.cuerpo.datos;
    expect(lista).toMatchObject({ p100Centimos: 14_486, p1000Centimos: 22_034, p5000Centimos: 55_583, productoId: producto, modoIntermedio: 'curva' });
    for (const [q, t] of [[100, 14_486], [1000, 22_034], [5000, 55_583]] as const) {
      expect((await datosDe(dueno, 'precio_consultar', { listaId: lista.id, cantidadMilesimas: q * 1000 })).importeCentimos).toBe(t);
    }
    expect((await datosDe(dueno, 'precio_consultar', { listaId: lista.id, cantidadMilesimas: 2_500_000 })).importeCentimos).toBe(37_314);
    expect((await calcular(dueno, id)).comercial.precioCentimos).toBe(34_638);
  });

  it('un cuadro vacío genera tres precios en cero y la validación bloquea los tres; guardarlas se rechaza', async () => {
    const { cuadro } = await datosDe(libre, 'cuadro_iniciar', { plantilla: 'en_blanco', titulo: 'Vacío' });
    const id = cuadro.cotizacionId;
    await datosDe(libre, 'cuadro_fijar_trabajo', { id, producto: 'Nada', cantidad: '1000' });
    const r = await libre.herramienta('cuadro_generar_referencias', { id });
    if (r.cuerpo.ok) {
      expect(r.cuerpo.datos.referencias).toEqual({ p100Centimos: 0, p1000Centimos: 0, p5000Centimos: 0 });
      expect(r.cuerpo.datos.validacion.bloqueos).toHaveLength(3);
    } else expect(r.cuerpo.ok).toBe(false);
    const guardar = await confirmando(libre, 'cuadro_guardar_referencias', { id, nombre: 'Lista vacía' });
    expect(guardar.respuesta.cuerpo.ok).toBe(false);
  });

  it('con filas por pliego y sin papel ni imposición pide la imposición; una utilidad de 100 % sobre la venta no existe (utilidad_imposible)', async () => {
    const { cuadro } = await datosDe(libre, 'cuadro_iniciar', { plantilla: 'volantes', titulo: 'Sin imposición' });
    const id = cuadro.cotizacionId;
    await datosDe(libre, 'cuadro_fijar_trabajo', { id, producto: 'Volantes', cantidad: '2500', pieza: { anchoCm: '14.8', altoCm: '21' }, tintas: 4, caras: 2 });
    const r = await libre.herramienta('cuadro_generar_referencias', { id });
    expect(r.cuerpo.ok).toBe(false);
    expect(JSON.stringify(r.cuerpo)).toMatch(/imposici/i);
    const imposible = await libre.herramienta('cuadro_fijar_utilidad', { id, pct: '100' });
    expect(codigoDe(imposible)).toBe('argumentos_invalidos');
    expect(imposible.cuerpo.error.mensaje).toMatch(/menor que 100/);
    expect(codigoDe(await libre.herramienta('cuadro_fijar_utilidad', { id, pct: '100', columna: '5000' }))).toBe('argumentos_invalidos');
  });
});

/** Un cuadro en blanco en la empresa sin taller, con la base en 1.000 y utilidad 35 % sobre la venta. */
async function enBlanco(utilidad: Record<string, unknown> = { pct: '35', base: 'venta' }): Promise<string> {
  const { cuadro } = await datosDe(libre, 'cuadro_iniciar', { plantilla: 'en_blanco', titulo: 'En blanco' });
  await datosDe(libre, 'cuadro_fijar_trabajo', { id: cuadro.cotizacionId, producto: 'Impreso', cantidad: '1000' });
  await datosDe(libre, 'cuadro_fijar_utilidad', { id: cuadro.cotizacionId, ...utilidad });
  return cuadro.cotizacionId;
}
/** Anota a mano soles por columna: `[c100, c1000, c5000]`; `undefined` deja la celda sin escribir. */
const anotar = (id: string, fila: string, soles: (number | undefined)[]) =>
  datosDe(libre, 'cuadro_fijar_costo_directo', {
    id,
    celdas: (['100', '1000', '5000'] as const).flatMap((c, i) => (soles[i] === undefined ? [] : [{ fila, columna: c, importeCentimos: Math.round(soles[i]! * 100) }])),
  });
const sobreVenta = (costoCentimos: number, pct: number) => Math.round(costoCentimos / (1 - pct / 100));

describe('cuadro directo: tres columnas escritas a mano (cuadro-directo.test.ts)', () => {
  it('suma por columna y saca el precio sobre la venta: costos 75 / 350 / 1,490 → 115.38 / 538.46 / 2,292.31; lo no escrito vale cero y se ve «vacia»', async () => {
    const id = await enBlanco();
    await anotar(id, 'material', [25, 250, 1250]);
    await anotar(id, 'planchas', [40, 40, 40]);
    await datosDe(libre, 'cuadro_fijar_costo_directo', { id, fijas: [{ fila: 'planchas', fija: true }] });
    await anotar(id, 'impresion', [10, 60, 200]);
    const r = await calcular(libre, id);
    for (const [c, esperado] of [['100', 7_500], ['1000', 35_000], ['5000', 149_000]] as const) {
      expect(col(r, c).interno).toMatchObject({ costoCentimos: esperado, precioSugeridoCentimos: sobreVenta(esperado, 35) });
      expect(precio(r, c)).toBe(sobreVenta(esperado, 35));
      expect(col(r, c).completa).toBe(true);
    }
    expect(['100', '1000', '5000'].map((c) => precio(r, c))).toEqual([11_538, 53_846, 229_231]);
    expect(celda(r, 'diseno', '100')).toMatchObject({ valorCentimos: 0, origen: 'vacia', delDetalleCentimos: null });
    expect(celda(r, 'material', '1000')).toMatchObject({ valorCentimos: 25_000, origen: 'mano', delDetalleCentimos: null });
  });

  it('unitario = precio / cantidad, utilidad = precio − costo, margen real 35.00 y verde; IGV 18 % y total por columna', async () => {
    const id = await enBlanco();
    await anotar(id, 'material', [100, 100, 100]);
    const r = await calcular(libre, id);
    const c = col(r, '1000');
    expect(c.interno).toMatchObject({ costoCentimos: 10_000, utilidadCentimos: 5_385, margenPct: '35.00', semaforo: 'verde' });
    expect(Math.abs(c.comercial.unitarioMilesimas - 153.846)).toBeLessThanOrEqual(1);
    expect(c.comercial.impuesto).toEqual({ nombre: 'IGV', pct: '18.00', montoCentimos: 2_769 });
    expect(c.comercial.totalConImpuestoCentimos).toBe(15_385 + 2_769);
  });

  it('sin impuesto (IGV 0) no hay línea de impuesto y el total con impuesto es el precio', async () => {
    const id = await enBlanco();
    await anotar(id, 'material', [100, 100, 100]);
    await datosDe(libre, 'cotizador_configurar', { igvPorcentaje: 0 });
    const c = col(await calcular(libre, id), '1000');
    await datosDe(libre, 'cotizador_configurar', { igvPorcentaje: 18 });
    expect(c.comercial.impuesto).toBeNull();
    expect(c.comercial.totalConImpuestoCentimos).toBe(c.comercial.precioCentimos);
  });

  it('un cuadro vacío da todo en cero, completo y sin coherencia que evaluar', async () => {
    const r = await calcular(libre, await enBlanco());
    for (const c of ['100', '1000', '5000']) expect(col(r, c)).toMatchObject({ completa: true, interno: { costoCentimos: 0, semaforo: null } });
    expect(r.directo.coherencia).toBeNull();
  });

  it('el precio final a mano rige solo en la columna base; las demás siguen con su sugerido; con 2.500 (no es columna) no hay base', async () => {
    const id = await enBlanco();
    await anotar(id, 'material', [100, 100, 100]);
    await datosDe(libre, 'cuadro_fijar_precio_final', { id, precioCentimos: 9_000 });
    const r = await calcular(libre, id);
    expect(precio(r, '1000')).toBe(9_000);
    expect(precio(r, '100')).toBe(15_385);
    expect(col(r, '1000').interno).toMatchObject({ precioSugeridoCentimos: 15_385, semaforo: 'rojo' });
    expect(col(r, '1000').esBase).toBe(true);
    await datosDe(libre, 'cuadro_fijar_trabajo', { id, cantidad: '2500' });
    const sinBase = await calcular(libre, id);
    expect(sinBase.directo.base).toBeNull();
    for (const c of ['100', '1000', '5000']) expect(col(sinBase, c).esBase).toBe(false);
  });

  it('qué columnas se envían: con enviar [1000, 5000] la 100 no se envía', async () => {
    const id = await enBlanco();
    await datosDe(libre, 'cuadro_fijar_columnas_a_enviar', { id, columnas: ['1000', '5000'] });
    const r = await calcular(libre, id);
    expect(['100', '1000', '5000'].map((c) => col(r, c).seEnvia)).toEqual([false, true, true]);
  });

  it('utilidad por columna: general 30 % y 20 % en la 5.000 → 142.86 y 125.00, equivalentes 42.86 y 25.00 sobre el costo; sobre el costo 30 % → 130.00 (23.08 sobre la venta)', async () => {
    const id = await enBlanco({ pct: '30', base: 'venta' });
    await anotar(id, 'material', [100, 100, 100]);
    await datosDe(libre, 'cuadro_fijar_utilidad', { id, pct: '20', columna: '5000' });
    const r = await calcular(libre, id);
    expect([precio(r, '100'), precio(r, '5000')]).toEqual([14_286, 12_500]);
    expect(col(r, '100').interno).toMatchObject({ utilidadPct: '30', utilidadDeColumna: false, baseDeUtilidad: 'venta', equivalentePct: '42.86' });
    expect(col(r, '5000').interno).toMatchObject({ utilidadPct: '20', utilidadDeColumna: true, baseDeUtilidad: 'venta', equivalentePct: '25.00' });
    await datosDe(libre, 'cuadro_fijar_utilidad', { id, pct: null, columna: '5000' });
    await datosDe(libre, 'cuadro_fijar_utilidad', { id, pct: '30', base: 'costo' });
    const costoBase = await calcular(libre, id);
    expect(precio(costoBase, '1000')).toBe(13_000);
    expect(col(costoBase, '1000').interno.equivalentePct).toBe('23.08');
  });

  it('coherencia A y B: 100 / 500 / 2.000 sin hallazgos; 100 / 90 / 2.000 bloquea total_no_crece; 100 / 1.500 / 2.000 avisa unitario_no_baja; con una columna en cero no hay nada que evaluar', async () => {
    const con = async (a: number, b: number, c: number) => {
      const id = await enBlanco();
      await anotar(id, 'material', [a, b, c]);
      return (await calcular(libre, id)).directo.coherencia;
    };
    expect(await con(100, 500, 2000)).toEqual({ bloqueos: [], avisos: [] });
    expect((await con(100, 90, 2000)).bloqueos.map((h: any) => h.codigo)).toEqual(['total_no_crece']);
    const aviso = await con(100, 1500, 2000);
    expect(aviso.bloqueos).toEqual([]);
    expect(aviso.avisos.map((h: any) => h.codigo)).toContain('unitario_no_baja');
    expect(await con(100, 500, 0)).toBeNull();
  });
});

describe('ítems adicionales (cuadro-directo.test.ts)', () => {
  it('suman a su factor y se pintan tras la fila indicada: acabado 52.00 y otros 7.00 a 1.000, costo 59.00; a 100 el costo es 24.00', async () => {
    const id = await enBlanco();
    const item = async (nombre: string, factor: string, despuesDe: string | undefined) => (await datosDe(libre, 'cuadro_item_agregar', { id, nombre, factor, ...(despuesDe && { despuesDe }) })).linea.id as string;
    const [i1, i2, i3] = [await item('Plastificado', 'acabado', 'acabado'), await item('Encolado', 'acabado', 'acabado'), await item('Flete', 'indirectos', 'diseno')];
    await anotar(id, 'acabado', [10, 10, 10]);
    await anotar(id, i1, [5, 30, 100]);
    await anotar(id, i2, [2, 12, 50]);
    await anotar(id, i3, [7, 7, 7]);
    const r = await calcular(libre, id);
    expect(r.directo.interno.filas.map((f: any) => f.clave)).toEqual(['material', 'planchas', 'impresion', 'diseno', i3, 'acabado', i1, i2, 'indirectos']);
    expect(col(r, '1000').interno.porFactorCentimos).toMatchObject({ acabado: 5_200, indirectos: 700 });
    expect([costo(r, '1000'), costo(r, '100')]).toEqual([5_900, 2_400]);
  });
});

describe('semáforo (semaforo.test.ts: verde ≥ 30, ámbar 15 a 29.99, rojo < 15), con costo 1,000.00', () => {
  const semaforoCon = async (utilidad: Record<string, unknown>) => {
    const id = await enBlanco(utilidad);
    await anotar(id, 'material', [1000, 1000, 1000]);
    return col(await calcular(libre, id), '1000').interno;
  };

  it('verde desde el umbral inclusive: 30 % y 35 % sobre la venta; ámbar con 29.99 y con 15; rojo con 14.99, 0 y con precio bajo el costo', async () => {
    expect(await semaforoCon({ pct: '30', base: 'venta' })).toMatchObject({ margenPct: '30.00', semaforo: 'verde' });
    expect((await semaforoCon({ pct: '35', base: 'venta' })).semaforo).toBe('verde');
    expect((await semaforoCon({ pct: '29.99', base: 'venta' })).semaforo).toBe('ambar');
    expect(await semaforoCon({ pct: '15', base: 'venta' })).toMatchObject({ margenPct: '15.00', semaforo: 'ambar' });
    expect((await semaforoCon({ pct: '14.99', base: 'venta' })).semaforo).toBe('rojo');
    expect((await semaforoCon({ pct: '0', base: 'venta' })).semaforo).toBe('rojo');
  });

  it('utilidadBase costo: 35 % sobre el costo da margen real 25.93 (ámbar, el de semaforo.test.ts); 50 % da 33.33 (verde); 10 % da 9.09 (rojo)', async () => {
    expect(await semaforoCon({ pct: '35', base: 'costo' })).toMatchObject({ margenPct: '25.93', semaforo: 'ambar', precioSugeridoCentimos: 135_000 });
    expect(await semaforoCon({ pct: '50', base: 'costo' })).toMatchObject({ margenPct: '33.33', semaforo: 'verde' });
    expect(await semaforoCon({ pct: '10', base: 'costo' })).toMatchObject({ margenPct: '9.09', semaforo: 'rojo' });
  });

  it('un margen negativo es rojo: precio final 900.00 con costo 1,000.00 → −11.11', async () => {
    const id = await enBlanco();
    await anotar(id, 'material', [1000, 1000, 1000]);
    await datosDe(libre, 'cuadro_fijar_precio_final', { id, precioCentimos: 90_000 });
    expect(col(await calcular(libre, id), '1000').interno).toMatchObject({ margenPct: '-11.11', semaforo: 'rojo', utilidadCentimos: -10_000 });
  });

  it('usa los umbrales de la empresa (verde 20, mínimo 10): 25.93 verde, 12 ámbar, 9.99 rojo; después se restauran', async () => {
    await datosDe(libre, 'cotizador_configurar', { umbralVerdePct: '20', umbralMinimoPct: '10' });
    try {
      expect((await semaforoCon({ pct: '35', base: 'costo' })).semaforo).toBe('verde');
      expect((await semaforoCon({ pct: '12', base: 'venta' })).semaforo).toBe('ambar');
      expect((await semaforoCon({ pct: '9.99', base: 'venta' })).semaforo).toBe('rojo');
    } finally {
      await datosDe(libre, 'cotizador_configurar', { umbralMinimoPct: '15', umbralVerdePct: '30' });
    }
  });

  it('el margen se evalúa tal como se muestra (PLA-01): 29.998 se ve 30.00 y va en verde', async () => {
    // Costo 1,000.00 y precio final 1,428.57: margen real 29.99993 → 30.00.
    const id = await enBlanco();
    await anotar(id, 'material', [1000, 1000, 1000]);
    await datosDe(libre, 'cuadro_fijar_precio_final', { id, precioCentimos: 142_857 });
    expect(col(await calcular(libre, id), '1000').interno).toMatchObject({ margenPct: '30.00', semaforo: 'verde' });
  });
});

describe('orígenes de celda: detalle, mano, deducida, no_calculable (cuadro-directo.test.ts)', () => {
  it('lo escrito a mano manda sobre el detalle en esa celda y deja a la vista lo que daba el detalle; las otras columnas siguen con detalle', async () => {
    const id = await casoDelVectorA1000();
    const origenes = Object.fromEntries((await calcular(dueno, id)).directo.interno.filas.map((f: any) => [f.clave, f.celdas['1000'].origen]));
    expect(origenes).toMatchObject({ material: 'detalle', planchas: 'detalle', impresion: 'detalle', diseno: 'detalle', acabado: 'detalle', indirectos: 'vacia' });
    await datosDe(dueno, 'cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'acabado', columna: '1000', importeCentimos: 99_900 }] });
    const r = await calcular(dueno, id);
    expect(celda(r, 'acabado', '1000')).toMatchObject({ valorCentimos: 99_900, origen: 'mano', delDetalleCentimos: 1_903 });
    expect(celda(r, 'acabado', '100').origen).toBe('detalle');
    expect(costo(r, '1000')).toBe(14_322 - 1_903 + 99_900);
  });

  it('volantes sin imposición: el papel «aún no está calculado» (no_calculable) y la columna queda incompleta con su motivo; lo escrito a mano de esa columna sigue ahí', async () => {
    const { cuadro } = await datosDe(libre, 'cuadro_iniciar', { plantilla: 'volantes', titulo: 'No calculable' });
    const id = cuadro.cotizacionId;
    await datosDe(libre, 'cuadro_fijar_trabajo', { id, producto: 'Volantes', cantidad: '1000' });
    await datosDe(libre, 'cuadro_fijar_utilidad', { id, pct: '35', base: 'venta' });
    for (const f of ['material', 'planchas', 'impresion', 'diseno']) await anotar(id, f, [50, 50, 50]);
    const r = await calcular(libre, id);
    expect(col(r, '1000')).toMatchObject({ completa: true, motivo: null });
    expect(col(r, '100')).toMatchObject({ completa: false, comercial: null });
    expect(col(r, '100').motivo).toMatch(/pliego|imposici|papel/i);
    expect(celda(r, 'acabado', '100')).toMatchObject({ valorCentimos: null, origen: 'no_calculable' });
    expect(celda(r, 'material', '100')).toMatchObject({ valorCentimos: 5_000, origen: 'mano' });
  });

  it('si en la fila hay algo escrito a mano, las cantidades que su detalle no puede calcular se deducen de eso: acabado 10.00 a 1.000 → 1.00 a 100 y 50.00 a 5.000', async () => {
    const { cuadro } = await datosDe(libre, 'cuadro_iniciar', { plantilla: 'volantes', titulo: 'Deducida' });
    const id = cuadro.cotizacionId;
    await datosDe(libre, 'cuadro_fijar_trabajo', { id, producto: 'Volantes', cantidad: '1000' });
    for (const f of ['material', 'planchas', 'impresion', 'diseno']) await anotar(id, f, [50, 50, 50]);
    await anotar(id, 'acabado', [undefined, 10, undefined]);
    const r = await calcular(libre, id);
    expect(celda(r, 'acabado', '100')).toMatchObject({ valorCentimos: 100, origen: 'deducida', desde: '1000' });
    expect(celda(r, 'acabado', '5000')).toMatchObject({ valorCentimos: 5_000, origen: 'deducida', desde: '1000' });
    for (const c of ['100', '1000', '5000']) expect(col(r, c).completa).toBe(true);
  });
});
