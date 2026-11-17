import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { codigo, confirmarCritica, crearArticulo, datos, eventosDe, mensaje, mover } from './pruebas-de-insumos.js';

// Inventario · operaciones (0026) por HTTP real: transferencias entre sucursales, inventario físico y kardex valorizado.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion; // member de A: insumos en lectura
let ajeno: Sesion; // owner de B
let empresaA: string;
let principal: string;
let norte: string;
let papel: any;
let tinta: any;

const existencia = async (articuloId: string, sucursalId: string): Promise<number> =>
  datos(await dueno.herramienta('existencias_listar', { sucursalId, limite: 100 })).items.find((e: any) => e.articuloId === articuloId)?.cantidadMilesimas ?? 0;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de operaciones');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de operaciones');
  await Promise.all([activarModulo(empresaA, 'insumos'), activarModulo(empresaB, 'insumos')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'insumos', nivel: 'lectura', alcance: 'todos' });
  principal = datos(await dueno.herramienta('sucursales_listar', {})).items.find((s: any) => s.esPrincipal).id;
  norte = datos(await dueno.herramienta('sucursal_crear', { codigo: 'NOR', nombre: 'Norte' })).id;
  papel = await crearArticulo(dueno, 'Papel bond A4');
  tinta = await crearArticulo(dueno, 'Tinta negra');
  datos(await mover(dueno, papel.id, 'entrada', 20_000, { costoUnitarioMilesimas: 2_000 }));
  datos(await mover(dueno, tinta.id, 'entrada', 3_000));
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('transferencia_crear', () => {
  it('resta del origen, suma en el destino, numera y emite el evento', async () => {
    const t = datos(await dueno.herramienta('transferencia_crear', { origenSucursalId: principal, destinoSucursalId: norte, nota: 'Camión', lineas: [{ articuloId: papel.id, cantidadMilesimas: 5_000 }, { articuloId: tinta.id, cantidadMilesimas: 1_000 }] }));
    expect(t).toMatchObject({ numero: 1, origenCodigo: expect.any(String), destinoCodigo: 'NOR', nota: 'Camión' });
    expect(t.lineas).toHaveLength(2);
    expect(await existencia(papel.id, principal)).toBe(15_000);
    expect(await existencia(papel.id, norte)).toBe(5_000);
    expect(await existencia(tinta.id, norte)).toBe(1_000);
    expect((await eventosDe(appPool, empresaA, 'transferencia.creada')).at(-1)).toMatchObject({ id: t.id, lineas: 2 });
    const ver = datos(await dueno.herramienta('transferencia_ver', { id: t.id }));
    expect(ver.id).toBe(t.id);
    expect(datos(await dueno.herramienta('transferencias_listar', {})).items.map((x: any) => x.id)).toContain(t.id);
  });

  it('si algo no alcanza no se mueve NADA y el número no se gasta', async () => {
    const r = await dueno.herramienta('transferencia_crear', { origenSucursalId: principal, destinoSucursalId: norte, lineas: [{ articuloId: papel.id, cantidadMilesimas: 1_000 }, { articuloId: tinta.id, cantidadMilesimas: 99_000 }] });
    expect(codigo(r)).toBe('conflicto');
    expect(await existencia(papel.id, principal)).toBe(15_000);
    expect(await existencia(papel.id, norte)).toBe(5_000);
    const siguiente = datos(await dueno.herramienta('transferencia_crear', { origenSucursalId: principal, destinoSucursalId: norte, lineas: [{ articuloId: papel.id, cantidadMilesimas: 1_000 }] }));
    expect(siguiente.numero).toBe(2);
  });

  it('rechaza mismo origen y destino, artículos repetidos, sucursal ajena y artículo inexistente', async () => {
    const base = { origenSucursalId: principal, destinoSucursalId: norte };
    expect(codigo(await dueno.herramienta('transferencia_crear', { origenSucursalId: principal, destinoSucursalId: principal, lineas: [{ articuloId: papel.id, cantidadMilesimas: 1 }] }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('transferencia_crear', { ...base, lineas: [{ articuloId: papel.id, cantidadMilesimas: 1 }, { articuloId: papel.id, cantidadMilesimas: 1 }] }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('transferencia_crear', { ...base, destinoSucursalId: randomUUID(), lineas: [{ articuloId: papel.id, cantidadMilesimas: 1 }] }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('transferencia_crear', { ...base, lineas: [{ articuloId: randomUUID(), cantidadMilesimas: 1 }] }))).toBe('no_encontrado');
    expect(codigo(await dueno.herramienta('transferencia_crear', { ...base, lineas: [] }))).toBe('argumentos_invalidos');
  });

  it('el lector no transfiere, la otra empresa no la ve', async () => {
    expect((await lector.herramienta('transferencia_crear', { origenSucursalId: principal, destinoSucursalId: norte, lineas: [{ articuloId: papel.id, cantidadMilesimas: 1 }] })).estado).toBe(403);
    const id = datos(await dueno.herramienta('transferencias_listar', {})).items[0].id;
    expect(codigo(await ajeno.herramienta('transferencia_ver', { id }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('transferencias_listar', {})).items).toEqual([]);
    expect(datos(await lector.herramienta('transferencia_ver', { id })).id).toBe(id);
  });
});

describe('inventario físico (conteos)', () => {
  let conteoId: string;

  it('abre con la foto del sistema; solo uno abierto por sucursal', async () => {
    const c = datos(await dueno.herramienta('conteo_abrir', { sucursalId: norte, nota: 'Cierre' }));
    conteoId = c.id;
    expect(c).toMatchObject({ estado: 'abierto', sucursalCodigo: 'NOR', totalLineas: 2, lineasContadas: 0, numero: 1 });
    const papelL = c.lineas.find((l: any) => l.articuloId === papel.id);
    expect(papelL).toMatchObject({ sistemaMilesimas: 6_000, contadaMilesimas: null, diferenciaMilesimas: null });
    expect(codigo(await dueno.herramienta('conteo_abrir', { sucursalId: norte }))).toBe('conflicto');
  });

  it('anota lo contado, permite corregir y rechaza artículos que no están', async () => {
    datos(await dueno.herramienta('conteo_registrar', { id: conteoId, lineas: [{ articuloId: papel.id, contadaMilesimas: 5_000 }] }));
    const c = datos(await dueno.herramienta('conteo_registrar', { id: conteoId, lineas: [{ articuloId: papel.id, contadaMilesimas: 4_000 }] }));
    expect(c.lineasContadas).toBe(1);
    expect(c.lineas.find((l: any) => l.articuloId === papel.id)).toMatchObject({ contadaMilesimas: 4_000, diferenciaMilesimas: -2_000 });
    expect(codigo(await dueno.herramienta('conteo_registrar', { id: conteoId, lineas: [{ articuloId: randomUUID(), contadaMilesimas: 1 }] }))).toBe('no_encontrado');
    expect(codigo(await dueno.herramienta('conteo_registrar', { id: conteoId, lineas: [{ articuloId: papel.id, contadaMilesimas: -1 }] }))).toBe('argumentos_invalidos');
  });

  it('el lector no cuenta y la otra empresa no ve el conteo', async () => {
    expect((await lector.herramienta('conteo_registrar', { id: conteoId, lineas: [{ articuloId: papel.id, contadaMilesimas: 1 }] })).estado).toBe(403);
    expect(codigo(await ajeno.herramienta('conteo_ver', { id: conteoId }))).toBe('no_encontrado');
    expect(datos(await lector.herramienta('conteo_ver', { id: conteoId })).id).toBe(conteoId);
  });

  it('cerrar pide confirmación, ajusta solo lo contado y deja el ajuste en el historial', async () => {
    const pide = await dueno.herramienta('conteo_cerrar', { id: conteoId });
    expect(pide.cuerpo.requiereConfirmacion.resumen).toMatch(/1 artículos contados, 1 con diferencia/);
    const c = datos(await confirmarCritica(dueno, 'conteo_cerrar', { id: conteoId }));
    expect(c.estado).toBe('cerrado');
    expect(c.lineas.find((l: any) => l.articuloId === papel.id).movimientoId).not.toBeNull();
    expect(c.lineas.find((l: any) => l.articuloId === tinta.id).movimientoId).toBeNull();
    expect(await existencia(papel.id, norte)).toBe(4_000);
    expect(await existencia(tinta.id, norte)).toBe(1_000);
    expect((await eventosDe(appPool, empresaA, 'conteo.cerrado')).at(-1)).toMatchObject({ id: conteoId, ajustes: 1 });
    const movs = datos(await dueno.herramienta('existencias_movimientos_listar', { articuloId: papel.id, sucursalId: norte })).items;
    expect(movs.find((m: any) => m.tipo === 'ajuste')).toMatchObject({ cantidadMilesimas: -2_000, motivo: expect.stringMatching(/Inventario físico 1-/) });
  });

  it('un conteo cerrado no se vuelve a cerrar, anotar ni anular', async () => {
    expect(codigo(await dueno.herramienta('conteo_registrar', { id: conteoId, lineas: [{ articuloId: papel.id, contadaMilesimas: 1 }] }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('conteo_anular', { id: conteoId, motivo: 'x' }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('conteo_cerrar', { id: conteoId }))).toBe('conflicto');
  });

  it('cerrar sin contar nada se rechaza y anular guarda el motivo y libera la sucursal', async () => {
    const c = datos(await dueno.herramienta('conteo_abrir', { sucursalId: norte, articuloIds: [papel.id] }));
    expect(c.numero).toBe(2);
    expect(codigo(await dueno.herramienta('conteo_cerrar', { id: c.id }))).toBe('conflicto');
    const a = datos(await dueno.herramienta('conteo_anular', { id: c.id, motivo: 'Se contó mal' }));
    expect(a.estado).toBe('anulado');
    expect(a.nota).toMatch(/Anulado: Se contó mal/);
    expect(codigo(await dueno.herramienta('conteo_anular', { id: c.id }))).toBe('argumentos_invalidos');
    datos(await dueno.herramienta('conteo_abrir', { sucursalId: norte }));
  });

  it('lista por estado y rechaza una sucursal sin existencias', async () => {
    expect(datos(await dueno.herramienta('conteos_listar', { estado: 'abiertos' })).items).toHaveLength(1);
    expect(datos(await dueno.herramienta('conteos_listar', {})).items.length).toBeGreaterThanOrEqual(3);
    const vacia = datos(await dueno.herramienta('sucursal_crear', { codigo: 'SUR', nombre: 'Sur' })).id;
    expect(mensaje(await dueno.herramienta('conteo_abrir', { sucursalId: vacia }))).toMatch(/No hay artículos con existencia/);
  });
});

describe('existencias_kardex', () => {
  it('valoriza con costo promedio móvil y suma todas las sucursales', async () => {
    const k = datos(await dueno.herramienta('existencias_kardex', { articuloId: papel.id }));
    expect(k.items.map((i: any) => i.tipo)).toEqual(['entrada', 'salida', 'entrada', 'salida', 'entrada', 'ajuste']);
    expect(k).toMatchObject({ saldoMilesimas: 18_000, costoPromedioMilesimas: 2_000, costosIncompletos: false });
    expect(k.valorTotalCentimos).toBe(Math.round((k.saldoMilesimas * 2_000) / 10_000));
  });

  it('por sucursal ve solo la suya; artículo o sucursal inexistentes y otra empresa se rechazan', async () => {
    const k = datos(await dueno.herramienta('existencias_kardex', { articuloId: papel.id, sucursalId: norte }));
    expect(k.saldoMilesimas).toBe(await existencia(papel.id, norte));
    expect(codigo(await dueno.herramienta('existencias_kardex', { articuloId: randomUUID() }))).toBe('no_encontrado');
    expect(codigo(await dueno.herramienta('existencias_kardex', { articuloId: papel.id, sucursalId: randomUUID() }))).toBe('argumentos_invalidos');
    expect(codigo(await ajeno.herramienta('existencias_kardex', { articuloId: papel.id }))).toBe('no_encontrado');
  });
});
