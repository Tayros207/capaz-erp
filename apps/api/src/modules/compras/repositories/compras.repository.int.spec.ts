import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type pg from 'pg';
import { prepararCliente } from '../../../core/clientes/domain/cliente.js';
import { crearCliente } from '../../../core/clientes/repositories/clientes.repository.js';
import { activarModulo } from '../../../core/herramientas/http-de-pruebas.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../../pruebas/base-de-pruebas.js';
import { prepararLineas } from '../domain/orden.js';
import { prepararRecepcion } from '../domain/recepcion.js';
import { actualizarCompra, crearCompra, lineasDe, listarCompras, reemplazarLineas, verCompra, type DatosDeCompra } from './compras.repository.js';
import { contarRecepciones, recepcionesDe, registrarRecepcion } from './recepciones.repository.js';
import { comprasConEntrega, resumenDeCompras } from './resumen.repository.js';

// Repositorio de compras contra la base real, con dos empresas (ids únicos: las pruebas no vacían tablas).

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
const A = empresaDePrueba();
const B = empresaDePrueba();
const ctxA = { empresaId: A, usuarioId: 'ana' };
const ctxA2 = { empresaId: A, usuarioId: 'beto' };
const ctxB = { empresaId: B, usuarioId: 'carla' };
let proveedorA: string;
let proveedorB: string;

const datosDe = (proveedorId: string, extra: Partial<DatosDeCompra> = {}): DatosDeCompra => ({
  proveedorId, fecha: '2026-03-01', entregaEl: null, notas: null, sucursalId: null, igvPorcentaje: 18, ...extra,
});
/** Líneas sin producto de 10 unidades al costo indicado (en soles, IGV incluido). */
const lineas = (...soles: number[]) => {
  const r = prepararLineas(soles.map((s, i) => ({ descripcion: `Insumo ${i}`, cantidadMilesimas: 10_000, costoUnitarioMilesimas: Math.round(s * 1000) })), new Map(), 18);
  if (!r.ok) throw new Error(r.motivo);
  return r;
};
async function nuevoProveedor(ctx: typeof ctxA, nombre: string): Promise<string> {
  const p = prepararCliente({ clase: 'empresa', nombre, tipo: 'proveedor' });
  if (!p.ok) throw new Error(p.motivo);
  const r = await conEmpresa(ctx, (tx) => crearCliente(tx, ctx, p.datos));
  if (!r.creado) throw new Error('No se creó el proveedor de prueba.');
  return r.cliente.id;
}
/** Crea una orden con sus líneas, como `compra_crear`; con `enviada` la deja enviada con número. */
async function nuevaOrden(ctx: typeof ctxA, proveedorId: string, extra: Partial<DatosDeCompra> = {}, soles: number[] = [11.8], enviada = false): Promise<string> {
  const l = lineas(...soles);
  return conEmpresa(ctx, async (tx) => {
    const id = await crearCompra(tx, ctx, datosDe(proveedorId, extra), l);
    await reemplazarLineas(tx, ctx, id, l.lineas);
    if (enviada) await actualizarCompra(tx, ctx, id, { estado: 'enviada', numero: Math.floor(Math.random() * 1e9), serie: 'PRI', anio: 2026 });
    return id;
  });
}
/** Lo que hace `compra_recibir`: bloquea la orden, lee sus líneas, comprueba y registra. `pausa` deja la ventana abierta. */
const recibir = (ctx: typeof ctxA, ordenId: string, cantidades: number[], pausa = 0) =>
  conEmpresa(ctx, async (tx) => {
    await verCompra(tx, ctx, ordenId, { alcance: 'todos', bloquear: true });
    const ls = await lineasDe(tx, ctx, ordenId);
    if (pausa) await tx.execute(sql`select pg_sleep(${pausa})`);
    const p = prepararRecepcion(ls, cantidades.map((c, i) => ({ ordenLineaId: ls[i]!.id, cantidadMilesimas: c })));
    if (!p.ok) return p;
    const r = await registrarRecepcion(tx, ctx, ordenId, { fecha: '2026-03-02', nota: null }, p.lineas);
    await actualizarCompra(tx, ctx, ordenId, { estado: p.estadoNuevo });
    return { ok: true as const, ...r, estado: p.estadoNuevo };
  });

