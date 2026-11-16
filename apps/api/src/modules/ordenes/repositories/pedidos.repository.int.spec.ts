import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { prepararCliente } from '../../../core/clientes/domain/cliente.js';
import { crearCliente } from '../../../core/clientes/repositories/clientes.repository.js';
import { activarModulo } from '../../../core/herramientas/http-de-pruebas.js';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../../pruebas/base-de-pruebas.js';
import { prepararLineas } from '../domain/pedido.js';
import { actualizarPedido, crearPedido, historialDe, lineasDe, listarPedidos, pedidoPorOrigen, reemplazarLineas, registrarEvento, verPedido, type DatosDePedido } from './pedidos.repository.js';
import { pedidosConEntrega, resumenDePedidos } from './resumen.repository.js';

// Repositorio de pedidos contra la base real, con dos empresas (ids únicos: las pruebas no vacían tablas).

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
const A = empresaDePrueba();
const B = empresaDePrueba();
const ctxA = { empresaId: A, usuarioId: 'ana' };
const ctxA2 = { empresaId: A, usuarioId: 'beto' };
const ctxB = { empresaId: B, usuarioId: 'carla' };
let clienteA: string;
let clienteB: string;

const datosDe = (clienteId: string, extra: Partial<DatosDePedido> = {}): DatosDePedido => ({
  clienteId, fecha: '2026-03-01', entregaEl: null, responsableId: null, notas: null, sucursalId: null, origenTipo: null, origenId: null, igvPorcentaje: 18, ...extra,
});
const lineas = (...soles: number[]) => {
  const r = prepararLineas(soles.map((s, i) => ({ descripcion: `Línea ${i}`, cantidadMilesimas: 1000, precioUnitarioMilesimas: s * 1000 })), new Map(), 18);
  if (!r.ok) throw new Error(r.motivo);
  return r;
};
async function nuevoCliente(ctx: typeof ctxA, nombre: string): Promise<string> {
  const p = prepararCliente({ clase: 'empresa', nombre });
  if (!p.ok) throw new Error(p.motivo);
  const r = await conEmpresa(ctx, (tx) => crearCliente(tx, ctx, p.datos));
  if (!r.creado) throw new Error('No se creó el cliente de prueba.');
  return r.cliente.id;
}
/** Crea un pedido con sus líneas, como lo hace `pedido_crear`. */
async function nuevoPedido(ctx: typeof ctxA, clienteId: string, extra: Partial<DatosDePedido> = {}, soles: number[] = [118]): Promise<string> {
  const l = lineas(...soles);
  return conEmpresa(ctx, async (tx) => {
    const id = await crearPedido(tx, ctx, datosDe(clienteId, extra), l);
    if (!id) throw new Error('No se creó el pedido de prueba.');
    await reemplazarLineas(tx, ctx, id, l.lineas);
    await registrarEvento(tx, ctx, id, { tipo: 'creado', estadoNuevo: 'borrador' });
    return id;
  });
}

beforeAll(async () => {
  const owner = abrirPool('owner');
  // El catálogo lo siembra el servidor al arrancar; aquí no hay servidor.
  await owner.query(`insert into core.modulos (codigo, nombre) values ('ordenes', 'Pedidos') on conflict do nothing`);
  await owner.end();
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
  await Promise.all([activarModulo(A, 'ordenes'), activarModulo(B, 'ordenes')]);
  clienteA = await nuevoCliente(ctxA, 'Cliente A');
  clienteB = await nuevoCliente(ctxB, 'Cliente B');
});
afterAll(() => pool.end());

