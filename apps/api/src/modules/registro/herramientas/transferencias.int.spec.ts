import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe, eventosDe, HOY } from './pruebas-de-registro.js';

// Transferencias entre cuentas (C-F2) por HTTP real, con dos empresas: dos movimientos enlazados, fuera de los
// totales de ingresos y egresos pero dentro del saldo de cada cuenta; anulación de las dos patas; concurrencia.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion;
let vendedor: Sesion;
let ajeno: Sesion;
let A: string;
let B: string;
let caja: string; // saldo inicial 500.00
let banco: string; // saldo inicial 0.00
let ajena: string; // cuenta de la empresa B

const transferir = (s: Sesion, args: Record<string, unknown>, clave?: string) => s.herramienta('cuentas_transferir', args, { clave });
const saldos = async (s: Sesion = dueno) => Object.fromEntries((await datosDe(s, 'cuentas_listar', { incluirArchivadas: true })).items.map((c: any) => [c.id, c.saldoCentimos]));
const patas = (empresaId: string, transferenciaId: string) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query(`select tipo, monto_centimos, cuenta_id, estado, numero from registro.movimientos where origen_ref = $1 order by tipo`, [`transferencia:${transferenciaId}`])).rows);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, vendedor, ajeno] = await Promise.all(['Dueña', 'Lector', 'Vendedora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Transferencias A');
  B = await crearEmpresa(ajeno, 'Transferencias B');
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  await datosDe(dueno, 'registro_iniciar');
  caja = (await datosDe(dueno, 'cuentas_listar')).items[0].id;
  await datosDe(dueno, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 50_000, descripcion: 'Saldo de apertura' });
  banco = (await datosDe(dueno, 'cuenta_crear', { nombre: 'Banco', tipo: 'banco' })).id;
  await datosDe(ajeno, 'registro_iniciar');
  ajena = (await datosDe(ajeno, 'cuentas_listar')).items[0].id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('cuentas_transferir: dos movimientos enlazados', () => {
  let t: any;

  it('caja → banco 200.01: egreso en la caja, ingreso en el banco, mismo identificador y sus dos eventos', async () => {
    const r = await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 20_001, nota: 'Depósito del día' });
    expect(r.estado).toBe(200);
    t = r.cuerpo.datos;
    expect(t.egreso).toMatchObject({ tipo: 'egreso', cuentaId: caja, montoCentimos: 20_001, categoriaNombre: 'Transferencia', medioDePago: 'transferencia', transferenciaId: t.transferenciaId, descripcion: 'Transferencia a Banco: Depósito del día', estado: 'activo' });
    expect(t.ingreso).toMatchObject({ tipo: 'ingreso', cuentaId: banco, montoCentimos: 20_001, categoriaNombre: 'Transferencia', transferenciaId: t.transferenciaId, descripcion: 'Transferencia desde Caja: Depósito del día' });
    expect(t.egreso.numero + 1).toBe(t.ingreso.numero);
    expect(r.cuerpo.avisos).toEqual([]);
    expect(await saldos()).toMatchObject({ [caja]: 29_999, [banco]: 20_001 });
    expect(await patas(A, t.transferenciaId)).toHaveLength(2);
    const eventos = (await eventosDe(appPool, A, 'movimiento.registrado')).filter((e) => [t.egreso.id, t.ingreso.id].includes(e.carga.id));
    expect(eventos.map((e) => [e.carga.tipo, e.carga.cuentaId, e.carga.montoCentimos])).toEqual([['egreso', caja, 20_001], ['ingreso', banco, 20_001]]);
  });

  it('no cuenta como ingreso ni egreso: registro_resumen y caja_del_dia la excluyen, pero el saldo de cada cuenta cuadra', async () => {
    const resumen = await datosDe(dueno, 'registro_resumen', { desde: HOY.dia, hasta: HOY.dia });
    expect(resumen).toMatchObject({ ingresosCentimos: 50_000, egresosCentimos: 0, netoCentimos: 50_000 });
    expect(resumen.porCategoria.map((c: any) => c.nombre)).not.toContain('Transferencia');
    const dia = await datosDe(dueno, 'caja_del_dia');
    expect(dia.totalIngresosCentimos).toBe(50_000);
    expect(dia.totalEgresosCentimos).toBe(0);
    expect(dia.cuentas.find((c: any) => c.cuentaId === caja)).toMatchObject({ saldoInicialCentimos: 0, ingresosCentimos: 50_000, egresosCentimos: 0, transferenciasNetasCentimos: -20_001, saldoFinalCentimos: 29_999, movimientos: 2 });
    expect(dia.cuentas.find((c: any) => c.cuentaId === banco)).toMatchObject({ ingresosCentimos: 0, egresosCentimos: 0, transferenciasNetasCentimos: 20_001, saldoFinalCentimos: 20_001 });
  });

  it('el listado de movimientos las trae con su identificador (se ven como transferencia)', async () => {
    const items = (await datosDe(dueno, 'movimientos_listar', { limite: 100 })).items;
    expect(items.filter((m: any) => m.transferenciaId === t.transferenciaId).map((m: any) => m.tipo).sort()).toEqual(['egreso', 'ingreso']);
    expect(items.filter((m: any) => m.transferenciaId === null).length).toBeGreaterThan(0);
  });

  it('es idempotente: la misma clave no transfiere dos veces; con otros datos es conflicto', async () => {
    const clave = `tr-${randomUUID()}`;
    const antes = await saldos();
    const a = await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 1_000 }, clave);
    const b = await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 1_000 }, clave);
    expect(b.cuerpo.datos.transferenciaId).toBe(a.cuerpo.datos.transferenciaId);
    expect(await saldos()).toMatchObject({ [caja]: antes[caja]! - 1_000, [banco]: antes[banco]! + 1_000 });
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 1_001 }, clave))).toBe('conflicto');
    expect(await patas(A, a.cuerpo.datos.transferenciaId)).toHaveLength(2);
  });

  it('transferir más de lo que hay se permite y avisa del saldo negativo en la cuenta de origen', async () => {
    const r = await transferir(dueno, { origenId: banco, destinoId: caja, montoCentimos: 100_000 });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.avisos).toEqual([expect.objectContaining({ codigo: 'saldo_negativo', mensaje: 'La cuenta «Banco» queda con saldo negativo.' })]);
    await confirmando(dueno, 'movimiento_anular', { id: r.cuerpo.datos.egreso.id, motivo: 'Prueba de saldo negativo' });
  });
});

