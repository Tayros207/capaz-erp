import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../../herramientas/http-de-pruebas.js';

// Maestros ampliados (0025) por HTTP real: ficha comercial, contactos y direcciones; categorías, ficha y unidades de producto.

let app: AppDePruebas;
let auth: pg.Pool;
let dueno: Sesion;
let miembro: Sesion; // member de A: nivel lectura en el núcleo
let ajeno: Sesion; // owner de B
let clienteId: string;
let productoId: string;

const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  [dueno, miembro, ajeno] = await Promise.all([abrirSesion(app, 'Dueña'), abrirSesion(app, 'Miembro'), abrirSesion(app, 'Ajena')]);
  const empresaA = await crearEmpresa(dueno, 'Empresa A ampliados');
  await crearEmpresa(ajeno, 'Empresa B ampliados');
  await auth.query('insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())', [
    randomUUID(),
    empresaA,
    miembro.usuarioId,
    'member',
  ]);
  expect((await miembro.pedir('POST', '/api/auth/organization/set-active', { organizationId: empresaA })).estado).toBe(200);
  clienteId = (await dueno.herramienta('clientes_crear', { nombre: 'Gráfica Sur SAC', documentoTipo: 'ruc', documentoNumero: '20123456789' })).cuerpo.datos.id;
  productoId = (await dueno.herramienta('productos_crear', { nombre: 'Papel bond A4', tipo: 'producto', unidad: 'unidad' })).cuerpo.datos.id;
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
});

