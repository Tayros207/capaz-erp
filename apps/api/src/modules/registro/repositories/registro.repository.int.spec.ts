import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { prepararCliente } from '../../../core/clientes/domain/cliente.js';
import { crearCliente } from '../../../core/clientes/repositories/clientes.repository.js';
import { activarModulo } from '../../../core/herramientas/http-de-pruebas.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../../pruebas/base-de-pruebas.js';
import { normalizarNombre } from '../domain/catalogos.js';
import { asegurarCatalogos } from './catalogos.repository.js';
import { categoriaConNombre, crearCategoria, listarCategorias, renombrarCategoria } from './categorias.repository.js';
import { archivarCuenta, crearCuenta, cuentaPrincipal, flujosPorCuenta, listarCuentas, marcarCuentaPrincipal, verCuenta } from './cuentas.repository.js';
import { anularDeuda, bloquearDeuda, deudaVivaPorOrigen, guardarAbonado, insertarDeuda, listarDeudas, verDeuda, type DatosDeDeuda } from './deudas.repository.js';
import { anularMovimiento, contarAbonosVivos, insertarMovimiento, listarMovimientos, verMovimiento, type DatosDeMovimiento } from './movimientos.repository.js';
import { deudasAbiertasPorTipo, totalesPorCategoria } from './reportes.repository.js';

// Repositorios de `registro` contra la base real, con dos empresas (ids únicos: las pruebas no vacían tablas).
// Las tablas llevan el disparador de «módulo activo» (R3): por eso primero se activa el módulo en cada empresa.

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
const A = empresaDePrueba();
const B = empresaDePrueba();
const ctxA = { empresaId: A, usuarioId: 'ua' };
const ctxA2 = { empresaId: A, usuarioId: 'ua2' };
const ctxB = { empresaId: B, usuarioId: 'ub' };
let contactoA: string;
let cajaA: string;

const mov = (extra: Partial<DatosDeMovimiento> & Pick<DatosDeMovimiento, 'numero' | 'cuentaId'>): DatosDeMovimiento => ({
  anio: 2026, tipo: 'ingreso', fecha: '2026-03-10', montoCentimos: 1_000, categoriaId: null, contactoId: null, medioDePago: 'efectivo',
  descripcion: null, deudaId: null, sucursalId: null, origen: 'teclado', origenRef: null, ...extra,
});
const deuda = (numero: number, extra: Partial<DatosDeDeuda> = {}): DatosDeDeuda => ({
  numero, anio: 2026, tipo: 'por_cobrar', contactoId: contactoA, concepto: 'Venta', totalCentimos: 10_000, fecha: '2026-03-01', venceEn: null,
  sucursalId: null, notas: null, origenTipo: null, origenId: null, ...extra,
});

beforeAll(async () => {
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
  // El catálogo de módulos lo sincroniza el servidor al arrancar; aquí no arranca, así que se asegura la fila (como en `aislamiento`).
  const owner = abrirPool('owner');
  await owner.query(`insert into core.modulos (codigo, nombre) values ('registro', 'Registro') on conflict do nothing`).finally(() => owner.end());
  await activarModulo(A, 'registro');
  await activarModulo(B, 'registro');
  const p = prepararCliente({ clase: 'persona', nombre: `Contacto ${A}` });
  if (!p.ok) throw new Error(p.motivo);
  const r = await conEmpresa(ctxA, (tx) => crearCliente(tx, ctxA, p.datos));
  if (!r.creado) throw new Error('No se creó el contacto de prueba.');
  contactoA = r.cliente.id;
});
afterAll(() => pool.end());

