import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { RegistroDeConsumidores } from '../../../core/eventos/registro-de-consumidores.js';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe, diaMas, HOY } from './pruebas-de-registro.js';

// Módulo `registro` por HTTP real, parte 3: caja del día, resumen, consumidores de pedidos (solo proponen: R5)
// y la fuente de tiempo de vencimientos.

let app: AppDePruebas;
let appPool: pg.Pool;
let sistema: pg.Pool;
let dueno: Sesion; // owner de A
let vendedor: Sesion; // member de A con alcance «propios»
let ajeno: Sesion; // owner de B
let A: string;
let B: string;
let contacto: string;
let caja: string;
let banco: string;

const AYER = diaMas(-1);
const registrar = (args: Record<string, unknown>) => datosDe(dueno, 'movimiento_registrar', args);
const deudasDe = (empresaId: string) => comoEmpresa(appPool, empresaId, async (c) => (await c.query('select * from registro.deudas order by creado_en')).rows);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  sistema = abrirPool('sistema');
  [dueno, vendedor, ajeno] = await Promise.all(['Dueña', 'Vendedora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Reportes A');
  B = await crearEmpresa(ajeno, 'Reportes B');
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  contacto = (await datosDe(dueno, 'clientes_crear', { nombre: 'Colegio San Martín' })).id;
  await datosDe(dueno, 'registro_iniciar');
  caja = (await datosDe(dueno, 'cuentas_listar')).items[0].id;
  banco = (await datosDe(dueno, 'cuenta_crear', { nombre: 'Banco', tipo: 'banco', saldoInicialCentimos: 100_000 })).id;
});
afterAll(async () => {
  await app.cerrar();
  await Promise.all([appPool.end(), sistema.end()]);
});

