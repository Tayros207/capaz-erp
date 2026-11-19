import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, datosDe, diaMas } from './pruebas-de-registro.js';

// `deudas_listar` con filtro por origen y el consumidor de `pedido.datos_editados` (solo propone: R5).

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let vendedor: Sesion; // registro completo, alcance «propios»
let ajeno: Sesion;
let A: string;
let contacto: string;
let futuro = Date.now() + 3_600_000;

const emitir = (tipo: string, carga: Record<string, unknown>) =>
  comoEmpresa(appPool, A, async (c) => (await c.query(`insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, $2, $3::jsonb) returning id`, [A, tipo, JSON.stringify(carga)])).rows[0].id as string, { confirmar: true });
async function drenar() {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const pendientes = async () => ((await datosDe(dueno, 'borradores_listar', { modulo: 'registro', limite: 100 })).items as any[]).filter((b) => b.estado === 'pendiente');

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  [dueno, vendedor, ajeno] = await Promise.all(['Dueña', 'Vendedora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Origen A');
  await crearEmpresa(ajeno, 'Origen B');
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  contacto = (await datosDe(dueno, 'clientes_crear', { nombre: 'Botica Central' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('deudas_listar por origen', () => {
  const pedidoId = randomUUID();
  const otroId = randomUUID();

  it('devuelve solo la deuda de ese origen, sin recorrer páginas, y respeta el estado', async () => {
    const mia = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Pedido uno', totalCentimos: 5_000, origenTipo: 'pedido', origenId: pedidoId });
    await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Pedido dos', totalCentimos: 6_000, origenTipo: 'pedido', origenId: otroId });
    await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Sin origen', totalCentimos: 7_000 });
    const r = await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas', origenTipo: 'pedido', origenId: pedidoId, limite: 10 });
    expect(r.items.map((d: any) => d.id)).toEqual([mia.id]);
    // El mismo id con otro tipo de origen no coincide.
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas', origenTipo: 'produccion', origenId: pedidoId })).items).toEqual([]);
  });

  it('el origen lleva tipo e identificador, los dos o ninguno', async () => {
    expect(codigoDe(await dueno.herramienta('deudas_listar', { tipo: 'por_cobrar', origenTipo: 'pedido' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('deudas_listar', { tipo: 'por_cobrar', origenId: pedidoId }))).toBe('argumentos_invalidos');
  });

  it('otra empresa no ve la deuda; el de alcance «propios» no ve la que no creó', async () => {
    expect((await datosDe(ajeno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas', origenTipo: 'pedido', origenId: otroId })).items).toEqual([]);
    expect((await datosDe(vendedor, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas', origenTipo: 'pedido', origenId: otroId })).items).toEqual([]);
  });
});

describe('pedido.datos_editados propone mover el vencimiento (solo propone)', () => {
  const pedido = { id: randomUUID(), codigo: 'PED-PRI-2099-0001', clienteId: '' };
  let deudaId: string;

  it('si la deuda vencía en la entrega anterior propone deuda_editar con el nuevo vencimiento y nada más', { timeout: 120_000 }, async () => {
    pedido.clienteId = contacto;
    const antes = diaMas(10);
    const nueva = diaMas(20);
    const d = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Pedido con entrega', totalCentimos: 9_000, venceEn: antes, origenTipo: 'pedido', origenId: pedido.id });
    deudaId = d.id;
    const eventoId = await emitir('pedido.datos_editados', { ...pedido, entregaAnterior: antes, entregaNueva: nueva });
    await drenar();
    const [b, ...resto] = await pendientes();
    expect(resto).toEqual([]);
    expect(b).toMatchObject({ herramienta: 'deuda_editar', origen: 'modulo', origenRef: `pedido:${pedido.id}`, propuestoPor: 'sistema', args: { id: deudaId, venceEn: nueva } });
    expect((await datosDe(dueno, 'deuda_ver', { id: deudaId })).venceEn).toBe(antes);
    // El mismo evento entregado otra vez no propone de nuevo (idempotencia del relevo).
    const sistema = abrirPool('sistema');
    await sistema.query('update core.eventos_salida set procesado_en = null where id = $1', [eventoId]);
    await sistema.end();
    await drenar();
    expect(await pendientes()).toHaveLength(1);
    // Aprobarlo mueve el vencimiento.
    expect((await dueno.herramienta('borrador_aprobar', { id: b.id })).cuerpo.ok).toBe(true);
    expect((await datosDe(dueno, 'deuda_ver', { id: deudaId })).venceEn).toBe(nueva);
  });

  it('sin cambio de entrega, con otro vencimiento acordado o sin deuda viva no propone nada', { timeout: 120_000 }, async () => {
    const hoy = diaMas(30);
    await emitir('pedido.datos_editados', { ...pedido, entregaAnterior: hoy, entregaNueva: hoy }); // la entrega no cambió
    await emitir('pedido.datos_editados', { ...pedido, entregaAnterior: diaMas(5), entregaNueva: diaMas(6) }); // la deuda no vencía ahí
    await emitir('pedido.datos_editados', { id: randomUUID(), codigo: 'PED-X', clienteId: contacto, entregaAnterior: diaMas(1), entregaNueva: diaMas(2) }); // sin deuda
    await drenar();
    expect(await pendientes()).toEqual([]);
  });
});
