import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe, diaMas, eventosDe, HOY } from './pruebas-de-registro.js';

// Módulo `registro` por HTTP real, parte 2: deudas, abonos y las dos herramientas críticas (R14, R17).

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: nivel lectura
let vendedor: Sesion; // member de A: completo, alcance «propios»
let ajeno: Sesion; // owner de B
let A: string;
let B: string;
let contacto: string;
let primera: any;

const CXC = (n: number) => `CXC-${HOY.anio}-${String(n).padStart(4, '0')}`;
const crear = (s: Sesion, extra: Record<string, unknown> = {}, clave?: string) =>
  s.herramienta('deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Letrero luminoso', totalCentimos: 35_000, ...extra }, { clave });
const numeros = (tabla: string, donde = 'true') =>
  comoEmpresa(appPool, A, async (c) => (await c.query(`select numero from registro.${tabla} where ${donde} order by numero`)).rows.map((f) => Number(f.numero)));
const seguidos = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, vendedor, ajeno] = await Promise.all(['Dueña', 'Lector', 'Vendedora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Deudas A');
  B = await crearEmpresa(ajeno, 'Deudas B');
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  contacto = (await datosDe(dueno, 'clientes_crear', { nombre: 'Botica Central' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('deuda_crear', () => {
  it('anota la deuda sin mover dinero y emite deuda.creada', async () => {
    const r = await crear(dueno, { venceEn: diaMas(15), notas: '  Paga a fin de mes ' });
    expect(r.estado).toBe(200);
    primera = r.cuerpo.datos;
    expect(primera).toMatchObject({
      codigo: CXC(1), numero: 1, anio: HOY.anio, tipo: 'por_cobrar', contactoId: contacto, contactoNombre: 'Botica Central', concepto: 'Letrero luminoso',
      totalCentimos: 35_000, abonadoCentimos: 0, saldoCentimos: 35_000, fecha: HOY.dia, venceEn: diaMas(15), vencida: false, estado: 'pendiente',
      origenTipo: null, origenId: null, notas: 'Paga a fin de mes', anuladoEn: null, creadoPor: dueno.usuarioId,
    });
    expect(await eventosDe(appPool, A, 'deuda.creada')).toEqual([
      { tipo: 'deuda.creada', carga: { id: primera.id, codigo: CXC(1), tipo: 'por_cobrar', contactoId: contacto, totalCentimos: 35_000, venceEn: diaMas(15), origenTipo: null, origenId: null } },
    ]);
    expect(await numeros('movimientos')).toEqual([]);
    expect((await datosDe(dueno, 'cuentas_listar')).items).toEqual([]);
  });

  it('valida importes, fechas, contacto y origen; un rechazo no gasta número', async () => {
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ totalCentimos: 0 }, 'argumentos_invalidos'],
      [{ totalCentimos: 99.5 }, 'argumentos_invalidos'],
      [{ concepto: '   ' }, 'argumentos_invalidos'],
      [{ sorpresa: true }, 'argumentos_invalidos'],
      [{ fecha: HOY.dia, venceEn: diaMas(-1) }, 'argumentos_invalidos'],
      [{ origenTipo: 'pedido' }, 'argumentos_invalidos'],
      [{ contactoId: randomUUID() }, 'no_encontrado'],
      [{ sucursalId: randomUUID() }, 'no_encontrado'],
      [{ creadoPor: lector.usuarioId }, 'argumentos_invalidos'],
      [{ tenantId: B }, 'argumento_prohibido'],
    ];
    for (const [extra, esperado] of casos) expect(codigoDe(await crear(dueno, extra)), JSON.stringify(extra)).toBe(esperado);
    const porPagar = await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: contacto, concepto: 'Vinil', totalCentimos: 8_000, fecha: diaMas(-40), venceEn: diaMas(-10) });
    expect(porPagar).toMatchObject({ codigo: `CXP-${HOY.anio}-0001`, vencida: true, fecha: diaMas(-40) });
    expect((await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Volantes', totalCentimos: 1_200 })).codigo).toBe(CXC(2));
  });

  it('la misma clave de idempotencia no crea dos deudas', async () => {
    const clave = `deuda-${randomUUID()}`;
    const a = await crear(dueno, { concepto: 'Idempotente' }, clave);
    const b = await crear(dueno, { concepto: 'Idempotente' }, clave);
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect(a.cuerpo.datos.codigo).toBe(CXC(3));
    expect(await numeros('deudas', `tipo = 'por_cobrar'`)).toEqual(seguidos(3));
  });

  it('un documento de origen tiene a lo sumo una deuda viva: la segunda es conflicto con la primera como candidata', async () => {
    const origen = { origenTipo: 'pedido', origenId: `ped-${randomUUID()}` };
    const uno = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Pedido PED-1', totalCentimos: 20_000, ...origen });
    expect(uno).toMatchObject(origen);
    const dos = await crear(dueno, origen);
    expect(dos.estado).toBe(409);
    expect(dos.cuerpo.error.candidatas).toEqual([{ id: uno.id, nombre: uno.codigo, detalle: 'Saldo S/ 200.00' }]);
    expect(await numeros('deudas', `tipo = 'por_cobrar'`)).toEqual(seguidos(4));
    expect((await confirmando(dueno, 'deuda_anular', { id: uno.id, motivo: 'Pedido cancelado' })).respuesta.cuerpo.datos.estado).toBe('anulada');
    expect((await crear(dueno, origen)).cuerpo.datos).toMatchObject({ ...origen, codigo: CXC(5) });
  });
});

describe('deuda_editar y deudas_listar', () => {
  it('corrige concepto, vencimiento y notas; no deja el vencimiento antes de la fecha', async () => {
    expect(await datosDe(dueno, 'deuda_editar', { id: primera.id, concepto: 'Letrero luminoso 2x1', venceEn: null, notas: null })).toMatchObject({
      concepto: 'Letrero luminoso 2x1', venceEn: null, notas: null, totalCentimos: 35_000,
    });
    expect(codigoDe(await dueno.herramienta('deuda_editar', { id: primera.id }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('deuda_editar', { id: primera.id, venceEn: diaMas(-1) }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('deuda_editar', { id: primera.id, totalCentimos: 1 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('deuda_editar', { id: randomUUID(), concepto: 'x' }))).toBe('no_encontrado');
    expect((await datosDe(dueno, 'deuda_editar', { id: primera.id, venceEn: diaMas(3) })).venceEn).toBe(diaMas(3));
  });

  it('lista por tipo y estado; «vencidas» depende del día de la empresa; pagina con cursor', async () => {
    expect(codigoDe(await dueno.herramienta('deudas_listar', {}))).toBe('argumentos_invalidos');
    const abiertas = (await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar' })).items;
    expect(abiertas.map((d: any) => d.codigo)).toEqual([CXC(5), CXC(3), CXC(2), CXC(1)]);
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'anuladas' })).items.map((d: any) => d.codigo)).toEqual([CXC(4)]);
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas' })).items).toHaveLength(5);
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'vencidas' })).items).toEqual([]);
    const vencidas = (await datosDe(dueno, 'deudas_listar', { tipo: 'por_pagar', estado: 'vencidas' })).items;
    expect(vencidas).toEqual([expect.objectContaining({ codigo: `CXP-${HOY.anio}-0001`, vencida: true })]);
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', contactoId: randomUUID() })).items).toEqual([]);

    const vistos: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas', limite: 2, ...(cursor && { cursor }) });
      vistos.push(...p.items.map((d: any) => d.codigo));
      cursor = p.siguiente ?? undefined;
    } while (cursor);
    expect(vistos).toEqual([CXC(5), CXC(4), CXC(3), CXC(2), CXC(1)]);
    expect(codigoDe(await dueno.herramienta('deudas_listar', { tipo: 'por_cobrar', cursor: 'xx' }))).toBe('argumentos_invalidos');
  });
});

