import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../../herramientas/http-de-pruebas.js';

// Fase 7 (servidor) por HTTP real: clientes, productos y sucursales con dos empresas y un member de solo lectura.

let app: AppDePruebas;
let auth: pg.Pool;
let appPool: pg.Pool;
let dueno: Sesion;
let miembro: Sesion; // member de A: nivel lectura en el núcleo
let ajeno: Sesion; // owner de B
let empresaA: string;
let empresaB: string;

const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;
const eventos = (empresaId: string, tipo?: string) =>
  comoEmpresa(appPool, empresaId, async (c) => {
    const r = await c.query('select tipo, carga from core.eventos_salida order by creado_en, id');
    return (r.rows as { tipo: string; carga: any }[]).filter((e) => !tipo || e.tipo === tipo);
  });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  appPool = abrirPool('app');
  [dueno, miembro, ajeno] = await Promise.all([abrirSesion(app, 'Dueña'), abrirSesion(app, 'Miembro'), abrirSesion(app, 'Ajena')]);
  empresaA = await crearEmpresa(dueno, 'Empresa A de maestros');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de maestros');
  await auth.query('insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())', [
    randomUUID(),
    empresaA,
    miembro.usuarioId,
    'member',
  ]);
  expect((await miembro.pedir('POST', '/api/auth/organization/set-active', { organizationId: empresaA })).estado).toBe(200);
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
  await appPool.end();
});

