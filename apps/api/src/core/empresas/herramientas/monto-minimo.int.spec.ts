import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../../herramientas/http-de-pruebas.js';

// Monto mínimo por trabajo configurable por empresa: nulo = por defecto, 0 = apagado, con confirmación y permisos.

let app: AppDePruebas;
let auth: pg.Pool;
let dueno: Sesion;
let miembro: Sesion;
const ver = async (s: Sesion) => (await s.herramienta('empresa_ver_configuracion', {})).cuerpo.datos;
const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;

async function guardar(s: Sesion, args: Record<string, unknown>) {
  const p = await s.herramienta('empresa_actualizar_configuracion', args);
  expect(p.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String) } });
  return { resumen: String(p.cuerpo.requiereConfirmacion.resumen ?? JSON.stringify(p.cuerpo)), r: await s.herramienta('empresa_actualizar_configuracion', args, { confirmacion: p.cuerpo.requiereConfirmacion.token }) };
}

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  [dueno, miembro] = await Promise.all([abrirSesion(app, 'Dueña mínimo'), abrirSesion(app, 'Miembro mínimo')]);
  const empresa = await crearEmpresa(dueno, 'Empresa monto mínimo');
  await auth.query('insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())', [randomUUID(), empresa, miembro.usuarioId, 'member']);
  expect((await miembro.pedir('POST', '/api/auth/organization/set-active', { organizationId: empresa })).estado).toBe(200);
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
});

describe('monto mínimo por trabajo', () => {
  it('es nulo por defecto', async () => {
    expect((await ver(dueno)).montoMinimoCentimos).toBeNull();
  });

  it('guarda 3000, 0 y vuelve a nulo, siempre con confirmación y resumen claro', async () => {
    const a = await guardar(dueno, { montoMinimoCentimos: 3000 });
    expect(a.r.cuerpo).toMatchObject({ ok: true, datos: { montoMinimoCentimos: 3000 } });
    expect(a.resumen).toContain('S/ 30.00');
    const b = await guardar(dueno, { montoMinimoCentimos: 0 });
    expect(b.r.cuerpo.datos.montoMinimoCentimos).toBe(0);
    expect(b.resumen).toContain('apagarás el aviso');
    const c = await guardar(dueno, { montoMinimoCentimos: null });
    expect(c.r.cuerpo.datos.montoMinimoCentimos).toBeNull();
    expect(c.resumen).toContain('S/ 40.00');
    expect((await ver(dueno)).montoMinimoCentimos).toBeNull();
  });

  it('un miembro de solo lectura lo ve pero no lo cambia', async () => {
    await guardar(dueno, { montoMinimoCentimos: 2500 });
    expect((await ver(miembro)).montoMinimoCentimos).toBe(2500);
    const r = await miembro.herramienta('empresa_actualizar_configuracion', { montoMinimoCentimos: 1 });
    expect(r.estado).toBe(403);
    expect(codigo(r)).toBe('sin_permiso');
  });

  it('rechaza -1, 10,000,001 y 12.5', async () => {
    for (const v of [-1, 10_000_001, 12.5]) {
      const r = await dueno.herramienta('empresa_actualizar_configuracion', { montoMinimoCentimos: v });
      expect(r.estado, String(v)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
      expect(JSON.stringify(r.cuerpo.error)).toContain('céntimos enteros');
    }
    expect((await ver(dueno)).montoMinimoCentimos).toBe(2500);
  });
});
