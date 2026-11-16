import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion } from '../herramientas/http-de-pruebas.js';

// `yo.operador` por HTTP real: sale solo de la lista blanca `core.plataforma_admins`.

let app: AppDePruebas;
let sistema: pg.Pool;

beforeAll(async () => {
  app = await levantarApp();
  sistema = abrirPool('sistema');
});
afterAll(async () => {
  await app.cerrar();
  await sistema.end();
});

describe('yo.operador', () => {
  it('un usuario normal recibe false y un operador de la lista blanca recibe true', async () => {
    const normal = await abrirSesion(app, 'Persona normal');
    const op = await abrirSesion(app, 'Persona operadora');
    expect((await normal.pedir('GET', '/api/v1/yo')).cuerpo.datos.operador).toBe(false);
    expect((await op.pedir('GET', '/api/v1/yo')).cuerpo.datos.operador).toBe(false);
    await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [op.usuarioId]);
    expect((await op.pedir('GET', '/api/v1/yo')).cuerpo.datos.operador).toBe(true);
    expect((await normal.pedir('GET', '/api/v1/yo')).cuerpo.datos.operador).toBe(false);
    await sistema.query('delete from core.plataforma_admins where usuario_id = $1', [op.usuarioId]);
    expect((await op.pedir('GET', '/api/v1/yo')).cuerpo.datos.operador).toBe(false);
  });
});