describe('clientes', () => {
  let joseId: string;

  it('crea un cliente (normaliza y emite cliente.creado) y la clase sale del RUC', async () => {
    const r = await dueno.herramienta('clientes_crear', { nombre: '  José   Pérez ', documentoTipo: 'dni', documentoNumero: '45871236', telefono: '987 654 321' });
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { nombre: 'José Pérez', clase: 'persona', tipo: 'cliente', telefono: '987654321', archivadoEn: null } });
    joseId = r.cuerpo.datos.id;
    const ev = await eventos(empresaA, 'cliente.creado');
    expect(ev.at(-1)!.carga).toEqual({ id: joseId, nombre: 'José Pérez', tipo: 'cliente', clase: 'persona' });
    const emp = await dueno.herramienta('clientes_crear', { nombre: 'Imprenta Sol SAC', documentoTipo: 'ruc', documentoNumero: '20123456789' });
    expect(emp.cuerpo.datos.clase).toBe('empresa');
  });

  it('un documento inválido o un campo de más es argumentos_invalidos', async () => {
    const mal = await dueno.herramienta('clientes_crear', { nombre: 'Ana', documentoTipo: 'dni', documentoNumero: '123' });
    expect(mal.estado).toBe(400);
    expect(codigo(mal)).toBe('argumentos_invalidos');
    const extra = await dueno.herramienta('clientes_crear', { nombre: 'Ana', sorpresa: 1 });
    expect(codigo(extra)).toBe('argumentos_invalidos');
  });

  it('el nombre duplicado responde conflicto con candidatas y no deja evento', async () => {
    const antes = (await eventos(empresaA)).length;
    const r = await dueno.herramienta('clientes_crear', { nombre: 'jose perez' });
    expect(r.estado).toBe(409);
    expect(codigo(r)).toBe('conflicto');
    expect(r.cuerpo.error.candidatas[0]).toMatchObject({ id: joseId, nombre: 'José Pérez' });
    expect((await eventos(empresaA)).length).toBe(antes);
    const doc = await dueno.herramienta('clientes_crear', { nombre: 'Otro Nombre', documentoTipo: 'dni', documentoNumero: '45871236' });
    expect(codigo(doc)).toBe('conflicto');
    expect(doc.cuerpo.error.candidatas[0].id).toBe(joseId);
  });

  it('la misma clave de idempotencia no crea dos veces', async () => {
    const clave = `cli-${randomUUID()}`;
    const a = await dueno.herramienta('clientes_crear', { nombre: 'Cliente Idempotente' }, { clave });
    const b = await dueno.herramienta('clientes_crear', { nombre: 'Cliente Idempotente' }, { clave });
    expect(a.cuerpo.ok).toBe(true);
    expect(b.cuerpo.datos.id).toBe(a.cuerpo.datos.id);
    const buscados = await dueno.herramienta('clientes_buscar', { texto: 'cliente idempotente' });
    expect(buscados.cuerpo.datos.items.filter((c: any) => c.nombre === 'Cliente Idempotente')).toHaveLength(1);
  });

  it('«Jose Perez» encuentra a «José Pérez» por parecido', async () => {
    const r = await dueno.herramienta('clientes_buscar', { texto: 'Jose Perez' });
    expect(r.cuerpo.datos.items[0]).toMatchObject({ id: joseId, nombre: 'José Pérez' });
    expect(r.cuerpo.datos.items[0].parecido).toBeGreaterThan(0.5);
    const typo = await dueno.herramienta('clientes_buscar', { texto: 'jose peres' });
    expect(typo.cuerpo.datos.items.map((c: any) => c.id)).toContain(joseId);
  });

  it('un member con nivel lectura ve y busca, pero no crea, edita ni archiva', async () => {
    expect((await miembro.herramienta('clientes_listar', {})).cuerpo.ok).toBe(true);
    expect((await miembro.herramienta('clientes_ver', { id: joseId })).cuerpo.ok).toBe(true);
    expect((await miembro.herramienta('clientes_buscar', { texto: 'jose' })).cuerpo.ok).toBe(true);
    for (const [nombre, args] of [
      ['clientes_crear', { nombre: 'Intruso' }],
      ['clientes_editar', { id: joseId, telefono: '999111222' }],
      ['clientes_archivar', { id: joseId }],
      ['clientes_restaurar', { id: joseId }],
    ] as const) {
      const r = await miembro.herramienta(nombre, args);
      expect(r.estado).toBe(403);
      expect(codigo(r)).toBe('sin_permiso');
    }
    expect((await dueno.herramienta('clientes_ver', { id: joseId })).cuerpo.datos.telefono).toBe('987654321');
  });

  it('otra empresa no ve el cliente: ni por id, ni en lista, ni en búsqueda, ni para editarlo', async () => {
    expect(codigo(await ajeno.herramienta('clientes_ver', { id: joseId }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('clientes_editar', { id: joseId, telefono: '999111222' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('clientes_archivar', { id: joseId }))).toBe('no_encontrado');
    expect((await ajeno.herramienta('clientes_listar', {})).cuerpo.datos.items).toEqual([]);
    expect((await ajeno.herramienta('clientes_buscar', { texto: 'jose perez' })).cuerpo.datos.items).toEqual([]);
    // el mismo nombre en la otra empresa no choca
    expect((await ajeno.herramienta('clientes_crear', { nombre: 'José Pérez' })).cuerpo.ok).toBe(true);
  });

  it('un argumento de empresa se rechaza', async () => {
    const r = await dueno.herramienta('clientes_listar', { empresaId: empresaB });
    expect(codigo(r)).toBe('argumento_prohibido');
  });

  it('edita lo pedido (y borra con null), emite cliente.actualizado y respeta los choques', async () => {
    const r = await dueno.herramienta('clientes_editar', { id: joseId, telefono: '999111222', correo: 'JOSE@Correo.pe', notas: null });
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { telefono: '999111222', correo: 'jose@correo.pe', nombre: 'José Pérez', documentoNumero: '45871236' } });
    expect((await eventos(empresaA, 'cliente.actualizado')).at(-1)!.carga).toMatchObject({ id: joseId, archivado: false });
    const vacio = await dueno.herramienta('clientes_editar', { id: joseId });
    expect(codigo(vacio)).toBe('argumentos_invalidos');
    const choque = await dueno.herramienta('clientes_editar', { id: joseId, nombre: 'Imprenta Sol SAC' });
    expect(codigo(choque)).toBe('conflicto');
    expect(choque.cuerpo.error.candidatas[0].nombre).toBe('Imprenta Sol SAC');
  });

  it('archiva y restaura; el archivado sale de la lista activa y de la búsqueda', async () => {
    const a = await dueno.herramienta('clientes_archivar', { id: joseId });
    expect(a.cuerpo.datos.archivadoEn).toEqual(expect.any(String));
    expect((await eventos(empresaA, 'cliente.actualizado')).at(-1)!.carga.archivado).toBe(true);
    const activos = (await dueno.herramienta('clientes_listar', {})).cuerpo.datos.items.map((c: any) => c.id);
    const archivados = (await dueno.herramienta('clientes_listar', { estado: 'archivados' })).cuerpo.datos.items.map((c: any) => c.id);
    expect(activos).not.toContain(joseId);
    expect(archivados).toContain(joseId);
    expect((await dueno.herramienta('clientes_buscar', { texto: 'jose perez' })).cuerpo.datos.items).toEqual([]);
    expect((await dueno.herramienta('clientes_restaurar', { id: joseId })).cuerpo.datos.archivadoEn).toBeNull();
  });

  it('el listado pagina con cursor y un cursor roto es argumentos_invalidos', async () => {
    for (const n of ['Ana Uno', 'Ana Dos', 'Ana Tres']) await dueno.herramienta('clientes_crear', { nombre: n });
    const p1 = await dueno.herramienta('clientes_listar', { limite: 2 });
    expect(p1.cuerpo.datos.items).toHaveLength(2);
    expect(p1.cuerpo.datos.siguiente).toEqual(expect.any(String));
    const p2 = await dueno.herramienta('clientes_listar', { limite: 2, cursor: p1.cuerpo.datos.siguiente });
    expect(p2.cuerpo.datos.items[0].id).not.toBe(p1.cuerpo.datos.items[0].id);
    expect(codigo(await dueno.herramienta('clientes_listar', { cursor: 'roto' }))).toBe('argumentos_invalidos');
  });
});