beforeAll(async () => {
  const owner = abrirPool('owner');
  // El catálogo lo siembra el servidor al arrancar; aquí no hay servidor. Compras exige Inventario.
  await owner.query(`insert into core.modulos (codigo, nombre) values ('insumos', 'Inventario'), ('compras', 'Compras') on conflict do nothing`);
  await owner.end();
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
  for (const e of [A, B]) {
    await activarModulo(e, 'insumos');
    await activarModulo(e, 'compras');
  }
  proveedorA = await nuevoProveedor(ctxA, 'Papelera A');
  proveedorB = await nuevoProveedor(ctxB, 'Papelera B');
});
afterAll(() => pool.end());

describe('compras.repository', () => {
  it('crea con líneas y totales, lo ve su empresa y no la otra (ni con el contexto cambiado)', async () => {
    const id = await nuevaOrden(ctxA, proveedorA, {}, [11.8, 0.01]);
    const c = await conEmpresa(ctxA, (tx) => verCompra(tx, ctxA, id, { alcance: 'todos' }));
    // 10 × 11.80 = 118.00 → 100.00 + 18.00 · 10 × 0.01 = 0.10 → 0.08 + 0.02.
    expect(c).toMatchObject({ estado: 'borrador', numero: null, proveedorNombre: 'Papelera A', lineas: 2, lineasPorRecibir: 2, subtotalCentimos: 10_008, igvCentimos: 1_802, totalCentimos: 11_810, creadoPor: 'ana' });
    expect(await conEmpresa(ctxB, (tx) => verCompra(tx, ctxB, id, { alcance: 'todos' }))).toBeNull();
    expect(await conEmpresa(ctxB, (tx) => verCompra(tx, ctxB, id, { alcance: 'todos', bloquear: true }))).toBeNull();
    expect(await conEmpresa(ctxB, (tx) => lineasDe(tx, ctxB, id))).toEqual([]);
    expect(await conEmpresa(ctxB, (tx) => recepcionesDe(tx, ctxB, id))).toEqual([]);
    expect(await conEmpresa(ctxA, (tx) => verCompra(tx, ctxB, id, { alcance: 'todos' }))).toBeNull();
    // La llave compuesta impide una orden de B con un proveedor de A.
    await expect(nuevaOrden(ctxB, proveedorA)).rejects.toThrow();
  });

  it('reemplazar líneas borra las anteriores y conserva el orden', async () => {
    const id = await nuevaOrden(ctxA, proveedorA, {}, [1, 2, 3]);
    await conEmpresa(ctxA, (tx) => reemplazarLineas(tx, ctxA, id, lineas(7, 8).lineas));
    expect((await conEmpresa(ctxA, (tx) => lineasDe(tx, ctxA, id))).map((x) => [x.posicion, x.importeCentimos])).toEqual([[0, 7_000], [1, 8_000]]);
    await conEmpresa(ctxA, (tx) => reemplazarLineas(tx, ctxA, id, []));
    expect(await conEmpresa(ctxA, (tx) => lineasDe(tx, ctxA, id))).toEqual([]);
  });

  it('alcance «propios»: solo lo creado por la persona', async () => {
    const deAna = await nuevaOrden(ctxA, proveedorA);
    const deBeto = await nuevaOrden(ctxA2, proveedorA);
    const ver = (id: string) => conEmpresa(ctxA2, (tx) => verCompra(tx, ctxA2, id, { alcance: 'propios', bloquear: true }));
    expect(await ver(deAna)).toBeNull();
    expect((await ver(deBeto))?.id).toBe(deBeto);
    const lista = await conEmpresa(ctxA2, (tx) => listarCompras(tx, ctxA2, 'propios', { limite: 100, estado: 'todas' }));
    expect(lista).toMatchObject({ items: [{ id: deBeto }], siguiente: null });
  });

  it('listado por páginas, filtros y cursor inválido; la otra empresa solo ve lo suyo', async () => {
    const vieja = await nuevaOrden(ctxB, proveedorB, { entregaEl: '2026-03-10' }, [1], true);
    const nueva = await nuevaOrden(ctxB, proveedorB, { entregaEl: '2026-04-10' });
    const listar = (f: Record<string, unknown>) => conEmpresa(ctxB, (tx) => listarCompras(tx, ctxB, 'todos', { limite: 1, estado: 'abiertas', ...f }));
    const p1 = await listar({});
    if (p1 === 'cursor_invalido') throw new Error('cursor');
    expect(p1.items.map((p) => p.id)).toEqual([nueva]);
    expect(await listar({ cursor: p1.siguiente! })).toMatchObject({ items: [{ id: vieja }], siguiente: null });
    expect(await listar({ cursor: 'basura' })).toBe('cursor_invalido');
    expect(await listar({ entregaHasta: '2026-03-31', limite: 10 })).toMatchObject({ items: [{ id: vieja }] });
    expect(await listar({ estado: 'por_recibir', limite: 10 })).toMatchObject({ items: [{ id: vieja }] });
    expect(await listar({ estado: 'recibida', limite: 10 })).toMatchObject({ items: [] });
  });

  it('actualizar no alcanza una orden de otra empresa y la base rechaza lo que no cuadra', async () => {
    const id = await nuevaOrden(ctxA, proveedorA);
    await expect(conEmpresa(ctxB, (tx) => actualizarCompra(tx, ctxB, id, { notas: 'intruso' }))).rejects.toThrow();
    await expect(conEmpresa(ctxA, (tx) => actualizarCompra(tx, ctxA, id, { subtotalCentimos: 100, igvCentimos: 18, totalCentimos: 100 }))).rejects.toThrow();
    // Sin número no puede quedar enviada; cancelada exige `cancelado_en` (CHECK de la base).
    await expect(conEmpresa(ctxA, (tx) => actualizarCompra(tx, ctxA, id, { estado: 'enviada' }))).rejects.toThrow();
    await expect(conEmpresa(ctxA, (tx) => actualizarCompra(tx, ctxA, id, { estado: 'cancelada' }))).rejects.toThrow();
    expect((await conEmpresa(ctxA, (tx) => verCompra(tx, ctxA, id, { alcance: 'todos' })))?.notas).toBeNull();
  });
});

