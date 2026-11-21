import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { datosDe, diaMas } from './pruebas-de-registro.js';

// Compra a crédito (F2-5): el plazo de la ficha comercial del proveedor fija el vencimiento del borrador de deuda por pagar.

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let ajeno: Sesion;
let A: string;
let B: string;
let conPlazo: string;
let sinFicha: string;
let enCero: string;
let ambos: string;
let futuro = Date.now() + 3_600_000;

const emitir = (empresaId: string, carga: Record<string, unknown>) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query(`insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, 'compra.recibida', $2::jsonb) returning id`, [empresaId, JSON.stringify(carga)])).rows[0].id as string, { confirmar: true });
async function drenar() {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const borradorDe = async (recepcionId: string) => (await datosDe(dueno, 'borradores_listar', { modulo: 'registro', limite: 100 })).items.filter((b: any) => b.origenRef === `compra:${recepcionId}`);
const compra = (proveedorId: string, numero: string, recepcionId: string) => ({
  ordenId: randomUUID(), recepcionId, numero, proveedorId, totalRecibidoCentimos: 25_000,
  lineas: [{ productoId: null, cantidadMilesimas: 5_000, costoUnitarioMilesimas: 5_000_000 }],
});

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno] = await Promise.all(['Dueña', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Crédito A');
  B = await crearEmpresa(ajeno, 'Crédito B');
  [conPlazo, sinFicha, enCero] = await Promise.all(['Proveedora a plazo', 'Proveedora sin ficha', 'Proveedora al contado'].map(async (nombre) => (await datosDe(dueno, 'clientes_crear', { nombre, tipo: 'proveedor' })).id));
  await datosDe(dueno, 'clientes_comercial_guardar', { clienteId: conPlazo, condicionPagoDias: 30 });
  await datosDe(dueno, 'clientes_comercial_guardar', { clienteId: enCero, condicionPagoDias: 0 });
  ambos = (await datosDe(dueno, 'clientes_crear', { nombre: 'Contacto cliente y proveedor', tipo: 'ambos' })).id;
  await datosDe(dueno, 'clientes_comercial_guardar', { clienteId: ambos, condicionPagoDias: 45 });
  await datosDe(dueno, 'registro_iniciar');
  await datosDe(ajeno, 'registro_iniciar');
  relevo = app.obtener(Relevo);
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('compra.recibida con proveedor a crédito', () => {
  it('30 días dan venceEn = día + 30, con fecha de hoy y el vencimiento en el resumen', { timeout: 120_000 }, async () => {
    const recepcion = randomUUID();
    await emitir(A, compra(conPlazo, 'COM-2026-0101', recepcion));
    await drenar();
    const vence = diaMas(30);
    const [b] = await borradorDe(recepcion);
    expect(b).toMatchObject({
      herramienta: 'deuda_crear', estado: 'pendiente',
      resumen: `Pagar S/ 250.00 por la compra COM-2026-0101 (vence el ${vence.split('-').reverse().join('/')})`,
      args: { tipo: 'por_pagar', contactoId: conPlazo, totalCentimos: 25_000, origenTipo: 'compra', origenId: recepcion, fecha: diaMas(0), venceEn: vence },
    });
    const aprobado = await datosDe(dueno, 'borrador_aprobar', { id: b.id });
    expect(aprobado.resultado).toMatchObject({ tipo: 'por_pagar', fecha: diaMas(0), venceEn: vence, totalCentimos: 25_000 });
  });

  it('un contacto «ambos» no hereda el plazo que se le da como cliente', { timeout: 120_000 }, async () => {
    const recepcion = randomUUID();
    await emitir(A, compra(ambos, 'COM-2026-0104', recepcion));
    await drenar();
    const [b] = await borradorDe(recepcion);
    expect(b.args).not.toHaveProperty('venceEn');
    expect(b.resumen).toBe('Pagar S/ 250.00 por la compra COM-2026-0104');
  });

  it('sin ficha o con 0 días queda igual que antes: sin fecha ni vencimiento', { timeout: 120_000 }, async () => {
    for (const [proveedor, numero] of [[sinFicha, 'COM-2026-0102'], [enCero, 'COM-2026-0103']] as const) {
      const recepcion = randomUUID();
      await emitir(A, compra(proveedor, numero, recepcion));
      await drenar();
      const [b] = await borradorDe(recepcion);
      expect(b.resumen).toBe(`Pagar S/ 250.00 por la compra ${numero}`);
      expect(b.args).toEqual({ tipo: 'por_pagar', contactoId: proveedor, concepto: `Compra ${numero}`, totalCentimos: 25_000, origenTipo: 'compra', origenId: recepcion });
    }
  });

  it('aislamiento: el plazo de una empresa no se aplica en otra', { timeout: 120_000 }, async () => {
    const recepcion = randomUUID();
    await emitir(B, compra(conPlazo, 'COM-2026-0104', recepcion));
    await drenar();
    const [b] = (await datosDe(ajeno, 'borradores_listar', { modulo: 'registro', limite: 100 })).items.filter((x: any) => x.origenRef === `compra:${recepcion}`);
    expect(b.resumen).toBe('Pagar S/ 250.00 por la compra COM-2026-0104');
    expect(b.args).not.toHaveProperty('venceEn');
    expect(await borradorDe(recepcion)).toEqual([]);
  });
});
