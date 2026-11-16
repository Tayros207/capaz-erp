import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { codigo, crearArticulo, crearProducto, datos, eventosDe, mensaje, mover } from './pruebas-de-insumos.js';

// Inventario por HTTP real, parte 1: artículos, entradas y salidas, listados, con dos empresas, un member de solo
// lectura, uno sin el módulo y uno con alcance «propios»; módulo en baja y sin contratar.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: insumos en lectura
let sinModulo: Sesion; // member de A: solo ordenes
let propio: Sesion; // member de A: insumos completo, alcance propios
let ajeno: Sesion; // owner de B
let empresaA: string;
let empresaB: string;
let principalA: string;
let norte: string; // segunda sucursal de A

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, sinModulo, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Sin módulo', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de inventario');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de inventario');
  // «ordenes» se activa en A solo para asignárselo al miembro que no tiene inventario (la base exige que esté contratado).
  await Promise.all([activarModulo(empresaA, 'insumos'), activarModulo(empresaA, 'ordenes'), activarModulo(empresaB, 'insumos')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'insumos', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, sinModulo, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'insumos', nivel: 'completo', alcance: 'propios' });
  const sucursales = datos(await dueno.herramienta('sucursales_listar', {})).items;
  principalA = sucursales.find((s: any) => s.esPrincipal).id;
  norte = datos(await dueno.herramienta('sucursal_crear', { codigo: 'NOR', nombre: 'Norte' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('articulo_activar, articulo_editar, articulo_archivar', () => {
  it('pone un producto bajo control con la unidad del producto y su existencia en cero en la principal', async () => {
    const productoId = await crearProducto(dueno, 'Papel bond A4', { unidad: 'paquete', codigo: 'PB-A4' });
    const a = datos(await dueno.herramienta('articulo_activar', { productoId, minimoMilesimas: 10_000 }));
    expect(a).toMatchObject({
      productoId, nombre: 'Papel bond A4', codigo: 'PB-A4', unidad: 'paquete', minimoMilesimas: 10_000, ultimoCostoMilesimas: null,
      existenciaTotalMilesimas: 0, bajoMinimo: true, archivadoEn: null,
      existencias: [{ sucursalId: principalA, sucursalCodigo: 'PRI', cantidadMilesimas: 0, bajoMinimo: true }],
    });
    // Idempotente: otra vez no crea otro; aplica lo que llega.
    const otra = datos(await dueno.herramienta('articulo_activar', { productoId, unidad: 'resma' }));
    expect(otra).toMatchObject({ id: a.id, unidad: 'resma', minimoMilesimas: 10_000 });
    expect(datos(await dueno.herramienta('articulos_listar', { buscar: 'pb-a4' })).items.map((x: any) => x.id)).toEqual([a.id]);
  });

  it('rechaza un producto que no existe, de otra empresa o archivado; valida campos', async () => {
    const deB = await crearProducto(ajeno, 'Producto de B');
    expect(mensaje(await dueno.herramienta('articulo_activar', { productoId: deB }))).toBe('El producto no existe.');
    expect(mensaje(await dueno.herramienta('articulo_activar', { productoId: randomUUID() }))).toBe('El producto no existe.');
    const archivado = await crearProducto(dueno, 'Producto retirado');
    datos(await dueno.herramienta('productos_archivar', { id: archivado }));
    expect(mensaje(await dueno.herramienta('articulo_activar', { productoId: archivado }))).toBe('El producto está archivado.');
    for (const args of [{ productoId: 'no-uuid' }, { productoId: deB, minimoMilesimas: -1 }, { productoId: deB, minimoMilesimas: 1.5 }, { productoId: deB, color: 'rojo' }]) {
      const r = await dueno.herramienta('articulo_activar', args);
      expect(r.estado, JSON.stringify(args)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
    }
    expect(codigo(await dueno.herramienta('articulo_activar', { productoId: deB, empresaId: empresaB }))).toBe('argumento_prohibido');
  });

  it('editar cambia mínimo y unidad; archivar exige existencia cero y activar lo reactiva', async () => {
    const a = await crearArticulo(dueno, 'Tóner negro');
    expect(codigo(await dueno.herramienta('articulo_editar', { id: a.id }))).toBe('argumentos_invalidos');
    expect(datos(await dueno.herramienta('articulo_editar', { id: a.id, minimoMilesimas: 2_000, unidad: 'cartucho' }))).toMatchObject({ minimoMilesimas: 2_000, unidad: 'cartucho' });
    datos(await mover(dueno, a.id, 'entrada', 1_500, { sucursalId: norte }));
    const r = await dueno.herramienta('articulo_archivar', { id: a.id });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe('Todavía hay 1.5 cartucho en el inventario: sácalo o ajústalo a cero antes de archivar.');
    datos(await mover(dueno, a.id, 'salida', 1_500, { sucursalId: norte }));
    const archivado = datos(await dueno.herramienta('articulo_archivar', { id: a.id }));
    expect(archivado.archivadoEn).not.toBeNull();
    expect(datos(await dueno.herramienta('articulo_archivar', { id: a.id })).archivadoEn).toBe(archivado.archivadoEn);
    expect(mensaje(await mover(dueno, a.id, 'entrada', 1_000))).toMatch(/archivado/);
    expect(datos(await dueno.herramienta('articulos_listar', { estado: 'archivados', limite: 100 })).items.map((x: any) => x.id)).toContain(a.id);
    expect(datos(await dueno.herramienta('articulo_activar', { productoId: a.productoId })).archivadoEn).toBeNull();
  });
});

describe('existencia_mover', () => {
  it('entrada con costo y salida en otra sucursal: cambian su existencia, guardan el último costo y emiten existencia.movida', async () => {
    const a = await crearArticulo(dueno, 'Cartulina dúplex', { minimoMilesimas: 5_000 });
    const e = datos(await mover(dueno, a.id, 'entrada', 25_000, { costoUnitarioMilesimas: 1_250, motivo: ' Llegó del proveedor ' }));
    expect(e.movimiento).toMatchObject({
      articuloId: a.id, sucursalId: principalA, sucursalCodigo: 'PRI', tipo: 'entrada', cantidadMilesimas: 25_000, existenciaResultanteMilesimas: 25_000,
      costoUnitarioMilesimas: 1_250, motivo: 'Llegó del proveedor', creadoPor: dueno.usuarioId, nombre: 'Cartulina dúplex', unidad: 'paquete', origenTipo: null,
    });
    expect(e.existencia).toMatchObject({ articuloId: a.id, sucursalId: principalA, cantidadMilesimas: 25_000, minimoMilesimas: 5_000, bajoMinimo: false });
    datos(await mover(dueno, a.id, 'entrada', 3_000, { sucursalId: norte }));
    const s = datos(await mover(dueno, a.id, 'salida', 2_000, { sucursalId: norte }));
    expect(s.movimiento).toMatchObject({ tipo: 'salida', cantidadMilesimas: -2_000, existenciaResultanteMilesimas: 1_000, sucursalCodigo: 'NOR', costoUnitarioMilesimas: null, motivo: null });
    expect(s.existencia).toMatchObject({ cantidadMilesimas: 1_000, bajoMinimo: true });
    const ver = datos(await dueno.herramienta('articulo_ver', { id: a.id }));
    expect(ver).toMatchObject({ ultimoCostoMilesimas: 1_250, existenciaTotalMilesimas: 26_000, bajoMinimo: true });
    expect(ver.existencias.map((x: any) => [x.sucursalCodigo, x.cantidadMilesimas, x.bajoMinimo])).toEqual([['PRI', 25_000, false], ['NOR', 1_000, true]]);
    const movidas = (await eventosDe(appPool, empresaA, 'existencia.movida')).filter((c) => c.articuloId === a.id);
    expect(movidas).toEqual([
      { articuloId: a.id, sucursalId: principalA, tipo: 'entrada', cantidadMilesimas: 25_000 },
      { articuloId: a.id, sucursalId: norte, tipo: 'entrada', cantidadMilesimas: 3_000 },
      { articuloId: a.id, sucursalId: norte, tipo: 'salida', cantidadMilesimas: -2_000 },
    ]);
    // 3 → 1 con mínimo 5: ya estaba bajo al entrar (0 → 3 no cruza hacia abajo), así que no hay alerta.
    expect((await eventosDe(appPool, empresaA, 'existencia.bajo_minimo')).filter((c) => c.articuloId === a.id)).toEqual([]);
    // R13: la auditoría guarda ids, tipo y cifras; nunca el motivo tecleado ni el nombre del producto.
    const auditoria = await comoEmpresa(appPool, empresaA, async (c) =>
      (await c.query(`select entidad_tipo, entidad_id, resumen from core.auditoria where herramienta = 'existencia_mover' and entidad_id = $1`, [e.movimiento.id])).rows,
    );
    expect(auditoria).toEqual([{ entidad_tipo: 'movimiento_de_inventario', entidad_id: e.movimiento.id, resumen: expect.objectContaining({ tipo: 'entrada', cantidadMilesimas: 25_000 }) }]);
    expect(JSON.stringify(auditoria)).not.toMatch(/proveedor|Cartulina/);
  });

  it('una salida mayor a lo que hay se rechaza con el faltante y no deja rastro (ni movimiento ni evento)', async () => {
    const a = await crearArticulo(dueno, 'Tinta cian');
    datos(await mover(dueno, a.id, 'entrada', 3_500));
    const r = await mover(dueno, a.id, 'salida', 5_000);
    expect(r.estado).toBe(409);
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe('No alcanza: hay 3.5 paquete y faltan 1.5 paquete.');
    expect(datos(await dueno.herramienta('articulo_ver', { id: a.id })).existenciaTotalMilesimas).toBe(3_500);
    expect(datos(await dueno.herramienta('existencias_movimientos_listar', { articuloId: a.id })).items).toHaveLength(1);
    expect((await eventosDe(appPool, empresaA, 'existencia.movida')).filter((c) => c.articuloId === a.id)).toHaveLength(1);
  });

  it('alerta al cruzar el mínimo hacia abajo, una sola vez', async () => {
    const a = await crearArticulo(dueno, 'Papel couché', { minimoMilesimas: 10_000 });
    datos(await mover(dueno, a.id, 'entrada', 12_000));
    datos(await mover(dueno, a.id, 'salida', 4_000));
    datos(await mover(dueno, a.id, 'salida', 1_000));
    expect((await eventosDe(appPool, empresaA, 'existencia.bajo_minimo')).filter((c) => c.articuloId === a.id)).toEqual([
      { articuloId: a.id, sucursalId: principalA, cantidadMilesimas: 8_000, minimoMilesimas: 10_000 },
    ]);
    const alertas = datos(await dueno.herramienta('existencias_listar', { soloBajoMinimo: true, limite: 100 })).items;
    expect(alertas.find((x: any) => x.articuloId === a.id)).toMatchObject({ cantidadMilesimas: 7_000, minimoMilesimas: 10_000, bajoMinimo: true });
  });

  it('validación: tipo, cantidad, costo en salida, campo de más y sucursal ajena o inexistente', async () => {
    const a = await crearArticulo(dueno, 'Sobres manila');
    for (const args of [
      { articuloId: a.id, tipo: 'ajuste', cantidadMilesimas: 1 },
      { articuloId: a.id, tipo: 'entrada', cantidadMilesimas: 0 },
      { articuloId: a.id, tipo: 'entrada', cantidadMilesimas: -5 },
      { articuloId: a.id, tipo: 'entrada', cantidadMilesimas: 1.5 },
      { articuloId: a.id, tipo: 'salida', cantidadMilesimas: 1, costoUnitarioMilesimas: 10 },
      { articuloId: a.id, tipo: 'entrada', cantidadMilesimas: 1, origenTipo: 'x' },
    ]) {
      expect(codigo(await dueno.herramienta('existencia_mover', args)), JSON.stringify(args)).toBe('argumentos_invalidos');
    }
    const principalB = datos(await ajeno.herramienta('sucursales_listar', {})).items[0].id;
    expect(mensaje(await mover(dueno, a.id, 'entrada', 1, { sucursalId: principalB }))).toBe('La sucursal no existe o está archivada.');
    expect(codigo(await mover(dueno, randomUUID(), 'entrada', 1))).toBe('no_encontrado');
  });

  it('la misma clave de idempotencia no mueve dos veces', async () => {
    const a = await crearArticulo(dueno, 'Grapas 26/6');
    const clave = `mov-${randomUUID()}`;
    const args = { articuloId: a.id, tipo: 'entrada', cantidadMilesimas: 2_000 };
    const x = datos(await dueno.herramienta('existencia_mover', args, { clave }));
    const y = datos(await dueno.herramienta('existencia_mover', args, { clave }));
    expect(y.movimiento.id).toBe(x.movimiento.id);
    expect(datos(await dueno.herramienta('articulo_ver', { id: a.id })).existenciaTotalMilesimas).toBe(2_000);
    expect(codigo(await dueno.herramienta('existencia_mover', { ...args, cantidadMilesimas: 3_000 }, { clave }))).toBe('conflicto');
  });
});

describe('listados', () => {
  it('articulos_listar y existencias_listar paginan por nombre con cursor, sin repetir ni saltar', async () => {
    const marca = `Pag ${randomUUID().slice(0, 6)}`;
    for (const n of ['D', 'B', 'A', 'C', 'E']) await crearArticulo(dueno, `${marca} ${n}`);
    for (const nombre of ['articulos_listar', 'existencias_listar']) {
      const vistos: string[] = [];
      let cursor: string | undefined;
      do {
        const p = datos(await dueno.herramienta(nombre, { limite: 2, buscar: marca, ...(cursor && { cursor }) }));
        vistos.push(...p.items.map((x: any) => x.nombre));
        cursor = p.siguiente ?? undefined;
      } while (cursor);
      expect(vistos, nombre).toEqual(['A', 'B', 'C', 'D', 'E'].map((n) => `${marca} ${n}`));
      expect(codigo(await dueno.herramienta(nombre, { cursor: 'no-es-un-cursor' }))).toBe('argumentos_invalidos');
    }
  });

  it('existencias_listar filtra por sucursal; el historial pagina del más nuevo al más antiguo y filtra por tipo', async () => {
    const a = await crearArticulo(dueno, `Historial ${randomUUID().slice(0, 6)}`);
    for (let i = 1; i <= 5; i++) datos(await mover(dueno, a.id, 'entrada', i * 1_000));
    datos(await mover(dueno, a.id, 'entrada', 2_000, { sucursalId: norte }));
    const enNorte = datos(await dueno.herramienta('existencias_listar', { sucursalId: norte, buscar: a.nombre })).items;
    expect(enNorte.map((x: any) => [x.sucursalCodigo, x.cantidadMilesimas])).toEqual([['NOR', 2_000]]);
    const cantidades: number[] = [];
    let cursor: string | undefined;
    do {
      const p = datos(await dueno.herramienta('existencias_movimientos_listar', { articuloId: a.id, sucursalId: principalA, limite: 2, ...(cursor && { cursor }) }));
      cantidades.push(...p.items.map((m: any) => m.cantidadMilesimas));
      cursor = p.siguiente ?? undefined;
    } while (cursor);
    expect(cantidades).toEqual([5_000, 4_000, 3_000, 2_000, 1_000]);
    expect(datos(await dueno.herramienta('existencias_movimientos_listar', { articuloId: a.id, tipo: 'salida' })).items).toEqual([]);
    expect(codigo(await dueno.herramienta('existencias_movimientos_listar', { cursor: 'basura' }))).toBe('argumentos_invalidos');
  });
});

describe('aislamiento, permisos y alcance', () => {
  let a: any;
  beforeAll(async () => {
    a = await crearArticulo(dueno, 'Artículo de la dueña');
    datos(await mover(dueno, a.id, 'entrada', 5_000));
  });

  it('otra empresa no ve nada: ni por id, ni en listados, ni para mover', async () => {
    expect(codigo(await ajeno.herramienta('articulo_ver', { id: a.id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('articulo_editar', { id: a.id, minimoMilesimas: 1 }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('articulo_archivar', { id: a.id }))).toBe('no_encontrado');
    expect(codigo(await mover(ajeno, a.id, 'salida', 1_000))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('articulos_listar', { estado: 'todos' })).items).toEqual([]);
    expect(datos(await ajeno.herramienta('existencias_listar', {})).items).toEqual([]);
    expect(datos(await ajeno.herramienta('existencias_movimientos_listar', { articuloId: a.id })).items).toEqual([]);
    expect(datos(await ajeno.herramienta('existencias_movimientos_listar', {})).items).toEqual([]);
    expect(datos(await dueno.herramienta('articulo_ver', { id: a.id })).existenciaTotalMilesimas).toBe(5_000);
  });

  it('un member con nivel lectura lee y recibe modulo_solo_lectura al escribir', async () => {
    expect(datos(await lector.herramienta('articulo_ver', { id: a.id })).id).toBe(a.id);
    expect(datos(await lector.herramienta('existencias_listar', {})).items.length).toBeGreaterThan(0);
    expect(datos(await lector.herramienta('insumos_resumen', { desde: '2000-01-01', hasta: '2999-12-31' })).articulos).toBeGreaterThan(0);
    for (const [nombre, args] of [
      ['articulo_activar', { productoId: a.productoId }],
      ['articulo_editar', { id: a.id, minimoMilesimas: 1 }],
      ['articulo_archivar', { id: a.id }],
      ['existencia_mover', { articuloId: a.id, tipo: 'salida', cantidadMilesimas: 1 }],
      ['existencias_recibir', { origenTipo: 'guia', origenId: 'g-1', lineas: [{ articuloId: a.id, cantidadMilesimas: 1 }] }],
      ['existencia_ajustar', { articuloId: a.id, existenciaNuevaMilesimas: 0, motivo: 'x' }],
    ] as const) {
      const r = await lector.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(codigo(r), nombre).toBe('modulo_solo_lectura');
    }
  });

  it('un member sin el módulo asignado recibe modulo_no_disponible hasta para leer', async () => {
    expect(codigo(await sinModulo.herramienta('articulos_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await sinModulo.herramienta('articulo_ver', { id: a.id }))).toBe('modulo_no_disponible');
    expect(codigo(await mover(sinModulo, a.id, 'salida', 1))).toBe('modulo_no_disponible');
  });

  it('con alcance «propios» ve el catálogo y las existencias, pero solo sus movimientos; el resumen le es ajeno', async () => {
    expect(datos(await propio.herramienta('articulo_ver', { id: a.id })).existenciaTotalMilesimas).toBe(5_000);
    expect(datos(await propio.herramienta('existencias_movimientos_listar', { articuloId: a.id })).items).toEqual([]);
    const suyo = datos(await mover(propio, a.id, 'salida', 1_000));
    const visibles = datos(await propio.herramienta('existencias_movimientos_listar', { articuloId: a.id })).items;
    expect(visibles.map((m: any) => m.id)).toEqual([suyo.movimiento.id]);
    expect(datos(await dueno.herramienta('existencias_movimientos_listar', { articuloId: a.id })).items).toHaveLength(2);
    const r = await propio.herramienta('insumos_resumen', { desde: '2026-01-01', hasta: '2026-12-31' });
    expect(codigo(r)).toBe('sin_permiso');
    expect(mensaje(r)).toBe('Tu acceso es solo a tus propios registros.');
  });
});

describe('sin contrato y con el módulo en baja', () => {
  it('empresa sin el módulo contratado: no entra', async () => {
    const nueva = await abrirSesion(app, 'Sin contrato');
    await crearEmpresa(nueva, 'Empresa sin inventario');
    expect(codigo(await nueva.herramienta('articulos_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await nueva.herramienta('articulo_activar', { productoId: randomUUID() }))).toBe('modulo_no_disponible');
  });

  it('módulo dado de baja: se lee, no se escribe por herramienta ni con un insert directo', async () => {
    const b = await crearArticulo(ajeno, 'Antes de la baja');
    datos(await mover(ajeno, b.id, 'entrada', 4_000));
    await darDeBajaModulo(empresaB, 'insumos');
    expect(datos(await ajeno.herramienta('articulo_ver', { id: b.id })).existenciaTotalMilesimas).toBe(4_000);
    expect(datos(await ajeno.herramienta('existencias_movimientos_listar', {})).items).toHaveLength(1);
    for (const [nombre, args] of [
      ['articulo_activar', { productoId: b.productoId }],
      ['articulo_editar', { id: b.id, minimoMilesimas: 1 }],
      ['existencia_mover', { articuloId: b.id, tipo: 'salida', cantidadMilesimas: 1 }],
      ['existencias_recibir', { origenTipo: 'guia', origenId: 'g-1', lineas: [{ articuloId: b.id, cantidadMilesimas: 1 }] }],
      ['existencia_ajustar', { articuloId: b.id, existenciaNuevaMilesimas: 0, motivo: 'x' }],
    ] as const) {
      expect(codigo(await ajeno.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    const principalB = datos(await ajeno.herramienta('sucursales_listar', {})).items[0].id;
    await expect(
      comoEmpresa(appPool, empresaB, (c) =>
        c.query(`insert into insumos.movimientos (tenant_id, articulo_id, sucursal_id, tipo, cantidad_milesimas, existencia_resultante_milesimas, creado_por) values ($1, $2, $3, 'entrada', 1, 1, 'u1')`, [empresaB, b.id, principalB]),
      ),
    ).rejects.toThrow(/no está activo/);
    await expect(comoEmpresa(appPool, empresaB, (c) => c.query(`update insumos.existencias set cantidad_milesimas = 0 where articulo_id = $1`, [b.id]))).rejects.toThrow(/no está activo/);
  });
});
