import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import pino from 'pino';
import { z } from 'zod';
import type { ManifiestoDeConector, Respuesta } from '@capaz/shared';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { EscritorDeAuditoria } from '../auditoria/escritor.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { acceso, codigoDe, contextoDePrueba, SECRETO } from '../herramientas/pruebas-del-ejecutor.js';
import { registroDePrueba } from '../herramientas/pruebas.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import type { CatalogoDeModulos } from '../modulos/catalogo.js';
import { Cifrador } from './cifrado.js';
import { crearHerramientasDeConexiones } from './herramientas-de-conexiones.js';
import { RegistroDeConectores } from './registro-de-conectores.js';
import * as repo from './repositorio.js';

// Fase 11a-1: conectores, conexiones y claves de API contra PostgreSQL real.

let app: pg.Pool;
let sistema: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let ejecutor: EjecutorDeHerramientas;
let registro: RegistroDeConectores;
let cifrador: Cifrador;
let E: string;
let db: DatabaseService;

const TOKEN = 'token-ultra-secreto-12345';
const PERMISOS = ['conexiones:ver', 'conexiones:gestionar'];
const prueba: ManifiestoDeConector = {
  codigo: 'prueba_s7',
  nombre: 'Prueba S7',
  descripcion: 'Conector de pruebas',
  version: '1.0.0',
  capacidades: ['enviar_mensaje'],
  autenticacion: 'clave_api',
  configuracion: z.strictObject({ region: z.string().default('pe') }),
  credenciales: z.strictObject({ token: z.string().min(5) }),
  herramientas: [],
  escucha: [],
  emite: [],
};
const catalogoFalso = { porCodigo: (c: string) => (c === 'prueba_s7' ? { familia: 'conexiones' } : undefined) } as unknown as CatalogoDeModulos;
const config = { NODE_ENV: 'test' as const, CONEXIONES_CLAVE: undefined };

beforeAll(async () => {
  app = abrirPool('app');
  sistema = abrirPool('sistema');
  conEmpresa = conEmpresaDePruebas(app);
  db = { conEmpresa, sistema } as unknown as DatabaseService;
  cifrador = new Cifrador(new Map([[1, randomBytes(32)]]), 1);
  registro = new RegistroDeConectores(db, catalogoFalso, config, pino({ level: 'silent' }));
  registro.agregar(prueba);
  await registro.sincronizar();
  const reg = registroDePrueba(crearHerramientasDeConexiones({ conectores: registro, cifrador }));
  ejecutor = new EjecutorDeHerramientas(reg, db, new EscritorDeAuditoria(db), { CONFIRMACION_SECRET: SECRETO }, { error: (...a: unknown[]) => { if (process.env.DEBUG_PRUEBAS) console.error(...a); } } as never);
});
afterAll(() => Promise.all([app.end(), sistema.end()]));
beforeEach(() => {
  E = empresaDePrueba();
});

const ctx = (e = E, c: Partial<ContextoDeHerramienta> = {}) =>
  contextoDePrueba(e, { permisos: PERMISOS, modulos: [acceso('core'), acceso('prueba_s7')], ...c });
const llamar = (n: string, a: unknown, c: Partial<ContextoDeHerramienta> = {}, confirmacion?: string, e = E) => ejecutor.ejecutar(n, a, { ctx: ctx(e, c), confirmacion });
const datos = <T>(r: Respuesta<unknown>): T => {
  if (!r.ok || !('datos' in r)) throw new Error(`Se esperaba éxito: ${JSON.stringify(r)}`);
  return r.datos as T;
};
/** Las acciones críticas piden confirmación en dos pasos: el segundo lleva el token del primero. */
async function confirmar(nombre: string, args: unknown, c: Partial<ContextoDeHerramienta> = {}, e = E): Promise<Respuesta<unknown>> {
  const primero = await llamar(nombre, args, c, undefined, e);
  if (primero.ok || !('requiereConfirmacion' in primero)) return primero;
  return llamar(nombre, args, c, primero.requiereConfirmacion.token, e);
}
const filas = (sql: string, e = E) => comoEmpresa(app, e, async (c) => (await c.query(sql)).rows);

