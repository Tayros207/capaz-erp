import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../../pruebas/base-de-pruebas.js';
import { prepararCliente, type EntradaDeCliente } from '../domain/cliente.js';
import { prepararProducto } from '../../productos/domain/producto.js';
import { prepararSucursal } from '../../sucursales/domain/sucursal.js';
import { archivarCliente, buscarClientes, crearCliente, editarCliente, listarClientes, restaurarCliente, verCliente } from './clientes.repository.js';
import { archivarProducto, buscarProductos, crearProducto, editarProducto, listarProductos, restaurarProducto, verProducto } from '../../productos/repositories/productos.repository.js';
import { archivarSucursal, asegurarSucursalPrincipal, crearSucursal, editarSucursal, listarSucursales, marcarPrincipal } from '../../sucursales/repositories/sucursales.repository.js';

// Repositorios de datos maestros contra base real, con dos empresas (las pruebas no vacían tablas: ids únicos).

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
const A = empresaDePrueba();
const B = empresaDePrueba();
const ctxA = { empresaId: A, usuarioId: 'ua' };
const ctxB = { empresaId: B, usuarioId: 'ub' };

// SOLICITUD DE CAMBIO DE ESQUEMA: `capaz_app` no tiene USAGE sobre `public` (0000 revoca todo a PUBLIC) y
// `pg_trgm` vive ahí, así que `similarity` y `%` no se pueden usar. Mientras no se corrija, las pruebas de
// búsqueda por parecido se saltan (no se tapa con un grant local).
let hayTrgm = false;

beforeAll(async () => {
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
  hayTrgm = (await pool.query(`select has_schema_privilege('public', 'usage') as ok`)).rows[0].ok;
});
afterAll(() => pool.end());

const cli = (e: EntradaDeCliente) => {
  const r = prepararCliente(e);
  if (!r.ok) throw new Error(r.motivo);
  return r.datos;
};
const prod = (nombre: string, extra: Record<string, unknown> = {}) => {
  const r = prepararProducto({ nombre, tipo: 'producto', ...extra });
  if (!r.ok) throw new Error(r.motivo);
  return r.datos;
};

