import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe, diaMas, eventosDe, HOY } from './pruebas-de-registro.js';

// `deuda_crear_con_adelanto` y el `origen` de `deuda_abonar`, por HTTP real.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion;
let A: string;
let contacto: string;

const CXC = (n: number) => `CXC-${HOY.anio}-${String(n).padStart(4, '0')}`;
const crear = (s: Sesion, extra: Record<string, unknown> = {}, clave?: string) =>
  s.herramienta('deuda_crear_con_adelanto', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Contrato de volantes', totalCentimos: 24_000, adelantoCentimos: 10_000, ...extra }, { clave });
const contar = (tabla: string) => comoEmpresa(appPool, A, async (c) => Number((await c.query(`select count(*)::int as n from registro.${tabla}`)).rows[0].n));

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector] = await Promise.all(['Dueña', 'Lector'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Adelanto A');
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  contacto = (await datosDe(dueno, 'clientes_crear', { nombre: 'Cristina Neira' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('deuda_crear_con_adelanto', () => {
  it('deja la deuda parcial, un movimiento de ingreso con su deuda y los tres eventos, una vez cada uno', async () => {
    const d = await datosDe(dueno, 'deuda_crear_con_adelanto', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Contrato de volantes', totalCentimos: 24_000, adelantoCentimos: 10_000, origen: 'voz' });
    expect(d.deuda).toMatchObject({ codigo: CXC(1), estado: 'parcial', totalCentimos: 24_000, abonadoCentimos: 10_000, saldoCentimos: 14_000, contactoId: contacto });
    expect(d.movimiento).toMatchObject({ tipo: 'ingreso', montoCentimos: 10_000, deudaId: d.deuda.id, contactoId: contacto, origen: 'voz', descripcion: `Adelanto de ${CXC(1)}`, categoriaNombre: 'Cobros' });
    expect((await eventosDe(appPool, A)).map((e) => e.tipo).filter((t) => t !== 'cliente.creado')).toEqual(['deuda.creada', 'movimiento.registrado', 'deuda.abonada']);
    expect(await eventosDe(appPool, A, 'deuda.pagada')).toEqual([]);
  });

  it('adelanto igual o mayor que el total: argumentos_invalidos y no se crea nada', async () => {
    const antes = [await contar('deudas'), await contar('movimientos')];
    for (const adelantoCentimos of [24_000, 30_000]) expect(codigoDe(await crear(dueno, { adelantoCentimos }))).toBe('argumentos_invalidos');
    for (const extra of [{ adelantoCentimos: 0 }, { fecha: diaMas(1) }, { sorpresa: 1 }, { venceEn: diaMas(-1), fecha: HOY.dia }]) {
      expect(codigoDe(await crear(dueno, extra)), JSON.stringify(extra)).toBe('argumentos_invalidos');
    }
    expect(codigoDe(await crear(dueno, { contactoId: randomUUID() }))).toBe('no_encontrado');
    expect(codigoDe(await crear(dueno, { sucursalId: randomUUID() }))).toBe('no_encontrado');
    expect([await contar('deudas'), await contar('movimientos')]).toEqual(antes);
  });

  it('por pagar: el adelanto es un egreso', async () => {
    const d = await datosDe(dueno, 'deuda_crear_con_adelanto', { tipo: 'por_pagar', contactoId: contacto, concepto: 'Papel', totalCentimos: 50_000, adelantoCentimos: 20_000 });
    expect(d.deuda).toMatchObject({ codigo: `CXP-${HOY.anio}-0001`, estado: 'parcial', saldoCentimos: 30_000 });
    expect(d.movimiento).toMatchObject({ tipo: 'egreso', montoCentimos: 20_000, origen: 'teclado', categoriaNombre: 'Pagos' });
  });

  it('la misma Idempotency-Key deja una sola deuda y un solo movimiento', async () => {
    const [d0, m0] = [await contar('deudas'), await contar('movimientos')];
    const clave = `adelanto-${randomUUID()}`;
    const a = await crear(dueno, { concepto: 'Idempotente' }, clave);
    const b = await crear(dueno, { concepto: 'Idempotente' }, clave);
    expect(a.estado).toBe(200);
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect([await contar('deudas'), await contar('movimientos')]).toEqual([d0 + 1, m0 + 1]);
  });

  it('un member de solo lectura recibe modulo_solo_lectura', async () => {
    const antes = await contar('deudas');
    expect(codigoDe(await crear(lector))).toBe('modulo_solo_lectura');
    expect(await contar('deudas')).toBe(antes);
  });

  it('la deuda admite deuda_abonar hasta pagada y se anula como cualquiera (primero su abono)', async () => {
    const d = await datosDe(dueno, 'deuda_crear_con_adelanto', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Ciclo completo', totalCentimos: 24_000, adelantoCentimos: 10_000 });
    const abono = await datosDe(dueno, 'deuda_abonar', { id: d.deuda.id, montoCentimos: 14_000 });
    expect(abono.deuda).toMatchObject({ estado: 'pagada', saldoCentimos: 0 });

    const e = await datosDe(dueno, 'deuda_crear_con_adelanto', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Para anular', totalCentimos: 24_000, adelantoCentimos: 10_000 });
    const sinAnular = await confirmando(dueno, 'deuda_anular', { id: e.deuda.id, motivo: 'Cancelado' });
    expect(codigoDe(sinAnular.respuesta)).toBe('conflicto');
    const anulado = await confirmando(dueno, 'movimiento_anular', { id: e.movimiento.id, motivo: 'Se devolvió el adelanto' });
    expect(anulado.respuesta.cuerpo.datos.estado).toBe('anulado');
    const final = await confirmando(dueno, 'deuda_anular', { id: e.deuda.id, motivo: 'Cancelado' });
    expect(final.respuesta.cuerpo.datos.estado).toBe('anulada');
  });
});

describe('deuda_abonar · origen', () => {
  it('con origen «voz» el movimiento queda con ese origen; sin origen, «teclado»', async () => {
    const d = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Abonos', totalCentimos: 30_000 });
    expect((await datosDe(dueno, 'deuda_abonar', { id: d.id, montoCentimos: 5_000, origen: 'voz' })).movimiento.origen).toBe('voz');
    expect((await datosDe(dueno, 'deuda_abonar', { id: d.id, montoCentimos: 5_000 })).movimiento.origen).toBe('teclado');
    expect(codigoDe(await dueno.herramienta('deuda_abonar', { id: d.id, montoCentimos: 100, origen: 'otro' }))).toBe('argumentos_invalidos');
  });
});