describe('RegistroDeConectores', () => {
  it('sincroniza core.conectores (idempotente) y apaga lo que ya no existe en el código', async () => {
    await registro.sincronizar();
    await registro.sincronizar();
    const { rows } = await sistema.query(`select * from core.conectores where codigo = 'prueba_s7'`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nombre: 'Prueba S7', version: '1.0.0', autenticacion: 'clave_api', activo: true, capacidades: ['enviar_mensaje'] });
    const solo = new RegistroDeConectores(db, catalogoFalso, config, pino({ level: 'silent' }));
    solo.agregar({ ...prueba, codigo: 'otro_s7' });
    await expect(solo.sincronizar()).resolves.toBeUndefined();
    expect((await sistema.query(`select activo from core.conectores where codigo = 'prueba_s7'`)).rows[0].activo).toBe(false);
    await registro.sincronizar();
    expect((await sistema.query(`select activo from core.conectores where codigo = 'prueba_s7'`)).rows[0].activo).toBe(true);
    await sistema.query(`delete from core.conectores where codigo = 'otro_s7'`);
  });

  it('rechaza un conector sin módulo, de otra familia o con forma inválida; y códigos repetidos', () => {
    const r = new RegistroDeConectores(
      db,
      { porCodigo: (c: string) => (c === 'ventas' ? { familia: 'ventas' } : c === 'prueba_s7' ? { familia: 'conexiones' } : undefined) } as unknown as CatalogoDeModulos,
      config,
      pino({ level: 'silent' }),
    );
    r.agregar({ ...prueba, codigo: 'sin_modulo' });
    r.agregar({ ...prueba, codigo: 'ventas' });
    r.agregar({ ...prueba, version: 'x' });
    r.agregar({ ...prueba, codigo: 'Mal Codigo' });
    expect(() => r.agregar({ ...prueba, codigo: 'ventas' })).toThrow(/Ya existe/);
    const p = r.problemas().join('\n');
    expect(p).toMatch(/«sin_modulo».*módulo/);
    expect(p).toMatch(/«ventas».*familia/);
    expect(p).toMatch(/«prueba_s7».*versión/);
    expect(p).toMatch(/«Mal Codigo».*código inválido/);
    expect(() => r.validar()).toThrow(/Conectores inválidos/);
  });

  it('en producción exige CONEXIONES_CLAVE', async () => {
    const r = new RegistroDeConectores(db, catalogoFalso, { NODE_ENV: 'production', CONEXIONES_CLAVE: undefined }, pino({ level: 'silent' }));
    await expect(r.onApplicationBootstrap()).rejects.toThrow(/CONEXIONES_CLAVE/);
  });
});

describe('conexion_configurar y credenciales', () => {
  it('es crítica: sin confirmación no escribe nada', async () => {
    const r = await llamar('conexion_configurar', { conector: 'prueba_s7', configuracion: {}, credenciales: { token: TOKEN } });
    expect(r.ok).toBe(false);
    expect('requiereConfirmacion' in r).toBe(true);
    expect(await filas('select * from core.conexiones')).toHaveLength(0);
  });

  it('cifra las credenciales: en la base solo hay texto cifrado y la respuesta no las trae', async () => {
    const r = await confirmar('conexion_configurar', { conector: 'prueba_s7', configuracion: { region: 'lima' }, credenciales: { token: TOKEN } });
    const c = datos<Record<string, unknown>>(r);
    expect(c).toMatchObject({ conector: 'prueba_s7', estado: 'activa', configuracion: { region: 'lima' }, credencialesConfiguradas: true });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    const [fila] = await filas('select credenciales_cifradas, clave_version from core.conexiones');
    expect(fila.clave_version).toBe(1);
    expect(fila.credenciales_cifradas).not.toContain(TOKEN);
    // Quien USA la credencial la recupera con la clave maestra y el contexto de la fila.
    const cifrado = await conEmpresa({ empresaId: E, usuarioId: 'x' }, (tx) => repo.credencialesDe(tx, 'prueba_s7'));
    expect(JSON.parse(cifrador.descifrar(cifrado!, `conexion:${E}:prueba_s7`))).toEqual({ token: TOKEN });
    expect(() => cifrador.descifrar(cifrado!, `conexion:otra:prueba_s7`)).toThrow();
  });

  it('conexion_ver y conectores_listar nunca devuelven credenciales; reconfigurar sin ellas las conserva', async () => {
    await confirmar('conexion_configurar', { conector: 'prueba_s7', credenciales: { token: TOKEN } });
    const ver = await llamar('conexion_ver', { conector: 'prueba_s7' });
    const lista = await llamar('conectores_listar', {});
    expect(JSON.stringify([ver, lista])).not.toContain(TOKEN);
    expect(datos<{ items: { codigo: string; estado: string; moduloActivo: boolean }[] }>(lista).items.find((i) => i.codigo === 'prueba_s7')).toMatchObject({ estado: 'activa', moduloActivo: true });
    const otra = datos<{ credencialesConfiguradas: boolean }>(await confirmar('conexion_configurar', { conector: 'prueba_s7', configuracion: { region: 'cusco' } }));
    expect(otra.credencialesConfiguradas).toBe(true);
  });

  it('valida con el esquema del conector sin repetir lo recibido, y exige el módulo', async () => {
    const mala = await confirmar('conexion_configurar', { conector: 'prueba_s7', credenciales: { token: 'abc', extra: TOKEN } });
    expect(codigoDe(mala)).toBe('argumentos_invalidos');
    expect(JSON.stringify(mala)).not.toContain(TOKEN);
    expect(codigoDe(await confirmar('conexion_configurar', { conector: 'prueba_s7', configuracion: { region: 5 } }))).toBe('argumentos_invalidos');
    expect(codigoDe(await confirmar('conexion_configurar', { conector: 'prueba_s7', credenciales: { token: TOKEN } }, { modulos: [acceso('core')] }))).toBe('modulo_no_disponible');
    expect(codigoDe(await confirmar('conexion_configurar', { conector: 'no_existe', credenciales: { token: TOKEN } }))).toBe('no_encontrado');
  });

  it('la auditoría no guarda credenciales ni argumentos', async () => {
    await confirmar('conexion_configurar', { conector: 'prueba_s7', credenciales: { token: TOKEN } });
    const texto = JSON.stringify(await filas('select * from core.auditoria'));
    expect(texto).not.toContain(TOKEN);
    expect(texto).toContain('conexion_configurar');
  });

  it('desactivar apaga la conexión', async () => {
    await confirmar('conexion_configurar', { conector: 'prueba_s7', credenciales: { token: TOKEN } });
    expect(datos<{ estado: string }>(await llamar('conexion_desactivar', { conector: 'prueba_s7' })).estado).toBe('desactivada');
    expect(codigoDe(await llamar('conexion_desactivar', { conector: 'webhooks' }))).toBe('no_encontrado');
  });

  it('una empresa no ve la conexión de otra', async () => {
    await confirmar('conexion_configurar', { conector: 'prueba_s7', credenciales: { token: TOKEN } });
    const B = empresaDePrueba();
    expect(codigoDe(await llamar('conexion_ver', { conector: 'prueba_s7' }, {}, undefined, B))).toBe('no_encontrado');
    expect(await filas('select * from core.conexiones', B)).toHaveLength(0);
  });

  it('capaz_sistema no puede leer credenciales ni configuración', async () => {
    await confirmar('conexion_configurar', { conector: 'prueba_s7', credenciales: { token: TOKEN } });
    await expect(sistema.query('select credenciales_cifradas from core.conexiones')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select configuracion from core.conexiones')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select clave_version from core.conexiones')).rejects.toThrow(/permission denied/);
    const { rows } = await sistema.query('select id, tenant_id, conector, estado from core.conexiones where tenant_id = $1', [E]);
    expect(rows).toHaveLength(1);
  });

  it('sin permiso no se ve ni se configura', async () => {
    expect(codigoDe(await llamar('conexion_ver', { conector: 'prueba_s7' }, { permisos: [] }))).toBe('sin_permiso');
    expect(codigoDe(await llamar('conexion_desactivar', { conector: 'prueba_s7' }, { permisos: ['conexiones:ver'] }))).toBe('sin_permiso');
  });
});

