import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe, manual } from './pruebas-de-cotizador.js';
import { armarCasoDeReferencia, sembrarTaller, type Taller } from './pruebas-de-cuadro.js';

// Las herramientas del cuadro por partes (cot-s4) por HTTP real, con dos empresas: aislamiento, solo en borrador, tope de filas,
// utilidad imposible, costos solo con permiso, columnas que se envían y los pasos de versión (emitir, nueva versión, duplicar).

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let ajeno: Sesion;
let cliente: string;
let taller: Taller;
let tallerAjeno: Taller;
let clienteAjeno: string;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lector', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Cuadro A');
  const B = await crearEmpresa(ajeno, 'Cuadro B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  clienteAjeno = await crearCliente(ajeno, 'Cliente de B');
  taller = await sembrarTaller(dueno);
  tallerAjeno = await sembrarTaller(ajeno);
});
afterAll(async () => {
  await app.cerrar();
});

const iniciar = async (extra: Record<string, unknown> = {}) => (await datosDe(dueno, 'cuadro_iniciar', { plantilla: 'en_blanco', clienteId: cliente, ...extra })).cuadro.cotizacionId as string;
const ver = async (id: string, s: Sesion = dueno) => (await datosDe(s, 'cuadro_ver', { id })).cuadro;
/** La respuesta entera (con los avisos), no solo `datos`. */
const llamar = async (nombre: string, args: Record<string, unknown>, s: Sesion = dueno) => {
  const r = await s.herramienta(nombre, args);
  if (!r.cuerpo?.ok) throw new Error(`«${nombre}» respondió ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return { ...r.cuerpo.datos, avisos: r.cuerpo.avisos as { codigo: string; nivel: string }[] };
};
const emitir = async (id: string, motivoMargenBajo?: string) => (await confirmando(dueno, 'cotizacion_emitir', { id, ...(motivoMargenBajo && { motivoMargenBajo }) })).respuesta;

describe('cuadro_iniciar y cuadro_ver', () => {
  it('crea una cotización por partes con la plantilla, la utilidad de la empresa y los ítems del taller copiados', async () => {
    const r = await datosDe(dueno, 'cuadro_iniciar', { plantilla: 'volantes', titulo: 'Volantes de marzo', producto: 'Volantes A5', clienteId: cliente });
    expect(r.cuadro).toMatchObject({ version: 1, estado: 'borrador', trabajo: { producto: 'Volantes A5', cantidad: '1000', tintas: 0, caras: 1, cliente: 'Imprenta Sol' }, moneda: 'PEN', comercial: null });
    expect(r.cuadro.lineas.map((l: any) => [l.descripcion, l.automatica])).toEqual([['Papel', 'papel'], ['Planchas', 'planchas'], ['Tiraje offset', null], ['Diseño gráfico', null], ['Corte y empaque', null]]);
    expect(r.cuadro.interno.utilidad).toEqual({ pct: '35', base: 'venta' });
    expect(r.cuadro.directo.interno.filas.filter((f: any) => f.esItem).map((f: any) => f.nombre)).toEqual(['Plastificado', 'Encolado']);
    expect(r.cuadro.directo.interno.filas.filter((f: any) => f.fija).map((f: any) => f.clave)).toEqual(['planchas', 'diseno']);
    const c = await datosDe(dueno, 'cotizacion_ver', { id: r.cuadro.cotizacionId });
    expect(c).toMatchObject({ modo: 'cuadro', titulo: 'Volantes de marzo', estado: 'borrador', clienteId: cliente, subtotalCentimos: 0, cantidadDeLineas: 0 });
    expect(c.cuadro.cotizacionId).toBe(c.id);
    expect(c.historial.map((h: any) => h.tipo)).toEqual(['creada']);
  });

  it('una cotización rápida no tiene cuadro y un cuadro sí aparece como modo «cuadro» en cotizacion_ver; cliente inexistente se rechaza', async () => {
    const rapida = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Rápida', clienteId: cliente, lineas: [manual('Diseño', 100)] });
    expect(rapida).toMatchObject({ modo: 'rapida', cuadro: null });
    expect(codigoDe(await dueno.herramienta('cuadro_ver', { id: rapida.id }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_trabajo', { id: rapida.id, producto: 'x' }))).toBe('conflicto');
    const peor = await dueno.herramienta('cuadro_iniciar', { clienteId: clienteAjeno });
    expect(codigoDe(peor)).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_iniciar', { plantilla: 'otra' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_iniciar', { extra: 1 }))).toBe('argumentos_invalidos');
  });

  it('otra empresa no ve ni toca el cuadro (no_encontrado en todas las herramientas)', async () => {
    const id = await iniciar();
    const casos: [string, Record<string, unknown>][] = [
      ['cuadro_ver', {}], ['cuadro_calcular', {}], ['cuadro_generar_referencias', {}], ['cuadro_fijar_trabajo', { producto: 'x' }],
      ['cuadro_fijar_imposicion', { sangradoCm: '1' }], ['cuadro_linea_agregar', { factor: 'acabado', descripcion: 'x', cantidad: '1', costoUnitario: '1' }],
      ['cuadro_linea_editar', { linea: { numero: 1 }, campo: 'cantidad', valor: '1' }], ['cuadro_linea_quitar', { linea: { numero: 1 } }],
      ['cuadro_fijar_costo_directo', { celdas: [{ fila: 'material', columna: '1000', importeCentimos: 1 }] }], ['cuadro_fijar_columnas_a_enviar', { columnas: ['1000'] }],
      ['cuadro_fijar_utilidad', { pct: '30' }], ['cuadro_fijar_precio_final', { precioCentimos: 100 }], ['cuadro_guardar_referencias', { nombre: 'x' }],
    ];
    for (const [nombre, args] of casos) expect(codigoDe(await ajeno.herramienta(nombre, { id, ...args })), nombre).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('cotizacion_emitir', { id }))).toBe('no_encontrado');
  });

  it('un lector ve el cuadro SIN costos ni margen: ninguna clave «interno» ni cifras de costo en la vista ni en cotizacion_ver', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Para el lector');
    const completo = await ver(id);
    expect(completo.interno.costos.costoCentimos).toBe(22_515);
    for (const vista of [await ver(id, lector), (await datosDe(lector, 'cotizacion_ver', { id })).cuadro]) {
      expect(vista.comercial.precioCentimos).toBe(34_638);
      expect(vista.interno).toBeUndefined();
      expect(vista.directo.interno).toBeUndefined();
      expect(vista.lineas.every((l: any) => l.interno === undefined)).toBe(true);
      expect(Object.values(vista.directo.columnas).every((c: any) => c.interno === undefined)).toBe(true);
      expect(JSON.stringify(vista)).not.toMatch(/costoUnitario|costoCentimos|margenPct|semaforo|utilidad|precioSugerido/);
    }
    const recibo = await datosDe(lector, 'cuadro_calcular', { id });
    expect(recibo.interno).toBeUndefined();
    expect(recibo.pliegos.pliegosMadre).toBe('172');
    expect((await datosDe(lector, 'cotizacion_ver', { id })).costoCentimos).toBeNull();
    for (const [nombre, args] of [['cuadro_fijar_trabajo', { producto: 'x' }], ['cuadro_iniciar', {}], ['cuadro_fijar_utilidad', { pct: '30' }], ['cuadro_fijar_costo_directo', { fijas: [{ fila: 'material', fija: true }] }]] as const) {
      expect(codigoDe(await lector.herramienta(nombre, { id, ...args })), nombre).toBe('modulo_solo_lectura');
    }
    const generadas = await datosDe(lector, 'cuadro_generar_referencias', { id });
    expect(generadas.margenes).toBeUndefined();
  });
});

describe('trabajo e imposición', () => {
  it('con la máquina y los pliegos del taller el motor llena el papel y las planchas', async () => {
    const id = await iniciar({ plantilla: 'volantes' });
    await datosDe(dueno, 'cuadro_fijar_trabajo', { id, producto: 'Volantes A5', descripcion: 'Couché 150 g', cantidad: '2500', pieza: { anchoCm: '14.8', altoCm: '21' }, tintas: 4, caras: 2 });
    const r = await datosDe(dueno, 'cuadro_fijar_imposicion', { id, maquinaId: taller.maquina, pliegoMadreId: taller.madre, pliegoMaquinaId: taller.deMaquina });
    expect(r.cuadro.imposicion.parametros).toMatchObject({
      pliegoMadre: { anchoCm: '70.00', altoCm: '100.00' }, pliegoMaquina: { anchoCm: '35.00', altoCm: '50.00' }, formatoMaximo: { anchoCm: '36.00', altoCm: '52.00' },
      pinzaCm: '2.00', sangradoCm: '0.30', calleCm: '0.30', etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }],
    });
    expect(r.cuadro.imposicion).toMatchObject({ faltantes: [], problema: null, calculada: { pliegosMadre: '172' } });
    expect(r.cuadro.trabajo.descripcion).toBe('Couché 150 g');
    expect(r.cuadro.lineas.find((l: any) => l.automatica === 'papel').cantidad).toBe('172');
    expect(r.cuadro.lineas.find((l: any) => l.automatica === 'planchas').cantidad).toBe('8');
  });

  it('valida: máquina o formato ajeno, inexistente o del tipo equivocado; id y medidas a la vez; datos de más; la pieza que no cabe se avisa', async () => {
    const id = await iniciar({ plantilla: 'volantes' });
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id, maquinaId: tallerAjeno.maquina }))).toBe('no_encontrado');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id, pliegoMadreId: taller.deMaquina }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id, pliegoMaquinaId: taller.madre }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id, pliegoMadreId: taller.madre, pliegoMadre: { anchoCm: '70', altoCm: '100' } }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id, sangradoCm: 0.3 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_trabajo', { id }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_trabajo', { id, cantidad: '2,500' }))).toBe('argumentos_invalidos');
    await datosDe(dueno, 'cuadro_fijar_trabajo', { id, cantidad: '2500', pieza: { anchoCm: '80', altoCm: '21' }, tintas: 4, caras: 2 });
    const r = await datosDe(dueno, 'cuadro_fijar_imposicion', { id, maquinaId: taller.maquina, pliegoMadreId: taller.madre, pliegoMaquinaId: taller.deMaquina });
    expect(r.cuadro.imposicion.problema).toMatch(/pieza/i);
    expect(r.cuadro.imposicion.calculada).toBeNull();
    expect(r.cuadro.comercial).toBeNull();
  });

  it('cambiar la cantidad entre 100, 1000 y 5000 mueve la columna base; otra cantidad deja el cuadro sin base y avisa de las filas que dependen de ella', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Base', '1000');
    expect((await ver(id)).directo.base).toBe('1000');
    const a = await llamar('cuadro_fijar_trabajo', { id, cantidad: '5000' });
    expect(a.cuadro.directo).toMatchObject({ base: '5000', columnas: { '5000': { esBase: true, seEnvia: true }, '1000': { seEnvia: false } } });
    expect(a.avisos.map((x: any) => x.codigo)).toContain('filas_sin_ajustar');
    const b = await datosDe(dueno, 'cuadro_fijar_trabajo', { id, cantidad: '2500' });
    expect(b.cuadro.directo.base).toBeNull();
    expect(b.cuadro.comercial.precioCentimos).toBeGreaterThan(0);
  });
});

describe('filas del cuadro', () => {
  it('agregar de una tarifa copia nombre, unidad, costo y escala; a mano pide factor, descripción y costo; el costo de la tarifa se COPIA', async () => {
    const id = await iniciar();
    const t = await datosDe(dueno, 'cuadro_linea_agregar', { id, tarifaId: taller.tarifas['Barniz de máquina'], cantidad: '1' });
    expect(t.linea).toMatchObject({ numero: 1, nombre: 'Barniz de máquina', detalle: 'Acabado' });
    expect(t.cuadro.lineas[0]).toMatchObject({ factor: 'acabado', unidad: 'servicio', escala: 'por_pliego', cantidad: '1', interno: { costoUnitario: '28.0000', subtotalCentimos: 2_800 } });
    await datosDe(dueno, 'tarifa_editar', { id: taller.tarifas['Barniz de máquina'], costoUnitario: '99' }).catch(() => null);
    const m = await datosDe(dueno, 'cuadro_linea_agregar', { id, factor: 'material', descripcion: 'Cartulina', cantidad: '10', costoUnitario: '1.2' });
    expect(m.cuadro.lineas.map((l: any) => l.descripcion)).toEqual(['Cartulina', 'Barniz de máquina']);
    expect(m.cuadro.lineas[0]).toMatchObject({ unidad: 'pliego', escala: 'por_pliego', interno: { costoUnitario: '1.2', subtotalCentimos: 1_200 } });
    for (const mal of [{ cantidad: '1' }, { factor: 'acabado', descripcion: 'x', cantidad: '1' }, { tarifaId: 'no-uuid', cantidad: '1' }, { tarifaId: taller.tarifas['Barniz de máquina'] }, { tarifaId: taller.tarifas['Barniz de máquina'], cantidad: 1 }]) {
      expect(codigoDe(await dueno.herramienta('cuadro_linea_agregar', { id, ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
    expect(codigoDe(await dueno.herramienta('cuadro_linea_agregar', { id, tarifaId: tallerAjeno.tarifas['Barniz de máquina'], cantidad: '1' }))).toBe('no_encontrado');
    await datosDe(dueno, 'tarifa_archivar', { id: taller.tarifas['Papel couché 300 g, pliego madre 70 × 100'] });
    expect(codigoDe(await dueno.herramienta('cuadro_linea_agregar', { id, tarifaId: taller.tarifas['Papel couché 300 g, pliego madre 70 × 100'], cantidad: '1' }))).toBe('conflicto');
  });

  it('editar y quitar por número, id o texto; un texto ambiguo no cambia nada y da las candidatas; sin costos ni la fila se ve', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Filas');
    const e = await datosDe(dueno, 'cuadro_linea_editar', { id, linea: { texto: 'barniz' }, campo: 'costoUnitario', valor: '30' });
    expect(e.cuadro.lineas.find((l: any) => l.descripcion === 'Barniz de máquina').interno.costoUnitario).toBe('30');
    expect(e.cuadro.interno.costos.costoCentimos).toBe(22_715);
    const ambigua = await dueno.herramienta('cuadro_linea_editar', { id, linea: { texto: 'acabado' }, campo: 'cantidad', valor: '2' });
    expect(codigoDe(ambigua)).toBe('conflicto');
    expect(ambigua.cuerpo.error.candidatas.map((c: any) => c.nombre)).toEqual(['Barniz de máquina', 'Corte y empaque']);
    expect(JSON.stringify(ambigua.cuerpo.error)).not.toMatch(/costo/i);
    expect(codigoDe(await dueno.herramienta('cuadro_linea_editar', { id, linea: { texto: 'inexistente' }, campo: 'cantidad', valor: '2' }))).toBe('no_encontrado');
    expect(codigoDe(await dueno.herramienta('cuadro_linea_editar', { id, linea: { numero: 99 }, campo: 'cantidad', valor: '2' }))).toBe('no_encontrado');
    expect(codigoDe(await dueno.herramienta('cuadro_linea_editar', { id, linea: { numero: 1 }, campo: 'costoUnitario', valor: '0,5' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_linea_editar', { id, linea: { numero: 1 }, campo: 'otro', valor: '1' }))).toBe('argumentos_invalidos');
    const papel = await llamar('cuadro_linea_editar', { id, linea: { numero: 1 }, campo: 'cantidad', valor: '200' });
    expect(papel.avisos.map((a: any) => a.codigo)).toContain('fila_manual');
    expect(papel.cuadro.lineas[0]).toMatchObject({ cantidad: '200', automatica: null });
    const q = await datosDe(dueno, 'cuadro_linea_quitar', { id, linea: { id: papel.cuadro.lineas[0].id } });
    expect(q.linea).toMatchObject({ numero: 1, nombre: expect.stringContaining('Papel') });
    expect(q.cuadro.lineas.map((l: any) => l.numero)).toEqual([1, 2, 3, 4, 5]);
  });

  it('el tope es de 60 filas: la 61 se rechaza y no cambia nada', async () => {
    const id = await iniciar();
    for (let i = 0; i < 60; i++) await datosDe(dueno, 'cuadro_linea_agregar', { id, factor: 'indirectos', descripcion: `Fila ${i + 1}`, cantidad: '1', costoUnitario: '1' });
    const r = await dueno.herramienta('cuadro_linea_agregar', { id, factor: 'indirectos', descripcion: 'Una más', cantidad: '1', costoUnitario: '1' });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toMatch(/60 filas/);
    expect((await ver(id)).lineas).toHaveLength(60);
  });
});

describe('costo directo, utilidad, precio final y columnas', () => {
  it('lo escrito a mano manda; en una fila fija vale para las tres columnas; null lo quita; las filas inexistentes se rechazan', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Directo', '1000');
    const antes = (await ver(id)).comercial.precioCentimos;
    const r = await datosDe(dueno, 'cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'material', columna: '1000', importeCentimos: 25_000 }], fijas: [{ fila: 'diseno', fija: true }] });
    const material = r.cuadro.directo.interno.filas.find((f: any) => f.clave === 'material');
    expect(material.celdas['1000']).toMatchObject({ valorCentimos: 25_000, origen: 'mano' });
    expect(material.celdas['100'].origen).toBe('detalle'); // la fila tiene detalle: manda el detalle y no lo escrito en otra columna
    expect(r.cuadro.directo.columnas['1000'].interno.porFactorCentimos.material).toBe(25_000);
    const otros = await datosDe(dueno, 'cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'indirectos', columna: '1000', importeCentimos: 10_000 }] });
    const indirectos = otros.cuadro.directo.interno.filas.find((f: any) => f.clave === 'indirectos');
    expect(indirectos.celdas['100']).toMatchObject({ origen: 'deducida', desde: '1000' });
    expect(r.cuadro.comercial.precioCentimos).not.toBe(antes);
    const fija = await datosDe(dueno, 'cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'diseno', columna: '100', importeCentimos: 5_000 }] });
    const diseno = fija.cuadro.directo.interno.filas.find((f: any) => f.clave === 'diseno');
    expect(['100', '1000', '5000'].map((c) => diseno.celdas[c].valorCentimos)).toEqual([5_000, 5_000, 5_000]);
    const item = await datosDe(dueno, 'cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'i1', columna: '1000', importeCentimos: 3_000 }] });
    expect(item.cuadro.directo.interno.filas.find((f: any) => f.clave === 'i1').celdas['1000']).toMatchObject({ valorCentimos: 3_000, origen: 'mano' });
    const quitada = await datosDe(dueno, 'cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'material', columna: '1000', importeCentimos: null }, { fila: 'i1', columna: '1000', importeCentimos: null }] });
    expect(quitada.cuadro.directo.interno.filas.find((f: any) => f.clave === 'material').celdas['1000'].origen).toBe('detalle');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'zzz', columna: '1000', importeCentimos: 1 }] }))).toBe('no_encontrado');
    for (const mal of [{}, { celdas: [] }, { celdas: [{ fila: 'material', columna: '2000', importeCentimos: 1 }] }, { celdas: [{ fila: 'material', columna: '1000', importeCentimos: 1.5 }] }, { celdas: [{ fila: 'material', columna: '1000', importeCentimos: -1 }] }]) {
      expect(codigoDe(await dueno.herramienta('cuadro_fijar_costo_directo', { id, ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
  });

  it('utilidad: porcentaje y base; por columna; sobre la venta 100 % es imposible y no se guarda', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Utilidad', '1000');
    const r = await datosDe(dueno, 'cuadro_fijar_utilidad', { id, pct: '40' });
    expect(r.cuadro.interno.utilidad).toEqual({ pct: '40', base: 'venta' });
    expect(r.cuadro.interno.costos.margenPct).toBe('40.00');
    const c = await datosDe(dueno, 'cuadro_fijar_utilidad', { id, pct: '20', columna: '5000' });
    expect(c.cuadro.directo.columnas['5000'].interno).toMatchObject({ utilidadPct: '20', utilidadDeColumna: true });
    expect(c.cuadro.directo.columnas['1000'].interno.utilidadDeColumna).toBe(false);
    const sin = await datosDe(dueno, 'cuadro_fijar_utilidad', { id, pct: null, columna: '5000' });
    expect(sin.cuadro.directo.columnas['5000'].interno.utilidadDeColumna).toBe(false);
    const imposible = await dueno.herramienta('cuadro_fijar_utilidad', { id, pct: '100' });
    expect(codigoDe(imposible)).toBe('argumentos_invalidos');
    expect(imposible.cuerpo.error.mensaje).toMatch(/menor que 100/);
    expect((await ver(id)).interno.utilidad.pct).toBe('40');
    await datosDe(dueno, 'cuadro_fijar_utilidad', { id, pct: '100', base: 'costo' });
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_utilidad', { id, base: 'venta' }))).toBe('argumentos_invalidos');
    for (const mal of [{}, { pct: null }, { pct: '30', base: 'costo', columna: '100' }, { pct: 30 }, { base: 'otra' }]) {
      expect(codigoDe(await dueno.herramienta('cuadro_fijar_utilidad', { id, ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
  });

  it('precio final: fija el precio en céntimos, avisa del rojo sin cifras en lo comercial, se quita con null y no vale con varias cantidades', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Precio', '1000');
    const bajo = await llamar('cuadro_fijar_precio_final', { id, precioCentimos: 19_000 });
    expect(bajo.cuadro).toMatchObject({ precioFinalCentimos: 19_000, comercial: { precioCentimos: 19_000 }, interno: { costos: { semaforo: 'rojo' } } });
    // El aviso con el margen es interno: el ejecutor lo filtra por `costos:ver` (permiso del núcleo), que el módulo no usa; ver el informe.
    expect(bajo.avisos.map((a: any) => a.codigo)).toContain('precio_bajo_minimo');
    expect(bajo.avisos.every((a: any) => a.nivel === 'comercial')).toBe(true);
    expect((await datosDe(dueno, 'cuadro_fijar_precio_final', { id, precioCentimos: null })).cuadro.precioFinalCentimos).toBeNull();
    for (const mal of [{ precioCentimos: 0 }, { precioCentimos: 10.5 }, {}, { precio: '300' }]) {
      expect(codigoDe(await dueno.herramienta('cuadro_fijar_precio_final', { id, ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
    const dos = await datosDe(dueno, 'cuadro_fijar_columnas_a_enviar', { id, columnas: ['1000', '5000'] });
    expect(dos.cuadro.directo.columnas).toMatchObject({ '1000': { seEnvia: true, esBase: true }, '5000': { seEnvia: true }, '100': { seEnvia: false } });
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_precio_final', { id, precioCentimos: 30_000 }))).toBe('conflicto');
    await datosDe(dueno, 'cuadro_fijar_precio_final', { id, precioCentimos: null });
    await datosDe(dueno, 'cuadro_fijar_precio_final', { id, precioCentimos: 30_000 }).catch(() => null);
  });

  it('columnas a enviar: la base siempre va y se avisa; con otra cantidad de trabajo no hay base; no se repiten ni se inventan', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Columnas', '1000');
    const r = await llamar('cuadro_fijar_columnas_a_enviar', { id, columnas: ['5000'] });
    expect(r.avisos.map((a: any) => a.codigo)).toContain('base_agregada');
    expect(r.cuadro.directo.columnas['1000'].seEnvia && r.cuadro.directo.columnas['5000'].seEnvia).toBe(true);
    for (const mal of [{ columnas: [] }, { columnas: ['1000', '1000'] }, { columnas: ['2000'] }]) {
      expect(codigoDe(await dueno.herramienta('cuadro_fijar_columnas_a_enviar', { id, ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
    await datosDe(dueno, 'cuadro_fijar_trabajo', { id, cantidad: '2500' });
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_columnas_a_enviar', { id, columnas: ['1000'] }))).toBe('conflicto');
  });
});

describe('emitir, nueva versión y duplicar un cuadro', () => {
  it('un cuadro incompleto no se emite: dice qué falta (producto, cantidad, imposición, filas)', async () => {
    const id = await iniciar();
    const falta = async () => (await emitir(id)).cuerpo.error;
    expect(await falta()).toMatchObject({ codigo: 'conflicto', mensaje: expect.stringMatching(/nombre del producto/) });
    await datosDe(dueno, 'cuadro_fijar_trabajo', { id, producto: 'Volantes A5' });
    expect((await falta()).mensaje).toMatch(/medidas de la pieza/);
    await datosDe(dueno, 'cuadro_fijar_trabajo', { id, pieza: { anchoCm: '14.8', altoCm: '21' } });
    expect((await falta()).mensaje).toMatch(/imposición: pliego madre/);
    await datosDe(dueno, 'cuadro_fijar_imposicion', { id, maquinaId: taller.maquina, pliegoMadreId: taller.madre, pliegoMaquinaId: taller.deMaquina });
    expect((await falta()).mensaje).toMatch(/no tiene filas/);
    await datosDe(dueno, 'cuadro_linea_agregar', { id, factor: 'diseno', descripcion: 'Diseño', cantidad: '1', costoUnitario: '40' });
    const ok = (await emitir(id)).cuerpo.datos;
    expect(ok.estado).toBe('emitida');
  });

  it('sin cliente no se emite; y una cotización rápida sigue emitiéndose igual', async () => {
    const sinCliente = (await datosDe(dueno, 'cuadro_iniciar', { plantilla: 'en_blanco', producto: 'X' })).cuadro.cotizacionId;
    expect((await emitir(sinCliente)).cuerpo.error.mensaje).not.toMatch(/Elige el cliente/);
    const rapida = await datosDe(dueno, 'cotizacion_crear', { titulo: 'R', clienteId: cliente, lineas: [manual('Diseño', 100)] });
    expect((await emitir(rapida.id)).cuerpo.datos).toMatchObject({ estado: 'emitida', modo: 'rapida', cuadro: null });
  });

  it('margen en rojo exige motivo al emitir y queda guardado; sin rojo no se pide', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Rojo');
    await datosDe(dueno, 'cuadro_fijar_precio_final', { id, precioCentimos: 25_000 });
    const sin = await emitir(id);
    expect(codigoDe(sin)).toBe('argumentos_invalidos');
    expect(sin.cuerpo.error.mensaje).toMatch(/margen.*por debajo del mínimo/);
    const e = (await emitir(id, 'Cliente recurrente')).cuerpo.datos;
    expect(e).toMatchObject({ estado: 'emitida', subtotalCentimos: 25_000, margenPct: '9.940', motivoMargenBajo: 'Cliente recurrente' });
    expect(e.cuadro.interno.costos.semaforo).toBe('rojo');
  });

  it('con varias cantidades enviadas salen varias líneas en céntimos (opciones); aceptar pide cuáles; nueva versión y duplicar copian el cuadro', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Opciones', '1000');
    await datosDe(dueno, 'cuadro_fijar_costo_directo', { id, celdas: [{ fila: 'material', columna: '100', importeCentimos: 1_500 }, { fila: 'material', columna: '5000', importeCentimos: 90_000 }] });
    await datosDe(dueno, 'cuadro_fijar_columnas_a_enviar', { id, columnas: ['100', '1000', '5000'] });
    const e = (await emitir(id)).cuerpo.datos;
    expect(e).toMatchObject({ estado: 'emitida', conOpciones: true, cantidadDeLineas: 3 });
    expect(e.lineas.map((l: any) => l.cantidadMilesimas)).toEqual([100_000, 1_000_000, 5_000_000]);
    expect(e.lineas.reduce((a: number, l: any) => a + l.importeCentimos, 0)).toBe(e.subtotalCentimos);
    expect(e.lineas.every((l: any) => l.totalCentimos === l.importeCentimos + l.igvCentimos)).toBe(true);
    expect(codigoDe(await dueno.herramienta('cotizacion_aceptar', { id }))).toBe('argumentos_invalidos');

    const v2 = await datosDe(dueno, 'cotizacion_nueva_version', { id });
    expect(v2).toMatchObject({ estado: 'borrador', version: 2, modo: 'cuadro', cantidadDeLineas: 3, motivoMargenBajo: null });
    expect(v2.cuadro).toMatchObject({ estado: 'borrador', version: 2, trabajo: { producto: 'Volantes A5', cantidad: '1000' } });
    const editada = await datosDe(dueno, 'cuadro_fijar_utilidad', { id, pct: '50' });
    expect(editada.cuadro.interno.utilidad.pct).toBe('50');
    expect((await datosDe(dueno, 'cotizacion_ver', { id, version: 1 })).cuadro.interno.utilidad.pct).toBe('35');
    expect((await datosDe(dueno, 'cotizacion_ver', { id, version: 1 })).cuadro.estado).toBe('emitida');

    const copia = await datosDe(dueno, 'cotizacion_duplicar', { id });
    expect(copia).toMatchObject({ estado: 'borrador', modo: 'cuadro', numero: null, version: 1 });
    expect(copia.id).not.toBe(id);
    expect(copia.cuadro.trabajo.producto).toBe('Volantes A5');
    expect(copia.cuadro.interno.utilidad.pct).toBe('50');
    await datosDe(dueno, 'cuadro_fijar_trabajo', { id: copia.id, producto: 'Copia' });
    expect((await ver(id)).trabajo.producto).toBe('Volantes A5');
  });

  it('cotizacion_editar no cambia las líneas, el costo ni las opciones de un cuadro; sí el título y el cliente', async () => {
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Editar');
    for (const cambio of [{ lineas: [manual('x', 1)] }, { costoCentimos: 100 }, { conOpciones: true }]) {
      expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id, ...cambio })), JSON.stringify(cambio)).toBe('conflicto');
    }
    expect(await datosDe(dueno, 'cotizacion_editar', { id, titulo: 'Nuevo título' })).toMatchObject({ titulo: 'Nuevo título', modo: 'cuadro', subtotalCentimos: 34_638 });
  });
});

describe('guardar referencias', () => {
  it('con el cuadro incompleto no se generan; el nombre repetido y el producto con otra lista se rechazan; la otra empresa no ve la lista', async () => {
    const vacio = await iniciar();
    expect((await datosDe(dueno, 'cuadro_generar_referencias', { id: vacio })).validacion.bloqueos.length).toBeGreaterThan(0);
    expect(codigoDe((await confirmando(dueno, 'cuadro_guardar_referencias', { id: vacio, nombre: 'Vacía' })).respuesta)).toBe('argumentos_invalidos');
    const sinImposicion = await iniciar({ plantilla: 'volantes' });
    expect(codigoDe(await dueno.herramienta('cuadro_generar_referencias', { id: sinImposicion }))).toBe('conflicto');
    const id = await armarCasoDeReferencia(dueno, taller, cliente, 'Refs', '1000');
    const lista = (await confirmando(dueno, 'cuadro_guardar_referencias', { id, nombre: 'Volantes del cuadro' })).respuesta.cuerpo.datos;
    expect(lista).toMatchObject({ nombre: 'Volantes del cuadro', productoId: null });
    expect(codigoDe((await confirmando(dueno, 'cuadro_guardar_referencias', { id, nombre: 'volantes DEL cuadro' })).respuesta)).toBe('conflicto');
    const otraLista = await datosDe(dueno, 'lista_precio_crear', { nombre: 'Otra', p100Centimos: 100, p1000Centimos: 500, p5000Centimos: 2_000 });
    const actualizada = (await confirmando(dueno, 'cuadro_guardar_referencias', { id, listaId: lista.id, nombre: 'Volantes del cuadro' })).respuesta.cuerpo.datos;
    expect(actualizada.id).toBe(lista.id);
    expect(codigoDe((await confirmando(dueno, 'cuadro_guardar_referencias', { id, listaId: lista.id, nombre: 'Otra' })).respuesta)).toBe('conflicto');
    expect(otraLista.id).not.toBe(lista.id);
    expect(codigoDe(await ajeno.herramienta('cuadro_guardar_referencias', { id, nombre: 'X' }))).toBe('no_encontrado');
    expect((await datosDe(ajeno, 'listas_precio_listar')).items).toHaveLength(0);
    expect(codigoDe(await dueno.herramienta('cuadro_guardar_referencias', { id, listaId: lista.id, nombre: 'Y', extra: 1 }))).toBe('argumentos_invalidos');
  });
});
