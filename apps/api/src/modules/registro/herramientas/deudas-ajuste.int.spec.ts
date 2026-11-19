import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, datosDe, eventosDe } from './pruebas-de-registro.js';

// `deuda_ajustar`: la suma de ajustes, los CHECK de la deuda, el excedente a favor del cliente, la idempotencia por origenRef y el alcance.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let vendedor: Sesion; // registro completo, alcance «propios»
let lector: Sesion;
let ajeno: Sesion;
let A: string;
let contacto: string;

const deuda = (total: number, extra: Record<string, unknown> = {}) => datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Pedido de prueba', totalCentimos: total, ...extra });
const abonar = (id: string, monto: number) => datosDe(dueno, 'deuda_abonar', { id, montoCentimos: monto });
const ajustar = (s: Sesion, id: string, nuevoTotalCentimos: number, extra: Record<string, unknown> = {}) => s.herramienta('deuda_ajustar', { id, nuevoTotalCentimos, motivoCodigo: 'precio_acordado', ...extra });
const ok = async (id: string, nuevo: number, extra: Record<string, unknown> = {}) => {
  const r = await ajustar(dueno, id, nuevo, extra);
  if (!r.cuerpo?.ok) throw new Error(JSON.stringify(r.cuerpo));
  return r.cuerpo.datos;
};

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, vendedor, lector, ajeno] = await Promise.all(['Dueña', 'Vendedora', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Ajustes A');
  await crearEmpresa(ajeno, 'Ajustes B');
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  contacto = (await datosDe(dueno, 'clientes_crear', { nombre: 'Botica Central' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('deuda_ajustar', () => {
  it('sube y baja el total, deja el ajuste con signo y la suma de ajustes cuadra con el total original', async () => {
    const d = await deuda(10_000);
    const a = await ok(d.id, 12_000, { motivoTexto: ' Faltó el IGV ', motivoCodigo: 'igv' });
    expect(a.deuda).toMatchObject({ totalCentimos: 12_000, abonadoCentimos: 0, saldoCentimos: 12_000, estado: 'pendiente' });
    expect(a.ajuste).toMatchObject({ montoCentimos: 2_000, totalAnteriorCentimos: 10_000, totalNuevoCentimos: 12_000, aFavorCentimos: 0, motivoCodigo: 'igv', motivoTexto: 'Faltó el IGV', creadoPor: dueno.usuarioId, creadoPorNombre: 'Dueña' });
    await ok(d.id, 9_000);
    const v = await datosDe(dueno, 'deuda_ver', { id: d.id });
    expect(v).toMatchObject({ totalCentimos: 9_000, totalOriginalCentimos: 10_000, aFavorCentimos: 0 });
    expect(v.ajustes.map((x: any) => x.montoCentimos)).toEqual([-3_000, 2_000]);
    expect(v.ajustes.reduce((t: number, x: any) => t + x.montoCentimos, v.totalOriginalCentimos)).toBe(v.totalCentimos);
    const ev = (await eventosDe(appPool, A, 'deuda.ajustada')).filter((e) => e.carga.id === d.id);
    expect(ev.map((e) => e.carga.montoCentimos)).toEqual([2_000, -3_000]);
  });

  it('con abonos: lo abonado no se toca, el estado se recalcula y baja hasta lo abonado dejando la deuda pagada', async () => {
    const d = await deuda(10_000);
    await abonar(d.id, 6_000);
    expect((await ok(d.id, 8_000)).deuda).toMatchObject({ totalCentimos: 8_000, abonadoCentimos: 6_000, saldoCentimos: 2_000, estado: 'parcial' });
    const p = await ok(d.id, 6_000);
    expect(p.deuda).toMatchObject({ totalCentimos: 6_000, abonadoCentimos: 6_000, saldoCentimos: 0, estado: 'pagada' });
    expect(p.aFavorCentimos).toBe(0);
    expect((await eventosDe(appPool, A, 'deuda.pagada')).some((e) => e.carga.id === d.id)).toBe(true);
    // Pagada, vuelve a subir: queda parcial.
    expect((await ok(d.id, 7_000)).deuda).toMatchObject({ estado: 'parcial', saldoCentimos: 1_000 });
  });

  it('si el cliente pagó de más: la deuda queda en lo abonado y el excedente a favor se guarda en el ajuste (sin deuda por pagar)', async () => {
    const d = await deuda(10_000);
    await abonar(d.id, 10_000);
    const r = await ok(d.id, 7_000, { motivoCodigo: 'precio_acordado' });
    expect(r.deuda).toMatchObject({ totalCentimos: 10_000, abonadoCentimos: 10_000, estado: 'pagada' });
    expect(r.ajuste).toMatchObject({ montoCentimos: 0, aFavorCentimos: 3_000, totalAnteriorCentimos: 10_000, totalNuevoCentimos: 10_000 });
    expect(r.aFavorCentimos).toBe(3_000);
    const v = await datosDe(dueno, 'deuda_ver', { id: d.id });
    expect(v.aFavorCentimos).toBe(3_000);
    // Invariante: total del pedido (7 000) = total de la deuda − a favor.
    expect(v.totalCentimos - v.aFavorCentimos).toBe(7_000);
    // No se creó ninguna deuda por pagar ni movimiento de devolución.
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_pagar', estado: 'todas' })).items).toEqual([]);
    expect(v.abonos).toHaveLength(1);
    // Otra baja: el excedente crece; el mismo total otra vez no cambia nada.
    expect((await ok(d.id, 6_000)).aFavorCentimos).toBe(4_000);
    expect(codigoDe(await ajustar(dueno, d.id, 6_000))).toBe('argumentos_invalidos');
  });

  it('total cero o negativo se rechaza (se anula); anulada no se ajusta; nada que ajustar', async () => {
    const d = await deuda(10_000);
    expect(codigoDe(await ajustar(dueno, d.id, 0))).toBe('argumentos_invalidos');
    expect(codigoDe(await ajustar(dueno, d.id, -5))).toBe('argumentos_invalidos');
    expect(codigoDe(await ajustar(dueno, d.id, 10_000))).toBe('argumentos_invalidos');
    const e = await deuda(5_000);
    const anulada = await dueno.herramienta('deuda_anular', { id: e.id, motivo: 'Error' });
    const token = anulada.cuerpo?.requiereConfirmacion?.token;
    await dueno.herramienta('deuda_anular', { id: e.id, motivo: 'Error' }, { confirmacion: token });
    expect(codigoDe(await ajustar(dueno, e.id, 6_000))).toBe('conflicto');
  });

  it('origenRef vuelve idempotente: repetirla no duplica el ajuste; otra deuda con la misma referencia choca', async () => {
    const d = await deuda(10_000);
    const primera = await ok(d.id, 9_000, { origenRef: 'pedido:abc:v2' });
    expect(primera.yaAplicado).toBe(false);
    const repetida = await ok(d.id, 9_000, { origenRef: 'pedido:abc:v2' });
    expect(repetida).toMatchObject({ yaAplicado: true });
    expect(repetida.ajuste.id).toBe(primera.ajuste.id);
    expect((await datosDe(dueno, 'deuda_ver', { id: d.id })).ajustes).toHaveLength(1);
    // Aunque ahora pida otro total con la misma referencia, no se aplica dos veces.
    expect((await ok(d.id, 5_000, { origenRef: 'pedido:abc:v2' })).deuda.totalCentimos).toBe(9_000);
    const otra = await deuda(3_000);
    expect(codigoDe(await ajustar(dueno, otra.id, 2_000, { origenRef: 'pedido:abc:v2' }))).toBe('conflicto');
  });

  it('el vencimiento y el cliente se pueden mover; el cliente no si hay abonos; solo vencimiento no crea ajuste', async () => {
    const d = await deuda(10_000, { fecha: '2099-01-01' });
    const solo = await ok(d.id, 10_000, { venceEn: '2099-02-01' });
    expect(solo).toMatchObject({ ajuste: null, deuda: { venceEn: '2099-02-01', totalCentimos: 10_000 } });
    expect(codigoDe(await ajustar(dueno, d.id, 10_000, { venceEn: '2098-01-01' }))).toBe('argumentos_invalidos');
    const otro = (await datosDe(dueno, 'clientes_crear', { nombre: 'Otro Cliente' })).id;
    expect((await ok(d.id, 11_000, { contactoId: otro })).deuda.contactoId).toBe(otro);
    await abonar(d.id, 1_000);
    expect(codigoDe(await ajustar(dueno, d.id, 11_000, { contactoId: contacto }))).toBe('conflicto');
  });

  it('un CHECK roto no deja medias tintas y los ajustes son inmutables', async () => {
    const d = await deuda(10_000);
    const a = await ok(d.id, 8_000);
    await expect(comoEmpresa(appPool, A, (c) => c.query(`update registro.deuda_ajustes set monto_centimos = 0 where id = $1`, [a.ajuste.id]), { confirmar: true })).rejects.toThrow();
    await expect(comoEmpresa(appPool, A, (c) => c.query(`delete from registro.deuda_ajustes where id = $1`, [a.ajuste.id]), { confirmar: true })).rejects.toThrow();
    await expect(
      comoEmpresa(appPool, A, (c) => c.query(`insert into registro.deuda_ajustes (tenant_id, deuda_id, monto_centimos, total_anterior_centimos, total_nuevo_centimos, motivo_codigo, creado_por) values ($1, $2, 5, 8000, 8000, 'otro', 'x')`, [A, d.id]), { confirmar: true }),
    ).rejects.toThrow();
  });

  it('permisos: lector no ajusta; «propios» solo sus deudas; otra empresa no la ve', async () => {
    const d = await deuda(10_000);
    expect(codigoDe(await ajustar(lector, d.id, 9_000))).toBe('modulo_solo_lectura');
    expect(codigoDe(await ajustar(vendedor, d.id, 9_000))).toBe('no_encontrado');
    expect(codigoDe(await ajustar(ajeno, d.id, 9_000))).toBe('no_encontrado');
    const propia = await datosDe(vendedor, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Mía', totalCentimos: 4_000 });
    expect((await (await ajustar(vendedor, propia.id, 3_000)).cuerpo).ok).toBe(true);
    const lista = await datosDe(vendedor, 'deuda_ajustes_listar', { origenRefs: ['pedido:zzz:v2'] });
    expect(lista.items).toEqual([]);
  });
});
