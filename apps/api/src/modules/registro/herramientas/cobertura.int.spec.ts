import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { diaMas, hoyDePrueba } from '../../../pruebas/fechas.js';
import { codigoDe, confirmando, datosDe } from './pruebas-de-registro.js';

// Cobertura del mes y pagos por vencer en «Mi día», por HTTP real. Nombres inventados.

let app: AppDePruebas;
let dueno: Sesion;
let propio: Sesion;
let proveedor: string;
let proveedorProximo: string;
const MES = '2026-03';

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, propio] = await Promise.all(['Dueña', 'Propia'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Empresa de cobertura');
  await Promise.all(['registro', 'ordenes'].map((m) => activarModulo(A, m)));
  await agregarMiembro(app, A, propio, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  await datosDe(dueno, 'registro_iniciar');
  proveedor = (await datosDe(dueno, 'clientes_crear', { nombre: 'Alquiler de Prueba' })).id;
  proveedorProximo = (await datosDe(dueno, 'clientes_crear', { nombre: 'Luz de Prueba' })).id;
  const cuentas = (await datosDe(dueno, 'cuentas_listar', {})).items;
  const otra = await datosDe(dueno, 'cuenta_crear', { nombre: 'Banco de Prueba', tipo: 'banco' });

  await datosDe(dueno, 'movimiento_registrar', { tipo: 'ingreso', montoCentimos: 54_000, fecha: `${MES}-10`, cuentaId: cuentas[0].id });
  // Una transferencia entre cuentas no es ingreso.
  await datosDe(dueno, 'cuentas_transferir', { origenId: cuentas[0].id, destinoId: otra.id, montoCentimos: 20_000, fecha: `${MES}-11` });
  await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: proveedor, concepto: 'Alquiler de marzo', totalCentimos: 100_000, fecha: `${MES}-01`, venceEn: `${MES}-05` });
  // Anulada: no cuenta. De otro mes: no cuenta.
  const anulada = await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: proveedor, concepto: 'Anulada', totalCentimos: 70_000, fecha: `${MES}-01`, venceEn: `${MES}-06` });
  await confirmando(dueno, 'deuda_anular', { id: anulada.id, motivo: 'error' });
  await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: proveedor, concepto: 'Abril', totalCentimos: 90_000, fecha: `${MES}-01`, venceEn: '2026-04-05' });
  await datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', contactoId: proveedorProximo, concepto: 'Luz del local', totalCentimos: 30_000, venceEn: diaMas(2) });
});
afterAll(async () => {
  await app.cerrar();
});

describe('registro_cobertura_del_mes', () => {
  it('suma ingresos sin transferencias y compromisos no anulados del mes', async () => {
    const c = await datosDe(dueno, 'registro_cobertura_del_mes', { mes: MES });
    expect(c).toMatchObject({ mes: MES, desde: '2026-03-01', hasta: '2026-03-31', ingresosCentimos: 54_000, compromisosCentimos: 100_000, compromisosPagadosCentimos: 0, faltaCentimos: 46_000, porcentaje: 54, compromisos: 1 });
  });
  it('una diferencia de caja del cierre semanal no cuenta como ingreso', async () => {
    const cuentas = (await datosDe(dueno, 'cuentas_listar', {})).items as any[];
    const conteos = cuentas.map((c) => ({ cuentaId: c.id, contadoCentimos: c.tipo === 'caja' ? 5_000 : 0, ...(c.tipo === 'caja' && { explicacion: 'Sobró dinero sin explicación' }) }));
    const { respuesta } = await confirmando(dueno, 'semana_cerrar', { desde: '2026-03-02', conteos });
    expect(respuesta.cuerpo.datos.movimientosCreados).toHaveLength(1); // el ingreso de la diferencia, fechado el 7 de marzo
    const c = await datosDe(dueno, 'registro_cobertura_del_mes', { mes: MES });
    expect(c).toMatchObject({ ingresosCentimos: 54_000, porcentaje: 54 });
  });
  it('el año va desde 1900', async () => {
    expect(codigoDe(await dueno.herramienta('registro_cobertura_del_mes', { mes: '1800-01' }))).toBe('argumentos_invalidos');
  });
  it('un mes sin compromisos da porcentaje null', async () => {
    expect(await datosDe(dueno, 'registro_cobertura_del_mes', { mes: '2025-01' })).toMatchObject({ porcentaje: null, compromisos: 0, faltaCentimos: 0 });
  });
  it('por defecto toma el mes actual', async () => {
    expect((await datosDe(dueno, 'registro_cobertura_del_mes', {})).mes).toBe(hoyDePrueba().slice(0, 7));
  });
  it('con alcance «propios» se rechaza', async () => {
    expect(codigoDe(await propio.herramienta('registro_cobertura_del_mes', { mes: MES }))).toBe('sin_permiso');
  });
});

describe('pagos por vencer en Mi día', () => {
  it('la tarjeta aparece dos días antes del vencimiento y la vencida sigue saliendo', async () => {
    const t = (await datosDe(dueno, 'registro_pendientes', {})).tarjetas.filter((x: any) => x.clave.startsWith('pagar:'));
    const luz = t.find((x: any) => x.titulo === 'Pagar a Luz de Prueba');
    expect(luz).toMatchObject({ grupo: 'seguimiento', urgencia: 'pronto', montoCentimos: 30_000, detalle: 'Luz del local · vence en 2 días' });
    expect(luz.entidad.tipo).toBe('deuda');
    const alquiler = t.find((x: any) => x.detalle.startsWith('Alquiler de marzo'));
    expect(alquiler).toMatchObject({ urgencia: 'atrasado', montoCentimos: 100_000 });
    expect(t.map((x: any) => x.titulo).sort()).toEqual(['Pagar a Alquiler de Prueba', 'Pagar a Alquiler de Prueba', 'Pagar a Luz de Prueba']); // la anulada no sale
    const d = await datosDe(dueno, 'mi_dia_ver', {});
    expect(d.grupos.flatMap((g: any) => g.tarjetas).some((x: any) => x.clave === luz.clave)).toBe(true);
  });
});
