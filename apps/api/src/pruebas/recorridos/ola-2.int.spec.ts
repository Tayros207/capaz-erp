import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { formatearSoles } from '@capaz/shared';
import { Relevo } from '../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type RespuestaHttp, type Sesion } from '../../core/herramientas/http-de-pruebas.js';
import { codigoDe, confirmando, datosDe } from '../../modules/registro/herramientas/pruebas-de-registro.js';
import { levantarApp, type AppDePruebas } from '../app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../base-de-pruebas.js';

// Recorrido de cierre de la ola 2, por HTTP real: oportunidad ganada → pedido confirmado → el relevo propone
// el cobro → la persona lo aprueba en la bandeja → se abona en dos partes → la caja del día lo suma.
// Usa solo herramientas públicas: ningún módulo se toca por dentro.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion; // member con `registro` en lectura
let empresaId: string;
let clienteId: string;
let futuro = Date.now() + 3_600_000;

/** Procesa todo lo pendiente del relevo (cada llamada avanza el reloj para volver a tomar lo postergado). */
async function drenar(): Promise<void> {
  const relevo = app.obtener(Relevo);
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}

const exigir = (r: RespuestaHttp, quien: string): any => {
  if (!r.cuerpo?.ok) throw new Error(`«${quien}» respondió ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};

/** Un pedido de dos líneas, confirmado, nacido de una oportunidad ganada. Devuelve el pedido confirmado. */
async function pedidoConfirmado(titulo: string): Promise<{ id: string; codigo: string; totalCentimos: number }> {
  const oportunidad = await datosDe(dueno, 'oportunidad_crear', { titulo, clienteId, montoEstimadoCentimos: 150_000 });
  const ganada = await datosDe(dueno, 'oportunidad_ganar', { id: oportunidad.id });
  expect(ganada.estado).toBe('ganada');
  const borrador = await datosDe(dueno, 'pedido_crear', {
    clienteId,
    origenTipo: 'oportunidad',
    origenId: oportunidad.id,
    lineas: [
      { descripcion: 'Tarjetas de presentación', cantidadMilesimas: 2000, precioUnitarioMilesimas: 250_000 },
      { descripcion: 'Volantes A5', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1_000_000 },
    ],
  });
  expect(borrador.lineas).toBe(2);
  expect(borrador.detalle).toHaveLength(2);
  return datosDe(dueno, 'pedido_confirmar', { id: borrador.id });
}

const pendientesDeRegistro = async (sesion: Sesion): Promise<any[]> =>
  (await datosDe(sesion, 'borradores_listar', { modulo: 'registro', estado: 'pendiente', limite: 100 })).items;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector] = await Promise.all([abrirSesion(app, 'Dueña del recorrido'), abrirSesion(app, 'Lector del recorrido')]);
  empresaId = await crearEmpresa(dueno, 'Imprenta del recorrido');
  for (const modulo of ['registro', 'crm', 'ordenes']) await activarModulo(empresaId, modulo);
  await agregarMiembro(app, empresaId, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  clienteId = (await datosDe(dueno, 'clientes_crear', { nombre: 'Colegio San Martín' })).id;
  await datosDe(dueno, 'registro_iniciar');
  await datosDe(dueno, 'crm_iniciar');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('recorrido de la ola 2: del pedido al cobro', () => {
  let pedido: { id: string; codigo: string; totalCentimos: number };
  let borradorId: string;
  let deudaId: string;

  it('un pedido confirmado deja su cobro propuesto en la bandeja, y no antes del relevo', async () => {
    pedido = await pedidoConfirmado('Útiles para el nuevo año escolar');
    expect(pedido.totalCentimos).toBeGreaterThan(0);
    expect(await pendientesDeRegistro(dueno)).toEqual([]);
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar' })).items).toEqual([]);

    await drenar();

    const propuestos = (await pendientesDeRegistro(dueno)).filter((b) => b.args.origenId === pedido.id);
    expect(propuestos).toHaveLength(1);
    const b = propuestos[0];
    borradorId = b.id;
    expect(b).toMatchObject({ herramienta: 'deuda_crear', modulo: 'registro', estado: 'pendiente', origen: 'modulo' });
    expect(b.args).toMatchObject({ tipo: 'por_cobrar', contactoId: clienteId, totalCentimos: pedido.totalCentimos, origenTipo: 'pedido', origenId: pedido.id });
    expect(b.resumen).toContain(formatearSoles(pedido.totalCentimos));
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar' })).items).toEqual([]); // proponer no escribe en el módulo
  });

  it('el resumen de pendientes cuenta ese borrador', async () => {
    const resumen = await datosDe(dueno, 'borradores_resumen', {});
    expect(resumen).toEqual({ pendientes: 1, deAltaPrioridad: 0 });
  });

  it('al aprobarlo nace la deuda con el pedido como origen', async () => {
    const { respuesta } = await confirmando(dueno, 'borrador_aprobar', { id: borradorId });
    const aprobado = exigir(respuesta, 'borrador_aprobar');
    expect(aprobado.borrador).toMatchObject({ id: borradorId, estado: 'aprobado' });
    deudaId = aprobado.resultado.id;

    const deuda = await datosDe(dueno, 'deuda_ver', { id: deudaId });
    expect(deuda).toMatchObject({ tipo: 'por_cobrar', estado: 'pendiente', origenTipo: 'pedido', origenId: pedido.id, totalCentimos: pedido.totalCentimos, abonadoCentimos: 0 });
    expect(await datosDe(dueno, 'borradores_resumen', {})).toEqual({ pendientes: 0, deAltaPrioridad: 0 });
  });

  it('aprobarlo otra vez no duplica la deuda', async () => {
    const { respuesta } = await confirmando(dueno, 'borrador_aprobar', { id: borradorId });
    expect(codigoDe(respuesta)).toBe('conflicto');
    expect((await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar' })).items).toHaveLength(1);
  });

  it('dos abonos la dejan pagada y la caja del día suma los dos ingresos', async () => {
    const primero = Math.floor(pedido.totalCentimos / 3);
    const segundo = pedido.totalCentimos - primero;

    const a1 = await datosDe(dueno, 'deuda_abonar', { id: deudaId, montoCentimos: primero });
    expect(a1.deuda).toMatchObject({ estado: 'parcial', abonadoCentimos: primero, saldoCentimos: segundo });
    const a2 = await datosDe(dueno, 'deuda_abonar', { id: deudaId, montoCentimos: segundo });
    expect(a2.deuda).toMatchObject({ estado: 'pagada', abonadoCentimos: pedido.totalCentimos, saldoCentimos: 0 });

    const caja = await datosDe(dueno, 'caja_del_dia', {});
    expect(caja.totalIngresosCentimos).toBe(primero + segundo);
    expect(caja.totalEgresosCentimos).toBe(0);
    expect(caja.cuentas.reduce((n: number, c: any) => n + c.movimientos, 0)).toBe(2);
    expect(caja.cuentas.reduce((n: number, c: any) => n + c.ingresosCentimos, 0)).toBe(pedido.totalCentimos);
  });

  it('una deuda pagada ya no cuenta como vencida en el resumen del mes', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const resumen = await datosDe(dueno, 'registro_resumen', { desde: `${hoy.slice(0, 8)}01`, hasta: hoy });
    expect(resumen.vencidasPorCobrar).toBe(0);
    expect(resumen.ingresosCentimos).toBeGreaterThanOrEqual(pedido.totalCentimos);
  });
});

describe('recorrido de la ola 2: quien solo lee no aprueba', () => {
  it('un member con registro en lectura ve el borrador pero recibe modulo_solo_lectura al aprobarlo', async () => {
    const pedido = await pedidoConfirmado('Pedido para el lector');
    await drenar();
    const propuesto = (await pendientesDeRegistro(dueno)).find((b) => b.args.origenId === pedido.id);
    expect(propuesto).toBeDefined();

    const visto = (await pendientesDeRegistro(lector)).find((b) => b.id === propuesto.id);
    expect(visto).toBeDefined();
    expect((await datosDe(lector, 'borradores_resumen', {})).pendientes).toBeGreaterThanOrEqual(1);

    const { respuesta } = await confirmando(lector, 'borrador_aprobar', { id: propuesto.id });
    expect(respuesta.estado).toBe(403);
    expect(codigoDe(respuesta)).toBe('modulo_solo_lectura');

    // Sigue pendiente y no nació ninguna deuda de ese pedido.
    expect((await pendientesDeRegistro(dueno)).some((b) => b.id === propuesto.id)).toBe(true);
    const deudas = await comoEmpresa(appPool, empresaId, async (c) => (await c.query('select origen_id from registro.deudas')).rows as { origen_id: string }[]);
    expect(deudas.some((d) => d.origen_id === pedido.id)).toBe(false);
  });
});