describe('caja_del_dia y registro_resumen', () => {
  let ventas: string;
  let compras: string;

  it('cada cuenta abre con lo de los días anteriores, suma el día y no cuenta lo anulado', async () => {
    const categorias = (await datosDe(dueno, 'categorias_listar')).items;
    ventas = categorias.find((c: any) => c.nombre === 'Ventas').id;
    compras = categorias.find((c: any) => c.nombre === 'Compras').id;
    await registrar({ tipo: 'ingreso', montoCentimos: 40_000, fecha: AYER, categoriaId: ventas });
    await registrar({ tipo: 'egreso', montoCentimos: 15_000, fecha: AYER, categoriaId: compras });
    await registrar({ tipo: 'ingreso', montoCentimos: 12_050, categoriaId: ventas });
    await registrar({ tipo: 'ingreso', montoCentimos: 1, categoriaId: ventas });
    await registrar({ tipo: 'egreso', montoCentimos: 3_025 });
    await registrar({ tipo: 'egreso', montoCentimos: 20_000, cuentaId: banco, categoriaId: compras });
    const error = await registrar({ tipo: 'ingreso', montoCentimos: 99_999 });
    expect((await confirmando(dueno, 'movimiento_anular', { id: error.id, motivo: 'Tecleo equivocado' })).respuesta.cuerpo.ok).toBe(true);

    const hoy = await datosDe(dueno, 'caja_del_dia');
    expect(hoy).toEqual({
      fecha: HOY.dia,
      cuentas: [
        { cuentaId: caja, nombre: 'Caja', saldoInicialCentimos: 25_000, ingresosCentimos: 12_051, egresosCentimos: 3_025, transferenciasNetasCentimos: 0, saldoFinalCentimos: 34_026, movimientos: 3 },
        { cuentaId: banco, nombre: 'Banco', saldoInicialCentimos: 100_000, ingresosCentimos: 0, egresosCentimos: 20_000, transferenciasNetasCentimos: 0, saldoFinalCentimos: 80_000, movimientos: 1 },
      ],
      totalIngresosCentimos: 12_051,
      totalEgresosCentimos: 23_025,
    });
    // El saldo final de la caja del día coincide con el saldo de la cuenta.
    const saldos = Object.fromEntries((await datosDe(dueno, 'cuentas_listar')).items.map((c: any) => [c.id, c.saldoCentimos]));
    expect(saldos).toEqual({ [caja]: 34_026, [banco]: 80_000 });
  });

  it('se puede pedir otro día y una sola cuenta', async () => {
    const ayer = await datosDe(dueno, 'caja_del_dia', { fecha: AYER, cuentaId: caja });
    expect(ayer).toMatchObject({ fecha: AYER, totalIngresosCentimos: 40_000, totalEgresosCentimos: 15_000 });
    expect(ayer.cuentas).toEqual([{ cuentaId: caja, nombre: 'Caja', saldoInicialCentimos: 0, ingresosCentimos: 40_000, egresosCentimos: 15_000, transferenciasNetasCentimos: 0, saldoFinalCentimos: 25_000, movimientos: 2 }]);
    expect(codigoDe(await dueno.herramienta('caja_del_dia', { cuentaId: randomUUID() }))).toBe('no_encontrado');
    expect(codigoDe(await dueno.herramienta('caja_del_dia', { fecha: 'ayer' }))).toBe('argumentos_invalidos');
    // La otra empresa no puede mirar la caja de una cuenta ajena, y su caja está vacía.
    expect(codigoDe(await ajeno.herramienta('caja_del_dia', { cuentaId: caja }))).toBe('no_encontrado');
    expect(await datosDe(ajeno, 'caja_del_dia')).toEqual({ fecha: HOY.dia, cuentas: [], totalIngresosCentimos: 0, totalEgresosCentimos: 0 });
  });

  it('el resumen suma el periodo por categoría y dice lo que queda por cobrar y por pagar', async () => {
    const cobrar = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Agendas', totalCentimos: 60_000, fecha: diaMas(-30), venceEn: diaMas(-5) });
    await datosDe(dueno, 'deuda_abonar', { id: cobrar.id, montoCentimos: 10_000 });
    await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Sin plazo', totalCentimos: 5_000 });
    await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: contacto, concepto: 'Papel', totalCentimos: 7_000, venceEn: diaMas(10) });
    const r = await datosDe(dueno, 'registro_resumen', { desde: AYER, hasta: HOY.dia });
    expect(r).toMatchObject({
      desde: AYER, hasta: HOY.dia, ingresosCentimos: 62_051, egresosCentimos: 38_025, netoCentimos: 24_026,
      porCobrarCentimos: 55_000, porPagarCentimos: 7_000, vencidasPorCobrar: 1, vencidasPorCobrarCentimos: 50_000, vencidasPorPagar: 0,
    });
    const porCategoria = Object.fromEntries(r.porCategoria.map((c: any) => [`${c.tipo}:${c.nombre}`, c.totalCentimos]));
    expect(porCategoria).toEqual({ 'ingreso:Ventas': 52_051, 'ingreso:Cobros': 10_000, 'egreso:Compras': 35_000, 'egreso:Sin categoría': 3_025 });
    expect(r.porCategoria.find((c: any) => c.nombre === 'Sin categoría').categoriaId).toBeNull();
    expect((await datosDe(dueno, 'registro_resumen', { desde: AYER, hasta: AYER })).netoCentimos).toBe(25_000);
    expect(codigoDe(await dueno.herramienta('registro_resumen', { desde: HOY.dia, hasta: AYER }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('registro_resumen', { desde: diaMas(-400), hasta: HOY.dia }))).toBe('argumentos_invalidos');
    expect(await datosDe(ajeno, 'registro_resumen', { desde: AYER, hasta: HOY.dia })).toMatchObject({ ingresosCentimos: 0, porCobrarCentimos: 0, porCategoria: [] });
  });

  it('con alcance «propios», la caja y el resumen responden sin_permiso', async () => {
    for (const [nombre, args] of [['caja_del_dia', {}], ['registro_resumen', { desde: AYER, hasta: HOY.dia }]] as const) {
      const r = await vendedor.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(r.cuerpo.error, nombre).toEqual({ codigo: 'sin_permiso', mensaje: 'Tu acceso es solo a tus propios registros.' });
    }
  });
});

describe('el día se corta en la zona de la empresa', () => {
  afterEach(() => vi.useRealTimers());

  it('a las 23:30 de Lima todavía es «hoy» de Lima, aunque en UTC ya sea mañana', async () => {
    // Últimas 04:30 UTC = 23:30 del día anterior en Lima (UTC−5). Hacia atrás: con la sesión de 4 h, adelantar el reloj la vencería.
    const utc = new Date();
    utc.setUTCDate(utc.getUTCDate() - 1);
    utc.setUTCHours(4, 30, 0, 0);
    const diaUtc = utc.toISOString().slice(0, 10);
    const diaLima = diaMas(-1, diaUtc);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(utc);
    const m = await datosDe(ajeno, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 4_200 });
    expect(m.fecha).toBe(diaLima);
    expect(m.anio).toBe(Number(diaLima.slice(0, 4)));
    // El día UTC es «mañana» para la empresa: una fecha así se rechaza por futura.
    expect(codigoDe(await ajeno.herramienta('movimiento_registrar', { tipo: 'ingreso', montoCentimos: 1, fecha: diaUtc }))).toBe('argumentos_invalidos');
    const cajaDeB = await datosDe(ajeno, 'caja_del_dia');
    expect(cajaDeB).toMatchObject({ fecha: diaLima, totalIngresosCentimos: 4_200 });
    const vence = await datosDe(ajeno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: (await datosDe(ajeno, 'clientes_crear', { nombre: 'Cliente de B' })).id, concepto: 'Vence hoy', totalCentimos: 100, fecha: diaMas(-3, diaLima), venceEn: diaLima });
    expect(vence).toMatchObject({ fecha: diaMas(-3, diaLima), vencida: false });
  });
});

