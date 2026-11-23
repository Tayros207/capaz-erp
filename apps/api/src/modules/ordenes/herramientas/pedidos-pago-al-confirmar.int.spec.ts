import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { diaMas } from '../../../pruebas/fechas.js';
import { codigo, confirmarCritica, crearBorrador, crearCliente, datos } from './pruebas-de-pedidos.js';

// El bloque «Pago» de «Nuevo pedido» arma sus tres casos desde la web con herramientas que ya existen (Pedidos decide, Registro guarda
// dinero y deuda). Aquí se repite esa misma secuencia por HTTP real, con los mismos argumentos, para comprobar que el servidor la acepta
// y que lo que lee la pantalla (deuda por origen, estado, vencida, cuenta) y la corrección de pedidos siguen cuadrando.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let A: string;
let cliente: string;
let caja: string; // la cuenta principal
let banco: string;

const ORIGEN = (id: string) => ({ origenTipo: 'pedido', origenId: id });
const deudaDe = async (pedidoId: string) =>
  datos(await dueno.herramienta('deudas_listar', { tipo: 'por_cobrar', estado: 'todas', ...ORIGEN(pedidoId), limite: 10 })).items as any[];
const movimientosDe = async (cuentaId: string) => datos(await dueno.herramienta('movimientos_listar', { cuentaId, limite: 50 })).items as any[];

/** Un pedido ya confirmado de S/ 118.00, como lo deja «Confirmar» antes de tocar Registro. */
async function confirmado() {
  const p = await crearBorrador(dueno, cliente);
  datos(await dueno.herramienta('pedido_confirmar', { id: p.id }));
  return { id: p.id as string, codigo: (await dueno.herramienta('pedido_ver', { id: p.id })).cuerpo.datos.codigo as string, total: 11_800 };
}
const crearDeuda = (p: { id: string; codigo: string; total: number }, extra: Record<string, unknown> = {}) =>
  dueno.herramienta('deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: `Pedido ${p.codigo}`, totalCentimos: p.total, ...ORIGEN(p.id), ...extra });
const crearDeudaConAdelanto = (p: { id: string; codigo: string; total: number }, extra: Record<string, unknown> = {}) =>
  dueno.herramienta('deuda_crear_con_adelanto', { tipo: 'por_cobrar', contactoId: cliente, concepto: `Pedido ${p.codigo}`, totalCentimos: p.total, adelantoCentimos: 4_000, ...ORIGEN(p.id), ...extra });
const corregir = async (id: string, fijarTotalCentimos: number) =>
  confirmarCritica(dueno, 'venta_corregir', { id, versionEsperada: 1, motivoCodigo: 'precio_acordado', fijarTotalCentimos });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  dueno = await abrirSesion(app, 'Dueña del pago');
  A = await crearEmpresa(dueno, 'Empresa del pago al confirmar');
  await Promise.all(['ordenes', 'registro'].map((m) => activarModulo(A, m)));
  cliente = await crearCliente(dueno, 'Botica Central');
  datos(await dueno.herramienta('registro_iniciar', {}));
  const cuentas = datos(await dueno.herramienta('cuentas_listar', { incluirArchivadas: false })).items as any[];
  caja = cuentas.find((c) => c.esPrincipal).id;
  banco = datos(await dueno.herramienta('cuenta_crear', { nombre: 'BCP Soles', tipo: 'banco', saldoInicialCentimos: 0 })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('«Pagó todo»: deuda por el total y abono del total', () => {
  it('queda pagada, sin saldo, con el dinero en la cuenta elegida y con el medio de pago elegido', async () => {
    const p = await confirmado();
    const d = datos(await crearDeuda(p));
    const r = datos(await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: p.total, medioDePago: 'yape', cuentaId: banco, descripcion: 'Cobro al confirmar el pedido' }));
    expect(r.deuda).toMatchObject({ estado: 'pagada', totalCentimos: 11_800, abonadoCentimos: 11_800, saldoCentimos: 0, vencida: false });
    expect(r.movimiento).toMatchObject({ tipo: 'ingreso', montoCentimos: 11_800, cuentaId: banco, medioDePago: 'yape', deudaId: d.id });
    // Lo que lee la pantalla del documento: la deuda por origen, en estado «pagada».
    expect((await deudaDe(p.id)).map((x) => [x.id, x.estado])).toEqual([[d.id, 'pagada']]);
    expect((await movimientosDe(banco)).some((m) => m.id === r.movimiento.id)).toBe(true);
  });
  it('sin cuenta elegida el dinero entra en la principal', async () => {
    const p = await confirmado();
    const d = datos(await crearDeuda(p));
    const r = datos(await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: p.total, medioDePago: 'efectivo' }));
    expect(r.movimiento.cuentaId).toBe(caja);
  });
  it('abonar más que el total se rechaza (por eso el cobro es siempre el total que confirmó el servidor)', async () => {
    const p = await confirmado();
    const d = datos(await crearDeuda(p));
    expect((await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: p.total + 1, medioDePago: 'efectivo' })).cuerpo.ok).toBe(false);
  });
});