describe('clientes', () => {
  it('crea, ve y no cruza empresas', async () => {
    const r = await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'persona', nombre: 'José Pérez', documentoTipo: 'dni', documentoNumero: '11111111' })));
    expect(r.creado).toBe(true);
    const id = (r as { cliente: { id: string } }).cliente.id;
    expect((await conEmpresa(ctxA, (tx) => verCliente(tx, ctxA, id)))?.creadoPor).toBe('ua');
    expect(await conEmpresa(ctxB, (tx) => verCliente(tx, ctxB, id))).toBeNull();
    // el mismo nombre y documento en otra empresa sí se puede
    const rb = await conEmpresa(ctxB, (tx) => crearCliente(tx, ctxB, cli({ clase: 'persona', nombre: 'José Pérez', documentoTipo: 'dni', documentoNumero: '11111111' })));
    expect(rb.creado).toBe(true);
  });

  it('un nombre o documento repetido devuelve el existente como conflicto', async () => {
    await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'empresa', nombre: 'Textiles Sol', documentoTipo: 'ruc', documentoNumero: '20111111111' })));
    const porNombre = await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'empresa', nombre: 'TEXTILES  sol' })));
    expect(porNombre).toMatchObject({ creado: false, conflicto: 'nombre' });
    const porDoc = await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'empresa', nombre: 'Otra', documentoTipo: 'ruc', documentoNumero: '20111111111' })));
    expect(porDoc).toMatchObject({ creado: false, conflicto: 'documento' });
    expect((porDoc as { existente: { nombre: string } }).existente.nombre).toBe('Textiles Sol');
  });

  it('edita, detecta choque al editar y rechaza id ajeno', async () => {
    const a = await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'persona', nombre: 'Edita Uno' })));
    const b = await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'persona', nombre: 'Edita Dos' })));
    const idA = (a as { cliente: { id: string } }).cliente.id;
    const ok = await conEmpresa(ctxA, (tx) => editarCliente(tx, ctxA, idA, cli({ clase: 'persona', nombre: 'Edita Uno Bis', telefono: '999 888 777' })));
    expect(ok).toMatchObject({ cliente: { nombre: 'Edita Uno Bis', telefono: '999888777' } });
    const choque = await conEmpresa(ctxA, (tx) => editarCliente(tx, ctxA, idA, cli({ clase: 'persona', nombre: 'edita dos' })));
    expect(choque).toMatchObject({ conflicto: 'nombre' });
    expect(await conEmpresa(ctxB, (tx) => editarCliente(tx, ctxB, idA, cli({ clase: 'persona', nombre: 'X' })))).toBeNull();
    expect(b.creado).toBe(true);
  });

  it('archivar conserva el nombre; restaurar es idempotente; archivados no se buscan ni listan por defecto', async () => {
    const r = await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'persona', nombre: 'Archivable Zeta' })));
    const id = (r as { cliente: { id: string } }).cliente.id;
    await conEmpresa(ctxA, (tx) => archivarCliente(tx, ctxA, id));
    await conEmpresa(ctxA, (tx) => archivarCliente(tx, ctxA, id));
    expect(await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, cli({ clase: 'persona', nombre: 'Archivable Zeta' })))).toMatchObject({ creado: false, conflicto: 'nombre' });
    if (hayTrgm) expect(await conEmpresa(ctxA, (tx) => buscarClientes(tx, ctxA, 'archivable zeta', 5))).toEqual([]);
    const arch = await conEmpresa(ctxA, (tx) => listarClientes(tx, ctxA, { limite: 100, estado: 'archivados' }));
    expect((arch as { items: Array<{ id: string }> }).items.some((c) => c.id === id)).toBe(true);
    const rest = await conEmpresa(ctxA, (tx) => restaurarCliente(tx, ctxA, id));
    expect(rest?.archivadoEn).toBeNull();
    if (hayTrgm) expect((await conEmpresa(ctxA, (tx) => buscarClientes(tx, ctxA, 'archivable zeta', 5)))[0]?.id).toBe(id);
  });

  it('«Jose Perez» encuentra a «José Pérez» y no a otra empresa', async (t) => {
    if (!hayTrgm) t.skip();
    const q = 'jose perez';
    const deA = await conEmpresa(ctxA, (tx) => buscarClientes(tx, ctxA, q, 5));
    expect(deA[0]).toMatchObject({ nombre: 'José Pérez', parecido: 1 });
    expect(deA.every((c) => c.tenantId === A)).toBe(true);
    const parecido = await conEmpresa(ctxA, (tx) => buscarClientes(tx, ctxA, 'jose peres', 5));
    expect(parecido[0]?.nombre).toBe('José Pérez');
  });

  it('lista con cursor sin repetir ni saltar, en dos empresas', async () => {
    const E = empresaDePrueba();
    const ctx = { empresaId: E, usuarioId: 'u' };
    for (const n of ['Ana', 'Beto', 'Carla', 'Dora', 'Eva']) await conEmpresa(ctx, (tx) => crearCliente(tx, ctx, cli({ clase: 'persona', nombre: n })));
    const vistos: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 5; i++) {
      const p = await conEmpresa(ctx, (tx) => listarClientes(tx, ctx, { limite: 2, cursor }));
      if (p === 'cursor_invalido') throw new Error('cursor');
      vistos.push(...p.items.map((c) => c.nombre));
      if (!p.siguiente) break;
      cursor = p.siguiente;
    }
    expect(vistos).toEqual(['Ana', 'Beto', 'Carla', 'Dora', 'Eva']);
    expect(await conEmpresa(ctx, (tx) => listarClientes(tx, ctx, { limite: 2, cursor: 'basura' }))).toBe('cursor_invalido');
  });
});

describe('productos', () => {
  it('crea, choca por nombre y por código, y no cruza empresas', async () => {
    const r = await conEmpresa(ctxA, (tx) => crearProducto(tx, ctxA, prod('Polo Básico', { codigo: 'pol-1', precioUnitarioMilesimas: 25000 })));
    expect(r).toMatchObject({ creado: true, producto: { codigo: 'POL-1', precioUnitarioMilesimas: 25000 } });
    expect(await conEmpresa(ctxA, (tx) => crearProducto(tx, ctxA, prod('polo basico')))).toMatchObject({ creado: false, conflicto: 'nombre' });
    expect(await conEmpresa(ctxA, (tx) => crearProducto(tx, ctxA, prod('Otro', { codigo: 'POL-1' })))).toMatchObject({ creado: false, conflicto: 'codigo' });
    expect((await conEmpresa(ctxB, (tx) => crearProducto(tx, ctxB, prod('Polo Básico', { codigo: 'POL-1' })))).creado).toBe(true);
    const id = (r as { producto: { id: string } }).producto.id;
    expect(await conEmpresa(ctxB, (tx) => verProducto(tx, ctxB, id))).toBeNull();
  });

  it('edita, archiva (libera el nombre), restaura con choque y busca', async () => {
    const r = await conEmpresa(ctxA, (tx) => crearProducto(tx, ctxA, prod('Camisa Lino')));
    const id = (r as { producto: { id: string } }).producto.id;
    expect(await conEmpresa(ctxA, (tx) => editarProducto(tx, ctxA, id, prod('Camisa Lino', { precioUnitarioMilesimas: 5000 })))).toMatchObject({ producto: { precioUnitarioMilesimas: 5000 } });
    await conEmpresa(ctxA, (tx) => archivarProducto(tx, ctxA, id));
    if (hayTrgm) expect(await conEmpresa(ctxA, (tx) => buscarProductos(tx, ctxA, 'camisa lino', 5))).toEqual([]);
    expect((await conEmpresa(ctxA, (tx) => crearProducto(tx, ctxA, prod('Camisa Lino')))).creado).toBe(true);
    expect(await conEmpresa(ctxA, (tx) => restaurarProducto(tx, ctxA, id))).toMatchObject({ conflicto: 'nombre' });
    const lista = await conEmpresa(ctxA, (tx) => listarProductos(tx, ctxA, { limite: 100, estado: 'archivados' }));
    expect((lista as { items: Array<{ id: string }> }).items.map((p) => p.id)).toContain(id);
    if (hayTrgm) expect((await conEmpresa(ctxA, (tx) => buscarProductos(tx, ctxA, 'camisa lin', 5)))[0]?.nombre).toBe('Camisa Lino');
  });
});