describe('catálogos por defecto', () => {
  it('siembra una vez la cuenta «Caja» principal y las ocho categorías; repetir no crea nada', async () => {
    expect(await conEmpresa(ctxA, (tx) => asegurarCatalogos(tx, ctxA))).toEqual({ cuentasCreadas: 1, categoriasCreadas: 8 });
    expect(await conEmpresa(ctxA, (tx) => asegurarCatalogos(tx, ctxA))).toEqual({ cuentasCreadas: 0, categoriasCreadas: 0 });
    const principal = await conEmpresa(ctxA, (tx) => cuentaPrincipal(tx, ctxA));
    expect(principal).toMatchObject({ nombre: 'Caja', tipo: 'caja', esPrincipal: true, saldoInicialCentimos: 0, creadoPor: 'ua' });
    cajaA = principal!.id;
    expect(await conEmpresa(ctxA, (tx) => listarCategorias(tx, ctxA, { incluirArchivadas: true }))).toHaveLength(8);
    expect(await conEmpresa(ctxA, (tx) => categoriaConNombre(tx, ctxA, 'ingreso', 'cobros'))).toMatchObject({ nombre: 'Cobros' });
  });

  it('dos primeras escrituras a la vez dejan una sola «Caja»', async () => {
    const r = await Promise.all([conEmpresa(ctxB, (tx) => asegurarCatalogos(tx, ctxB)), conEmpresa(ctxB, (tx) => asegurarCatalogos(tx, ctxB))]);
    expect(r.map((x) => x.cuentasCreadas).sort((a, b) => a - b)).toEqual([0, 1]);
    expect(r.reduce((n, x) => n + x.categoriasCreadas, 0)).toBe(8);
    expect(await conEmpresa(ctxB, (tx) => listarCuentas(tx, ctxB, { incluirArchivadas: true }))).toHaveLength(1);
  });

  it('una empresa no ve los catálogos de la otra', async () => {
    expect(await conEmpresa(ctxB, (tx) => verCuenta(tx, ctxB, cajaA))).toBeNull();
    const deB = await conEmpresa(ctxB, (tx) => listarCuentas(tx, ctxB, { incluirArchivadas: true }));
    expect(deB.map((c) => c.id)).not.toContain(cajaA);
  });
});

describe('cuentas y categorías', () => {
  it('un nombre repetido no lanza: devuelve la existente; la principal no se archiva y cambia de una en una', async () => {
    const datos = { nombre: 'BCP Soles', nombreNormalizado: normalizarNombre('BCP Soles'), tipo: 'banco', sucursalId: null, saldoInicialCentimos: 50_000 };
    const alta = await conEmpresa(ctxA, (tx) => crearCuenta(tx, ctxA, datos));
    expect(alta.creada).toBe(true);
    const otra = await conEmpresa(ctxA, (tx) => crearCuenta(tx, ctxA, { ...datos, nombre: 'bcp  SOLES' }));
    expect(otra).toMatchObject({ creada: false, existente: { nombre: 'BCP Soles' } });
    const bcp = alta.creada ? alta.cuenta.id : '';
    expect(await conEmpresa(ctxA, (tx) => archivarCuenta(tx, ctxA, cajaA))).toBe('es_principal');
    expect(await conEmpresa(ctxA, (tx) => marcarCuentaPrincipal(tx, ctxA, bcp))).toMatchObject({ id: bcp, esPrincipal: true });
    const principales = (await conEmpresa(ctxA, (tx) => listarCuentas(tx, ctxA, { incluirArchivadas: true }))).filter((c) => c.esPrincipal);
    expect(principales.map((c) => c.id)).toEqual([bcp]);
    expect(await conEmpresa(ctxA, (tx) => marcarCuentaPrincipal(tx, ctxA, cajaA))).toMatchObject({ id: cajaA, esPrincipal: true });
    expect(await conEmpresa(ctxA, (tx) => archivarCuenta(tx, ctxA, bcp))).toMatchObject({ id: bcp, archivadoEn: expect.any(Date) });
    expect(await conEmpresa(ctxA, (tx) => marcarCuentaPrincipal(tx, ctxA, bcp))).toBe('archivada');
    expect(await conEmpresa(ctxB, (tx) => marcarCuentaPrincipal(tx, ctxB, bcp))).toBeNull();
  });

  it('la categoría choca solo dentro de su tipo', async () => {
    const d = (nombre: string, tipo: string) => ({ nombre, nombreNormalizado: normalizarNombre(nombre), tipo });
    expect((await conEmpresa(ctxA, (tx) => crearCategoria(tx, ctxA, d('Ventas', 'ingreso')))).creada).toBe(false);
    const egreso = await conEmpresa(ctxA, (tx) => crearCategoria(tx, ctxA, d('Ventas', 'egreso')));
    expect(egreso.creada).toBe(true);
    const id = egreso.creada ? egreso.categoria.id : '';
    expect(await conEmpresa(ctxA, (tx) => renombrarCategoria(tx, ctxA, id, d('Compras', 'egreso')))).toMatchObject({ existente: { nombre: 'Compras' } });
    expect(await conEmpresa(ctxB, (tx) => renombrarCategoria(tx, ctxB, id, d('Otra', 'egreso')))).toBeNull();
  });
});