describe('cuentas_transferir: validación', () => {
  it('origen y destino distintos; monto entero mayor que cero; sin campos de más; fecha no futura', async () => {
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: caja, montoCentimos: 100 }))).toBe('argumentos_invalidos');
    for (const montoCentimos of [0, -5, 10.5, '100']) expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos })), String(montoCentimos)).toBe('argumentos_invalidos');
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 100, sorpresa: 1 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 100, empresaId: A }))).toBe('argumento_prohibido');
    const manana = new Date(`${HOY.dia}T12:00:00Z`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 100, fecha: manana.toISOString().slice(0, 10) }))).toBe('argumentos_invalidos');
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 100, fecha: '2026-02-30' }))).toBe('argumentos_invalidos');
  });

  it('una cuenta archivada es conflicto y no cambia nada', async () => {
    const vieja = (await datosDe(dueno, 'cuenta_crear', { nombre: 'Vieja', tipo: 'billetera' })).id;
    await datosDe(dueno, 'cuenta_archivar', { id: vieja });
    const antes = await saldos();
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: vieja, montoCentimos: 100 }))).toBe('conflicto');
    expect(codigoDe(await transferir(dueno, { origenId: vieja, destinoId: caja, montoCentimos: 100 }))).toBe('conflicto');
    expect(await saldos()).toEqual(antes);
  });

  it('una cuenta de otra empresa no existe: ni como origen ni como destino', async () => {
    const antes = await saldos();
    const r = await transferir(dueno, { origenId: caja, destinoId: ajena, montoCentimos: 100 });
    expect(r.estado).toBe(404);
    expect(codigoDe(r)).toBe('no_encontrado');
    expect(codigoDe(await transferir(dueno, { origenId: ajena, destinoId: caja, montoCentimos: 100 }))).toBe('no_encontrado');
    expect(codigoDe(await transferir(dueno, { origenId: caja, destinoId: randomUUID(), montoCentimos: 100 }))).toBe('no_encontrado');
    expect(await saldos()).toEqual(antes);
    expect(await saldos(ajeno)).toEqual({ [ajena]: 0 });
    // Y la empresa B no ve ninguna pata de las transferencias de A.
    expect((await datosDe(ajeno, 'movimientos_listar', { limite: 100 })).items).toEqual([]);
  });
});