describe('recepciones', () => {
  it('numera dentro de la orden, suma lo recibido y la deja recibida al completar', async () => {
    const id = await nuevaOrden(ctxA, proveedorA, {}, [1, 2], true);
    expect(await recibir(ctxA, id, [4_000, 10_000])).toMatchObject({ ok: true, numero: 1, estado: 'recibida_parcial' });
    expect(await recibir(ctxA, id, [6_000])).toMatchObject({ ok: true, numero: 2, estado: 'recibida' });
    expect((await conEmpresa(ctxA, (tx) => lineasDe(tx, ctxA, id))).map((l) => l.recibidoMilesimas)).toEqual([10_000, 10_000]);
    const r = await conEmpresa(ctxA, (tx) => recepcionesDe(tx, ctxA, id));
    expect(r.map((x) => [x.numero, x.lineas.map((l) => l.cantidadMilesimas)])).toEqual([[1, [4_000, 10_000]], [2, [6_000]]]);
    expect(await conEmpresa(ctxA, (tx) => contarRecepciones(tx, ctxA, id))).toBe(2);
    expect(await conEmpresa(ctxB, (tx) => contarRecepciones(tx, ctxB, id))).toBe(0);
    expect(await conEmpresa(ctxA, (tx) => verCompra(tx, ctxA, id, { alcance: 'todos' }))).toMatchObject({ estado: 'recibida', lineasPorRecibir: 0 });
  });

  it('dos recepciones simultáneas sobre la misma línea no pasan de lo pedido: la segunda espera y es conflicto', async () => {
    const id = await nuevaOrden(ctxA, proveedorA, {}, [1], true);
    const r = await Promise.all([recibir(ctxA, id, [6_000], 0.3), recibir(ctxA, id, [6_000], 0.3)]);
    expect(r.filter((x) => x.ok)).toHaveLength(1);
    expect(r.filter((x) => !x.ok)).toMatchObject([{ ok: false, codigo: 'conflicto', motivo: expect.stringMatching(/solo falta recibir 4/) }]);
    expect((await conEmpresa(ctxA, (tx) => lineasDe(tx, ctxA, id)))[0]!.recibidoMilesimas).toBe(6_000);
    expect(await conEmpresa(ctxA, (tx) => contarRecepciones(tx, ctxA, id))).toBe(1);
  });

  it('sin la comprobación, la base sigue sin dejar recibir más de lo pedido; una línea de otra orden no se toca', async () => {
    const id = await nuevaOrden(ctxA, proveedorA, {}, [1], true);
    const otra = await nuevaOrden(ctxA, proveedorA, {}, [1], true);
    const [linea] = await conEmpresa(ctxA, (tx) => lineasDe(tx, ctxA, id));
    const forzar = (ordenId: string, cantidad: number) =>
      conEmpresa(ctxA, (tx) => registrarRecepcion(tx, ctxA, ordenId, { fecha: '2026-03-02', nota: null }, [{ ordenLineaId: linea!.id, cantidadMilesimas: cantidad }]));
    await expect(forzar(id, 10_001)).rejects.toThrow();
    await expect(forzar(otra, 1_000)).rejects.toThrow();
    expect(await conEmpresa(ctxA, (tx) => contarRecepciones(tx, ctxA, otra))).toBe(0);
  });

  it('capaz_app no edita ni borra recepciones, ni borra una orden', async () => {
    const id = await nuevaOrden(ctxA, proveedorA, {}, [1], true);
    await recibir(ctxA, id, [1_000]);
    await expect(comoEmpresa(pool, A, (c) => c.query(`update compras.recepciones set nota = 'x' where orden_id = $1`, [id]))).rejects.toThrow();
    await expect(comoEmpresa(pool, A, (c) => c.query('delete from compras.recepciones where orden_id = $1', [id]))).rejects.toThrow();
    await expect(comoEmpresa(pool, A, (c) => c.query(`update compras.recepcion_lineas set cantidad_milesimas = 1 where tenant_id = $1`, [A]))).rejects.toThrow();
    await expect(comoEmpresa(pool, A, (c) => c.query('delete from compras.ordenes where id = $1', [id]))).rejects.toThrow();
  });
});