describe('productos', () => {
  let tarjetasId: string;

  it('crea un producto con precio en milésimas y emite producto.creado', async () => {
    const r = await dueno.herramienta('productos_crear', { nombre: 'Tarjetas de Presentación x100', codigo: 'tar-100', precioUnitarioMilesimas: 25000, unidad: 'Millar' });
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { codigo: 'TAR-100', tipo: 'producto', unidad: 'millar', precioUnitarioMilesimas: 25000, afectoIgv: true } });
    tarjetasId = r.cuerpo.datos.id;
    expect((await eventos(empresaA, 'producto.creado')).at(-1)!.carga).toMatchObject({ id: tarjetasId, codigo: 'TAR-100', precioUnitarioMilesimas: 25000 });
  });

  it('un precio decimal o negativo se rechaza', async () => {
    expect(codigo(await dueno.herramienta('productos_crear', { nombre: 'Malo', precioUnitarioMilesimas: 1.5 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('productos_crear', { nombre: 'Malo', precioUnitarioMilesimas: -1 }))).toBe('argumentos_invalidos');
  });

  it('nombre o código duplicado responde conflicto con candidatas y no deja evento', async () => {
    const antes = (await eventos(empresaA)).length;
    const porNombre = await dueno.herramienta('productos_crear', { nombre: 'tarjetas de presentacion x100' });
    expect(porNombre.estado).toBe(409);
    expect(porNombre.cuerpo.error.candidatas[0].id).toBe(tarjetasId);
    const porCodigo = await dueno.herramienta('productos_crear', { nombre: 'Otra cosa', codigo: 'TAR-100' });
    expect(codigo(porCodigo)).toBe('conflicto');
    expect((await eventos(empresaA)).length).toBe(antes);
  });

  it('encuentra por parecido y por código', async () => {
    const r = await dueno.herramienta('productos_buscar', { texto: 'tarjeta presentacion' });
    expect(r.cuerpo.datos.items.map((p: any) => p.id)).toContain(tarjetasId);
    const porCodigo = await dueno.herramienta('productos_buscar', { texto: 'tar-100' });
    expect(porCodigo.cuerpo.datos.items.map((p: any) => p.id)).toContain(tarjetasId);
  });

  it('un member con nivel lectura no crea ni edita; otra empresa no lo ve', async () => {
    expect((await miembro.herramienta('productos_listar', {})).cuerpo.ok).toBe(true);
    expect(codigo(await miembro.herramienta('productos_crear', { nombre: 'Intruso' }))).toBe('sin_permiso');
    expect(codigo(await miembro.herramienta('productos_editar', { id: tarjetasId, unidad: 'caja' }))).toBe('sin_permiso');
    expect(codigo(await ajeno.herramienta('productos_ver', { id: tarjetasId }))).toBe('no_encontrado');
    expect((await ajeno.herramienta('productos_listar', {})).cuerpo.datos.items).toEqual([]);
    expect((await ajeno.herramienta('productos_crear', { nombre: 'Tarjetas de Presentación x100', codigo: 'TAR-100' })).cuerpo.ok).toBe(true);
  });

  it('edita, archiva y restaura (con choque si otro tomó el nombre)', async () => {
    const e = await dueno.herramienta('productos_editar', { id: tarjetasId, precioUnitarioMilesimas: 28000, descripcion: null });
    expect(e.cuerpo).toMatchObject({ ok: true, datos: { precioUnitarioMilesimas: 28000, nombre: 'Tarjetas de Presentación x100' } });
    expect((await eventos(empresaA, 'producto.actualizado')).at(-1)!.carga).toMatchObject({ id: tarjetasId, precioUnitarioMilesimas: 28000, archivado: false });
    expect((await dueno.herramienta('productos_archivar', { id: tarjetasId })).cuerpo.datos.archivadoEn).toEqual(expect.any(String));
    const otro = await dueno.herramienta('productos_crear', { nombre: 'Tarjetas de Presentación x100' });
    expect(otro.cuerpo.ok).toBe(true);
    const r = await dueno.herramienta('productos_restaurar', { id: tarjetasId });
    expect(codigo(r)).toBe('conflicto');
    expect(r.cuerpo.error.candidatas[0].id).toBe(otro.cuerpo.datos.id);
    await dueno.herramienta('productos_archivar', { id: otro.cuerpo.datos.id });
    expect((await dueno.herramienta('productos_restaurar', { id: tarjetasId })).cuerpo.datos.archivadoEn).toBeNull();
  });
});