describe('categoría «Transferencia» reservada', () => {
  it('no se crea, ni se renombra a ese nombre, ni se edita o archiva la del sistema', async () => {
    const cats = (await datosDe(dueno, 'categorias_listar')).items.filter((c: any) => c.nombre === 'Transferencia');
    expect(cats.map((c: any) => c.tipo).sort()).toEqual(['egreso', 'ingreso']);
    expect(codigoDe(await dueno.herramienta('categoria_crear', { nombre: ' transferencia ', tipo: 'egreso' }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('categoria_editar', { id: cats[0].id, nombre: 'Traspasos' }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('categoria_archivar', { id: cats[0].id }))).toBe('conflicto');
    const otra = (await datosDe(dueno, 'categoria_crear', { nombre: 'Varios', tipo: 'egreso' })).id;
    expect(codigoDe(await dueno.herramienta('categoria_editar', { id: otra, nombre: 'Transferencia' }))).toBe('conflicto');
  });

  it('un movimiento a mano no puede usar la categoría ni el origen de una transferencia', async () => {
    const cat = (await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items.find((c: any) => c.nombre === 'Transferencia');
    expect(codigoDe(await dueno.herramienta('movimiento_registrar', { tipo: 'egreso', montoCentimos: 100, categoriaId: cat.id }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('movimiento_registrar', { tipo: 'egreso', montoCentimos: 100, origenRef: 'transferencia:falsa' }))).toBe('argumentos_invalidos');
  });

  it('una empresa con catálogo anterior las recibe en su primera transferencia', async () => {
    const owner = abrirPool('owner');
    try {
      await comoEmpresa(owner, B, (c) => c.query(`delete from registro.categorias where tenant_id = $1 and nombre_normalizado = 'transferencia'`, [B]), { confirmar: true });
    } finally {
      await owner.end();
    }
    const otra = (await datosDe(ajeno, 'cuenta_crear', { nombre: 'Banco B', tipo: 'banco' })).id;
    const r = await transferir(ajeno, { origenId: ajena, destinoId: otra, montoCentimos: 500 });
    expect(r.cuerpo.datos.egreso.categoriaNombre).toBe('Transferencia');
    expect((await datosDe(ajeno, 'categorias_listar')).items.filter((c: any) => c.nombre === 'Transferencia')).toHaveLength(2);
  });
});

describe('anular una transferencia', () => {
  it('anular una pata anula las dos: cada cuenta recupera su saldo, con confirmación y dos eventos', async () => {
    const t = (await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 7_500 })).cuerpo.datos;
    const antes = await saldos();
    const { respuesta, resumen } = await confirmando(dueno, 'movimiento_anular', { id: t.ingreso.id, motivo: 'Se depositó en otro banco' });
    expect(resumen).toBe(`Anularás la transferencia de S/ 75.00 de «Caja» a «Banco»: se anulan sus dos movimientos (${t.egreso.codigo} y ${t.ingreso.codigo}) y cada cuenta recupera su saldo anterior.`);
    expect(respuesta.cuerpo.datos).toMatchObject({ id: t.ingreso.id, estado: 'anulado', transferenciaId: t.transferenciaId });
    expect(await saldos()).toMatchObject({ [caja]: antes[caja]! + 7_500, [banco]: antes[banco]! - 7_500 });
    expect((await patas(A, t.transferenciaId)).map((p: any) => p.estado)).toEqual(['anulado', 'anulado']);
    const anulados = (await eventosDe(appPool, A, 'movimiento.anulado')).map((e) => e.carga.id);
    expect(anulados).toEqual(expect.arrayContaining([t.egreso.id, t.ingreso.id]));
    // Ni la otra pata ni la misma se pueden anular de nuevo.
    expect(codigoDe((await confirmando(dueno, 'movimiento_anular', { id: t.egreso.id, motivo: 'otra vez' })).respuesta)).toBe('conflicto');
  });

  it('dos anulaciones a la vez (una por pata) dejan las dos patas anuladas una sola vez', async () => {
    const t = (await transferir(dueno, { origenId: caja, destinoId: banco, montoCentimos: 300 })).cuerpo.datos;
    const antes = await saldos();
    const r = await Promise.all([t.egreso.id, t.ingreso.id].map((id) => confirmando(dueno, 'movimiento_anular', { id, motivo: 'A la vez' })));
    expect(r.map((x) => x.respuesta.estado).sort()).toEqual([200, 409]);
    expect(await saldos()).toMatchObject({ [caja]: antes[caja]! + 300, [banco]: antes[banco]! - 300 });
    expect((await eventosDe(appPool, A, 'movimiento.anulado')).filter((e) => [t.egreso.id, t.ingreso.id].includes(e.carga.id))).toHaveLength(2);
  });
});

describe('concurrencia: saldos consistentes', () => {
  it('doce transferencias simultáneas en los dos sentidos: cada una deja sus dos patas y la suma de las cuentas no cambia', async () => {
    const previos = await saldos();
    const total = Object.values(previos).reduce((a: number, b: any) => a + b, 0) as number;
    const montos = Array.from({ length: 12 }, (_, i) => 101 + i);
    const r = await Promise.all(montos.map((m, i) => transferir(dueno, i % 2 === 0 ? { origenId: caja, destinoId: banco, montoCentimos: m } : { origenId: banco, destinoId: caja, montoCentimos: m })));
    expect(r.map((x) => x.estado)).toEqual(Array(12).fill(200));
    const netoDeCaja = montos.reduce((s, m, i) => s + (i % 2 === 0 ? -m : m), 0);
    const ahora = await saldos();
    expect(Object.values(ahora).reduce((a: number, b: any) => a + b, 0)).toBe(total);
    expect(ahora[caja]).toBe(previos[caja]! + netoDeCaja);
    expect(ahora[banco]).toBe(previos[banco]! - netoDeCaja);
    const numeros = r.flatMap((x) => [x.cuerpo.datos.egreso.numero, x.cuerpo.datos.ingreso.numero]);
    expect(new Set(numeros).size).toBe(24);
    for (const x of r) expect(await patas(A, x.cuerpo.datos.transferenciaId)).toHaveLength(2);
  });
});

describe('permisos y alcance (R2, R4, R17)', () => {
  it('un member con nivel lectura recibe modulo_solo_lectura y no cambia nada', async () => {
    const antes = await saldos();
    const r = await transferir(lector, { origenId: caja, destinoId: banco, montoCentimos: 100 });
    expect(r.estado).toBe(403);
    expect(codigoDe(r)).toBe('modulo_solo_lectura');
    expect(await saldos()).toEqual(antes);
  });

  it('un member con alcance «propios» transfiere y solo ve sus patas; los reportes le siguen vetados', async () => {
    const t = (await transferir(vendedor, { origenId: caja, destinoId: banco, montoCentimos: 450 })).cuerpo.datos;
    expect(t.egreso.creadoPor).toBe(vendedor.usuarioId);
    expect((await datosDe(vendedor, 'movimientos_listar', { limite: 100 })).items.map((m: any) => m.id).sort()).toEqual([t.egreso.id, t.ingreso.id].sort());
    expect(codigoDe(await vendedor.herramienta('caja_del_dia', {}))).toBe('sin_permiso');
  });

  it('módulo en baja: la transferencia responde modulo_solo_lectura', async () => {
    await darDeBajaModulo(B, 'registro');
    expect(codigoDe(await transferir(ajeno, { origenId: ajena, destinoId: banco, montoCentimos: 100 }))).toBe('modulo_solo_lectura');
  });
});