describe('consumidores de pedidos: solo proponen borradores', () => {
  const pedido = { id: randomUUID(), codigo: 'PED-2026-0042' };
  let relevo: Relevo;
  let futuro = Date.now() + 3_600_000;

  const emitir = (empresaId: string, tipo: string, carga: Record<string, unknown>) =>
    comoEmpresa(appPool, empresaId, async (c) => (await c.query(`insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, $2, $3::jsonb) returning id`, [empresaId, tipo, JSON.stringify(carga)])).rows[0].id as string, { confirmar: true });
  /** Procesa todo lo pendiente (cada llamada avanza el reloj del relevo para volver a tomar lo postergado). */
  async function drenar() {
    futuro += 600_000;
    for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
    throw new Error('El relevo no terminó de drenar.');
  }
  const borradores = async () => (await datosDe(dueno, 'borradores_listar', { modulo: 'registro', limite: 100 })).items;
  const confirmado = (extra: Record<string, unknown> = {}) => ({ ...pedido, clienteId: contacto, totalCentimos: 48_000, entregaEl: diaMas(7), sucursalId: null, ...extra });

  beforeAll(() => {
    relevo = app.obtener(Relevo);
  });

  it('los consumidores y la fuente de tiempo quedaron registrados al arrancar el módulo', () => {
    const consumidores = app.obtener(RegistroDeConsumidores).todos().filter((c) => c.modulo === 'registro');
    expect(consumidores.map((c) => `${c.nombre}:${c.evento}`).sort((a, b) => a.localeCompare(b))).toEqual([
      'registro_adelanto_registrado:adelanto.registrado', 'registro_compra_recibida:compra.recibida', 'registro_pedido_cancelado:pedido.cancelado', 'registro_pedido_confirmado:pedido.confirmado', 'registro_pedido_datos_editados:pedido.datos_editados', 'registro_pedido_entregado:pedido.entregado', 'registro_produccion_cobro_pedido:produccion.orden_cobro_pedido', 'registro_produccion_orden_anulada:produccion.orden_anulada', 'registro_produccion_orden_corregida:produccion.orden_corregida', 'registro_produccion_orden_creada:produccion.orden_creada', 'registro_produccion_orden_entregada:produccion.orden_entregada',
    ]);
    expect(app.obtener(RegistroDeFuentesDeTiempo).obtener('registro.deuda_vence')).toMatchObject({ modulo: 'registro' });
  });

  it('pedido.confirmado termina como UN borrador pendiente de deuda_crear; no crea la deuda', { timeout: 120_000 }, async () => {
    const antes = (await deudasDe(A)).length;
    const eventoId = await emitir(A, 'pedido.confirmado', confirmado());
    await drenar();
    const lista = await borradores();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      herramienta: 'deuda_crear', modulo: 'registro', estado: 'pendiente', origen: 'modulo', origenRef: `pedido:${pedido.id}`, propuestoPor: 'sistema', prioridad: 'normal',
      resumen: 'Cobrar S/ 480.00 por el pedido PED-2026-0042',
      args: { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Pedido PED-2026-0042', totalCentimos: 48_000, venceEn: diaMas(7), origenTipo: 'pedido', origenId: pedido.id },
    });
    expect(await deudasDe(A)).toHaveLength(antes);
    // El mismo evento entregado otra vez no propone de nuevo.
    await sistema.query('update core.eventos_salida set procesado_en = null where id = $1', [eventoId]);
    await drenar();
    expect(await borradores()).toHaveLength(1);
    // La otra empresa no recibió nada.
    expect((await datosDe(ajeno, 'borradores_listar', { limite: 100 })).items).toEqual([]);
  });

  it('un pedido sin importe no propone nada', { timeout: 120_000 }, async () => {
    await emitir(A, 'pedido.confirmado', confirmado({ id: randomUUID(), codigo: 'PED-2026-0043', totalCentimos: 0 }));
    await drenar();
    expect(await borradores()).toHaveLength(1);
  });

  it('aprobar el borrador por HTTP crea la deuda con su origen; otro «confirmado» del mismo pedido ya no propone', { timeout: 120_000 }, async () => {
    const [b] = await borradores();
    const r = await datosDe(dueno, 'borrador_aprobar', { id: b.id });
    expect(r.borrador.estado).toBe('aprobado');
    expect(r.resultado).toMatchObject({ tipo: 'por_cobrar', estado: 'pendiente', totalCentimos: 48_000, origenTipo: 'pedido', origenId: pedido.id, venceEn: diaMas(7), creadoPor: dueno.usuarioId });
    await emitir(A, 'pedido.confirmado', confirmado());
    await drenar();
    expect((await borradores()).filter((x: any) => x.estado === 'pendiente')).toEqual([]);
  });

  it('pedido.cancelado propone anular la deuda viva con prioridad alta; aprobarlo exige confirmación', { timeout: 120_000 }, async () => {
    const viva = (await deudasDe(A)).find((d) => d.origen_id === pedido.id);
    await emitir(A, 'pedido.cancelado', { ...pedido, clienteId: contacto, teniaNumero: true });
    await emitir(A, 'pedido.cancelado', { id: randomUUID(), codigo: 'PED-2026-0099', clienteId: contacto, teniaNumero: false });
    await drenar();
    const pendientes = (await borradores()).filter((x: any) => x.estado === 'pendiente');
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]).toMatchObject({ herramienta: 'deuda_anular', prioridad: 'alta', origen: 'modulo', origenRef: `pedido:${pedido.id}`, args: { id: viva.id, motivo: 'Pedido PED-2026-0042 cancelado' } });
    expect((await datosDe(dueno, 'deuda_ver', { id: viva.id })).estado).toBe('pendiente');
    // La bandeja reenvía la confirmación de la herramienta crítica: sin ella nada cambia.
    const pide = await dueno.herramienta('borrador_aprobar', { id: pendientes[0].id });
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain('Anularás la deuda por cobrar');
    expect((await datosDe(dueno, 'deuda_ver', { id: viva.id })).estado).toBe('pendiente');
    const ok = await datosDe(dueno, 'borrador_aprobar', { id: pendientes[0].id, confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(ok.borrador.estado).toBe('aprobado');
    expect(await datosDe(dueno, 'deuda_ver', { id: viva.id })).toMatchObject({ estado: 'anulada', motivoAnulacion: 'Pedido PED-2026-0042 cancelado' });
  });
});

