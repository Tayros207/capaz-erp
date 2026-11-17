import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { Relevo } from '../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { crearCliente, datos } from './herramientas/pruebas-de-pedidos.js';

// Puente cotización → pedido (carril ordenes-s3): los consumidores solo proponen borradores (R5). El evento se
// emite a mano porque el Cotizador (s2) aún no lo emite.

let app: AppDePruebas;
let appPool: pg.Pool;
let sistema: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let ajeno: Sesion;
let A: string;
let cliente: string;
let futuro = Date.now() + 3_600_000;

const emitir = (empresaId: string, tipo: string, carga: Record<string, unknown>) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query(`insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, $2, $3::jsonb) returning id`, [empresaId, tipo, JSON.stringify(carga)])).rows[0].id as string, { confirmar: true });
async function drenar() {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const borradores = async (s: Sesion = dueno) => datos(await s.herramienta('borradores_listar', { modulo: 'ordenes', limite: 100 })).items as any[];
const pedidos = async () => datos(await dueno.herramienta('pedidos_listar', { estado: 'todos', limite: 100 })).items as any[];

const aceptada = (id: string, precioMilesimas: number, extra: Record<string, unknown> = {}) => ({
  id, codigo: 'COT-2026-0001', version: 1, clienteId: cliente, igvPorcentaje: 18,
  subtotalCentimos: 0, igvCentimos: 0, totalCentimos: Math.round(precioMilesimas / 10),
  lineas: [{ productoId: null, descripcion: '2.500 unidades · Volantes A5', unidad: 'lote', cantidadMilesimas: 1000, precioUnitarioMilesimas: precioMilesimas, afectoIgv: true }],
  ...extra,
});

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  sistema = abrirPool('sistema');
  [dueno, ajeno] = await Promise.all(['Dueña', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Puente A');
  const B = await crearEmpresa(ajeno, 'Puente B');
  await Promise.all([activarModulo(A, 'ordenes'), activarModulo(B, 'ordenes')]);
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  relevo = app.obtener(Relevo);
});
afterAll(async () => {
  await app.cerrar();
  await Promise.all([appPool.end(), sistema.end()]);
});

describe('cotizacion.aceptada', () => {
  it('P1: aprobar el borrador crea el pedido con los totales exactos de cada vector', { timeout: 120_000 }, async () => {
    const vectores: [number, number, number, number][] = [
      [408_730, 34_638, 6_235, 40_873],
      [170_930, 14_486, 2_607, 17_093],
      [260_000, 22_034, 3_966, 26_000],
      [655_880, 55_583, 10_005, 65_588],
    ];
    for (const [precio] of vectores) await emitir(A, 'cotizacion.aceptada', aceptada(randomUUID(), precio));
    await drenar();
    const lista = await borradores();
    expect(lista).toHaveLength(4);
    for (const [precio, subtotal, igv, total] of vectores) {
      const b = lista.find((x) => x.args.lineas[0].precioUnitarioMilesimas === precio);
      expect(b).toMatchObject({ herramienta: 'pedido_crear', modulo: 'ordenes', estado: 'pendiente', origen: 'modulo', propuestoPor: 'sistema', prioridad: 'normal' });
      const r = datos(await dueno.herramienta('borrador_aprobar', { id: b.id }));
      const pedido = r.resultado ?? r;
      expect(pedido).toMatchObject({ subtotalCentimos: subtotal, igvCentimos: igv, totalCentimos: total, estado: 'borrador', origenTipo: 'cotizacion' });
    }
  });

  it('P2: el mismo evento entregado dos veces deja un borrador; un segundo evento con el borrador pendiente tampoco duplica', { timeout: 120_000 }, async () => {
    const id = randomUUID();
    const eventoId = await emitir(A, 'cotizacion.aceptada', aceptada(id, 408_730));
    await drenar();
    await sistema.query('update core.eventos_salida set procesado_en = null where id = $1', [eventoId]);
    await drenar();
    const propios = (await borradores()).filter((b) => b.origenRef === `cotizacion:${id}`);
    expect(propios).toHaveLength(1);
    expect(propios[0].resumen).toBe('Crear el pedido de la cotización COT-2026-0001 por S/ 408.73');
    expect(propios[0].args.notas).toBe('Cotización COT-2026-0001');

    // Un segundo evento con la misma cotización, antes de aprobar el primero, NO deja otro borrador (mira la bandeja).
    await emitir(A, 'cotizacion.aceptada', aceptada(id, 408_730));
    await drenar();
    const unico = (await borradores()).filter((b) => b.origenRef === `cotizacion:${id}`);
    expect(unico).toHaveLength(1);
    datos(await dueno.herramienta('borrador_aprobar', { id: unico[0].id }));
    expect((await pedidos()).filter((p) => p.origenId === id)).toHaveLength(1);
    // Con el pedido ya vivo, un evento nuevo no propone nada.
    const antes = (await borradores()).length;
    await emitir(A, 'cotizacion.aceptada', aceptada(id, 408_730));
    await drenar();
    expect((await borradores()).length).toBe(antes);
  });

  it('un IGV distinto de 18 y 0 propone con prioridad alta y avisa en la nota; otra empresa no recibe nada', { timeout: 120_000 }, async () => {
    const id = randomUUID();
    await emitir(A, 'cotizacion.aceptada', aceptada(id, 100_000, { igvPorcentaje: 10 }));
    await drenar();
    const b = (await borradores()).find((x) => x.origenRef === `cotizacion:${id}`);
    expect(b.prioridad).toBe('alta');
    expect(b.args.notas).toContain('revisa los importes');
    expect(await borradores(ajeno)).toEqual([]);
  });
});

describe('cotizacion.anulada', () => {
  const anulada = (id: string) => ({ id, codigo: 'COT-2026-0009', estadoAnterior: 'aceptada' });
  const aprobarPedidoDe = async (id: string) => {
    await emitir(A, 'cotizacion.aceptada', aceptada(id, 408_730));
    await drenar();
    const b = (await borradores()).find((x) => x.origenRef === `cotizacion:${id}` && x.estado === 'pendiente');
    return datos(await dueno.herramienta('borrador_aprobar', { id: b.id }));
  };

  it('con el pedido en borrador propone cancelarlo con prioridad alta; aprobarlo lo cancela', { timeout: 120_000 }, async () => {
    const id = randomUUID();
    await aprobarPedidoDe(id);
    await emitir(A, 'cotizacion.anulada', anulada(id));
    await drenar();
    const b = (await borradores()).find((x) => x.herramienta === 'pedido_cancelar' && x.origenRef === `cotizacion:${id}`);
    expect(b).toMatchObject({ prioridad: 'alta', propuestoPor: 'sistema', args: { motivo: 'Cotización COT-2026-0009 anulada' } });
    const pide = await dueno.herramienta('borrador_aprobar', { id: b.id });
    datos(await dueno.herramienta('borrador_aprobar', { id: b.id, confirmacion: pide.cuerpo.requiereConfirmacion.token }));
    expect((await pedidos()).find((p) => p.origenId === id)?.estado).toBe('cancelado');
  });

  it('con el pedido confirmado, sin pedido o sin evento no propone nada', { timeout: 120_000 }, async () => {
    const id = randomUUID();
    const creado = await aprobarPedidoDe(id);
    datos(await dueno.herramienta('pedido_confirmar', { id: (creado.resultado ?? creado).id }));
    await emitir(A, 'cotizacion.anulada', anulada(id));
    await emitir(A, 'cotizacion.anulada', anulada(randomUUID()));
    await drenar();
    expect((await borradores()).filter((x) => x.herramienta === 'pedido_cancelar' && x.origenRef === `cotizacion:${id}`)).toEqual([]);
    expect((await borradores()).filter((x) => x.herramienta === 'pedido_cancelar')).toHaveLength(1);
  });

  it('P3: sin evento de aceptación no hay borrador', async () => {
    const otra = await abrirSesion(app, 'Sin eventos');
    await crearEmpresa(otra, 'Puente C');
    expect(await borradores(otra)).toEqual([]);
  });
});
