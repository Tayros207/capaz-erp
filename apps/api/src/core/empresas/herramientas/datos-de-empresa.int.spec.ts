import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../../herramientas/http-de-pruebas.js';

// Datos de la propia empresa (razón social, RUC, logo…) por HTTP real: parciales, validados, con
// confirmación en dos pasos y auditoría sin el contenido.

let app: AppDePruebas;
let auth: pg.Pool;
let appPool: pg.Pool;
let dueno: Sesion;
let miembro: Sesion;
let ajeno: Sesion;
let empresaA: string;
let empresaB: string;

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcMQAAAABJRU5ErkJggg==';
const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;
const mensaje = (r: { cuerpo: any }) => JSON.stringify(r.cuerpo?.error ?? '');
const ver = async (s: Sesion) => (await s.herramienta('empresa_ver_configuracion', {})).cuerpo.datos;
const auditoriaDe = (empresaId: string) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query('select * from core.auditoria order by creado_en, id')).rows as Record<string, any>[]);

async function guardar(s: Sesion, args: Record<string, unknown>) {
  const p = await s.herramienta('empresa_actualizar_configuracion', args);
  expect(p.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String) } });
  return s.herramienta('empresa_actualizar_configuracion', args, { confirmacion: p.cuerpo.requiereConfirmacion.token });
}

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  appPool = abrirPool('app');
  [dueno, miembro, ajeno] = await Promise.all([abrirSesion(app, 'Dueña'), abrirSesion(app, 'Miembro'), abrirSesion(app, 'Ajena')]);
  empresaA = await crearEmpresa(dueno, 'Empresa A datos');
  empresaB = await crearEmpresa(ajeno, 'Empresa B datos');
  await auth.query('insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())', [
    randomUUID(),
    empresaA,
    miembro.usuarioId,
    'member',
  ]);
  expect((await miembro.pedir('POST', '/api/auth/organization/set-active', { organizationId: empresaA })).estado).toBe(200);
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
  await appPool.end();
});

describe('datos de la empresa', () => {
  it('al inicio todo es nulo', async () => {
    expect(await ver(dueno)).toMatchObject({ razonSocial: null, ruc: null, direccionFiscal: null, telefono: null, correo: null, pieDeDocumento: null, logoDataUrl: null });
  });

  it('se guardan con confirmación, de forma parcial, y cada empresa ve solo los suyos', async () => {
    const p = await dueno.herramienta('empresa_actualizar_configuracion', { razonSocial: 'Gráfica Andina S.A.C.', ruc: '20123456789' });
    expect(p.cuerpo.requiereConfirmacion).toBeTruthy();
    expect((await ver(dueno)).razonSocial).toBeNull();
    const r = await guardar(dueno, { razonSocial: 'Gráfica Andina S.A.C.', ruc: '20123456789', pieDeDocumento: 'Yape 999 888 777', logoDataUrl: PNG });
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { razonSocial: 'Gráfica Andina S.A.C.', ruc: '20123456789', logoDataUrl: PNG, moneda: 'PEN' } });
    const r2 = await guardar(dueno, { telefono: '999 888 777' });
    expect(r2.cuerpo.datos).toMatchObject({ razonSocial: 'Gráfica Andina S.A.C.', telefono: '999 888 777', pieDeDocumento: 'Yape 999 888 777' });
    expect(await ver(ajeno)).toMatchObject({ razonSocial: null, ruc: null, logoDataUrl: null });
    expect((await ver(miembro)).razonSocial).toBe('Gráfica Andina S.A.C.');
  });

  it('un member no cambia nada', async () => {
    const r = await miembro.herramienta('empresa_actualizar_configuracion', { razonSocial: 'Intruso' });
    expect(r.estado).toBe(403);
    expect(codigo(r)).toBe('sin_permiso');
    expect((await ver(dueno)).razonSocial).toBe('Gráfica Andina S.A.C.');
  });

  it('rechaza RUC inválido, logo SVG, logo enorme, textos largos y campos desconocidos', async () => {
    const casos: [Record<string, unknown>, RegExp][] = [
      [{ ruc: '123' }, /11 dígitos/],
      [{ ruc: '2012345678a' }, /11 dígitos/],
      [{ logoDataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, /PNG, JPEG o WebP/],
      [{ logoDataUrl: 'https://ejemplo.pe/logo.png' }, /PNG, JPEG o WebP/],
      [{ logoDataUrl: `data:image/png;base64,${'A'.repeat(150_000)}` }, /demasiado grande/],
      [{ razonSocial: 'x'.repeat(201) }, /máximo 200/],
      [{ pieDeDocumento: 'x'.repeat(1001) }, /máximo 1000/],
      [{ otro: 'x' }, /./],
    ];
    for (const [args, texto] of casos) {
      const r = await dueno.herramienta('empresa_actualizar_configuracion', args);
      expect(r.estado, JSON.stringify(args).slice(0, 80)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
      expect(mensaje(r)).toMatch(texto);
    }
    expect((await ver(dueno)).ruc).toBe('20123456789');
  });

  it('la cadena vacía borra el dato', async () => {
    const r = await guardar(dueno, { telefono: '', logoDataUrl: '' });
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { telefono: null, logoDataUrl: null, ruc: '20123456789' } });
  });

  it('si la fila cambió después de pedir la confirmación, el token ya no vale', async () => {
    const lento = await dueno.herramienta('empresa_actualizar_configuracion', { correo: 'a@b.pe' });
    await guardar(dueno, { direccionFiscal: 'Av. Nueva 1' });
    const r = await dueno.herramienta('empresa_actualizar_configuracion', { correo: 'a@b.pe' }, { confirmacion: lento.cuerpo.requiereConfirmacion.token });
    expect(codigo(r)).toBe('confirmacion_desactualizada');
  });

  it('la auditoría guarda solo los campos cambiados, nunca el contenido', async () => {
    await guardar(dueno, { logoDataUrl: PNG, pieDeDocumento: 'Cuenta secreta 123' });
    const filas = (await auditoriaDe(empresaA)).filter((f) => f.herramienta === 'empresa_actualizar_configuracion');
    const texto = JSON.stringify(filas);
    expect(texto).not.toContain('iVBORw0KGgo');
    expect(texto).not.toContain('Cuenta secreta');
    expect(texto).not.toContain('20123456789');
    expect(filas.at(-1)!.resumen).toEqual({ campos: 'logoDataUrl,pieDeDocumento' });
    expect(JSON.stringify(await auditoriaDe(empresaB))).not.toContain('iVBORw0KGgo');
  });
});
