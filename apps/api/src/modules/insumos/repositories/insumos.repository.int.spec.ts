import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type pg from 'pg';
import { prepararProducto } from '../../../core/productos/domain/producto.js';
import { crearProducto } from '../../../core/productos/repositories/productos.repository.js';
import { asegurarSucursalPrincipal } from '../../../core/sucursales/repositories/sucursales.repository.js';
import { activarModulo } from '../../../core/herramientas/http-de-pruebas.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../../pruebas/base-de-pruebas.js';
import { movimientoManual } from '../domain/existencia.js';
import { registrarMovimiento } from '../herramientas/registrar-movimiento.js';
import { articulosActivosPorProducto, crearArticulo, existenciasDeArticulos, listarArticulos, verArticulo } from './articulos.repository.js';
import { cantidadActual, listarExistencias, sucursalParaMover, tomarExistencia } from './existencias.repository.js';
import { insertarMovimiento, listarMovimientos, movimientosDeOrigen } from './movimientos.repository.js';
import { cifrasDeInsumos } from './resumen.repository.js';

// Repositorios de inventario contra la base real, con dos empresas (ids únicos: las pruebas no vacían tablas).

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
const A = empresaDePrueba();
const B = empresaDePrueba();
const ctxA = { empresaId: A, usuarioId: 'ana' };
const ctxA2 = { empresaId: A, usuarioId: 'beto' };
const ctxB = { empresaId: B, usuarioId: 'carla' };
type Ctx = typeof ctxA;

async function nuevoProducto(ctx: Ctx, nombre: string, unidad = 'unidad'): Promise<string> {
  const p = prepararProducto({ nombre, tipo: 'producto', unidad });
  if (!p.ok) throw new Error(p.motivo);
  const r = await conEmpresa(ctx, (tx) => crearProducto(tx, ctx, p.datos));
  if (!r.creado) throw new Error('No se creó el producto de prueba.');
  return r.producto.id;
}
async function nuevoArticulo(ctx: Ctx, nombre: string, minimoMilesimas = 0, unidad = 'unidad'): Promise<string> {
  const productoId = await nuevoProducto(ctx, nombre, unidad);
  const id = await conEmpresa(ctx, (tx) => crearArticulo(tx, ctx, { productoId, unidad, minimoMilesimas }));
  if (!id) throw new Error('No se creó el artículo de prueba.');
  return id;
}
/** Un movimiento completo como lo hacen las herramientas: artículo bloqueado y principal. */
const mover = (ctx: Ctx, articuloId: string, tipo: 'entrada' | 'salida', cantidad: number, origen: { tipo: string; id: string } | null = null) =>
  conEmpresa(ctx, async (tx) => {
    const articulo = (await verArticulo(tx, ctx, articuloId, { bloquear: true }))!;
    const sucursal = (await sucursalParaMover(tx, ctx, undefined))!;
    return registrarMovimiento(tx, ctx, { articulo, sucursal, movimiento: movimientoManual(tipo, cantidad), costoUnitarioMilesimas: null, motivo: null, origen });
  });
const eventos = (empresaId: string, tipo: string) =>
  comoEmpresa(pool, empresaId, async (c) => (await c.query('select carga from core.eventos_salida where tipo = $1 order by creado_en, id', [tipo])).rows.map((r) => r.carga));
const principal = (ctx: Ctx) => conEmpresa(ctx, async (tx) => (await sucursalParaMover(tx, ctx, undefined))!);

beforeAll(async () => {
  const owner = abrirPool('owner');
  // El catálogo lo siembra el servidor al arrancar; aquí no hay servidor.
  await owner.query(`insert into core.modulos (codigo, nombre) values ('insumos', 'Inventario') on conflict do nothing`);
  await owner.end();
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
  await Promise.all([activarModulo(A, 'insumos'), activarModulo(B, 'insumos')]);
  await conEmpresa(ctxA, (tx) => asegurarSucursalPrincipal(tx, ctxA));
  await conEmpresa(ctxB, (tx) => asegurarSucursalPrincipal(tx, ctxB));
});
afterAll(() => pool.end());

