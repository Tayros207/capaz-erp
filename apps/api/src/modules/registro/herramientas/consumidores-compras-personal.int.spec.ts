import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type pg from 'pg';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { datosDe, diaMas } from './pruebas-de-registro.js';

// Consumidores de `compra.recibida` y `adelanto.registrado` (carril registro-s4): solo proponen borradores (R5).

let app: AppDePruebas;
let appPool: pg.Pool;
let sistema: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let ajeno: Sesion;
let A: string;
let B: string;
let proveedor: string;
let futuro = Date.now() + 3_600_000;

const emitir = (empresaId: string, tipo: string, carga: Record<string, unknown>) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query(`insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, $2, $3::jsonb) returning id`, [empresaId, tipo, JSON.stringify(carga)])).rows[0].id as string, { confirmar: true });
async function drenar() {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const borradores = async (s: Sesion = dueno) => (await datosDe(s, 'borradores_listar', { modulo: 'registro', limite: 100 })).items;
const tabla = (empresaId: string, nombre: string) => comoEmpresa(appPool, empresaId, async (c) => (await c.query(`select * from registro.${nombre}`)).rows);

const recepcionId = randomUUID();
const compra = (extra: Record<string, unknown> = {}) => ({
  ordenId: randomUUID(), recepcionId, numero: 'COM-2026-0007', proveedorId: proveedor, totalRecibidoCentimos: 25_000,
  lineas: [{ productoId: null, cantidadMilesimas: 5_000, costoUnitarioMilesimas: 5_000_000 }], ...extra,
});
const adelantoId = randomUUID();
const adelanto = (extra: Record<string, unknown> = {}) => ({ adelantoId, colaboradorId: randomUUID(), montoCentimos: 15_000, fecha: diaMas(0), ...extra });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  sistema = abrirPool('sistema');
  [dueno, ajeno] = await Promise.all(['Dueña', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Consumidores A');
  B = await crearEmpresa(ajeno, 'Consumidores B');
  proveedor = (await datosDe(dueno, 'clientes_crear', { nombre: 'Proveedora Lima' })).id;
  await datosDe(dueno, 'registro_iniciar');
  await datosDe(ajeno, 'registro_iniciar');
  relevo = app.obtener(Relevo);
});
afterAll(async () => {
  await app.cerrar();
  await Promise.all([appPool.end(), sistema.end()]);
});

describe('compra.recibida', () => {
  it('deja UN borrador de deuda por pagar por lo recibido y no crea la deuda; la reentrega no duplica', { timeout: 120_000 }, async () => {
    const eventoId = await emitir(A, 'compra.recibida', compra());
    await drenar();
    const lista = await borradores();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      herramienta: 'deuda_crear', modulo: 'registro', estado: 'pendiente', origen: 'modulo', origenRef: `compra:${recepcionId}`, propuestoPor: 'sistema',
      resumen: 'Pagar S/ 250.00 por la compra COM-2026-0007',
      args: { tipo: 'por_pagar', contactoId: proveedor, concepto: 'Compra COM-2026-0007', totalCentimos: 25_000, origenTipo: 'compra', origenId: recepcionId },
    });
    expect(await tabla(A, 'deudas')).toHaveLength(0);
    await sistema.query('update core.eventos_salida set procesado_en = null where id = $1', [eventoId]);
    await drenar();
    expect(await borradores()).toHaveLength(1);
  });

  it('otra empresa no recibe el borrador; un total en cero no propone nada', { timeout: 120_000 }, async () => {
    expect(await borradores(ajeno)).toEqual([]);
    await emitir(A, 'compra.recibida', compra({ recepcionId: randomUUID(), totalRecibidoCentimos: 0 }));
    await drenar();
    expect(await borradores()).toHaveLength(1);
  });

  it('aprobar el borrador crea la deuda por pagar con su origen; otra entrega de la misma recepción ya no propone', { timeout: 120_000 }, async () => {
    const [b] = await borradores();
    const r = await datosDe(dueno, 'borrador_aprobar', { id: b.id });
    expect(r.resultado).toMatchObject({ tipo: 'por_pagar', estado: 'pendiente', totalCentimos: 25_000, origenTipo: 'compra', origenId: recepcionId });
    await emitir(A, 'compra.recibida', compra());
    await drenar();
    expect((await borradores()).filter((x: any) => x.estado === 'pendiente')).toEqual([]);
  });
});

