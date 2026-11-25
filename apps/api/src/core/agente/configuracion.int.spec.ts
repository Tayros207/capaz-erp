import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import type pg from 'pg';

// Cambiar el modelo y el tope del asistente: herramientas registradas, auditadas y con confirmación. El asistente no puede usarlas.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let miembro: Sesion;
let empresa: string;
const FLASH = 'deepseek/deepseek-v4.1-flash-1017';
const PRO = 'deepseek/deepseek-v4-pro-0813';

beforeAll(async () => {
  process.env.AGENTE_PROVEEDOR = 'simulado';
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, miembro] = await Promise.all([abrirSesion(app, 'Dueña'), abrirSesion(app, 'Miembro')]);
  empresa = await crearEmpresa(dueno, 'Imprenta de la configuración');
  await agregarMiembro(app, empresa, miembro, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
});
afterAll(async () => {
  delete process.env.AGENTE_PROVEEDOR;
  await app.cerrar();
  await appPool.end();
});

/** Las críticas se hacen en dos pasos: pedir, y confirmar con el token que devuelve el servidor. */
async function configurar(s: Sesion, args: Record<string, unknown>) {
  const pedido = await s.herramienta('agente_configurar', args);
  if (pedido.estado !== 200 || !pedido.cuerpo?.requiereConfirmacion) return pedido;
  return s.herramienta('agente_configurar', args, { confirmacion: pedido.cuerpo.requiereConfirmacion.token });
}

describe('agente_configuracion_ver', () => {
  it('la dueña ve lo que rige, el gasto del mes y el catálogo de modelos (sin precios: el proveedor no es OpenRouter)', async () => {
    const r = await dueno.herramienta('agente_configuracion_ver', {});
    expect(r.estado).toBe(200);
    const d = r.cuerpo.datos;
    expect(d.configuracion).toEqual({
      modelo: null, modeloEfectivo: FLASH, topeMensualMicrousd: null, topeEfectivoMicrousd: 5_000_000, escrituraDirecta: true, dineroDirecto: true, topePorOperacionCentimos: 100_000, internet: true, gastoDelMesMicrousd: 0,
    });
    expect(d.preciosDisponibles).toBe(false);
    expect(d.catalogo.map((m: { id: string }) => m.id)).toContain(FLASH);
    expect(d.catalogo.every((m: { evaluado: boolean }) => m.evaluado === false)).toBe(true);
  });

  it('sin sesión se rechaza', async () => {
    const anonimo = await abrirSesion(app);
    await anonimo.pedir('POST', '/api/auth/sign-out', {});
    expect((await anonimo.herramienta('agente_configuracion_ver', {})).estado).toBe(401);
  });
});

