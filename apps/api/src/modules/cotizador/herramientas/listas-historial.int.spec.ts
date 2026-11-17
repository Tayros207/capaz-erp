import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, conEmpresaDePruebas } from '../../../pruebas/base-de-pruebas.js';
import { fijarOrigenDeLista } from '../repositories/listas-origen.repository.js';
import { codigoDe, confirmando, crearCliente, datosDe, LISTA_C7, manual } from './pruebas-de-cotizador.js';

// Historial por producto (lista_precio_historial) y origen de la lista (fijarOrigenDeLista), con dos empresas.

let app: AppDePruebas;
let appPool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let dueno: Sesion;
let propio: Sesion; // member de A con alcance «propios»
let ajeno: Sesion;
let A: string;
let cliente: string;
let lista: any;

const deLista = (listaId: string, cantidad = 1_000_000) => ({ tipo: 'lista' as const, listaId, cantidadMilesimas: cantidad });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(appPool);
  [dueno, propio, ajeno] = await Promise.all(['Dueña', 'Propio', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Historial A');
  const B = await crearEmpresa(ajeno, 'Historial B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, propio, { modulo: 'cotizador', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  lista = await datosDe(dueno, 'lista_precio_crear', LISTA_C7);
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('lista_precio_historial', () => {
  it('sin cotizaciones: vacío y sin origen', async () => {
    expect(await datosDe(dueno, 'lista_precio_historial', { id: lista.id })).toEqual({ origen: null, items: [], siguiente: null });
    expect(lista.origen).toBeNull();
  });

  it('devuelve las cotizaciones con líneas de la lista, de la más reciente a la más antigua, y no las que solo tienen líneas manuales', async () => {
    const primera = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Primera', clienteId: cliente, lineas: [deLista(lista.id, 2_000_000)] });
    const segunda = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Segunda', clienteId: cliente, lineas: [deLista(lista.id)] });
    await datosDe(dueno, 'cotizacion_crear', { titulo: 'Manual', lineas: [manual('x', 5)] });
    const h = await datosDe(dueno, 'lista_precio_historial', { id: lista.id });
    expect(h.items.map((i: any) => i.titulo)).toEqual(['Segunda', 'Primera']);
    expect(h.items[1]).toMatchObject({
      cotizacionId: primera.id, codigo: 'Borrador', estado: 'borrador', clienteNombre: 'Imprenta Sol', version: 1, cantidadMilesimas: 2_000_000,
      importeCentimos: primera.lineas[0].importeCentimos, precioUnitarioMilesimas: primera.lineas[0].precioUnitarioMilesimas,
    });
    expect(h.items[0].cotizacionId).toBe(segunda.id);
    const emitida = (await confirmando(dueno, 'cotizacion_emitir', { id: segunda.id })).respuesta.cuerpo.datos;
    const otra = await datosDe(dueno, 'lista_precio_historial', { id: lista.id });
    expect(otra.items.find((i: any) => i.cotizacionId === segunda.id)).toMatchObject({ codigo: emitida.codigo, estado: 'emitida' });
  });

  it('pagina con cursor sin repetir ni saltar; el límite máximo es 50 y un cursor roto se rechaza', async () => {
    const p1 = await datosDe(dueno, 'lista_precio_historial', { id: lista.id, limite: 1 });
    expect(p1.items).toHaveLength(1);
    expect(p1.siguiente).toBeTruthy();
    const p2 = await datosDe(dueno, 'lista_precio_historial', { id: lista.id, limite: 1, cursor: p1.siguiente });
    expect(p2.items).toHaveLength(1);
    expect(p2.siguiente).toBeNull();
    expect([p1.items[0].titulo, p2.items[0].titulo]).toEqual(['Segunda', 'Primera']);
    expect(codigoDe(await dueno.herramienta('lista_precio_historial', { id: lista.id, limite: 51 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('lista_precio_historial', { id: lista.id, cursor: 'zzz' }))).toBe('argumentos_invalidos');
  });

  it('aislamiento: otra empresa no ve la lista; con alcance «propios» solo se ven las cotizaciones propias', async () => {
    expect(codigoDe(await ajeno.herramienta('lista_precio_historial', { id: lista.id }))).toBe('no_encontrado');
    expect(codigoDe(await dueno.herramienta('lista_precio_historial', { id: randomUUID() }))).toBe('no_encontrado');
    expect((await datosDe(propio, 'lista_precio_historial', { id: lista.id })).items).toEqual([]);
    await datosDe(propio, 'cotizacion_crear', { titulo: 'Suya', lineas: [deLista(lista.id)] });
    expect((await datosDe(propio, 'lista_precio_historial', { id: lista.id })).items.map((i: any) => i.titulo)).toEqual(['Suya']);
    expect((await datosDe(dueno, 'lista_precio_historial', { id: lista.id })).items).toHaveLength(3);
  });
});

describe('fijarOrigenDeLista', () => {
  it('fija el origen, lo devuelven lista_precio_ver y listas_precio_listar con el código, y rechaza cotizaciones de otra empresa', async () => {
    const cuadro = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Por partes', clienteId: cliente, lineas: [manual('Parte', 100)] });
    const emitida = (await confirmando(dueno, 'cotizacion_emitir', { id: cuadro.id })).respuesta.cuerpo.datos;
    const ctx = { empresaId: A, usuarioId: dueno.usuarioId };
    expect(await conEmpresa(ctx, (tx) => fijarOrigenDeLista(tx, ctx, lista.id, { cotizacionId: cuadro.id, version: 1 }))).toBe(true);
    const esperado = { cotizacionId: cuadro.id, version: 1, codigo: emitida.codigo };
    expect((await datosDe(dueno, 'lista_precio_ver', { id: lista.id })).origen).toEqual(esperado);
    expect((await datosDe(dueno, 'listas_precio_listar', {})).items.find((i: any) => i.id === lista.id).origen).toEqual(esperado);
    expect((await datosDe(dueno, 'lista_precio_historial', { id: lista.id })).origen).toEqual(esperado);
    expect(await conEmpresa(ctx, (tx) => fijarOrigenDeLista(tx, ctx, lista.id, { cotizacionId: randomUUID(), version: 1 }))).toBe(false);
    expect(await conEmpresa(ctx, (tx) => fijarOrigenDeLista(tx, ctx, randomUUID(), { cotizacionId: cuadro.id, version: 1 }))).toBe(false);
  });
});