describe('sucursales', () => {
  it('una empresa nueva tiene su sucursal principal PRI', async () => {
    const r = await dueno.herramienta('sucursales_listar', {});
    expect(r.cuerpo.datos.items).toHaveLength(1);
    expect(r.cuerpo.datos.items[0]).toMatchObject({ codigo: 'PRI', nombre: 'Principal', esPrincipal: true });
    expect(r.cuerpo.datos.siguiente).toBeNull();
  });

  it('un member con nivel lectura las ve pero no las gestiona; otra empresa tiene las suyas', async () => {
    expect((await miembro.herramienta('sucursales_listar', {})).cuerpo.ok).toBe(true);
    expect(codigo(await miembro.herramienta('sucursal_crear', { codigo: 'SUR', nombre: 'Sur' }))).toBe('sin_permiso');
    const b = await ajeno.herramienta('sucursales_listar', {});
    expect(b.cuerpo.datos.items).toHaveLength(1);
  });

  it('crea, edita y archiva; la principal no se archiva; un código repetido es conflicto', async () => {
    const c = await dueno.herramienta('sucursal_crear', { codigo: 'sur', nombre: ' Tienda  Sur ', direccion: 'Av. Sur 123' });
    expect(c.cuerpo).toMatchObject({ ok: true, datos: { codigo: 'SUR', nombre: 'Tienda Sur', esPrincipal: false } });
    const id = c.cuerpo.datos.id;
    expect(codigo(await dueno.herramienta('sucursal_crear', { codigo: 'SUR', nombre: 'Otra' }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('sucursal_crear', { codigo: 'X', nombre: 'Mala' }))).toBe('argumentos_invalidos');
    const e = await dueno.herramienta('sucursal_editar', { id, direccion: 'Av. Sur 456', telefono: null });
    expect(e.cuerpo.datos).toMatchObject({ codigo: 'SUR', nombre: 'Tienda Sur', direccion: 'Av. Sur 456' });
    const principal = (await dueno.herramienta('sucursales_listar', {})).cuerpo.datos.items[0];
    const noArchiva = await dueno.herramienta('sucursal_archivar', { id: principal.id });
    expect(noArchiva.estado).toBe(409);
    expect(codigo(await ajeno.herramienta('sucursal_editar', { id, nombre: 'Robada' }))).toBe('no_encontrado');
    expect((await dueno.herramienta('sucursal_archivar', { id })).cuerpo.datos.archivadoEn).toEqual(expect.any(String));
    expect((await dueno.herramienta('sucursales_listar', {})).cuerpo.datos.items).toHaveLength(1);
    expect((await dueno.herramienta('sucursales_listar', { incluirArchivadas: true })).cuerpo.datos.items).toHaveLength(2);
  });

  it('marcar principal es crítica: pide confirmación y no cambia nada hasta confirmar', async () => {
    const c = await dueno.herramienta('sucursal_crear', { codigo: 'NOR', nombre: 'Tienda Norte' });
    const id = c.cuerpo.datos.id;
    const pide = await dueno.herramienta('sucursal_marcar_principal', { id });
    expect(pide.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String) } });
    const antes = (await dueno.herramienta('sucursales_listar', {})).cuerpo.datos.items.find((s: any) => s.esPrincipal);
    expect(antes.codigo).toBe('PRI');
    expect(codigo(await miembro.herramienta('sucursal_marcar_principal', { id }))).toBe('sin_permiso');
    const ok = await dueno.herramienta('sucursal_marcar_principal', { id }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(ok.cuerpo).toMatchObject({ ok: true, datos: { codigo: 'NOR', esPrincipal: true } });
    const lista = (await dueno.herramienta('sucursales_listar', {})).cuerpo.datos.items;
    expect(lista.filter((s: any) => s.esPrincipal).map((s: any) => s.codigo)).toEqual(['NOR']);
  });
});