describe('movimientos', () => {
  const ids: string[] = [];

  it('guarda, suma solo los activos y pagina por (fecha, id) descendente', async () => {
    await conEmpresa(ctxA, async (tx) => {
      ids.push(await insertarMovimiento(tx, ctxA, mov({ numero: 9001, cuentaId: cajaA, montoCentimos: 10_000, fecha: '2026-03-08' })));
      ids.push(await insertarMovimiento(tx, ctxA, mov({ numero: 9002, cuentaId: cajaA, montoCentimos: 2_550, tipo: 'egreso', fecha: '2026-03-09' })));
      ids.push(await insertarMovimiento(tx, ctxA2, mov({ numero: 9003, cuentaId: cajaA, montoCentimos: 1, fecha: '2026-03-10' })));
    });
    const flujo = await conEmpresa(ctxA, (tx) => flujosPorCuenta(tx, ctxA));
    expect(flujo.get(cajaA)).toEqual({ ingresos: 10_001, egresos: 2_550, movimientos: 3 });
    expect((await conEmpresa(ctxA, (tx) => flujosPorCuenta(tx, ctxA, { antesDe: '2026-03-09' }))).get(cajaA)).toEqual({ ingresos: 10_000, egresos: 0, movimientos: 1 });
    expect((await conEmpresa(ctxA, (tx) => flujosPorCuenta(tx, ctxA, { enElDia: '2026-03-09' }))).get(cajaA)).toEqual({ ingresos: 0, egresos: 2_550, movimientos: 1 });

    const base = { limite: 2, cursor: null, estado: 'activos' as const, cuentaId: cajaA };
    const p1 = await conEmpresa(ctxA, (tx) => listarMovimientos(tx, ctxA, base, null));
    expect(p1.items.map((m) => m.numero)).toEqual([9003, 9002]);
    expect(p1.items[0]).toMatchObject({ cuentaNombre: 'Caja', categoriaNombre: null, contactoNombre: null });
    expect(p1.siguiente).toEqual(expect.any(String));
    const { decodificarCursorPorFecha } = await import('../domain/cursor.js');
    const p2 = await conEmpresa(ctxA, (tx) => listarMovimientos(tx, ctxA, { ...base, cursor: decodificarCursorPorFecha(p1.siguiente!) }, null));
    expect(p2.items.map((m) => m.numero)).toEqual([9001]);
    expect(p2.siguiente).toBeNull();
  });

  it('con alcance «propios» solo aparecen los de esa persona; otra empresa no ve ninguno', async () => {
    const base = { limite: 50, cursor: null, estado: 'todos' as const };
    expect((await conEmpresa(ctxA, (tx) => listarMovimientos(tx, ctxA, base, 'ua2'))).items.map((m) => m.numero)).toEqual([9003]);
    expect(await conEmpresa(ctxA, (tx) => verMovimiento(tx, ctxA, ids[0]!, 'ua2'))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => verMovimiento(tx, ctxA, ids[0]!, 'ua'))).toMatchObject({ numero: 9001 });
    expect((await conEmpresa(ctxB, (tx) => listarMovimientos(tx, ctxB, base, null))).items).toEqual([]);
    expect(await conEmpresa(ctxB, (tx) => verMovimiento(tx, ctxB, ids[0]!, null))).toBeNull();
    expect(await conEmpresa(ctxB, (tx) => anularMovimiento(tx, ctxB, ids[0]!, 'intento ajeno'))).toBe(false);
  });

  it('anular deja el movimiento fuera de los saldos y no se repite', async () => {
    expect(await conEmpresa(ctxA, (tx) => anularMovimiento(tx, ctxA, ids[1]!, 'duplicado'))).toBe(true);
    expect(await conEmpresa(ctxA, (tx) => anularMovimiento(tx, ctxA, ids[1]!, 'otra vez'))).toBe(false);
    expect(await conEmpresa(ctxA, (tx) => verMovimiento(tx, ctxA, ids[1]!, null))).toMatchObject({ estado: 'anulado', anuladoPor: 'ua', motivoAnulacion: 'duplicado' });
    expect((await conEmpresa(ctxA, (tx) => flujosPorCuenta(tx, ctxA))).get(cajaA)).toEqual({ ingresos: 10_001, egresos: 0, movimientos: 2 });
  });

  it('la base no deja cambiar el monto ni borrar un movimiento', async () => {
    await expect(comoEmpresa(pool, A, (c) => c.query(`update registro.movimientos set monto_centimos = 1 where id = $1`, [ids[0]]))).rejects.toThrow(/permission denied|permiso denegado/);
    await expect(comoEmpresa(pool, A, (c) => c.query(`delete from registro.movimientos where id = $1`, [ids[0]]))).rejects.toThrow();
  });
});