describe('«Deja adelanto»: deuda y adelanto en una sola operación', () => {
  it('deja la deuda parcial con su saldo, su vencimiento y el movimiento del adelanto en la cuenta elegida', async () => {
    const p = await confirmado();
    const vence = diaMas(15);
    const r = datos(await crearDeudaConAdelanto(p, { medioDePago: 'transferencia', cuentaId: banco, venceEn: vence }));
    expect(r.deuda).toMatchObject({ estado: 'parcial', totalCentimos: 11_800, abonadoCentimos: 4_000, saldoCentimos: 7_800, venceEn: vence, vencida: false, origenTipo: 'pedido', origenId: p.id });
    expect(r.movimiento).toMatchObject({ tipo: 'ingreso', montoCentimos: 4_000, cuentaId: banco, medioDePago: 'transferencia', deudaId: r.deuda.id });
    expect((await deudaDe(p.id)).map((x) => x.id)).toEqual([r.deuda.id]);
  });
  it('un adelanto igual al total se rechaza y no crea nada: eso es «Pagó todo»', async () => {
    const p = await confirmado();
    const r = await crearDeudaConAdelanto(p, { adelantoCentimos: p.total });
    expect(codigo(r)).toBe('argumentos_invalidos');
    expect(await deudaDe(p.id)).toEqual([]);
  });
  it('repetirlo para el mismo pedido da conflicto y deja UNA sola deuda con UN solo adelanto (la web reutiliza la existente)', async () => {
    const p = await confirmado();
    const primera = datos(await crearDeudaConAdelanto(p));
    expect(codigo(await crearDeudaConAdelanto(p))).toBe('conflicto');
    const deudas = await deudaDe(p.id);
    expect(deudas.map((x) => x.id)).toEqual([primera.deuda.id]);
    expect(deudas[0]).toMatchObject({ abonadoCentimos: 4_000, saldoCentimos: 7_800 });
  });
  it('un vencimiento anterior a hoy se rechaza (la hoja lo avisa antes)', async () => {
    const p = await confirmado();
    expect(codigo(await crearDeudaConAdelanto(p, { venceEn: diaMas(-1) }))).toBe('argumentos_invalidos');
    expect(await deudaDe(p.id)).toEqual([]);
  });
});

describe('«Sin pago»: solo la deuda por el total', () => {
  it('queda pendiente por todo el total, con su vencimiento y sin mover dinero', async () => {
    const p = await confirmado();
    const antes = (await movimientosDe(caja)).length + (await movimientosDe(banco)).length;
    const d = datos(await crearDeuda(p, { venceEn: diaMas(30) }));
    expect(d).toMatchObject({ estado: 'pendiente', totalCentimos: 11_800, abonadoCentimos: 0, saldoCentimos: 11_800, venceEn: diaMas(30), vencida: false });
    expect((await movimientosDe(caja)).length + (await movimientosDe(banco)).length).toBe(antes);
  });
  it('sin vencimiento también se crea, y repetirla da conflicto (una sola deuda por pedido)', async () => {
    const p = await confirmado();
    const d = datos(await crearDeuda(p));
    expect(d.venceEn).toBeNull();
    expect(codigo(await crearDeuda(p))).toBe('conflicto');
    expect((await deudaDe(p.id)).map((x) => x.id)).toEqual([d.id]);
  });
  it('pasado el vencimiento la deuda figura vencida (lo que el documento dice «Vencida»); si se paga, deja de estarlo', async () => {
    const p = await confirmado();
    const d = datos(await crearDeuda(p, { fecha: diaMas(-10), venceEn: diaMas(-3) }));
    expect(d).toMatchObject({ estado: 'pendiente', vencida: true });
    expect((await deudaDe(p.id))[0]).toMatchObject({ estado: 'pendiente', vencida: true });
    const pagada = datos(await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: p.total, medioDePago: 'efectivo' }));
    expect(pagada.deuda).toMatchObject({ estado: 'pagada', vencida: false });
  });
});

describe('«Corregir pedido» sigue cuadrando con la deuda de cada caso', () => {
  it('«Pagó todo»: bajar el total deja el excedente a favor del cliente y la deuda pagada', async () => {
    const p = await confirmado();
    const d = datos(await crearDeuda(p));
    datos(await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: p.total, medioDePago: 'efectivo' }));
    const r = datos(await corregir(p.id, 7_000));
    expect(r).toMatchObject({ aFavorCentimos: 4_800, deuda: { id: d.id, estado: 'pagada', abonadoCentimos: 11_800 } });
  });
  it('«Deja adelanto»: bajar el total ajusta la deuda y respeta lo cobrado', async () => {
    const p = await confirmado();
    const dd = datos(await crearDeudaConAdelanto(p, { venceEn: diaMas(15) }));
    const r = datos(await corregir(p.id, 10_000));
    expect(r.pedido).toMatchObject({ version: 2, totalCentimos: 10_000 });
    expect(r.deuda).toMatchObject({ id: dd.deuda.id, totalCentimos: 10_000, abonadoCentimos: 4_000, saldoCentimos: 6_000, estado: 'parcial' });
  });
  it('«Sin pago»: bajar el total ajusta la deuda pendiente', async () => {
    const p = await confirmado();
    const d = datos(await crearDeuda(p, { venceEn: diaMas(30) }));
    const r = datos(await corregir(p.id, 10_000));
    expect(r.deuda).toMatchObject({ id: d.id, totalCentimos: 10_000, abonadoCentimos: 0, saldoCentimos: 10_000, estado: 'pendiente' });
  });
});
