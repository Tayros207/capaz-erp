import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { aCentimos } from '@capaz/shared';
import { abrirSesion, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe, eventosDe } from './pruebas-de-registro.js';

// Casos de referencia a–h de la ficha §4.2 por HTTP real (par de `domain/casos-de-referencia.spec.ts`).
// Cada caso: una secuencia de deudas, abonos y anulaciones, y el saldo que debe quedar.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let A: string;
let contacto: string;

const soles = (texto: string): number => aCentimos(texto);
const nuevaDeuda = (total = '100.00', tipo = 'por_cobrar') =>
  datosDe(dueno, 'deuda_crear', { tipo, contactoId: contacto, concepto: 'Banner 3x2', totalCentimos: soles(total) });
const abonar = (id: string, monto: string, clave?: string) => dueno.herramienta('deuda_abonar', { id, montoCentimos: soles(monto) }, { clave });
const ver = (id: string) => datosDe(dueno, 'deuda_ver', { id });
const abonosVivos = (id: string) =>
  comoEmpresa(appPool, A, async (c) => Number((await c.query(`select count(*) from registro.movimientos where deuda_id = $1 and estado = 'activo'`, [id])).rows[0].count));
const eventosDeDeuda = async (tipo: string, id: string) => (await eventosDe(appPool, A, tipo)).filter((e) => e.carga.id === id);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  dueno = await abrirSesion(app, 'Dueña');
  A = await crearEmpresa(dueno, 'Casos de referencia');
  contacto = (await datosDe(dueno, 'clientes_crear', { nombre: 'José Pérez' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('casos de referencia de deudas y abonos (HTTP)', () => {
  it('a. 100.00 → abono 30.00 → abono 70.00 ⇒ pagada, saldo 0, deuda.pagada una sola vez', async () => {
    const d = await nuevaDeuda();
    const uno = await abonar(d.id, '30.00');
    expect(uno.cuerpo.datos.deuda).toMatchObject({ estado: 'parcial', abonadoCentimos: 3_000, saldoCentimos: 7_000 });
    expect(uno.cuerpo.datos.movimiento).toMatchObject({ tipo: 'ingreso', montoCentimos: 3_000, deudaId: d.id, contactoId: contacto, categoriaNombre: 'Cobros', cuentaNombre: 'Caja' });
    const dos = await abonar(d.id, '70.00');
    expect(dos.cuerpo.datos.deuda).toMatchObject({ estado: 'pagada', abonadoCentimos: 10_000, saldoCentimos: 0 });
    expect(await eventosDeDeuda('deuda.pagada', d.id)).toEqual([
      { tipo: 'deuda.pagada', carga: { id: d.id, codigo: d.codigo, tipo: 'por_cobrar', contactoId: contacto, totalCentimos: 10_000 } },
    ]);
    expect((await eventosDeDeuda('deuda.abonada', d.id)).map((e) => [e.carga.montoCentimos, e.carga.saldoCentimos])).toEqual([[3_000, 7_000], [7_000, 0]]);
    expect(codigoDe(await abonar(d.id, '0.01'))).toBe('conflicto');
    expect(await eventosDeDeuda('deuda.pagada', d.id)).toHaveLength(1);
  });

  it('b. 100.00 → abono 100.01 ⇒ conflicto, sin movimiento ni evento', async () => {
    const d = await nuevaDeuda();
    const r = await abonar(d.id, '100.01');
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error).toEqual({ codigo: 'conflicto', mensaje: 'El abono (S/ 100.01) supera el saldo pendiente (S/ 100.00).' });
    expect(await abonosVivos(d.id)).toBe(0);
    expect(await eventosDeDeuda('deuda.abonada', d.id)).toEqual([]);
    expect(await ver(d.id)).toMatchObject({ estado: 'pendiente', saldoCentimos: 10_000, abonos: [] });
  });

  it('c. 100.00 → abono 40.00 → anular ese movimiento ⇒ pendiente, saldo 100.00', async () => {
    const d = await nuevaDeuda();
    const abono = (await abonar(d.id, '40.00')).cuerpo.datos.movimiento;
    const { respuesta, resumen } = await confirmando(dueno, 'movimiento_anular', { id: abono.id, motivo: 'Se registró por error' });
    expect(resumen).toBe(`Anularás el ingreso ${abono.codigo} de S/ 40.00. La deuda ${d.codigo} volverá a tener S/ 100.00 de saldo.`);
    expect(respuesta.cuerpo.datos).toMatchObject({ id: abono.id, estado: 'anulado', motivoAnulacion: 'Se registró por error', anuladoEn: expect.any(String) });
    const final = await ver(d.id);
    expect(final).toMatchObject({ estado: 'pendiente', abonadoCentimos: 0, saldoCentimos: 10_000 });
    expect(final.abonos.map((m: any) => m.estado)).toEqual(['anulado']);
    expect(await eventosDeDeuda('movimiento.anulado', abono.id)).toEqual([{ tipo: 'movimiento.anulado', carga: { id: abono.id, codigo: abono.codigo, deudaId: d.id } }]);
  });

  it('d. 100.00 → abonos 60.00 y 40.00 → anular el de 40.00 ⇒ parcial, saldo 40.00', async () => {
    const d = await nuevaDeuda();
    await abonar(d.id, '60.00');
    const segundo = (await abonar(d.id, '40.00')).cuerpo.datos;
    expect(segundo.deuda.estado).toBe('pagada');
    const { respuesta } = await confirmando(dueno, 'movimiento_anular', { id: segundo.movimiento.id, motivo: 'Cheque sin fondos' });
    expect(respuesta.cuerpo.ok).toBe(true);
    expect(await ver(d.id)).toMatchObject({ estado: 'parcial', abonadoCentimos: 6_000, saldoCentimos: 4_000 });
    // Reabierta, vuelve a admitir abonos hasta su saldo y vuelve a emitir «pagada» al completarse.
    expect(codigoDe(await abonar(d.id, '40.01'))).toBe('conflicto');
    expect((await abonar(d.id, '40.00')).cuerpo.datos.deuda.estado).toBe('pagada');
    expect(await eventosDeDeuda('deuda.pagada', d.id)).toHaveLength(2);
  });

  it('e. dos abonos simultáneos de 60.00 sobre 100.00 ⇒ uno entra y el otro es conflicto (el bloqueo impide cobrar de más)', async () => {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const d = await nuevaDeuda();
      const r = await Promise.all([abonar(d.id, '60.00'), abonar(d.id, '60.00')]);
      expect(r.map((x) => x.estado).sort((a, b) => a - b)).toEqual([200, 409]);
      expect(codigoDe(r.find((x) => x.estado === 409)!)).toBe('conflicto');
      expect(await ver(d.id)).toMatchObject({ estado: 'parcial', abonadoCentimos: 6_000, saldoCentimos: 4_000 });
      expect(await abonosVivos(d.id)).toBe(1);
    }
  });

  it('f. el mismo abono con la misma Idempotency-Key dos veces ⇒ un solo movimiento y la misma respuesta, aunque la deuda ya esté pagada', async () => {
    const d = await nuevaDeuda();
    const clave = `abono-${randomUUID()}`;
    const a = await abonar(d.id, '100.00', clave);
    expect(a.cuerpo.datos.deuda.estado).toBe('pagada');
    const b = await abonar(d.id, '100.00', clave);
    expect(b.estado).toBe(200);
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect(await abonosVivos(d.id)).toBe(1);
    expect(await eventosDeDeuda('deuda.pagada', d.id)).toHaveLength(1);
    // Sin la clave, repetirlo sí es un abono nuevo y la regla lo frena.
    expect(codigoDe(await abonar(d.id, '100.00'))).toBe('conflicto');
    // Dos envíos simultáneos con la misma clave (doble toque): uno solo cobra.
    const d2 = await nuevaDeuda();
    const clave2 = `abono-${randomUUID()}`;
    const par = await Promise.all([abonar(d2.id, '50.00', clave2), abonar(d2.id, '50.00', clave2)]);
    expect(par.filter((x) => x.estado === 200).length).toBeGreaterThanOrEqual(1);
    expect(await abonosVivos(d2.id)).toBe(1);
    expect(await ver(d2.id)).toMatchObject({ abonadoCentimos: 5_000 });
  });

  it('g. deuda con un abono → deuda_anular ⇒ conflicto; tras anular el abono, se anula', async () => {
    const d = await nuevaDeuda();
    const abono = (await abonar(d.id, '25.00')).cuerpo.datos.movimiento;
    const intento = await dueno.herramienta('deuda_anular', { id: d.id, motivo: 'El cliente canceló' });
    expect(intento.estado).toBe(409);
    expect(intento.cuerpo.error).toEqual({ codigo: 'conflicto', mensaje: 'Anula primero su abono.' });
    expect((await ver(d.id)).estado).toBe('parcial');
    expect((await confirmando(dueno, 'movimiento_anular', { id: abono.id, motivo: 'Devuelto al cliente' })).respuesta.cuerpo.ok).toBe(true);
    const { respuesta, resumen } = await confirmando(dueno, 'deuda_anular', { id: d.id, motivo: 'El cliente canceló' });
    expect(resumen).toContain(d.codigo);
    expect(respuesta.cuerpo.datos).toMatchObject({ estado: 'anulada', motivoAnulacion: 'El cliente canceló', anuladoEn: expect.any(String), vencida: false });
    expect(await eventosDeDeuda('deuda.anulada', d.id)).toEqual([{ tipo: 'deuda.anulada', carga: { id: d.id, codigo: d.codigo } }]);
    expect(codigoDe(await abonar(d.id, '1.00'))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('deuda_anular', { id: d.id, motivo: 'otra vez' }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('deuda_editar', { id: d.id, concepto: 'Otro' }))).toBe('conflicto');
  });

  it('h. céntimos: 0.01 + 0.02 + 99.97 sobre 100.00 ⇒ pagada exacta', async () => {
    const d = await nuevaDeuda();
    for (const monto of ['0.01', '0.02', '99.97']) expect((await abonar(d.id, monto)).estado).toBe(200);
    const final = await ver(d.id);
    expect(final).toMatchObject({ estado: 'pagada', abonadoCentimos: 10_000, saldoCentimos: 0 });
    expect(final.abonos.map((m: any) => m.montoCentimos)).toEqual([1, 2, 9_997]);
    expect(await eventosDeDeuda('deuda.pagada', d.id)).toHaveLength(1);
  });
});

describe('una deuda por pagar', () => {
  it('su abono es un egreso con la categoría «Pagos», y avisa cuando deja la cuenta en negativo', async () => {
    const enCaja = (await datosDe(dueno, 'cuentas_listar')).items[0].saldoCentimos;
    expect(enCaja).toBeGreaterThan(10_000);
    const d = await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: contacto, concepto: 'Vinil y tinta', totalCentimos: enCaja + 5_000 });
    expect(d.codigo).toMatch(/^CXP-\d{4}-0001$/);
    const parte = await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: 10_000, medioDePago: 'transferencia' });
    expect(parte.cuerpo.datos.movimiento).toMatchObject({ tipo: 'egreso', categoriaNombre: 'Pagos', montoCentimos: 10_000, medioDePago: 'transferencia', descripcion: `Abono de ${d.codigo}` });
    expect(parte.cuerpo.datos.deuda.estado).toBe('parcial');
    expect(parte.cuerpo.avisos).toEqual([]);
    const resto = await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: enCaja - 5_000 });
    expect(resto.cuerpo.datos.deuda).toMatchObject({ estado: 'pagada', saldoCentimos: 0 });
    expect(resto.cuerpo.avisos).toEqual([{ codigo: 'saldo_negativo', nivel: 'comercial', mensaje: 'La cuenta «Caja» queda con saldo negativo.' }]);
    expect((await datosDe(dueno, 'cuentas_listar')).items[0].saldoCentimos).toBe(-5_000);
  });
});