describe('deudas', () => {
  let d1: string;

  it('un documento de origen admite una sola deuda viva; anulada, admite otra', async () => {
    d1 = (await conEmpresa(ctxA, (tx) => insertarDeuda(tx, ctxA, deuda(9001, { origenTipo: 'pedido', origenId: 'p-1', venceEn: '2026-03-05' }))))!;
    expect(d1).toEqual(expect.any(String));
    expect(await conEmpresa(ctxA, (tx) => insertarDeuda(tx, ctxA, deuda(9002, { origenTipo: 'pedido', origenId: 'p-1' })))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => deudaVivaPorOrigen(tx, ctxA, 'pedido', 'p-1'))).toMatchObject({ id: d1 });
    expect(await conEmpresa(ctxB, (tx) => deudaVivaPorOrigen(tx, ctxB, 'pedido', 'p-1'))).toBeNull();
  });

  it('lista por estado (las vencidas dependen del día), con el nombre del contacto, y respeta el alcance', async () => {
    const base = { limite: 10, cursor: null, tipo: 'por_cobrar', hoy: '2026-03-10' };
    const vencidas = await conEmpresa(ctxA, (tx) => listarDeudas(tx, ctxA, { ...base, estado: 'vencidas' }, null));
    expect(vencidas.items.map((x) => x.id)).toEqual([d1]);
    expect(vencidas.items[0]!.contactoNombre).toBe(`Contacto ${A}`);
    expect((await conEmpresa(ctxA, (tx) => listarDeudas(tx, ctxA, { ...base, estado: 'vencidas', hoy: '2026-03-05' }, null))).items).toEqual([]);
    expect((await conEmpresa(ctxA, (tx) => listarDeudas(tx, ctxA, { ...base, estado: 'abiertas' }, 'ua2'))).items).toEqual([]);
    expect((await conEmpresa(ctxA, (tx) => listarDeudas(tx, ctxA, { ...base, tipo: 'por_pagar', estado: 'todas' }, null))).items).toEqual([]);
    expect(await conEmpresa(ctxB, (tx) => verDeuda(tx, ctxB, d1, null))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => verDeuda(tx, ctxA, d1, 'ua2'))).toBeNull();
  });

  it('los reportes suman solo lo abierto y lo activo de la empresa', async () => {
    expect(await conEmpresa(ctxA, (tx) => deudasAbiertasPorTipo(tx, ctxA, '2026-03-10'))).toEqual({
      por_cobrar: { saldoCentimos: 10_000, vencidas: 1, vencidasCentimos: 10_000 },
      por_pagar: { saldoCentimos: 0, vencidas: 0, vencidasCentimos: 0 },
    });
    expect(await conEmpresa(ctxA, (tx) => totalesPorCategoria(tx, ctxA, '2026-03-01', '2026-03-31'))).toEqual([{ categoriaId: null, nombre: null, tipo: 'ingreso', totalCentimos: 10_001 }]);
    expect(await conEmpresa(ctxB, (tx) => totalesPorCategoria(tx, ctxB, '2026-03-01', '2026-03-31'))).toEqual([]);
    expect((await conEmpresa(ctxB, (tx) => deudasAbiertasPorTipo(tx, ctxB, '2026-03-10'))).por_cobrar.saldoCentimos).toBe(0);
  });

  it('con algo abonado no se anula; la base rechaza un estado que no cuadra con lo abonado; no se borra', async () => {
    await conEmpresa(ctxA, async (tx) => {
      const fila = await bloquearDeuda(tx, ctxA, d1, null);
      expect(fila).toMatchObject({ estado: 'pendiente', abonadoCentimos: 0 });
      await guardarAbonado(tx, ctxA, d1, 4_000, 'parcial');
      await insertarMovimiento(tx, ctxA, mov({ numero: 9010, cuentaId: cajaA, montoCentimos: 4_000, deudaId: d1 }));
    });
    expect(await conEmpresa(ctxA, (tx) => contarAbonosVivos(tx, ctxA, d1))).toBe(1);
    expect(await conEmpresa(ctxA, (tx) => anularDeuda(tx, ctxA, d1, 'no procede'))).toBe(false);
    await expect(conEmpresa(ctxA, (tx) => guardarAbonado(tx, ctxA, d1, 10_000, 'parcial'))).rejects.toThrow();
    await expect(conEmpresa(ctxA, (tx) => guardarAbonado(tx, ctxA, d1, 10_001, 'pagada'))).rejects.toThrow();
    await expect(comoEmpresa(pool, A, (c) => c.query(`delete from registro.deudas where id = $1`, [d1]))).rejects.toThrow();
    expect(await conEmpresa(ctxB, (tx) => bloquearDeuda(tx, ctxB, d1, null))).toBeNull();
  });
});