describe('fuente de tiempo registro.deuda_vence', () => {
  it('entrega las deudas abiertas con vencimiento de la empresa, sin datos personales y sin escribir', async () => {
    const fuente = app.obtener(RegistroDeFuentesDeTiempo).obtener('registro.deuda_vence')!;
    const conEmpresa = conEmpresaDePruebas(appPool);
    const pagada = await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: contacto, concepto: 'Ya pagada', totalCentimos: 100, venceEn: diaMas(2) });
    await datosDe(dueno, 'deuda_abonar', { id: pagada.id, montoCentimos: 100 });
    const deA = await conEmpresa({ empresaId: A, usuarioId: 'sistema' }, (tx) => fuente.candidatos(tx, new Date()));
    const abiertas = (await deudasDe(A)).filter((d) => ['pendiente', 'parcial'].includes(d.estado) && d.vence_en !== null);
    expect(abiertas.length).toBeGreaterThanOrEqual(2);
    expect(deA.map((c) => c.entidadId).sort((a, b) => a.localeCompare(b))).toEqual(abiertas.map((d) => d.id).sort((a: string, b: string) => a.localeCompare(b)));
    const agendas = deA.find((c) => c.datos.saldoCentimos === 50_000)!;
    expect(agendas).toEqual({
      entidadTipo: 'deuda',
      entidadId: agendas.entidadId,
      fecha: new Date(`${diaMas(-5)}T12:00:00Z`),
      datos: { id: agendas.entidadId, codigo: expect.stringMatching(/^CXC-\d{4}-\d{4}$/), tipo: 'por_cobrar', contactoId: contacto, saldoCentimos: 50_000, venceEn: diaMas(-5) },
    });
    const deB = await conEmpresa({ empresaId: B, usuarioId: 'sistema' }, (tx) => fuente.candidatos(tx, new Date()));
    expect(deB.map((c) => c.entidadId)).not.toEqual(expect.arrayContaining(deA.map((c) => c.entidadId)));
    expect(deB.every((c) => !deA.some((a) => a.entidadId === c.entidadId))).toBe(true);
  });
});