describe('abonos', () => {
  it('rechaza fecha futura, cuenta inexistente y monto inválido sin gastar número; el abono válido mueve la caja', async () => {
    for (const [extra, esperado] of [
      [{ montoCentimos: 1_000, fecha: diaMas(1) }, 'argumentos_invalidos'],
      [{ montoCentimos: 0 }, 'argumentos_invalidos'],
      [{ montoCentimos: 10.5 }, 'argumentos_invalidos'],
      [{ montoCentimos: 1_000, cuentaId: randomUUID() }, 'no_encontrado'],
      [{ montoCentimos: 35_001 }, 'conflicto'],
    ] as const) {
      expect(codigoDe(await dueno.herramienta('deuda_abonar', { id: primera.id, ...extra })), JSON.stringify(extra)).toBe(esperado);
    }
    expect(codigoDe(await dueno.herramienta('deuda_abonar', { id: randomUUID(), montoCentimos: 100 }))).toBe('no_encontrado');
    expect(await numeros('movimientos')).toEqual([]);
    const r = await datosDe(dueno, 'deuda_abonar', { id: primera.id, montoCentimos: 10_000, fecha: diaMas(-1), medioDePago: 'plin', descripcion: 'Primer pago' });
    expect(r.movimiento).toMatchObject({ numero: 1, fecha: diaMas(-1), medioDePago: 'plin', descripcion: 'Primer pago', deudaId: primera.id, contactoNombre: 'Botica Central' });
    expect(r.deuda).toMatchObject({ estado: 'parcial', saldoCentimos: 25_000 });
    expect((await datosDe(dueno, 'cuentas_listar')).items[0]).toMatchObject({ nombre: 'Caja', saldoCentimos: 10_000 });
    const ev = await eventosDe(appPool, A);
    expect(ev.slice(-2).map((e) => e.tipo)).toEqual(['movimiento.registrado', 'deuda.abonada']);
    expect(ev.at(-1)!.carga).toEqual({ id: primera.id, codigo: CXC(1), movimientoId: r.movimiento.id, montoCentimos: 10_000, saldoCentimos: 25_000 });
    expect(ev.at(-2)!.carga).toMatchObject({ id: r.movimiento.id, deudaId: primera.id, contactoId: contacto, tipo: 'ingreso' });
  });
});