describe('pedidos.repository', () => {
  it('crea con líneas y totales, lo ve su empresa y no la otra (ni con el contexto cambiado)', async () => {
    const id = await nuevoPedido(ctxA, clienteA, {}, [118, 0.1]);
    const p = await conEmpresa(ctxA, (tx) => verPedido(tx, ctxA, id, { alcance: 'todos' }));
    expect(p).toMatchObject({ estado: 'borrador', numero: null, clienteNombre: 'Cliente A', lineas: 2, subtotalCentimos: 10_008, igvCentimos: 1_802, totalCentimos: 11_810, creadoPor: 'ana' });
    expect(await conEmpresa(ctxB, (tx) => verPedido(tx, ctxB, id, { alcance: 'todos' }))).toBeNull();
    expect(await conEmpresa(ctxB, (tx) => verPedido(tx, ctxB, id, { alcance: 'todos', bloquear: true }))).toBeNull();
    expect(await conEmpresa(ctxB, (tx) => lineasDe(tx, ctxB, id))).toEqual([]);
    expect(await conEmpresa(ctxB, (tx) => historialDe(tx, ctxB, id))).toEqual([]);
    // Defensa en profundidad: aun dentro de la transacción de A, un contexto de B no encuentra nada.
    expect(await conEmpresa(ctxA, (tx) => verPedido(tx, ctxB, id, { alcance: 'todos' }))).toBeNull();
    // La llave compuesta impide un pedido de B con un cliente de A.
    await expect(nuevoPedido(ctxB, clienteA)).rejects.toThrow();
  });

  it('reemplazar líneas borra las anteriores y conserva el orden', async () => {
    const id = await nuevoPedido(ctxA, clienteA, {}, [10, 20, 30]);
    await conEmpresa(ctxA, (tx) => reemplazarLineas(tx, ctxA, id, lineas(7, 8).lineas));
    const l = await conEmpresa(ctxA, (tx) => lineasDe(tx, ctxA, id));
    expect(l.map((x) => [x.posicion, x.importeCentimos])).toEqual([[0, 700], [1, 800]]);
    await conEmpresa(ctxA, (tx) => reemplazarLineas(tx, ctxA, id, []));
    expect(await conEmpresa(ctxA, (tx) => lineasDe(tx, ctxA, id))).toEqual([]);
  });

  it('alcance «propios»: solo lo creado por la persona o a su cargo', async () => {
    const deAna = await nuevoPedido(ctxA, clienteA);
    const aCargoDeBeto = await nuevoPedido(ctxA, clienteA, { responsableId: 'beto' });
    const ver = (id: string) => conEmpresa(ctxA2, (tx) => verPedido(tx, ctxA2, id, { alcance: 'propios', bloquear: true }));
    expect(await ver(deAna)).toBeNull();
    expect((await ver(aCargoDeBeto))?.id).toBe(aCargoDeBeto);
    const lista = await conEmpresa(ctxA2, (tx) => listarPedidos(tx, ctxA2, 'propios', { limite: 100, estado: 'todos' }));
    expect(lista).toMatchObject({ items: [{ id: aCargoDeBeto }], siguiente: null });
  });

  it('listado por páginas, filtros y cursor inválido; la otra empresa solo ve lo suyo', async () => {
    const suyo = await nuevoPedido(ctxB, clienteB, { entregaEl: '2026-03-10' });
    const otro = await nuevoPedido(ctxB, clienteB, { entregaEl: '2026-04-10' });
    const listar = (f: Record<string, unknown>) => conEmpresa(ctxB, (tx) => listarPedidos(tx, ctxB, 'todos', { limite: 1, estado: 'abiertos', ...f }));
    const p1 = await listar({});
    if (p1 === 'cursor_invalido') throw new Error('cursor');
    expect(p1.items.map((p) => p.id)).toEqual([otro]);
    const p2 = await listar({ cursor: p1.siguiente! });
    expect(p2).toMatchObject({ items: [{ id: suyo }], siguiente: null });
    expect(await listar({ cursor: 'basura' })).toBe('cursor_invalido');
    expect(await listar({ entregaHasta: '2026-03-31', limite: 10 })).toMatchObject({ items: [{ id: suyo }] });
    expect(await listar({ estado: 'entregado', limite: 10 })).toMatchObject({ items: [] });
  });

  it('un origen vivo no se repite: crear devuelve null y se puede explicar el choque', async () => {
    const origen = { origenTipo: 'cotizacion', origenId: 'cot-1' };
    const id = await nuevoPedido(ctxA, clienteA, origen);
    expect(await conEmpresa(ctxA, (tx) => crearPedido(tx, ctxA, datosDe(clienteA, origen), lineas()))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => pedidoPorOrigen(tx, ctxA, 'cotizacion', 'cot-1'))).toMatchObject({ id, numero: null });
    // El mismo origen en otra empresa no choca.
    expect(await nuevoPedido(ctxB, clienteB, origen)).toBeTruthy();
  });

  it('actualizar no alcanza un pedido de otra empresa y la base rechaza totales que no cuadran', async () => {
    const id = await nuevoPedido(ctxA, clienteA);
    await expect(conEmpresa(ctxB, (tx) => actualizarPedido(tx, ctxB, id, { notas: 'intruso' }))).rejects.toThrow();
    await expect(conEmpresa(ctxA, (tx) => actualizarPedido(tx, ctxA, id, { subtotalCentimos: 100, igvCentimos: 18, totalCentimos: 100 }))).rejects.toThrow();
    // Sin número no puede quedar confirmado (CHECK de la base).
    await expect(conEmpresa(ctxA, (tx) => actualizarPedido(tx, ctxA, id, { estado: 'confirmado' }))).rejects.toThrow();
    expect((await conEmpresa(ctxA, (tx) => verPedido(tx, ctxA, id, { alcance: 'todos' })))?.notas).toBeNull();
  });

  it('el resumen y los candidatos de entrega son por empresa', async () => {
    const C = empresaDePrueba();
    const ctxC = { empresaId: C, usuarioId: 'dora' };
    await activarModulo(C, 'ordenes');
    const clienteC = await nuevoCliente(ctxC, 'Cliente C');
    const id = await nuevoPedido(ctxC, clienteC, { entregaEl: '2026-03-05' });
    await conEmpresa(ctxC, (tx) => actualizarPedido(tx, ctxC, id, { estado: 'confirmado', numero: 1, serie: 'PRI', anio: 2026, confirmadoAhora: true }));
    const r = await conEmpresa(ctxC, (tx) => resumenDePedidos(tx, { desde: '2026-03-01', hasta: '2026-03-31', hoy: '2026-03-06', zona: 'America/Lima' }));
    expect(r.porEstado.find((e) => e.estado === 'confirmado')).toEqual({ estado: 'confirmado', cantidad: 1, totalCentimos: 11_800 });
    expect(r).toMatchObject({ atrasados: 1, entregasDeHoy: 0 });
    expect((await conEmpresa(ctxC, (tx) => pedidosConEntrega(tx))).map((p) => p.id)).toEqual([id]);
  });
});