describe('adelanto.registrado', () => {
  it('deja UN borrador de egreso en «Sueldos» sin el nombre del colaborador; la reentrega no duplica', { timeout: 120_000 }, async () => {
    const movimientosAntes = (await tabla(A, 'movimientos')).length;
    const eventoId = await emitir(A, 'adelanto.registrado', adelanto());
    await drenar();
    const lista = (await borradores()).filter((x: any) => x.herramienta === 'movimiento_registrar');
    expect(lista).toHaveLength(1);
    const sueldos = (await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items.find((c: any) => c.nombre === 'Sueldos');
    expect(lista[0]).toMatchObject({
      estado: 'pendiente', origen: 'modulo', origenRef: `adelanto:${adelantoId}`, propuestoPor: 'sistema',
      args: { tipo: 'egreso', montoCentimos: 15_000, fecha: diaMas(0), categoriaId: sueldos.id, origen: 'modulo', origenRef: `adelanto:${adelantoId}` },
    });
    expect(JSON.stringify(lista[0])).not.toContain('colaborador');
    expect(await tabla(A, 'movimientos')).toHaveLength(movimientosAntes);
    await sistema.query('update core.eventos_salida set procesado_en = null where id = $1', [eventoId]);
    await drenar();
    expect((await borradores()).filter((x: any) => x.herramienta === 'movimiento_registrar')).toHaveLength(1);
    expect((await borradores(ajeno))).toEqual([]);
    void B;
  });

  it('aprobar el borrador registra el egreso en Sueldos', { timeout: 120_000 }, async () => {
    const [b] = (await borradores()).filter((x: any) => x.herramienta === 'movimiento_registrar');
    const r = await datosDe(dueno, 'borrador_aprobar', { id: b.id });
    expect(r.resultado).toMatchObject({ tipo: 'egreso', montoCentimos: 15_000, origen: 'modulo' });
  });
});

describe('pedido.entregado', () => {
  const pedidoId = randomUUID();
  const entregado = (id = pedidoId) => ({ id, codigo: 'PED-2026-0009', clienteId: proveedor });
  const cobros = async (s: Sesion = dueno) => (await borradores(s)).filter((x: any) => x.herramienta === 'deuda_abonar' && x.estado === 'pendiente');

  it('sin deuda viva del pedido no propone nada', { timeout: 120_000 }, async () => {
    await emitir(A, 'pedido.entregado', entregado());
    await drenar();
    expect(await cobros()).toEqual([]);
  });

  it('con saldo propone UN cobro por el saldo, sin cobrar; la reentrega y otra entrega no duplican', { timeout: 120_000 }, async () => {
    const deuda = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: proveedor, concepto: 'Pedido PED-2026-0009', totalCentimos: 50_000, origenTipo: 'pedido', origenId: pedidoId });
    await datosDe(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 20_000 });
    const eventoId = await emitir(A, 'pedido.entregado', entregado());
    await drenar();
    const lista = await cobros();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      herramienta: 'deuda_abonar', origen: 'modulo', origenRef: `pedido:${pedidoId}`, propuestoPor: 'sistema',
      resumen: 'Cobrar el saldo de S/ 300.00 del pedido PED-2026-0009',
      args: { id: deuda.id, montoCentimos: 30_000 },
    });
    expect((await tabla(A, 'deudas')).find((d: any) => d.id === deuda.id).abonado_centimos).toBe('20000');
    await sistema.query('update core.eventos_salida set procesado_en = null where id = $1', [eventoId]);
    await emitir(A, 'pedido.entregado', entregado());
    await drenar();
    expect(await cobros()).toHaveLength(1);
    expect(await cobros(ajeno)).toEqual([]);
  });

  it('aprobado el cobro la deuda queda saldada y una nueva entrega ya no propone', { timeout: 120_000 }, async () => {
    const [b] = await cobros();
    await datosDe(dueno, 'borrador_aprobar', { id: b.id });
    await emitir(A, 'pedido.entregado', entregado());
    await drenar();
    expect(await cobros()).toEqual([]);
  });
});

describe('R5: los consumidores no ejecutan ni escriben', () => {
  it('consumidores.ts no importa el ejecutor ni llama a ejecutarDentro ni inserta en tablas del módulo', () => {
    const fuente = readFileSync(new URL('../consumidores.ts', import.meta.url), 'utf8');
    const importaciones = fuente.split('\n').filter((l) => l.startsWith('import '));
    expect(importaciones.join('\n')).not.toMatch(/ejecutor|herramientas\//i);
    expect(fuente).not.toMatch(/ejecutarDentro\(|\.ejecutar\(/);
    expect(fuente).not.toMatch(/\.(insert|update|delete)\(/);
  });
});