describe('resumen y candidatos de entrega', () => {
  it('son por empresa', async () => {
    const C = empresaDePrueba();
    const ctxC = { empresaId: C, usuarioId: 'dora' };
    await activarModulo(C, 'insumos');
    await activarModulo(C, 'compras');
    const proveedorC = await nuevoProveedor(ctxC, 'Proveedor C');
    const id = await nuevaOrden(ctxC, proveedorC, { entregaEl: '2026-03-05' }, [11.8, 0.01], true);
    await nuevaOrden(ctxC, proveedorC, { fecha: '2026-03-02' });
    await recibir(ctxC, id, [3_000, 500]);
    const r = await conEmpresa(ctxC, (tx) => resumenDeCompras(tx, { desde: '2026-03-01', hasta: '2026-03-31', hoy: '2026-03-06' }));
    expect(r.porEstado.find((e) => e.estado === 'recibida_parcial')).toEqual({ estado: 'recibida_parcial', cantidad: 1, totalCentimos: 11_810 });
    expect(r.porEstado.find((e) => e.estado === 'borrador')).toMatchObject({ cantidad: 1 });
    // 3 × 11.80 = 35.40 · 0.5 × 0.01 = 0.005 → 0.01 (mitad hacia arriba, como `importe`).
    expect(r).toMatchObject({ compradas: 1, totalCompradoCentimos: 11_810, recepciones: 1, recibidoCentimos: 3_541, porRecibir: 1, atrasadas: 1 });
    expect((await conEmpresa(ctxC, (tx) => comprasConEntrega(tx))).map((p) => p.id)).toEqual([id]);
    expect((await conEmpresa(ctxA, (tx) => comprasConEntrega(tx))).map((p) => p.id)).not.toContain(id);
  });
});