describe('artículos', () => {
  it('se crean una vez por producto; su empresa los ve y la otra no (ni con el contexto cambiado)', async () => {
    const productoId = await nuevoProducto(ctxA, 'Papel bond A4', 'paquete');
    const id = await conEmpresa(ctxA, (tx) => crearArticulo(tx, ctxA, { productoId, unidad: 'paquete', minimoMilesimas: 5_000 }));
    expect(id).toBeTruthy();
    expect(await conEmpresa(ctxA, (tx) => crearArticulo(tx, ctxA, { productoId, unidad: 'paquete', minimoMilesimas: 0 }))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => verArticulo(tx, ctxA, id!))).toMatchObject({ nombre: 'Papel bond A4', unidad: 'paquete', minimoMilesimas: 5_000, creadoPor: 'ana' });
    expect(await conEmpresa(ctxB, (tx) => verArticulo(tx, ctxB, id!, { bloquear: true }))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => verArticulo(tx, ctxB, id!))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => articulosActivosPorProducto(tx, ctxA, [productoId]))).toEqual(new Map([[productoId, id]]));
    expect(await conEmpresa(ctxB, (tx) => articulosActivosPorProducto(tx, ctxB, [productoId]))).toEqual(new Map());
    // La llave compuesta impide un artículo de B sobre un producto de A.
    await expect(conEmpresa(ctxB, (tx) => crearArticulo(tx, ctxB, { productoId, unidad: 'x', minimoMilesimas: 0 }))).rejects.toThrow();
  });

  it('el listado va por nombre, pagina con cursor, filtra bajo mínimo y no cruza empresas', async () => {
    const marca = `Lista ${Date.now()}`;
    const ids = [];
    for (const n of ['C', 'A', 'B']) ids.push(await nuevoArticulo(ctxA, `${marca} ${n}`, n === 'B' ? 1_000 : 0));
    const sucursal = await principal(ctxA);
    await conEmpresa(ctxA, (tx) => tomarExistencia(tx, ctxA, ids[2]!, sucursal.id));
    const pag1 = await conEmpresa(ctxA, (tx) => listarArticulos(tx, ctxA, { limite: 2, estado: 'activos', soloBajoMinimo: false, buscar: marca, buscarNormalizado: marca.toLowerCase() }));
    if (pag1 === 'cursor_invalido') throw new Error('cursor');
    expect(pag1.items.map((a) => a.nombre)).toEqual([`${marca} A`, `${marca} B`]);
    const pag2 = await conEmpresa(ctxA, (tx) => listarArticulos(tx, ctxA, { limite: 2, cursor: pag1.siguiente!, estado: 'activos', soloBajoMinimo: false, buscar: marca, buscarNormalizado: marca.toLowerCase() }));
    expect(pag2 !== 'cursor_invalido' && pag2.items.map((a) => a.nombre)).toEqual([`${marca} C`]);
    const bajos = await conEmpresa(ctxA, (tx) => listarArticulos(tx, ctxA, { limite: 10, estado: 'activos', soloBajoMinimo: true, buscar: marca, buscarNormalizado: marca.toLowerCase() }));
    expect(bajos !== 'cursor_invalido' && bajos.items.map((a) => a.nombre)).toEqual([`${marca} B`]);
    expect(await conEmpresa(ctxA, (tx) => listarArticulos(tx, ctxA, { limite: 2, cursor: 'basura', estado: 'activos', soloBajoMinimo: false }))).toBe('cursor_invalido');
    const deB = await conEmpresa(ctxB, (tx) => listarArticulos(tx, ctxB, { limite: 100, estado: 'todos', soloBajoMinimo: false }));
    expect(deB !== 'cursor_invalido' && deB.items.filter((a) => a.nombre.startsWith(marca))).toEqual([]);
  });
});

