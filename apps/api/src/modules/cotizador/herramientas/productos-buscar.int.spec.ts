import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, datosDe, LISTA_C7 } from './pruebas-de-cotizador.js';

// Fase 1 del plan de integración: el buscador del catálogo (`cotizador_productos_buscar`) y «una lista activa por producto».

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let ajeno: Sesion;
const ids: Record<string, string> = {};

const buscar = async (s: Sesion, texto: string, limite?: number) => (await datosDe(s, 'cotizador_productos_buscar', { texto, ...(limite && { limite }) })).items as any[];
const producto = async (s: Sesion, nombre: string, extra: Record<string, unknown> = {}) => (await datosDe(s, 'productos_crear', { nombre, ...extra })).id as string;
const lista = (s: Sesion, nombre: string, extra: Record<string, unknown> = {}) => s.herramienta('lista_precio_crear', { ...LISTA_C7, nombre, ...extra });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Catálogo A');
  const B = await crearEmpresa(ajeno, 'Catálogo B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
  ids.conLista = await producto(dueno, 'Banner con lista', { unidad: 'm²', precioUnitarioMilesimas: 5_900 });
  ids.sinLista = await producto(dueno, 'Banner de catálogo', { unidad: 'und', precioUnitarioMilesimas: 1_180 });
  ids.sinPrecio = await producto(dueno, 'Banner sin precio');
  ids.noAfecto = await producto(dueno, 'Banner exonerado', { precioUnitarioMilesimas: 1_180, afectoIgv: false });
  ids.archivado = await producto(dueno, 'Banner archivado', { precioUnitarioMilesimas: 1_000 });
  ids.conListaArchivada = await producto(dueno, 'Banner lista archivada', { precioUnitarioMilesimas: 2_360 });
  await datosDe(dueno, 'productos_archivar', { id: ids.archivado });
  await producto(ajeno, 'Banner de la ajena', { precioUnitarioMilesimas: 1_000 });
});
afterAll(async () => app.cerrar());