describe('sucursales', () => {
  const suc = (codigo: string, nombre = 'S') => {
    const r = prepararSucursal({ codigo, nombre });
    if (!r.ok) throw new Error(r.motivo);
    return r.datos;
  };

  it('asegurarSucursalPrincipal crea PRI una sola vez y no pisa a una empresa que ya tiene sucursales', async () => {
    const E = empresaDePrueba();
    const ctx = { empresaId: E, usuarioId: 'u' };
    await conEmpresa(ctx, (tx) => asegurarSucursalPrincipal(tx, ctx));
    await conEmpresa(ctx, (tx) => asegurarSucursalPrincipal(tx, ctx));
    const lista = await conEmpresa(ctx, (tx) => listarSucursales(tx, ctx));
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ codigo: 'PRI', nombre: 'Principal', esPrincipal: true });
    const F = empresaDePrueba();
    const ctxF = { empresaId: F, usuarioId: 'u' };
    await conEmpresa(ctxF, (tx) => crearSucursal(tx, ctxF, suc('LIM')));
    await conEmpresa(ctxF, (tx) => asegurarSucursalPrincipal(tx, ctxF));
    expect((await conEmpresa(ctxF, (tx) => listarSucursales(tx, ctxF))).map((s) => s.codigo)).toEqual(['LIM']);
  });

  it('código repetido, archivar, principal y aislamiento', async () => {
    await conEmpresa(ctxA, (tx) => asegurarSucursalPrincipal(tx, ctxA));
    const lim = await conEmpresa(ctxA, (tx) => crearSucursal(tx, ctxA, suc('LIM', 'Lima')));
    expect(lim.creada).toBe(true);
    expect(await conEmpresa(ctxA, (tx) => crearSucursal(tx, ctxA, suc('LIM')))).toMatchObject({ creada: false });
    const id = (lim as { sucursal: { id: string } }).sucursal.id;
    expect(await conEmpresa(ctxA, (tx) => editarSucursal(tx, ctxA, id, { nombre: 'Lima Centro', direccion: 'Jr. X', telefono: null }))).toMatchObject({ nombre: 'Lima Centro' });
    expect(await conEmpresa(ctxB, (tx) => editarSucursal(tx, ctxB, id, { nombre: 'x', direccion: null, telefono: null }))).toBeNull();

    const principal = (await conEmpresa(ctxA, (tx) => listarSucursales(tx, ctxA)))[0]!;
    expect(principal.esPrincipal).toBe(true);
    expect(await conEmpresa(ctxA, (tx) => archivarSucursal(tx, ctxA, principal.id))).toBe('es_principal');

    const nueva = await conEmpresa(ctxA, (tx) => marcarPrincipal(tx, ctxA, id));
    expect(nueva).toMatchObject({ esPrincipal: true });
    const tras = await conEmpresa(ctxA, (tx) => listarSucursales(tx, ctxA));
    expect(tras.filter((s) => s.esPrincipal)).toHaveLength(1);
    expect(await conEmpresa(ctxA, (tx) => archivarSucursal(tx, ctxA, principal.id))).toMatchObject({ archivadoEn: expect.any(Date) });
    expect(await conEmpresa(ctxA, (tx) => marcarPrincipal(tx, ctxA, principal.id))).toBe('archivada');
    expect((await conEmpresa(ctxA, (tx) => listarSucursales(tx, ctxA))).map((s) => s.codigo)).not.toContain('PRI');
  });
});