describe('claves de API', () => {
  type Creada = { id: string; clave: string; prefijo: string; alcance: string[] };

  it('la clave se muestra una sola vez y en la base solo queda su hash', async () => {
    const c = datos<Creada>(await llamar('clave_api_crear', { nombre: 'Zapier' }));
    expect(c.clave).toMatch(/^capaz_[A-Za-z0-9_-]{43}$/);
    expect(c.alcance).toEqual(['entrada']);
    const filasDb = await filas('select * from core.claves_api');
    expect(JSON.stringify(filasDb)).not.toContain(c.clave);
    expect(filasDb[0].hash).toMatch(/^[0-9a-f]{64}$/);
    const lista = await llamar('claves_api_listar', {});
    expect(JSON.stringify(lista)).not.toContain(c.clave);
    expect(JSON.stringify(lista)).not.toContain(filasDb[0].hash);
    expect(datos<{ items: Creada[] }>(lista).items[0]).toMatchObject({ id: c.id, prefijo: c.prefijo });
    expect(JSON.stringify(await filas('select * from core.auditoria'))).not.toContain(c.clave);
  });

  it('revocar es crítica y deja la clave revocada', async () => {
    const c = datos<Creada>(await llamar('clave_api_crear', { nombre: 'Make' }));
    const primero = await llamar('clave_api_revocar', { id: c.id });
    expect('requiereConfirmacion' in primero).toBe(true);
    expect((await filas('select revocada_en from core.claves_api'))[0].revocada_en).toBeNull();
    const r = datos<{ revocadaEn: string | null }>(await confirmar('clave_api_revocar', { id: c.id }));
    expect(r.revocadaEn).not.toBeNull();
    expect(codigoDe(await confirmar('clave_api_revocar', { id: '0192f3a0-0000-7000-8000-000000000000' }))).toBe('no_encontrado');
  });

  it('capaz_sistema solo resuelve la empresa por el hash: ve lo mínimo y puede anotar el último uso', async () => {
    const c = datos<Creada>(await llamar('clave_api_crear', { nombre: 'n8n' }));
    const [{ hash }] = await filas('select hash from core.claves_api');
    const { rows } = await sistema.query('select tenant_id, id, alcance, revocada_en from core.claves_api where hash = $1', [hash]);
    expect(rows[0]).toMatchObject({ tenant_id: E, id: c.id });
    await expect(sistema.query('select nombre from core.claves_api')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('update core.claves_api set ultimo_uso_en = now() where hash = $1', [hash])).resolves.toBeDefined();
    await expect(sistema.query('update core.claves_api set revocada_en = null where hash = $1', [hash])).rejects.toThrow(/permission denied/);
  });

  it('una empresa no ve las claves de otra', async () => {
    await llamar('clave_api_crear', { nombre: 'A' });
    expect(datos<{ items: unknown[] }>(await llamar('claves_api_listar', {}, {}, undefined, empresaDePrueba())).items).toHaveLength(0);
  });
});
