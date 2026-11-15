import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { leerArgumentos, plataforma, type Urls } from '../../../scripts/plataforma.ts';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';

// El comando de plataforma contra la base local `capaz_test` (nunca Neon).

let auth: pg.Pool;
let sistema: pg.Pool;
let urls: Urls;
const correo = () => `p-${randomUUID().slice(0, 8)}@prueba.pe`;
const CODIGO = `modp_${Date.now()}`;

const crearUsuario = async (email: string) => {
  const id = randomUUID().replace(/-/g, '');
  await auth.query(`insert into auth."user" (id, name, email, email_verified) values ($1, 'Persona', $2, false)`, [id, email]);
  return id;
};

beforeAll(async () => {
  auth = abrirPool('auth');
  sistema = abrirPool('sistema');
  const base = (n: string) => { const u = new URL(process.env[n]!); u.pathname = '/capaz_test'; return u.toString(); };
  urls = { auth: base('DATABASE_URL_AUTH'), sistema: base('DATABASE_URL_SISTEMA'), app: base('DATABASE_URL_APP') };
  await sistema.query(`insert into core.modulos (codigo, nombre, por_defecto, prueba_dias) values ($1, 'Módulo de plataforma', true, 14) on conflict do nothing`, [CODIGO]);
});
afterAll(async () => {
  await sistema.query(`update core.modulos set por_defecto = false where codigo = $1`, [CODIGO]);
  await Promise.all([auth.end(), sistema.end()]);
});

describe('leerArgumentos', () => {
  it('separa el comando y las opciones', () => {
    expect(leerArgumentos(['activar', '--empresa', 'e1', '--modulo', 'registro', '--prueba-dias', '30'])).toEqual({
      comando: 'activar',
      opciones: { empresa: 'e1', modulo: 'registro', 'prueba-dias': '30' },
    });
  });
});

describe('plataforma', () => {
  it('crea una empresa con su dueño, su configuración y los módulos por defecto', async () => {
    const email = correo();
    await crearUsuario(email);
    const msg = await plataforma('crear-empresa', { nombre: 'Taller de Plataforma', correo: email }, urls);
    expect(msg).toContain('creada');
    const { rows } = await auth.query(`select o.id, m.role from auth.organization o join auth.member m on m.organization_id = o.id where o.name = 'Taller de Plataforma' order by o.created_at desc limit 1`);
    expect(rows[0].role).toBe('owner');
    const id = rows[0].id as string;
    const { rows: contratos } = await sistema.query(`select modulo, estado from core.empresa_modulos where tenant_id = $1 and modulo = $2`, [id, CODIGO]);
    expect(contratos).toEqual([{ modulo: CODIGO, estado: 'prueba' }]);
    const { rows: hist } = await sistema.query('select actor from core.empresa_modulos_eventos where tenant_id = $1 and modulo = $2', [id, CODIGO]);
    expect(hist[0].actor).toBe('plataforma:cli');
  });

  it('suspender, reactivar y dar de baja cambian el estado y dejan historial con el actor', async () => {
    const email = correo();
    await crearUsuario(email);
    await plataforma('crear-empresa', { nombre: 'Ciclo de Vida', correo: email }, urls);
    const { rows: [e] } = await auth.query(`select id from auth.organization where name = 'Ciclo de Vida' order by created_at desc limit 1`);
    const estado = async () => (await sistema.query('select estado from core.empresa_modulos where tenant_id = $1 and modulo = $2', [e.id, CODIGO])).rows[0].estado;
    await plataforma('suspender', { empresa: e.id, modulo: CODIGO, motivo: 'mora' }, urls);
    expect(await estado()).toBe('suspendido');
    await plataforma('reactivar', { empresa: e.id, modulo: CODIGO }, urls);
    expect(await estado()).toBe('activo');
    await plataforma('baja', { empresa: e.id, modulo: CODIGO, motivo: 'cancelación' }, urls);
    expect(await estado()).toBe('baja');
    const { rows } = await sistema.query('select evento from core.empresa_modulos_eventos where tenant_id = $1 and modulo = $2 order by creado_en, id', [e.id, CODIGO]);
    expect(rows.map((r) => r.evento)).toEqual(['prueba', 'suspension', 'reactivacion', 'baja']);
  });

  it('rechaza una empresa que no existe, un módulo desconocido y datos inválidos', async () => {
    await expect(plataforma('activar', { empresa: 'no-existe', modulo: CODIGO }, urls)).rejects.toThrow(/no existe/);
    const email = correo();
    await crearUsuario(email);
    await plataforma('crear-empresa', { nombre: 'Validaciones', correo: email }, urls);
    const { rows: [e] } = await auth.query(`select id from auth.organization where name = 'Validaciones' order by created_at desc limit 1`);
    await expect(plataforma('activar', { empresa: e.id, modulo: 'no_existe' }, urls)).rejects.toThrow(/no existe o no está disponible/);
    await expect(plataforma('activar', { empresa: e.id, modulo: CODIGO, 'prueba-dias': '-3' }, urls)).rejects.toThrow(/entero positivo/);
    await expect(plataforma('crear-empresa', { nombre: 'X', correo: 'nadie@no.pe' }, urls)).rejects.toThrow(/muy corto|registrarse/);
    await expect(plataforma('inventado', {}, urls)).rejects.toThrow(/Comando desconocido/);
  });

  it('crear-empresa exige un usuario ya registrado', async () => {
    await expect(plataforma('crear-empresa', { nombre: 'Sin Dueño', correo: correo() }, urls)).rejects.toThrow(/debe registrarse primero/);
  });

  it('admin registra a un administrador de plataforma, y es idempotente', async () => {
    const email = correo();
    const id = await crearUsuario(email);
    await plataforma('admin', { correo: email }, urls);
    await plataforma('admin', { correo: email }, urls);
    const { rows } = await sistema.query('select usuario_id from core.plataforma_admins where usuario_id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it('empresas lista cada empresa con el estado de sus módulos', async () => {
    const lista = await plataforma('empresas', {}, urls);
    expect(lista).toContain('Taller de Plataforma');
    expect(lista).toContain(`${CODIGO}:`);
  });
});