describe('herramientas críticas: nada cambia hasta confirmar', () => {
  it('movimiento_anular pide confirmación, y la confirmación deja de valer si la deuda cambió', async () => {
    const abono = (await datosDe(dueno, 'deuda_ver', { id: primera.id })).abonos[0];
    const pide = await dueno.herramienta('movimiento_anular', { id: abono.id, motivo: 'Monto equivocado' });
    expect(pide.estado).toBe(200);
    expect(pide.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String), resumen: `Anularás el ingreso ${abono.codigo} de S/ 100.00. La deuda ${CXC(1)} volverá a tener S/ 350.00 de saldo.` } });
    expect((await datosDe(dueno, 'movimiento_ver', { id: abono.id })).estado).toBe('activo');
    expect(await eventosDe(appPool, A, 'movimiento.anulado')).toEqual([]);
    // Entra otro abono: el saldo que se confirmó ya no es el real.
    await datosDe(dueno, 'deuda_abonar', { id: primera.id, montoCentimos: 5_000 });
    const viejo = await dueno.herramienta('movimiento_anular', { id: abono.id, motivo: 'Monto equivocado' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(codigoDe(viejo)).toBe('confirmacion_desactualizada');
    expect((await datosDe(dueno, 'movimiento_ver', { id: abono.id })).estado).toBe('activo');
    // Con otros argumentos el token tampoco vale.
    const otro = await dueno.herramienta('movimiento_anular', { id: abono.id, motivo: 'Otro motivo' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(codigoDe(otro)).toBe('confirmacion_no_coincide');
    const { respuesta, resumen } = await confirmando(dueno, 'movimiento_anular', { id: abono.id, motivo: 'Monto equivocado' });
    expect(resumen).toContain('volverá a tener S/ 300.00 de saldo');
    expect(respuesta.cuerpo.datos.estado).toBe('anulado');
    expect(await datosDe(dueno, 'deuda_ver', { id: primera.id })).toMatchObject({ estado: 'parcial', abonadoCentimos: 5_000, saldoCentimos: 30_000 });
    expect((await datosDe(dueno, 'cuentas_listar')).items[0].saldoCentimos).toBe(5_000);
    const repetido = await dueno.herramienta('movimiento_anular', { id: abono.id, motivo: 'Otra vez' });
    expect(repetido.cuerpo.error).toEqual({ codigo: 'conflicto', mensaje: 'Ese movimiento ya está anulado.' });
    expect((await datosDe(dueno, 'movimientos_listar', { estado: 'anulados' })).items.map((m: any) => m.id)).toEqual([abono.id]);
    expect((await datosDe(dueno, 'movimientos_listar', { deudaId: primera.id })).items).toHaveLength(1);
  });

  it('anular un movimiento suelto devuelve el dinero al saldo de la cuenta', async () => {
    const gasto = await datosDe(dueno, 'movimiento_registrar', { tipo: 'egreso', montoCentimos: 1_500 });
    expect((await datosDe(dueno, 'cuentas_listar')).items[0].saldoCentimos).toBe(3_500);
    const { respuesta, resumen } = await confirmando(dueno, 'movimiento_anular', { id: gasto.id, motivo: 'No era de la empresa' });
    expect(resumen).toBe(`Anularás el egreso ${gasto.codigo} de S/ 15.00.`);
    expect(respuesta.cuerpo.datos).toMatchObject({ estado: 'anulado', deudaId: null });
    expect((await datosDe(dueno, 'cuentas_listar')).items[0].saldoCentimos).toBe(5_000);
    expect((await eventosDe(appPool, A, 'movimiento.anulado')).at(-1)!.carga).toEqual({ id: gasto.id, codigo: gasto.codigo, deudaId: null });
    expect(codigoDe(await dueno.herramienta('movimiento_anular', { id: randomUUID(), motivo: 'x' }))).toBe('no_encontrado');
    expect(codigoDe(await dueno.herramienta('movimiento_anular', { id: gasto.id }))).toBe('argumentos_invalidos');
  });

  it('deuda_anular pide confirmación y no cambia nada hasta recibirla', async () => {
    const d = (await crear(dueno, { concepto: 'Para anular' })).cuerpo.datos;
    const pide = await dueno.herramienta('deuda_anular', { id: d.id, motivo: 'Se anotó dos veces' });
    expect(pide.cuerpo.requiereConfirmacion.resumen).toBe(`Anularás la deuda por cobrar ${d.codigo} de S/ 350.00. Dejará de contar en los saldos pendientes.`);
    expect((await datosDe(dueno, 'deuda_ver', { id: d.id })).estado).toBe('pendiente');
    expect(await eventosDe(appPool, A, 'deuda.anulada')).toHaveLength(1); // solo la del caso del origen
    const ok = await dueno.herramienta('deuda_anular', { id: d.id, motivo: 'Se anotó dos veces' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(ok.cuerpo.datos).toMatchObject({ estado: 'anulada', motivoAnulacion: 'Se anotó dos veces' });
    const usado = await dueno.herramienta('deuda_anular', { id: d.id, motivo: 'Se anotó dos veces' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(['confirmacion_ya_usada', 'conflicto']).toContain(codigoDe(usado));
  });
});

describe('permisos, alcance y aislamiento', () => {
  it('un member con nivel lectura ve las deudas y no puede crear, abonar ni anular', async () => {
    expect((await datosDe(lector, 'deudas_listar', { tipo: 'por_cobrar' })).items.length).toBeGreaterThan(0);
    expect((await datosDe(lector, 'deuda_ver', { id: primera.id })).abonos).toHaveLength(2);
    for (const [nombre, args] of [
      ['deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Intrusa', totalCentimos: 100 }],
      ['deuda_abonar', { id: primera.id, montoCentimos: 100 }],
      ['deuda_editar', { id: primera.id, concepto: 'Cambiada' }],
      ['deuda_anular', { id: primera.id, motivo: 'no' }],
    ] as const) {
      expect(codigoDe(await lector.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    expect((await datosDe(dueno, 'deuda_ver', { id: primera.id })).abonadoCentimos).toBe(5_000);
  });

  it('con alcance «propios» solo se ven y se tocan las deudas propias', async () => {
    const suya = (await crear(vendedor, { concepto: 'Venta de la vendedora' })).cuerpo.datos;
    expect((await datosDe(vendedor, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas' })).items.map((d: any) => d.id)).toEqual([suya.id]);
    for (const [nombre, args] of [
      ['deuda_ver', { id: primera.id }],
      ['deuda_abonar', { id: primera.id, montoCentimos: 100 }],
      ['deuda_editar', { id: primera.id, concepto: 'Ajena' }],
      ['deuda_anular', { id: primera.id, motivo: 'no es mía' }],
    ] as const) {
      expect(codigoDe(await vendedor.herramienta(nombre, args)), nombre).toBe('no_encontrado');
    }
    const abono = await datosDe(vendedor, 'deuda_abonar', { id: suya.id, montoCentimos: 5_000 });
    expect(abono.deuda.estado).toBe('parcial');
    expect((await datosDe(vendedor, 'movimientos_listar')).items.map((m: any) => m.id)).toEqual([abono.movimiento.id]);
    // La dueña ve la deuda de la vendedora y su abono.
    expect((await datosDe(dueno, 'deuda_ver', { id: suya.id })).abonos.map((m: any) => m.id)).toEqual([abono.movimiento.id]);
  });

  it('otra empresa no ve ni toca las deudas, y no puede usar un contacto ajeno', async () => {
    expect(codigoDe(await ajeno.herramienta('deuda_ver', { id: primera.id }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('deuda_abonar', { id: primera.id, montoCentimos: 100 }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('deuda_editar', { id: primera.id, concepto: 'Tomada' }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('deuda_anular', { id: primera.id, motivo: 'ajena' }))).toBe('no_encontrado');
    expect((await datosDe(ajeno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas' })).items).toEqual([]);
    expect(codigoDe(await crear(ajeno))).toBe('no_encontrado');
    expect(await comoEmpresa(appPool, B, async (c) => Number((await c.query('select count(*) from registro.deudas')).rows[0].count))).toBe(0);
    expect((await datosDe(dueno, 'deuda_ver', { id: primera.id })).concepto).toBe('Letrero luminoso 2x1');
  });

  it('al final, los correlativos de movimientos y de deudas no tienen huecos', async () => {
    const movimientos = await numeros('movimientos');
    expect(movimientos).toEqual(seguidos(movimientos.length));
    const porCobrar = await numeros('deudas', `tipo = 'por_cobrar'`);
    expect(porCobrar).toEqual(seguidos(porCobrar.length));
    expect(await numeros('deudas', `tipo = 'por_pagar'`)).toEqual([1]);
  });
});