describe('cotizador_productos_buscar', () => {
  it('cada producto sale con su origen: lista, catálogo (sin IGV) o sin precio', async () => {
    const l = await lista(dueno, 'Banner con lista', { productoId: ids.conLista, unidad: 'm²' });
    expect(l.cuerpo.ok).toBe(true);
    const lArchivada = await lista(dueno, 'Banner lista archivada', { productoId: ids.conListaArchivada });
    await datosDe(dueno, 'lista_precio_archivar', { id: lArchivada.cuerpo.datos.id });
    const items = await buscar(dueno, 'banner');
    const por = (n: string) => items.find((i) => i.nombre === n);
    expect(por('Banner con lista')).toMatchObject({ origen: 'lista', productoId: ids.conLista, listaId: l.cuerpo.datos.id, unidad: 'm²', lista: { id: l.cuerpo.datos.id, productoNombre: 'Banner con lista' } });
    expect(por('Banner de catálogo')).toMatchObject({ origen: 'catalogo', listaId: null, unidad: 'und', precioCatalogoSinIgvMilesimas: 1_000, afectoIgv: true });
    expect(por('Banner exonerado')).toMatchObject({ origen: 'catalogo', precioCatalogoSinIgvMilesimas: 1_180, afectoIgv: false });
    expect(por('Banner lista archivada')).toMatchObject({ origen: 'catalogo', precioCatalogoSinIgvMilesimas: 2_000 });
    expect(por('Banner sin precio')).toMatchObject({ origen: 'sin_precio', listaId: null });
    expect(por('Banner sin precio').precioCatalogoSinIgvMilesimas).toBeUndefined();
    expect(items.map((i) => i.origen)).toEqual(items.map((i) => i.origen).sort((a, b) => ['lista', 'catalogo', 'sin_precio'].indexOf(a) - ['lista', 'catalogo', 'sin_precio'].indexOf(b)));
  });

  it('un producto archivado no aparece; una empresa no ve nada de la otra', async () => {
    expect((await buscar(dueno, 'banner')).map((i) => i.nombre)).not.toContain('Banner archivado');
    expect((await buscar(dueno, 'banner')).map((i) => i.nombre)).not.toContain('Banner de la ajena');
    expect((await buscar(ajeno, 'banner')).map((i) => i.nombre)).toEqual(['Banner de la ajena']);
  });

  it('las listas heredadas, sin producto, también salen (y las archivadas no)', async () => {
    const h = await lista(dueno, 'Troquel heredado');
    const a = await lista(dueno, 'Troquel viejo');
    await datosDe(dueno, 'lista_precio_archivar', { id: a.cuerpo.datos.id });
    const items = await buscar(dueno, 'troquel');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ origen: 'lista', productoId: null, listaId: h.cuerpo.datos.id, nombre: 'Troquel heredado', unidad: 'unidad' });
    expect(items[0].lista.productoNombre).toBeNull();
  });

  it('el límite se respeta, el texto vacío o el límite de más son argumentos_invalidos y un lector puede buscar', async () => {
    expect((await buscar(dueno, 'banner', 2)).length).toBe(2);
    expect(codigoDe(await dueno.herramienta('cotizador_productos_buscar', { texto: '  ' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cotizador_productos_buscar', { texto: 'a', limite: 21 }))).toBe('argumentos_invalidos');
    expect((await buscar(lector, 'banner')).length).toBeGreaterThan(0);
  });
});

describe('una lista activa por producto', () => {
  it('crear con un producto que ya tiene lista activa es conflicto con la lista como candidata; archivada, sí se puede', async () => {
    const r = await lista(dueno, 'Otra del mismo banner', { productoId: ids.conLista });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toContain('Banner con lista');
    expect(r.cuerpo.error.candidatas).toHaveLength(1);
    const lArchivada = (await buscar(dueno, 'banner')).find((i) => i.nombre === 'Banner con lista');
    await datosDe(dueno, 'lista_precio_archivar', { id: lArchivada.listaId });
    expect((await lista(dueno, 'Otra del mismo banner', { productoId: ids.conLista })).cuerpo.ok).toBe(true);
  });

  it('editar para enlazar un producto que ya tiene lista activa es conflicto; enlazar uno libre funciona', async () => {
    const suelta = (await lista(dueno, 'Suelta para enlazar')).cuerpo.datos;
    const choque = await confirmando(dueno, 'lista_precio_editar', { id: suelta.id, productoId: ids.conLista });
    expect(codigoDe(choque.respuesta)).toBe('conflicto');
    const libre = await confirmando(dueno, 'lista_precio_editar', { id: suelta.id, productoId: ids.sinPrecio });
    expect(libre.respuesta.cuerpo.datos).toMatchObject({ productoId: ids.sinPrecio, productoNombre: 'Banner sin precio' });
  });

  it('sin unidad, la lista toma la del producto; con unidad explícita, manda la explícita', async () => {
    const heredada = await lista(dueno, 'Hereda unidad', { productoId: ids.sinLista, unidad: undefined });
    expect(heredada.cuerpo.datos).toMatchObject({ unidad: 'und', productoNombre: 'Banner de catálogo' });
    const propia = await lista(dueno, 'Unidad propia', { productoId: ids.noAfecto, unidad: 'millar' });
    expect(propia.cuerpo.datos.unidad).toBe('millar');
    expect(codigoDe(await lista(dueno, 'Producto fantasma', { productoId: randomUUID() }))).toBe('no_encontrado');
  });
});

describe('listas_precio_listar por producto', () => {
  it('filtra por producto y por «sin producto»', async () => {
    const deProducto = (await datosDe(dueno, 'listas_precio_listar', { productoId: ids.sinLista })).items as any[];
    expect(deProducto.map((x) => x.nombre)).toEqual(['Hereda unidad']);
    const sueltas = (await datosDe(dueno, 'listas_precio_listar', { soloSinProducto: true })).items as any[];
    expect(sueltas.length).toBeGreaterThan(0);
    expect(sueltas.every((x) => x.productoId === null)).toBe(true);
    expect(sueltas.map((x) => x.nombre)).toContain('Troquel heredado');
    expect(codigoDe(await dueno.herramienta('listas_precio_listar', { productoId: 'no-es-uuid' }))).toBe('argumentos_invalidos');
  });
});
