import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, datosDe } from './pruebas-de-cotizador.js';

// Taller del Cotizador (cot-s3) por HTTP real: formatos, máquinas, tarifas, ítems del cuadro y la carga de ejemplo,
// con dos empresas para comprobar el aislamiento.

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let ajeno: Sesion;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lector', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Taller A');
  const B = await crearEmpresa(ajeno, 'Taller B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
});
afterAll(async () => {
  await app.cerrar();
});

const FORMATO = { nombre: '70 × 100 cm', anchoCm: '70', altoCm: '100', tipo: 'madre' };
const MAQUINA = { nombre: 'Offset 36 × 52', formatoMaxAnchoCm: '36', formatoMaxAltoCm: '52', pinzaCm: '2', sangradoCm: '0.3', calleCm: '0.3', etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }] };
const TARIFA = { factor: 'material', nombre: 'Papel couché 150 g', unidad: 'pliego', costoUnitario: '0.45', escalaPorDefecto: 'por_pliego' };

describe('formatos de pliego', () => {
  let f: any;
  it('crea, lista y devuelve las medidas como texto', async () => {
    f = await datosDe(dueno, 'formato_pliego_crear', FORMATO);
    expect(f).toMatchObject({ nombre: '70 × 100 cm', anchoCm: '70.00', altoCm: '100.00', tipo: 'madre', archivadoEn: null });
    expect((await datosDe(dueno, 'formatos_pliego_listar', { tipo: 'madre' })).items).toHaveLength(1);
    expect((await datosDe(dueno, 'formatos_pliego_listar', { tipo: 'maquina' })).items).toHaveLength(0);
  });
  it('rechaza medidas en cero, campos de más y números como `number`', async () => {
    for (const mal of [{ anchoCm: '0' }, { altoCm: 'abc' }, { anchoCm: 70 }, { tipo: 'otro' }, { extra: 1 }]) {
      expect(codigoDe(await dueno.herramienta('formato_pliego_crear', { ...FORMATO, nombre: 'Otro', ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
  });
  it('un nombre repetido (sin tildes ni mayúsculas) da conflicto con la fila como candidata', async () => {
    const r = await dueno.herramienta('formato_pliego_crear', { ...FORMATO, nombre: '70 × 100  CM' });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.candidatas[0].id).toBe(f.id);
  });
  it('edita, no edita sin datos, y otra empresa no lo ve ni lo toca', async () => {
    expect((await datosDe(dueno, 'formato_pliego_editar', { id: f.id, altoCm: '102' })).altoCm).toBe('102.00');
    expect(codigoDe(await dueno.herramienta('formato_pliego_editar', { id: f.id }))).toBe('argumentos_invalidos');
    expect((await datosDe(ajeno, 'formatos_pliego_listar')).items).toHaveLength(0);
    expect(codigoDe(await ajeno.herramienta('formato_pliego_editar', { id: f.id, altoCm: '1' }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('formato_pliego_archivar', { id: f.id }))).toBe('no_encontrado');
  });
  it('archivar es idempotente, el archivado no se edita y el nombre queda libre', async () => {
    const a = await datosDe(dueno, 'formato_pliego_archivar', { id: f.id });
    const b = await datosDe(dueno, 'formato_pliego_archivar', { id: f.id });
    expect(b.archivadoEn).toBe(a.archivadoEn);
    expect(codigoDe(await dueno.herramienta('formato_pliego_editar', { id: f.id, nombre: 'x' }))).toBe('conflicto');
    expect((await datosDe(dueno, 'formatos_pliego_listar')).items).toHaveLength(0);
    expect((await datosDe(dueno, 'formatos_pliego_listar', { estado: 'archivadas' })).items).toHaveLength(1);
    f = await datosDe(dueno, 'formato_pliego_crear', FORMATO);
  });
  it('el lector (solo lectura) lee pero no escribe', async () => {
    expect((await datosDe(lector, 'formatos_pliego_listar')).items).toHaveLength(1);
    expect(codigoDe(await lector.herramienta('formato_pliego_crear', { ...FORMATO, nombre: 'Del lector' }))).toBe('modulo_solo_lectura');
  });
  it('una tarifa enlazada a un formato: inexistente o de otra empresa da no_encontrado', async () => {
    expect(codigoDe(await dueno.herramienta('tarifa_crear', { ...TARIFA, nombre: 'Con formato falso', formatoId: randomUUID() }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('tarifa_crear', { ...TARIFA, nombre: 'Con formato ajeno', formatoId: f.id }))).toBe('no_encontrado');
    const t = await datosDe(dueno, 'tarifa_crear', { ...TARIFA, nombre: 'Con formato', formatoId: f.id });
    expect(t.formatoId).toBe(f.id);
    await datosDe(dueno, 'tarifa_archivar', { id: t.id });
  });
});

describe('máquinas', () => {
  let m: any;
  it('crea con sus etapas, las lista y rechaza una merma de 100 %', async () => {
    m = await datosDe(dueno, 'maquina_crear', MAQUINA);
    expect(m).toMatchObject({ nombre: 'Offset 36 × 52', formatoMaxAnchoCm: '36.00', pinzaCm: '2.00', sangradoCm: '0.30', etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }] });
    expect((await datosDe(dueno, 'maquinas_listar', { buscar: 'OFFSET' })).items).toHaveLength(1);
    const mal = { ...MAQUINA, nombre: 'Mala', etapas: [{ nombre: 'Tiraje', mermaPct: '100', arranque: '40' }] };
    expect(codigoDe(await dueno.herramienta('maquina_crear', mal))).toBe('argumentos_invalidos');
  });
  it('choque de nombre, edición de etapas y aislamiento', async () => {
    expect(codigoDe(await dueno.herramienta('maquina_crear', { ...MAQUINA, nombre: 'OFFSET  36 × 52' }))).toBe('conflicto');
    const e = await datosDe(dueno, 'maquina_editar', { id: m.id, pinzaCm: '1.5', etapas: [] });
    expect(e).toMatchObject({ pinzaCm: '1.50', etapas: [] });
    expect((await datosDe(ajeno, 'maquinas_listar')).items).toHaveLength(0);
    expect(codigoDe(await ajeno.herramienta('maquina_editar', { id: m.id, pinzaCm: '1' }))).toBe('no_encontrado');
  });
  it('archivar es idempotente y el archivado no se edita', async () => {
    const a = await datosDe(dueno, 'maquina_archivar', { id: m.id });
    expect((await datosDe(dueno, 'maquina_archivar', { id: m.id })).archivadoEn).toBe(a.archivadoEn);
    expect(codigoDe(await dueno.herramienta('maquina_editar', { id: m.id, pinzaCm: '1' }))).toBe('conflicto');
    expect(codigoDe(await ajeno.herramienta('maquina_archivar', { id: m.id }))).toBe('no_encontrado');
  });
});

describe('tarifas', () => {
  let t: any;
  it('crea con el costo como texto y filtra por factor y búsqueda', async () => {
    t = await datosDe(dueno, 'tarifa_crear', TARIFA);
    expect(t).toMatchObject({ factor: 'material', costoUnitario: '0.4500', escalaPorDefecto: 'por_pliego', formatoId: null, articuloId: null });
    await datosDe(dueno, 'tarifa_crear', { factor: 'diseno', nombre: 'Diseño gráfico', unidad: 'servicio', costoUnitario: '40', escalaPorDefecto: 'fija' });
    expect((await datosDe(dueno, 'tarifas_listar', { factor: 'material' })).items).toHaveLength(1);
    expect((await datosDe(dueno, 'tarifas_listar', { buscar: 'DISEÑO' })).items).toHaveLength(1);
    expect((await datosDe(dueno, 'tarifas_listar')).items).toHaveLength(2);
  });
  it('rechaza costo negativo, con coma o como número, y choque de nombre', async () => {
    for (const mal of [{ costoUnitario: '-1' }, { costoUnitario: '0,45' }, { costoUnitario: 0.45 }, { factor: 'otro' }, { escalaPorDefecto: 'x' }]) {
      expect(codigoDe(await dueno.herramienta('tarifa_crear', { ...TARIFA, nombre: 'Otra', ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
    expect(codigoDe(await dueno.herramienta('tarifa_crear', { ...TARIFA, nombre: 'PAPEL couche 150 g' }))).toBe('conflicto');
  });
  it('tarifa_editar es crítica: pide confirmar con «Cambiarás el costo de «X»: 0.45 → 0.52» y guarda', async () => {
    const { respuesta, resumen } = await confirmando(dueno, 'tarifa_editar', { id: t.id, costoUnitario: '0.52' });
    expect(resumen).toContain('Cambiarás el costo de «Papel couché 150 g»: 0.45 → 0.52');
    expect(respuesta.cuerpo.datos.costoUnitario).toBe('0.5200');
    const sin = await confirmando(dueno, 'tarifa_editar', { id: t.id, unidad: 'hoja' });
    expect(sin.resumen).toBe('Cambiarás los datos de «Papel couché 150 g».');
  });
  it('sin confirmación no cambia nada; la de otra empresa no existe', async () => {
    const r = await dueno.herramienta('tarifa_editar', { id: t.id, costoUnitario: '9' });
    expect(r.cuerpo.requiereConfirmacion).toBeTruthy();
    expect((await datosDe(dueno, 'tarifas_listar', { factor: 'material' })).items[0].costoUnitario).toBe('0.5200');
    expect(codigoDe(await ajeno.herramienta('tarifa_editar', { id: t.id, costoUnitario: '1' }))).toBe('no_encontrado');
    expect((await datosDe(ajeno, 'tarifas_listar')).items).toHaveLength(0);
  });
  it('archivar es idempotente y el archivado no se edita', async () => {
    const a = await datosDe(dueno, 'tarifa_archivar', { id: t.id });
    expect((await datosDe(dueno, 'tarifa_archivar', { id: t.id })).archivadoEn).toBe(a.archivadoEn);
    expect(codigoDe(await dueno.herramienta('tarifa_editar', { id: t.id, nombre: 'x' }))).toBe('conflicto');
    expect(codigoDe(await ajeno.herramienta('tarifa_archivar', { id: t.id }))).toBe('no_encontrado');
  });
});

describe('ítems del cuadro', () => {
  const ids: string[] = [];
  it('crea en orden, con «despuesDe» igual al factor por defecto', async () => {
    for (const nombre of ['Plastificado', 'Encolado', 'Troquelado']) {
      const i = await datosDe(dueno, 'item_cuadro_crear', { nombre, factor: 'acabado' });
      ids.push(i.id);
      expect(i).toMatchObject({ despuesDe: 'acabado', fija: false });
    }
    expect((await datosDe(dueno, 'items_cuadro_listar')).items.map((i: any) => [i.nombre, i.posicion])).toEqual([['Plastificado', 0], ['Encolado', 1], ['Troquelado', 2]]);
  });
  it('choque de nombre, edición y aislamiento', async () => {
    expect(codigoDe(await dueno.herramienta('item_cuadro_crear', { nombre: 'plastificado', factor: 'acabado' }))).toBe('conflicto');
    expect((await datosDe(dueno, 'item_cuadro_editar', { id: ids[2], fija: true, despuesDe: 'impresion' }))).toMatchObject({ fija: true, despuesDe: 'impresion' });
    expect((await datosDe(ajeno, 'items_cuadro_listar')).items).toHaveLength(0);
    expect(codigoDe(await ajeno.herramienta('item_cuadro_editar', { id: ids[0], fija: true }))).toBe('no_encontrado');
  });
  it('reordena: los nombrados primero y el resto después; rechaza ids ajenos o repetidos', async () => {
    const r = await datosDe(dueno, 'items_cuadro_reordenar', { ids: [ids[2], ids[1]] });
    expect(r.items.map((i: any) => [i.nombre, i.posicion])).toEqual([['Troquelado', 0], ['Encolado', 1], ['Plastificado', 2]]);
    expect(codigoDe(await dueno.herramienta('items_cuadro_reordenar', { ids: [randomUUID()] }))).toBe('no_encontrado');
    expect(codigoDe(await dueno.herramienta('items_cuadro_reordenar', { ids: [ids[0], ids[0]] }))).toBe('argumentos_invalidos');
    expect(codigoDe(await ajeno.herramienta('items_cuadro_reordenar', { ids }))).toBe('no_encontrado');
  });
  it('archivar es idempotente; sale del orden y el máximo es 20 activos', async () => {
    const a = await datosDe(dueno, 'item_cuadro_archivar', { id: ids[1] });
    expect((await datosDe(dueno, 'item_cuadro_archivar', { id: ids[1] })).archivadoEn).toBe(a.archivadoEn);
    expect((await datosDe(dueno, 'items_cuadro_listar')).items).toHaveLength(2);
    expect(codigoDe(await dueno.herramienta('item_cuadro_editar', { id: ids[1], fija: true }))).toBe('conflicto');
    for (let n = 0; n < 18; n++) await datosDe(dueno, 'item_cuadro_crear', { nombre: `Extra ${n}`, factor: 'indirectos' });
    expect(codigoDe(await dueno.herramienta('item_cuadro_crear', { nombre: 'Uno de más', factor: 'indirectos' }))).toBe('conflicto');
  });
});

describe('taller_sembrar', () => {
  it('con filas no hace nada y lo dice; en una empresa vacía carga la semilla una sola vez', async () => {
    const lleno = await datosDe(dueno, 'taller_sembrar');
    expect(lleno).toMatchObject({ sembrado: false, formatos: 0, tarifas: 0 });
    const primera = await datosDe(ajeno, 'taller_sembrar');
    expect(primera).toMatchObject({ sembrado: true, formatos: 4, maquinas: 1, tarifas: 8, items: 2 });
    expect(primera.mensaje).toContain('ilustrativos');
    expect(await datosDe(ajeno, 'taller_sembrar')).toMatchObject({ sembrado: false });
    expect((await datosDe(ajeno, 'tarifas_listar')).items).toHaveLength(7);
    expect((await datosDe(ajeno, 'tarifas_listar', { estado: 'archivadas' })).items).toHaveLength(1);
    expect((await datosDe(ajeno, 'items_cuadro_listar')).items.map((i: any) => i.nombre)).toEqual(['Plastificado', 'Encolado']);
    expect((await datosDe(ajeno, 'maquinas_listar')).items[0].etapas).toEqual([{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }]);
  });
  it('el lector no puede sembrar', async () => {
    expect(codigoDe(await lector.herramienta('taller_sembrar', {}))).toBe('modulo_solo_lectura');
  });
});