describe('existencias y movimientos', () => {
  it('entrada y salida cambian la existencia y dejan el movimiento con la existencia resultante', async () => {
    const id = await nuevoArticulo(ctxA, `Tinta ${Date.now()}`, 0, 'litro');
    expect(await mover(ctxA, id, 'entrada', 4_500)).toMatchObject({ ok: true, resultanteMilesimas: 4_500 });
    expect(await mover(ctxA2, id, 'salida', 1_500)).toMatchObject({ ok: true, resultanteMilesimas: 3_000 });
    expect(await mover(ctxA, id, 'salida', 5_000)).toEqual({ ok: false, motivo: 'faltante', mensaje: 'No alcanza: hay 3 litro y faltan 2 litro.' });
    const sucursal = await principal(ctxA);
    expect(await conEmpresa(ctxA, (tx) => cantidadActual(tx, ctxA, id, sucursal.id))).toBe(3_000);
    const r = await conEmpresa(ctxA, (tx) => listarMovimientos(tx, ctxA, 'todos', { limite: 10, articuloId: id }));
    if (r === 'cursor_invalido') throw new Error('cursor');
    expect(r.items.map((m) => [m.tipo, m.cantidadMilesimas, m.existenciaResultanteMilesimas, m.creadoPor])).toEqual([
      ['salida', -1_500, 3_000, 'beto'],
      ['entrada', 4_500, 4_500, 'ana'],
    ]);
    // Alcance «propios»: solo lo que registró esa persona.
    const propios = await conEmpresa(ctxA2, (tx) => listarMovimientos(tx, ctxA2, 'propios', { limite: 10, articuloId: id }));
    expect(propios !== 'cursor_invalido' && propios.items.map((m) => m.tipo)).toEqual(['salida']);
    // Otra empresa no ve ni la existencia ni el historial.
    expect(await conEmpresa(ctxB, (tx) => cantidadActual(tx, ctxB, id, sucursal.id))).toBe(0);
    const deB = await conEmpresa(ctxB, (tx) => listarMovimientos(tx, ctxB, 'todos', { limite: 10, articuloId: id }));
    expect(deB !== 'cursor_invalido' && deB.items).toEqual([]);
  });

  it('dos salidas a la vez sobre la misma existencia no la dejan negativa: la segunda espera la fila y ve el faltante', async () => {
    const id = await nuevoArticulo(ctxA, `Cartulina ${Date.now()}`);
    await mover(ctxA, id, 'entrada', 5_000);
    const sucursal = await principal(ctxA);
    let primeraTomada!: () => void;
    const tomada = new Promise<void>((r) => (primeraTomada = r));
    const primera = conEmpresa(ctxA, async (tx) => {
      // Solo la fila de existencia (sin el bloqueo del artículo): basta para turnar a la otra.
      await tomarExistencia(tx, ctxA, id, sucursal.id);
      primeraTomada();
      await tx.execute(sql`select pg_sleep(0.3)`);
      const articulo = (await verArticulo(tx, ctxA, id))!;
      return registrarMovimiento(tx, ctxA, { articulo, sucursal, movimiento: movimientoManual('salida', 3_000), costoUnitarioMilesimas: null, motivo: null, origen: null });
    });
    await tomada;
    const inicio = performance.now();
    const segunda = conEmpresa(ctxA2, async (tx) => {
      const articulo = (await verArticulo(tx, ctxA2, id))!;
      return registrarMovimiento(tx, ctxA2, { articulo, sucursal, movimiento: movimientoManual('salida', 3_000), costoUnitarioMilesimas: null, motivo: null, origen: null });
    });
    const [a, b] = await Promise.all([primera, segunda]);
    expect(performance.now() - inicio).toBeGreaterThan(200);
    expect(a).toMatchObject({ ok: true, resultanteMilesimas: 2_000 });
    expect(b).toEqual({ ok: false, motivo: 'faltante', mensaje: 'No alcanza: hay 2 unidad y faltan 1 unidad.' });
    expect(await conEmpresa(ctxA, (tx) => cantidadActual(tx, ctxA, id, sucursal.id))).toBe(2_000);
  });

  it('muchas salidas en paralelo nunca pasan de lo que había', async () => {
    const id = await nuevoArticulo(ctxA, `Grapas ${Date.now()}`);
    await mover(ctxA, id, 'entrada', 10_000);
    const r = await Promise.all(Array.from({ length: 6 }, () => mover(ctxA, id, 'salida', 3_000)));
    expect(r.filter((x) => x.ok)).toHaveLength(3);
    expect(r.filter((x) => !x.ok)).toHaveLength(3);
    const sucursal = await principal(ctxA);
    expect(await conEmpresa(ctxA, (tx) => cantidadActual(tx, ctxA, id, sucursal.id))).toBe(1_000);
  });

  it('un origen no trae dos veces el mismo artículo (único parcial)', async () => {
    const id = await nuevoArticulo(ctxA, `Sobres ${Date.now()}`);
    const origen = { tipo: 'recepcion', id: `rec-${Date.now()}` };
    expect(await mover(ctxA, id, 'entrada', 1_000, origen)).toMatchObject({ ok: true });
    expect(await mover(ctxA, id, 'entrada', 1_000, origen)).toEqual({ ok: false, motivo: 'origen_repetido' });
    const sucursal = await principal(ctxA);
    expect(await conEmpresa(ctxA, (tx) => cantidadActual(tx, ctxA, id, sucursal.id))).toBe(1_000);
    expect((await conEmpresa(ctxA, (tx) => movimientosDeOrigen(tx, ctxA, origen.tipo, origen.id))).map((m) => m.cantidadMilesimas)).toEqual([1_000]);
    expect(await conEmpresa(ctxB, (tx) => movimientosDeOrigen(tx, ctxB, origen.tipo, origen.id))).toEqual([]);
    // Sin origen, en cambio, no hay único: dos entradas iguales son dos movimientos.
    await conEmpresa(ctxA, async (tx) => {
      const base = { articuloId: id, sucursalId: sucursal.id, tipo: 'entrada' as const, cantidadMilesimas: 1, existenciaResultanteMilesimas: 1, costoUnitarioMilesimas: null, motivo: null, origenTipo: null, origenId: null };
      expect(await insertarMovimiento(tx, ctxA, base)).toBeTruthy();
      expect(await insertarMovimiento(tx, ctxA, base)).toBeTruthy();
      throw new Error('revertir');
    }).catch((e: Error) => expect(e.message).toBe('revertir'));
  });

  it('el historial no se edita ni se borra con capaz_app', async () => {
    const id = await nuevoArticulo(ctxA, `Cinta ${Date.now()}`);
    await mover(ctxA, id, 'entrada', 1_000);
    await expect(comoEmpresa(pool, A, (c) => c.query(`update insumos.movimientos set motivo = 'x' where articulo_id = $1`, [id]))).rejects.toThrow();
    await expect(comoEmpresa(pool, A, (c) => c.query('delete from insumos.movimientos where articulo_id = $1', [id]))).rejects.toThrow();
  });
});

