import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { interpreteDePrueba } from './interprete-de-prueba.js';
import { RegistroDeInterpretes } from './registro-de-interpretes.js';

// Captura por HTTP real, dos empresas: solo propone borradores; nada se ejecuta hasta que una persona aprueba.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let sinRegistro: Sesion;
let lector: Sesion;
let ajeno: Sesion;
let A: string;
let B: string;

const codigoDe = (r: { cuerpo: any }): string | undefined => r.cuerpo?.error?.codigo;
const datos = (r: { estado: number; cuerpo: any }) => {
  if (r.estado !== 200) throw new Error(`Se esperaba 200: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const dictar = (s: Sesion, texto = 'cobré 500', extra: Record<string, unknown> = {}, clave?: string) =>
  s.herramienta('captura_proponer', { texto, origen: 'voz', transcurridoMs: 8000, ...extra }, { clave });
const filas = (empresa: string, consulta: string) => comoEmpresa(appPool, empresa, async (c) => (await c.query(consulta)).rows);
const cuenta = async (empresa: string) => Number((await filas(empresa, 'select count(*)::int as n from core.borradores'))[0].n);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  app.obtener(RegistroDeInterpretes).fijar(interpreteDePrueba);
  [dueno, sinRegistro, lector, ajeno] = await Promise.all(['Dueña', 'Sin registro', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Captura A');
  B = await crearEmpresa(ajeno, 'Captura B');
  await activarModulo(A, 'crm');
  await agregarMiembro(app, A, sinRegistro, { modulo: 'crm', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  datos(await dueno.herramienta('registro_iniciar', {}));
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('captura_proponer', () => {
  it('1 · el dueño dicta: un borrador de voz, con la hora calculada por el servidor y el evento', async () => {
    const antes = Date.now();
    const d = datos(await dictar(dueno));
    expect(d).toMatchObject({ faltan: [], pista: null, interpretadoCon: 'reglas' });
    expect(d.borradores).toHaveLength(1);
    const b = datos(await dueno.herramienta('borrador_ver', { id: d.borradores[0].id }));
    expect(b).toMatchObject({ origen: 'voz', propuestoPor: dueno.usuarioId, corregido: false, estado: 'pendiente', herramienta: 'movimiento_registrar' });
    expect(b.argsOriginales).toEqual(b.args);
    expect(Math.abs(Date.parse(b.capturaIniciadaEn) - (antes - 8000))).toBeLessThan(5000);
    const ev = await filas(A, `select carga from core.eventos_salida where tipo = 'borrador.propuesto'`);
    expect(ev.some((e: any) => e.carga.id === b.id && e.carga.origen === 'voz')).toBe(true);
    // El texto dictado no viaja en eventos ni en auditoría (R26).
    expect(JSON.stringify(ev)).not.toContain('cobré');
    const aud = await filas(A, `select resumen, entidad_id from core.auditoria where herramienta = 'captura_proponer' and resultado = 'ok'`);
    expect(aud.length).toBeGreaterThan(0);
    expect(aud[0].resumen).toMatchObject({ borradores: 1, faltan: 0, origen: 'voz', interpretadoCon: 'reglas' });
    expect(JSON.stringify(aud)).not.toContain('cobré');
  });

  it('2 · nada se ejecuta al proponer; aprobar crea el movimiento sin corregir', async () => {
    const antes = datos(await dueno.herramienta('movimientos_listar', {})).items.length;
    const d = datos(await dictar(dueno, 'otro ingreso'));
    expect(datos(await dueno.herramienta('movimientos_listar', {})).items.length).toBe(antes);
    const r = datos(await dueno.herramienta('borrador_aprobar', { id: d.borradores[0].id }));
    expect(r.borrador).toMatchObject({ estado: 'aprobado', corregido: false });
    expect(datos(await dueno.herramienta('movimientos_listar', {})).items.length).toBe(antes + 1);
  });

  it('3 · la misma Idempotency-Key devuelve lo mismo y deja un solo borrador', async () => {
    const antes = await cuenta(A);
    const a = await dictar(dueno, 'idem', {}, 'clave-captura-0001');
    const b = await dictar(dueno, 'idem', {}, 'clave-captura-0001');
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect(await cuenta(A)).toBe(antes + 1);
  });

  it('4 · un member sin el módulo registro recibe modulo_no_disponible y no se guarda nada', async () => {
    const antes = await cuenta(A);
    expect(codigoDe(await dictar(sinRegistro))).toBe('modulo_no_disponible');
    expect(await cuenta(A)).toBe(antes);
  });

  it('5 · lectura o módulo dado de baja: modulo_solo_lectura', async () => {
    const antes = await cuenta(A);
    expect(codigoDe(await dictar(lector))).toBe('modulo_solo_lectura');
    const dueno2 = await abrirSesion(app, 'Dueña baja');
    const C = await crearEmpresa(dueno2, 'Captura C');
    await darDeBajaModulo(C, 'registro');
    expect(codigoDe(await dictar(dueno2))).toBe('modulo_solo_lectura');
    expect(await cuenta(A)).toBe(antes);
    expect(await cuenta(C)).toBe(0);
  });

  it('6 · la otra empresa no ve el borrador', async () => {
    const d = datos(await dictar(dueno, 'privado'));
    expect(codigoDe(await ajeno.herramienta('borrador_ver', { id: d.borradores[0].id }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('borradores_listar', {})).items).toEqual([]);
    expect(await cuenta(B)).toBe(0);
  });

  it('7 · corregir y aprobar deja corregido: true', async () => {
    const d = datos(await dictar(dueno, 'corregir'));
    const id = d.borradores[0].id;
    datos(await dueno.herramienta('borrador_corregir', { id, args: { tipo: 'ingreso', montoCentimos: 70000, origen: 'voz' } }));
    const r = datos(await dueno.herramienta('borrador_aprobar', { id }));
    expect(r.borrador).toMatchObject({ corregido: true, estado: 'aprobado' });
    expect(r.borrador.argsOriginales).toMatchObject({ montoCentimos: 50000 });
  });

  it('8 · validación: texto vacío, espera excesiva, campo de más y `canal`', async () => {
    const antes = await cuenta(A);
    expect(codigoDe(await dictar(dueno, '   '))).toBe('argumentos_invalidos');
    expect(codigoDe(await dictar(dueno, 'x', { transcurridoMs: 900_001 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dictar(dueno, 'x', { extra: 1 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dictar(dueno, 'x', { canal: 'voz' }))).toBe('argumento_prohibido');
    expect(await cuenta(A)).toBe(antes);
  });

  it('9 · una frase que no se entiende es una respuesta correcta sin borradores', async () => {
    const antes = await cuenta(A);
    const d = datos(await dictar(dueno, 'nada'));
    expect(d.borradores).toEqual([]);
    expect(d.faltan.length).toBeGreaterThan(0);
    expect(d.pista).toBeTruthy();
    expect(await cuenta(A)).toBe(antes);
  });

  it('10 · un intérprete que propone una herramienta de otro módulo falla y no guarda nada', async () => {
    const antes = await cuenta(A);
    expect(codigoDe(await dictar(dueno, 'ajena'))).toBe('error_interno');
    expect(await cuenta(A)).toBe(antes);
  });
});
