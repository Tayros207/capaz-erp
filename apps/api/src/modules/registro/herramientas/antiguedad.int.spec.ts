import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, datosDe, diaMas } from './pruebas-de-registro.js';

// `deudas_antiguedad` por HTTP real: tramos por días vencidos, por contacto, con abonos y aislamiento por empresa.

let app: AppDePruebas;
let dueno: Sesion;
let ajeno: Sesion;
let sol: string;
let luz: string;

const deuda = (contactoId: string, totalCentimos: number, venceEn: string, extra: Record<string, unknown> = {}) =>
  datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId, concepto: 'Trabajo', totalCentimos, fecha: diaMas(-200), venceEn, ...extra });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, ajeno] = await Promise.all(['Dueña', 'Ajena'].map((n) => abrirSesion(app, n)));
  await crearEmpresa(dueno, 'Empresa A de antigüedad');
  await crearEmpresa(ajeno, 'Empresa B de antigüedad');
  sol = (await datosDe(dueno, 'clientes_crear', { nombre: 'Imprenta Sol' })).id;
  luz = (await datosDe(dueno, 'clientes_crear', { nombre: 'Luz del Sur' })).id;
  await deuda(sol, 20_000, diaMas(-100));
  await deuda(sol, 5_000, diaMas(-45));
  await deuda(luz, 8_000, diaMas(-10));
  await deuda(luz, 3_000, diaMas(10));
  await deuda(luz, 7_000, diaMas(-5)).then((d) => datosDe(dueno, 'deuda_abonar', { id: d.id, montoCentimos: 7_000 })); // saldada: no cuenta
});
afterAll(async () => {
  await app.cerrar();
});

describe('deudas_antiguedad', () => {
  it('agrupa por contacto y por tramo, la fila más pesada primero, y suma los totales', async () => {
    const r = await datosDe(dueno, 'deudas_antiguedad', { tipo: 'por_cobrar' });
    expect(r.filas.map((f: any) => [f.contactoNombre, f.totalCentimos, f.deudas])).toEqual([['Imprenta Sol', 25_000, 2], ['Luz del Sur', 11_000, 2]]);
    expect(r.filas[0]).toMatchObject({ masDe90Centimos: 20_000, de31a60Centimos: 5_000, vigenteCentimos: 0 });
    expect(r.filas[1]).toMatchObject({ de1a30Centimos: 8_000, vigenteCentimos: 3_000 });
    expect(r.totales).toEqual({ vigenteCentimos: 3_000, de1a30Centimos: 8_000, de31a60Centimos: 5_000, de61a90Centimos: 0, masDe90Centimos: 20_000, totalCentimos: 36_000 });
  });

  it('un abono parcial baja el saldo del tramo; la fecha de corte mueve las deudas de tramo', async () => {
    const d = await deuda(luz, 4_000, diaMas(-20));
    await datosDe(dueno, 'deuda_abonar', { id: d.id, montoCentimos: 1_000 });
    expect((await datosDe(dueno, 'deudas_antiguedad', {})).totales.de1a30Centimos).toBe(8_000 + 3_000);
    const futuro = await datosDe(dueno, 'deudas_antiguedad', { fecha: diaMas(60) });
    expect(futuro.fecha).toBe(diaMas(60));
    expect(futuro.totales.vigenteCentimos).toBe(0);
    expect(futuro.totales.totalCentimos).toBe(39_000);
  });

  it('por_pagar es otra cuenta y la otra empresa no ve nada', async () => {
    expect((await datosDe(dueno, 'deudas_antiguedad', { tipo: 'por_pagar' })).filas).toEqual([]);
    expect((await datosDe(ajeno, 'deudas_antiguedad', {})).totales.totalCentimos).toBe(0);
  });

  it('rechaza un tipo inválido y una fecha mal escrita', async () => {
    expect(codigoDe(await dueno.herramienta('deudas_antiguedad', { tipo: 'otra' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('deudas_antiguedad', { fecha: '31/03/2026' }))).toBe('argumentos_invalidos');
  });
});