describe('ficha comercial del cliente', () => {
  it('sin ficha devuelve los valores por defecto', async () => {
    const r = await dueno.herramienta('clientes_comercial_ver', { clienteId });
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { condicionPagoDias: 0, moneda: 'PEN', limiteCreditoCentimos: null, actualizadoEn: null } });
  });

  it('guarda solo lo indicado y conserva el resto', async () => {
    await dueno.herramienta('clientes_comercial_guardar', { clienteId, condicionPagoDias: 30, limiteCreditoCentimos: 500000 });
    const r = await dueno.herramienta('clientes_comercial_guardar', { clienteId, moneda: 'USD', banco: ' BCP ' });
    expect(r.cuerpo.datos).toMatchObject({ condicionPagoDias: 30, limiteCreditoCentimos: 500000, moneda: 'USD', banco: 'BCP' });
  });

  it('rechaza valores fuera de rango, un cuerpo vacío y un cliente que no existe', async () => {
    expect(codigo(await dueno.herramienta('clientes_comercial_guardar', { clienteId, condicionPagoDias: 400 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('clientes_comercial_guardar', { clienteId }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('clientes_comercial_guardar', { clienteId: randomUUID(), moneda: 'PEN' }))).toBe('no_encontrado');
  });

  it('otra empresa no ve ni toca la ficha, y un miembro de solo lectura no la edita', async () => {
    expect(codigo(await ajeno.herramienta('clientes_comercial_ver', { clienteId }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('clientes_comercial_guardar', { clienteId, moneda: 'PEN' }))).toBe('no_encontrado');
    expect((await miembro.herramienta('clientes_comercial_ver', { clienteId })).cuerpo.ok).toBe(true);
    expect((await miembro.herramienta('clientes_comercial_guardar', { clienteId, moneda: 'PEN' })).estado).toBe(403);
  });
});

describe('contactos del cliente', () => {
  let anaId: string;
  let luisId: string;

  it('crea contactos y solo uno es principal', async () => {
    const ana = await dueno.herramienta('clientes_contacto_guardar', { clienteId, nombre: 'Ana Rojas', cargo: 'Compras', telefono: '987 654 321', esPrincipal: true });
    expect(ana.cuerpo.datos).toMatchObject({ nombre: 'Ana Rojas', telefono: '987654321', esPrincipal: true });
    anaId = ana.cuerpo.datos.id;
    const luis = await dueno.herramienta('clientes_contacto_guardar', { clienteId, nombre: 'Luis Paz', correo: 'LUIS@Sur.pe', esPrincipal: true });
    luisId = luis.cuerpo.datos.id;
    const lista = (await dueno.herramienta('clientes_contactos_listar', { clienteId })).cuerpo.datos.items;
    expect(lista.map((c: any) => [c.nombre, c.esPrincipal])).toEqual([['Luis Paz', true], ['Ana Rojas', false]]);
    expect(lista[0].correo).toBe('luis@sur.pe');
  });

  it('corrige un contacto, valida teléfono y correo y no toca contactos ajenos', async () => {
    const r = await dueno.herramienta('clientes_contacto_guardar', { id: anaId, clienteId, nombre: 'Ana Rojas', cargo: 'Gerencia' });
    expect(r.cuerpo.datos.cargo).toBe('Gerencia');
    expect(codigo(await dueno.herramienta('clientes_contacto_guardar', { clienteId, nombre: 'X', telefono: '12' }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('clientes_contacto_guardar', { clienteId, nombre: 'X', correo: 'sin-arroba' }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('clientes_contacto_guardar', { id: randomUUID(), clienteId, nombre: 'X' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('clientes_contacto_eliminar', { id: anaId }))).toBe('no_encontrado');
  });

  it('elimina un contacto', async () => {
    expect((await dueno.herramienta('clientes_contacto_eliminar', { id: luisId })).cuerpo.ok).toBe(true);
    expect((await dueno.herramienta('clientes_contactos_listar', { clienteId })).cuerpo.datos.items).toHaveLength(1);
    expect(codigo(await dueno.herramienta('clientes_contacto_eliminar', { id: luisId }))).toBe('no_encontrado');
  });
});

describe('direcciones del cliente', () => {
  it('una sola principal por tipo y las de otros tipos no se afectan', async () => {
    const fiscal = await dueno.herramienta('clientes_direccion_guardar', { clienteId, tipo: 'fiscal', direccion: 'Jr. Unión 100', ciudad: 'Lima', esPrincipal: true });
    const e1 = await dueno.herramienta('clientes_direccion_guardar', { clienteId, direccion: 'Av. Industrial 450', esPrincipal: true });
    const e2 = await dueno.herramienta('clientes_direccion_guardar', { clienteId, direccion: 'Av. Argentina 20', esPrincipal: true });
    expect(e1.cuerpo.datos.tipo).toBe('entrega');
    const lista = (await dueno.herramienta('clientes_direcciones_listar', { clienteId })).cuerpo.datos.items;
    const principales = lista.filter((d: any) => d.esPrincipal).map((d: any) => d.id).sort();
    expect(principales).toEqual([fiscal.cuerpo.datos.id, e2.cuerpo.datos.id].sort());
  });

  it('valida, aísla por empresa y elimina', async () => {
    expect(codigo(await dueno.herramienta('clientes_direccion_guardar', { clienteId, direccion: '   ' }))).toBe('argumentos_invalidos');
    expect(codigo(await ajeno.herramienta('clientes_direcciones_listar', { clienteId }))).toBe('no_encontrado');
    const lista = (await dueno.herramienta('clientes_direcciones_listar', { clienteId })).cuerpo.datos.items;
    expect((await dueno.herramienta('clientes_direccion_eliminar', { id: lista[0].id })).cuerpo.ok).toBe(true);
    expect(codigo(await dueno.herramienta('clientes_direccion_eliminar', { id: lista[0].id }))).toBe('no_encontrado');
  });
});

describe('categorías de producto', () => {
  let papeleriaId: string;
  let bondId: string;

  it('crea un árbol, rechaza duplicados y ciclos', async () => {
    papeleriaId = (await dueno.herramienta('categorias_producto_guardar', { nombre: 'Papelería' })).cuerpo.datos.id;
    const bond = await dueno.herramienta('categorias_producto_guardar', { nombre: 'Papel bond', padreId: papeleriaId });
    bondId = bond.cuerpo.datos.id;
    expect(bond.cuerpo.datos.padreId).toBe(papeleriaId);
    expect(codigo(await dueno.herramienta('categorias_producto_guardar', { nombre: 'papeleria' }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('categorias_producto_guardar', { id: papeleriaId, nombre: 'Papelería', padreId: bondId }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('categorias_producto_guardar', { id: papeleriaId, nombre: 'Papelería', padreId: papeleriaId }))).toBe('argumentos_invalidos');
  });

  it('archivar la oculta de la lista y libera su nombre', async () => {
    await dueno.herramienta('categorias_producto_archivar', { id: bondId });
    expect((await dueno.herramienta('categorias_producto_listar', {})).cuerpo.datos.items.map((c: any) => c.nombre)).toEqual(['Papelería']);
    expect((await dueno.herramienta('categorias_producto_listar', { incluirArchivadas: true })).cuerpo.datos.items).toHaveLength(2);
    expect((await dueno.herramienta('categorias_producto_guardar', { nombre: 'Papel bond' })).cuerpo.ok).toBe(true);
  });

  it('otra empresa no ve las categorías', async () => {
    expect((await ajeno.herramienta('categorias_producto_listar', {})).cuerpo.datos.items).toEqual([]);
    expect(codigo(await ajeno.herramienta('categorias_producto_archivar', { id: papeleriaId }))).toBe('no_encontrado');
  });
});

describe('ficha de catálogo del producto', () => {
  it('sin ficha devuelve valores por defecto; guarda parcial y conserva el resto', async () => {
    const vacia = await dueno.herramienta('productos_ficha_ver', { productoId });
    expect(vacia.cuerpo.datos).toMatchObject({ vendible: true, comprable: true, sku: null, actualizadoEn: null });
    const cat = (await dueno.herramienta('categorias_producto_listar', {})).cuerpo.datos.items.find((c: any) => c.nombre === 'Papelería').id;
    await dueno.herramienta('productos_ficha_guardar', { productoId, sku: 'PAP-A4-75', marca: 'Chamex', categoriaId: cat });
    const r = await dueno.herramienta('productos_ficha_guardar', { productoId, costoMilesimas: 12500, pesoGramos: 2500.5, comprable: false });
    expect(r.cuerpo.datos).toMatchObject({ sku: 'PAP-A4-75', marca: 'Chamex', categoriaNombre: 'Papelería', costoMilesimas: 12500, pesoGramos: 2500.5, comprable: false });
  });

  it('rechaza SKU repetido, categoría ajena, valores negativos y producto inexistente', async () => {
    const otro = (await dueno.herramienta('productos_crear', { nombre: 'Tinta negra', tipo: 'producto' })).cuerpo.datos.id;
    expect(codigo(await dueno.herramienta('productos_ficha_guardar', { productoId: otro, sku: 'PAP-A4-75' }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('productos_ficha_guardar', { productoId: otro, categoriaId: randomUUID() }))).toBe('no_encontrado');
    expect(codigo(await dueno.herramienta('productos_ficha_guardar', { productoId: otro, costoMilesimas: -1 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('productos_ficha_guardar', { productoId: randomUUID(), marca: 'X' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('productos_ficha_ver', { productoId }))).toBe('no_encontrado');
    expect((await miembro.herramienta('productos_ficha_guardar', { productoId, marca: 'Z' })).estado).toBe(403);
  });
});

describe('unidades del producto', () => {
  it('define una caja de 12, la actualiza por la misma unidad y rechaza la base', async () => {
    const a = await dueno.herramienta('productos_unidad_guardar', { productoId, unidad: ' Caja ', factorMilesimas: 12000 });
    expect(a.cuerpo.datos).toMatchObject({ unidad: 'caja', factorMilesimas: 12000, paraCompra: true, paraVenta: true });
    const b = await dueno.herramienta('productos_unidad_guardar', { productoId, unidad: 'caja', factorMilesimas: 24000, paraVenta: false });
    expect(b.cuerpo.datos).toMatchObject({ id: a.cuerpo.datos.id, factorMilesimas: 24000, paraVenta: false });
    expect((await dueno.herramienta('productos_unidades_listar', { productoId })).cuerpo.datos.items).toHaveLength(1);
    expect(codigo(await dueno.herramienta('productos_unidad_guardar', { productoId, unidad: 'Unidad', factorMilesimas: 1000 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('productos_unidad_guardar', { productoId, unidad: 'paquete', factorMilesimas: 0 }))).toBe('argumentos_invalidos');
  });

  it('aísla por empresa y elimina', async () => {
    const id = (await dueno.herramienta('productos_unidades_listar', { productoId })).cuerpo.datos.items[0].id;
    expect(codigo(await ajeno.herramienta('productos_unidad_eliminar', { id }))).toBe('no_encontrado');
    expect((await dueno.herramienta('productos_unidad_eliminar', { id })).cuerpo.ok).toBe(true);
    expect(codigo(await ajeno.herramienta('productos_unidades_listar', { productoId }))).toBe('no_encontrado');
  });
});