describe('agente_configurar', () => {
  it('pide confirmación con un resumen en palabras sencillas y NO cambia nada hasta confirmar', async () => {
    const pedido = await dueno.herramienta('agente_configurar', { modelo: PRO });
    expect(pedido.estado).toBe(200);
    expect(pedido.cuerpo.requiereConfirmacion.resumen).toContain(`de «${FLASH}» a «${PRO}»`);
    const ver = await dueno.herramienta('agente_configuracion_ver', {});
    expect(ver.cuerpo.datos.configuracion.modelo).toBeNull();
  });

  it('confirmado, cambia el modelo y el estado del asistente lo refleja al instante', async () => {
    const r = await configurar(dueno, { modelo: PRO });
    expect(r.cuerpo.ok).toBe(true);
    expect(r.cuerpo.datos.configuracion).toMatchObject({ modelo: PRO, modeloEfectivo: PRO });
    expect((await dueno.pedir('GET', '/api/v1/agente/estado')).cuerpo.datos.modelo).toBe(PRO);
  });

  it('un valor nulo vuelve al modelo del sistema', async () => {
    const r = await configurar(dueno, { modelo: null });
    expect(r.cuerpo.datos.configuracion).toMatchObject({ modelo: null, modeloEfectivo: FLASH });
  });

  it('cambia el tope: el resumen lo dice en dólares y el estado avisa si queda en cero', async () => {
    const pedido = await dueno.herramienta('agente_configurar', { topeMensualMicrousd: 12_000_000 });
    expect(pedido.cuerpo.requiereConfirmacion.resumen).toBe('Cambiarás el tope mensual de US$ 5.00 a US$ 12.00.');
    expect((await configurar(dueno, { topeMensualMicrousd: 12_000_000 })).cuerpo.datos.configuracion.topeEfectivoMicrousd).toBe(12_000_000);
    const aCero = await dueno.herramienta('agente_configurar', { topeMensualMicrousd: 0 });
    expect(aCero.cuerpo.requiereConfirmacion.resumen).toContain('el asistente quedará detenido');
    await configurar(dueno, { topeMensualMicrousd: 0 });
    expect((await dueno.pedir('GET', '/api/v1/agente/estado')).cuerpo.datos).toMatchObject({ activo: false, motivo: 'tope_mensual' });
    await configurar(dueno, { topeMensualMicrousd: null });
    expect((await dueno.pedir('GET', '/api/v1/agente/estado')).cuerpo.datos.activo).toBe(true);
  });

  it('rechaza un modelo con forma rara, uno de otro proveedor que no se puede comprobar, y un tope decimal o negativo', async () => {
    expect((await dueno.herramienta('agente_configurar', { modelo: 'sin barra' })).cuerpo.error.codigo).toBe('argumentos_invalidos');
    const fuera = await dueno.herramienta('agente_configurar', { modelo: 'nuevo/modelo-desconocido' });
    expect(fuera.cuerpo.error.mensaje).toContain('No se pudo comprobar');
    expect((await dueno.herramienta('agente_configurar', { topeMensualMicrousd: 1.5 })).cuerpo.error.codigo).toBe('argumentos_invalidos');
    expect((await dueno.herramienta('agente_configurar', { topeMensualMicrousd: -5 })).cuerpo.error.codigo).toBe('argumentos_invalidos');
  });

  it('exige indicar algo que cambiar y rechaza argumentos de contexto', async () => {
    expect((await dueno.herramienta('agente_configurar', {})).cuerpo.error.codigo).toBe('argumentos_invalidos');
    expect((await dueno.herramienta('agente_configurar', { modelo: null, empresaId: 'otra' })).cuerpo.error.codigo).toBe('argumento_prohibido');
  });

  it('una persona sin el permiso de configurar la empresa no puede', async () => {
    const r = await miembro.herramienta('agente_configurar', { modelo: PRO });
    expect(r.estado).toBe(403);
  });

  it('el estado indica quién puede configurar', async () => {
    expect((await dueno.pedir('GET', '/api/v1/agente/estado')).cuerpo.datos.puedeConfigurar).toBe(true);
    expect((await miembro.pedir('GET', '/api/v1/agente/estado')).cuerpo.datos.puedeConfigurar).toBe(false);
  });

  it('queda en la auditoría con el canal «ui» y solo los nombres de los campos, no los valores', async () => {
    const c = await appPool.connect();
    try {
      await c.query('begin');
      await c.query(`select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)`, [empresa, dueno.usuarioId]);
      const { rows } = await c.query(`select canal, resultado, resumen from core.auditoria where herramienta = 'agente_configurar' and resultado = 'ok' order by creado_en desc limit 1`);
      expect(rows[0]).toMatchObject({ canal: 'ui', resultado: 'ok' });
      // Solo los nombres de los campos que cambiaron: ni el modelo elegido ni el tope.
      expect(rows[0].resumen).toEqual({ campos: expect.any(String) });
      expect(JSON.stringify(rows[0].resumen)).not.toContain(PRO);
      await c.query('rollback');
    } finally {
      c.release();
    }
  });
});

describe('el asistente no puede cambiar su propia configuración', () => {
  it('por el canal «agente» el ejecutor ni siquiera pide confirmación', async () => {
    const ctx = (await app.obtener(ServicioDeAcceso).contextoDe(empresa, dueno.usuarioId, 'agente', 'p'))!;
    const r = await app.obtener(EjecutorDeHerramientas).ejecutar('agente_configurar', { modelo: PRO }, { ctx });
    expect(r).toMatchObject({ ok: false, error: { codigo: 'confirmacion_solo_ui' } });
    const ver = await dueno.herramienta('agente_configuracion_ver', {});
    expect(ver.cuerpo.datos.configuracion.modelo).toBeNull();
  });
});