describe('alerta de bajo mínimo y cifras', () => {
  it('emite existencia.bajo_minimo solo al cruzar hacia abajo, y existencia.movida en cada movimiento', async () => {
    const id = await nuevoArticulo(ctxA, `Pegamento ${Date.now()}`, 10_000);
    const sucursal = await principal(ctxA);
    await mover(ctxA, id, 'entrada', 12_000);
    await mover(ctxA, id, 'salida', 4_000); // 12 → 8: cruza
    await mover(ctxA, id, 'salida', 1_000); // 8 → 7: ya estaba bajo
    await mover(ctxA, id, 'entrada', 5_000); // 7 → 12: sube
    await mover(ctxA, id, 'salida', 2_000); // 12 → 10: en el mínimo, no bajo
    await mover(ctxA, id, 'salida', 1_000); // 10 → 9: cruza otra vez
    const bajos = (await eventos(A, 'existencia.bajo_minimo')).filter((c) => c.articuloId === id);
    expect(bajos).toEqual([
      { articuloId: id, sucursalId: sucursal.id, cantidadMilesimas: 8_000, minimoMilesimas: 10_000 },
      { articuloId: id, sucursalId: sucursal.id, cantidadMilesimas: 9_000, minimoMilesimas: 10_000 },
    ]);
    const movidas = (await eventos(A, 'existencia.movida')).filter((c) => c.articuloId === id);
    expect(movidas.map((c) => [c.tipo, c.cantidadMilesimas])).toEqual([['entrada', 12_000], ['salida', -4_000], ['salida', -1_000], ['entrada', 5_000], ['salida', -2_000], ['salida', -1_000]]);
    expect((await eventos(B, 'existencia.bajo_minimo')).filter((c) => c.articuloId === id)).toEqual([]);
    const existencias = await conEmpresa(ctxA, (tx) => existenciasDeArticulos(tx, ctxA, [id]));
    expect(existencias.get(id)).toEqual([{ articuloId: id, sucursalId: sucursal.id, sucursalCodigo: 'PRI', sucursalNombre: expect.any(String), cantidadMilesimas: 9_000 }]);
    const lista = await conEmpresa(ctxA, (tx) => listarExistencias(tx, ctxA, { limite: 100, soloBajoMinimo: true }));
    expect(lista !== 'cursor_invalido' && lista.items.some((e) => e.articuloId === id)).toBe(true);
  });

  it('las cifras cuentan artículos activos, bajo mínimo y movimientos del período de su empresa', async () => {
    const periodo = { desde: '2000-01-01', hasta: '2999-12-31', zona: 'America/Lima' };
    const a = await conEmpresa(ctxA, (tx) => cifrasDeInsumos(tx, periodo));
    expect(a.articulos).toBeGreaterThan(5);
    expect(a.articulosBajoMinimo).toBeGreaterThanOrEqual(2);
    expect(a.entradas).toBeGreaterThan(0);
    expect(a.salidas).toBeGreaterThan(0);
    expect(a.ajustes).toBe(0);
    expect(await conEmpresa(ctxA, (tx) => cifrasDeInsumos(tx, { ...periodo, desde: '1999-01-01', hasta: '1999-12-31' }))).toMatchObject({ entradas: 0, salidas: 0, ajustes: 0 });
    expect(await conEmpresa(ctxB, (tx) => cifrasDeInsumos(tx, periodo))).toEqual({ articulos: 0, articulosBajoMinimo: 0, existenciasBajoMinimo: 0, entradas: 0, salidas: 0, ajustes: 0 });
  });
});
