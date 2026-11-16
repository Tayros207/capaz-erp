import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import pino from 'pino';
import { z } from 'zod';
import { exito, rechazo, type Respuesta } from '@capaz/shared';
import type { DatabaseService } from '../../infra/database/database.service.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { EscritorDeAuditoria } from '../auditoria/escritor.js';
import { conectarCatalogo } from '../borradores/catalogo.js';
import { RegistroDeConsumidores } from '../eventos/registro-de-consumidores.js';
import { RegistroDeTareas } from '../eventos/registro-de-tareas.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { acceso, codigoDe, contextoDePrueba, SECRETO, TODOS } from '../herramientas/pruebas-del-ejecutor.js';
import { herramientaDePrueba, registroDePrueba } from '../herramientas/pruebas.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import type { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { DisparadoresDeReglas } from './disparadores.js';
import { comoSistema, crearHerramientasDeAutomatizaciones, crearHerramientasDeEjecucion } from './herramientas-de-automatizaciones.js';
import { MotorDeReglas } from './motor.js';
import * as repo from './repositorio.js';
import { RegistroDeFuentesDeTiempo, type FuenteDeTiempo } from './tipos.js';

// Fase 11a-2: reglas, motor y disparadores contra PostgreSQL real, con herramientas de prueba.

let app: pg.Pool;
let sistema: pg.Pool;
let owner: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let ejecutor: EjecutorDeHerramientas;
let motor: MotorDeReglas;
let fuentes: RegistroDeFuentesDeTiempo;
let disparadores: DisparadoresDeReglas;
let llamarTool: (n: string, a: unknown, c?: Partial<ContextoDeHerramienta>, confirmacion?: string) => Promise<Respuesta<unknown>>;
let E: string;
let hechas: string[];
let miembro = true;
let candidatos: Awaited<ReturnType<FuenteDeTiempo['candidatos']>> = [];

const PERMISOS = [...TODOS, 'automatizaciones:ver', 'automatizaciones:gestionar'];
// 10:00 en Lima del día de hoy en Lima: `regla_probar` usa el reloj real, así que el reloj de la prueba debe caer en el mismo día.
const DIA_DE_LIMA = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const AHORA = new Date(`${DIA_DE_LIMA}T15:00:00.000Z`);

beforeAll(() => {
  app = abrirPool('app');
  sistema = abrirPool('sistema');
  owner = abrirPool('owner');
  conEmpresa = conEmpresaDePruebas(app);
});
afterAll(() => Promise.all([app.end(), sistema.end(), owner.end()]));

beforeEach(() => {
  E = empresaDePrueba();
  hechas = [];
  miembro = true;
  candidatos = [];
  const db = { conEmpresa, sistema } as unknown as DatabaseService;
  const nota = (nombre: string, extra: Partial<Parameters<typeof herramientaDePrueba>[0]> = {}) =>
    herramientaDePrueba({
      nombre,
      permiso: 'cotizacion:editar',
      entrada: z.strictObject({ texto: z.string() }),
      salida: z.looseObject({}),
      ejecutar: async (a) => {
        if (a.texto === 'malo') return rechazo('conflicto', 'No se puede.');
        hechas.push(`${nombre}:${a.texto}`);
        return exito({ texto: a.texto });
      },
      ...extra,
    });
  const registro = registroDePrueba([
    nota('nota'),
    nota('cobrar', { mueveDinero: true }),
    nota('emitir', { criticidad: 'critica', resumir: async () => ({ ok: true, resumen: { resumen: 'x', huella: 'h' } }) }),
  ]);
  ejecutor = new EjecutorDeHerramientas(registro, db, new EscritorDeAuditoria(db), { CONFIRMACION_SECRET: SECRETO }, { error: () => undefined } as never);
  motor = new MotorDeReglas(registro, ejecutor);
  fuentes = new RegistroDeFuentesDeTiempo();
  fuentes.agregar([
    {
      clave: 'prueba.vence',
      modulo: 'core',
      descripcion: 'de prueba',
      // Solo devuelve candidatos para la empresa de esta prueba (la base es compartida).
      candidatos: async (tx) => ((await tx.execute(`select current_setting('app.tenant_id', true) as t` as never)).rows[0] as { t: string }).t === E ? candidatos : [],
    },
  ]);
  const d = { registro, fuentes, motor };
  registro.agregar([...crearHerramientasDeAutomatizaciones(d), ...crearHerramientasDeEjecucion(d, comoSistema)]);
  conectarCatalogo((n) => registro.obtener(n));
  const accesoStub = {
    contextoDe: async () => (miembro ? { ...contextoDePrueba(E, { usuarioId: 'creador', permisos: PERMISOS }), canal: 'ui' as const } : null),
  } as unknown as ServicioDeAcceso;
  disparadores = new DisparadoresDeReglas(db, motor, new RegistroDeConsumidores(), new RegistroDeTareas(), fuentes, accesoStub, pino({ level: 'silent' }), () => AHORA);
  llamarTool = (n, a, c = {}, confirmacion) => ejecutor.ejecutar(n, a, { ctx: contextoDePrueba(E, { permisos: PERMISOS, modulos: [acceso('core')], ...c }), confirmacion });
});

const datos = <T>(r: Respuesta<unknown>): T => {
  if (!r.ok || !('datos' in r)) throw new Error(`Se esperaba éxito: ${JSON.stringify(r)}`);
  return r.datos as T;
};
type R = { id: string; activa: boolean; modo: string };
const def = (extra: Record<string, unknown> = {}) => ({
  nombre: 'Regla de prueba',
  disparador: { tipo: 'evento', evento: 'cliente.creado' },
  condiciones: [],
  acciones: [{ herramienta: 'nota', args: { texto: 'hola {{datos.nombre}}' } }],
  ...extra,
});
/** Crea la regla por la herramienta y la deja activa saltando la confirmación (se prueba aparte). */
async function regla(extra: Record<string, unknown> = {}, activa = true): Promise<R> {
  const r = datos<R>(await llamarTool('regla_guardar', def(extra)));
  if (activa) await conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx) => repo.fijarActiva(tx, r.id, true));
  return r;
}
const evento = (carga: Record<string, unknown>, tipo = 'cliente.creado') => ({ id: 'ev-1', tipo: tipo as never, carga, creadoEn: AHORA });
const disparar = (carga: Record<string, unknown>, tipo?: string) =>
  conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx) => disparadores.alEvento(evento(carga, tipo), contextoDePrueba(E), tx));
const filas = (sql: string) => comoEmpresa(app, E, async (c) => (await c.query(sql)).rows);
const borradores = () => filas('select * from core.borradores order by propuesto_en');
const ejecuciones = () => filas('select * from core.reglas_ejecuciones order by creado_en, id');

describe('regla_guardar y modos', () => {
  it('nace apagada y en borrador; el límite y los defaults vienen del contrato', async () => {
    const r = datos<R & { limiteDiario: number }>(await llamarTool('regla_guardar', def()));
    expect(r).toMatchObject({ activa: false, modo: 'borrador', limiteDiario: 50 });
  });

  it('una acción que mueve dinero o es crítica no cabe en automático (ni al guardar ni al editar)', async () => {
    for (const herramienta of ['cobrar', 'emitir']) {
      const r = await llamarTool('regla_guardar', def({ modo: 'automatico', acciones: [{ herramienta, args: { texto: 'x' } }] }));
      expect(codigoDe(r)).toBe('argumentos_invalidos');
    }
    // En borrador y pide_aprobacion sí caben.
    for (const modo of ['borrador', 'pide_aprobacion']) {
      expect((await llamarTool('regla_guardar', def({ modo, acciones: [{ herramienta: 'cobrar', args: { texto: 'x' } }] }))).ok).toBe(true);
    }
    expect(await borradores()).toHaveLength(0);
  });

  it('rechaza herramienta, evento y fuente inexistentes, y acciones sobre la bandeja o reglas', async () => {
    expect(codigoDe(await llamarTool('regla_guardar', def({ acciones: [{ herramienta: 'no_existe', args: {} }] })))).toBe('argumentos_invalidos');
    expect(codigoDe(await llamarTool('regla_guardar', def({ acciones: [{ herramienta: 'borrador_aprobar', args: {} }] })))).toBe('argumentos_invalidos');
    expect(codigoDe(await llamarTool('regla_guardar', def({ disparador: { tipo: 'evento', evento: 'no.existe' } })))).toBe('argumentos_invalidos');
    expect(codigoDe(await llamarTool('regla_guardar', def({ disparador: { tipo: 'tiempo', fuente: 'x.y', dias: 1 } })))).toBe('argumentos_invalidos');
  });

  it('no acepta operadores ni expresiones fuera de los seis', async () => {
    const r = await llamarTool('regla_guardar', def({ condiciones: [{ campo: 'datos.total', op: 'regex', valor: '.*' }] }));
    expect(codigoDe(r)).toBe('argumentos_invalidos');
    const r2 = await llamarTool('regla_guardar', def({ condiciones: [{ campo: 'datos.total * 2', op: 'mayor', valor: 1 }] }));
    expect(codigoDe(r2)).toBe('argumentos_invalidos');
  });

  it('activar es crítica (pide confirmación) y editar una regla automática la apaga', async () => {
    const r = await regla({ modo: 'automatico' }, false);
    expect(await llamarTool('regla_activar', { id: r.id })).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String) } });
    const p = (await llamarTool('regla_activar', { id: r.id })) as { requiereConfirmacion: { token: string } };
    const activada = datos<R>(await llamarTool('regla_activar', { id: r.id }, {}, p.requiereConfirmacion.token));
    expect(activada.activa).toBe(true);
    const editada = datos<R>(await llamarTool('regla_guardar', { ...def({ modo: 'automatico', nombre: 'Otro' }), id: r.id }));
    expect(editada).toMatchObject({ activa: false, modo: 'automatico' });
    // Una de borrador editada sigue como estaba.
    const b = await regla({}, true);
    expect(datos<R>(await llamarTool('regla_guardar', { ...def({ nombre: 'Otro' }), id: b.id })).activa).toBe(true);
  });

  it('sin permiso de gestionar no guarda; sin ver no lista', async () => {
    expect(codigoDe(await llamarTool('regla_guardar', def(), { permisos: ['automatizaciones:ver'] }))).toBe('sin_permiso');
    expect(codigoDe(await llamarTool('reglas_listar', {}, { permisos: [] }))).toBe('sin_permiso');
  });

  it('una empresa no ve las reglas de otra', async () => {
    const r = await regla();
    const otra = empresaDePrueba();
    const v = await ejecutor.ejecutar('regla_ver', { id: r.id }, { ctx: contextoDePrueba(otra, { permisos: PERMISOS }) });
    expect(codigoDe(v)).toBe('no_encontrado');
  });
});

describe('regla_probar («qué haría»)', () => {
  it('no ejecuta ni propone nada: solo deja una ejecución simulada', async () => {
    const r = await regla({ condiciones: [{ campo: 'datos.total', op: 'mayor', valor: 100 }], modo: 'automatico' });
    const p = datos<{ coincide: boolean; acciones: Array<{ args: unknown }>; resumen: string }>(await llamarTool('regla_probar', { id: r.id, datos: { total: 150, nombre: 'Ana' } }));
    expect(p.coincide).toBe(true);
    expect(p.acciones[0]?.args).toEqual({ texto: 'hola Ana' });
    expect(p.resumen).toMatch(/Ejecutaría sin pedir aprobación/);
    const no = datos<{ coincide: boolean }>(await llamarTool('regla_probar', { id: r.id, datos: { total: 5 } }));
    expect(no.coincide).toBe(false);
    expect(hechas).toEqual([]);
    expect(await borradores()).toHaveLength(0);
    const e = await ejecuciones();
    expect(e).toHaveLength(2);
    expect(e.every((x) => x.simulada)).toBe(true);
  });

  it('avisa de datos que faltan y de límite alcanzado', async () => {
    const r = await regla({ limiteDiario: 1 });
    const p = datos<{ acciones: Array<{ problemas: string[] }>; resumen: string }>(await llamarTool('regla_probar', { id: r.id, datos: {} }));
    expect(p.acciones[0]?.problemas).toEqual(['Falta el dato «datos.nombre».']);
    await disparar({ nombre: 'Ana' });
    const l = datos<{ limiteAlcanzado: boolean }>(await llamarTool('regla_probar', { id: r.id, datos: { nombre: 'x' } }));
    expect(l.limiteAlcanzado).toBe(true);
  });
});

describe('disparo por evento', () => {
  it('borrador: deja un borrador de origen regla y la ejecución', async () => {
    const r = await regla({ condiciones: [{ campo: 'datos.nombre', op: 'contiene', valor: 'an' }] });
    await disparar({ nombre: 'Ana' });
    await disparar({ nombre: 'Luis' }); // no cumple: no deja nada
    const b = await borradores();
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ herramienta: 'nota', origen: 'regla', origen_ref: r.id, prioridad: 'normal', estado: 'pendiente', args: { texto: 'hola Ana' } });
    const e = await ejecuciones();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ resultado: 'borrador_creado', simulada: false, borrador_id: b[0]?.id });
    expect(hechas).toEqual([]);
  });

  it('pide_aprobacion: prioridad alta', async () => {
    await regla({ modo: 'pide_aprobacion' });
    await disparar({ nombre: 'Ana' });
    expect((await borradores())[0]?.prioridad).toBe('alta');
  });

  it('otro tipo de evento no la despierta; una regla apagada tampoco', async () => {
    await regla({}, true);
    await regla({}, false);
    await disparar({ nombre: 'x' }, 'producto.creado');
    expect(await ejecuciones()).toHaveLength(0);
    await disparar({ nombre: 'x' });
    expect(await borradores()).toHaveLength(1); // solo la activa
  });

  it('webhook: coincide por el nombre del evento de entrada', async () => {
    const r = datos<R>(await llamarTool('regla_guardar', def({ disparador: { tipo: 'webhook', evento: 'pedido.nuevo' } })));
    await conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx) => repo.fijarActiva(tx, r.id, true));
    await disparar({ evento: 'otro', nombre: 'a' }, 'webhook.recibido');
    expect(await borradores()).toHaveLength(0);
    await disparar({ evento: 'pedido.nuevo', nombre: 'b' }, 'webhook.recibido');
    expect(await borradores()).toHaveLength(1);
  });

  it('automático: ejecuta la herramienta con canal sistema y deja auditoría', async () => {
    await regla({ modo: 'automatico' });
    await disparar({ nombre: 'Ana' });
    expect(hechas).toEqual(['nota:hola Ana']);
    expect(await borradores()).toHaveLength(0);
    expect((await ejecuciones())[0]).toMatchObject({ resultado: 'ok', simulada: false });
    const a = await filas(`select canal, herramienta, resultado from core.auditoria where herramienta = 'nota'`);
    expect(a).toEqual([{ canal: 'sistema', herramienta: 'nota', resultado: 'ok' }]);
  });

  it('automático: si una acción falla, se deshacen las anteriores y queda rechazada', async () => {
    await regla({ modo: 'automatico', acciones: [{ herramienta: 'nota', args: { texto: 'bien' } }, { herramienta: 'nota', args: { texto: 'malo' } }] });
    await disparar({});
    const e = await ejecuciones();
    expect(e[0]).toMatchObject({ resultado: 'rechazada' });
    expect(JSON.stringify(e[0]?.detalle)).toContain('No se puede.');
  });

  it('automático: quien la creó ya no es miembro → rechazada, sin ejecutar', async () => {
    await regla({ modo: 'automatico' });
    miembro = false;
    await disparar({ nombre: 'Ana' });
    expect((await ejecuciones())[0]).toMatchObject({ resultado: 'rechazada' });
    expect(hechas).toEqual([]);
  });

  it('automático con acción que mueve dinero guardada a la fuerza (fila alterada): el motor la rechaza igual', async () => {
    const r = await regla({ modo: 'automatico' });
    await comoEmpresa(owner, E, (c) => c.query(`update core.reglas_automaticas set acciones = '[{"herramienta":"cobrar","args":{"texto":"x"}}]'::jsonb where id = $1`, [r.id]), { confirmar: true });
    await disparar({});
    expect((await ejecuciones())[0]).toMatchObject({ resultado: 'rechazada' });
    expect(hechas).toEqual([]);
    // Y activarla tampoco pasa.
    const t = (await llamarTool('regla_activar', { id: r.id })) as { requiereConfirmacion: { token: string } };
    expect(codigoDe(await llamarTool('regla_activar', { id: r.id }, {}, t.requiereConfirmacion.token))).toBe('argumentos_invalidos');
  });

  it('el límite diario corta: las demás quedan omitidas_por_limite', async () => {
    await regla({ limiteDiario: 2 });
    for (let i = 0; i < 4; i++) await disparar({ nombre: `n${i}` });
    expect(await borradores()).toHaveLength(2);
    expect((await ejecuciones()).map((x) => x.resultado)).toEqual(['borrador_creado', 'borrador_creado', 'omitida_por_limite', 'omitida_por_limite']);
  });

  it('un dato que falta rechaza sin dejar borrador', async () => {
    await regla();
    await disparar({});
    expect(await borradores()).toHaveLength(0);
    expect((await ejecuciones())[0]).toMatchObject({ resultado: 'rechazada' });
  });
});

describe('disparo por tiempo', () => {
  const dia = (n: number) => new Date(AHORA.getTime() + n * 86_400_000);
  async function reglaDeTiempo(dias: number, extra: Record<string, unknown> = {}) {
    return regla({ disparador: { tipo: 'tiempo', fuente: 'prueba.vence', dias }, acciones: [{ herramienta: 'nota', args: { texto: 'vence {{datos.que}}' } }], ...extra });
  }

  it('deja UN solo borrador aunque el motor corra dos veces', async () => {
    const r = await reglaDeTiempo(3);
    candidatos = [{ entidadTipo: 'deuda', entidadId: 'd1', fecha: dia(-3), datos: { que: 'deuda 1' } }];
    expect((await disparadores.dispararPorTiempo(AHORA)).disparos).toBeGreaterThanOrEqual(1);
    await disparadores.dispararPorTiempo(AHORA);
    await disparadores.dispararPorTiempo(new Date(AHORA.getTime() + 3600_000)); // otra hora del mismo día
    const b = await borradores();
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ origen: 'regla', origen_ref: r.id, args: { texto: 'vence deuda 1' } });
    expect(await filas('select * from core.reglas_disparos')).toHaveLength(1);
  });

  it('dos corridas simultáneas tampoco duplican', async () => {
    await reglaDeTiempo(0);
    candidatos = [{ entidadTipo: 'deuda', entidadId: 'd2', fecha: AHORA, datos: { que: 'x' } }];
    await Promise.all([disparadores.dispararPorTiempo(AHORA), disparadores.dispararPorTiempo(AHORA)]);
    expect(await borradores()).toHaveLength(1);
  });

  it('solo dispara cuando hoy = fecha + N días (zona de la empresa), una vez por entidad', async () => {
    await reglaDeTiempo(-2);
    candidatos = [
      { entidadTipo: 'deuda', entidadId: 'justo', fecha: dia(2), datos: { que: 'justo' } },
      { entidadTipo: 'deuda', entidadId: 'tarde', fecha: dia(3), datos: { que: 'tarde' } },
      { entidadTipo: 'deuda', entidadId: 'pasada', fecha: dia(-5), datos: { que: 'pasada' } },
    ];
    await disparadores.dispararPorTiempo(AHORA);
    expect((await borradores()).map((b) => (b.args as { texto: string }).texto)).toEqual(['vence justo']);
    // Al día siguiente le toca a la otra.
    await disparadores.dispararPorTiempo(dia(1));
    expect(await borradores()).toHaveLength(2);
  });

  it('cuenta el día en la zona horaria de la empresa', async () => {
    await reglaDeTiempo(0);
    // 03:00Z del 16 es 22:00 del 15 en Lima; con ahora = 15:00Z del 15 sigue siendo el 15 de allá.
    candidatos = [{ entidadTipo: 'deuda', entidadId: 'tz', fecha: new Date(AHORA.getTime() + 12 * 3_600_000), datos: { que: 'tz' } }];
    await disparadores.dispararPorTiempo(AHORA);
    expect(await borradores()).toHaveLength(1);
  });

  it('el límite diario también corta los disparos por tiempo', async () => {
    await reglaDeTiempo(0, { limiteDiario: 1 });
    candidatos = [
      { entidadTipo: 'deuda', entidadId: 'a', fecha: AHORA, datos: { que: 'a' } },
      { entidadTipo: 'deuda', entidadId: 'b', fecha: AHORA, datos: { que: 'b' } },
    ];
    await disparadores.dispararPorTiempo(AHORA);
    expect(await borradores()).toHaveLength(1);
    expect((await ejecuciones()).map((e) => e.resultado)).toEqual(['borrador_creado', 'omitida_por_limite']);
  });

  it('la fuente del núcleo core.prueba_de_modulo_vence ve las pruebas de la empresa', async () => {
    const { pruebaDeModuloVence } = await import('./fuentes.js');
    await owner.query(`insert into core.modulos (codigo, nombre) values ('mfuente', 'Fuente') on conflict do nothing`);
    await comoEmpresa(owner, E, (c) => c.query(`insert into core.empresa_modulos (tenant_id, modulo, estado, prueba_hasta) values ($1, 'mfuente', 'prueba', $2)`, [E, dia(5)]), { confirmar: true });
    const c = await conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx: Transaccion) => pruebaDeModuloVence.candidatos(tx, AHORA));
    expect(c).toMatchObject([{ entidadTipo: 'empresa_modulo', entidadId: 'mfuente', datos: { modulo: 'mfuente' } }]);
    expect(c[0]?.fecha.getTime()).toBe(dia(5).getTime());
  });
});

describe('regla_ejecutar (manual) e historial', () => {
  it('exige regla activa; en automático usa los permisos de quien ejecuta', async () => {
    const r = await regla({ modo: 'automatico', disparador: { tipo: 'manual' } }, false);
    expect(codigoDe(await llamarTool('regla_ejecutar', { id: r.id, datos: { nombre: 'Ana' } }))).toBe('conflicto');
    await conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx) => repo.fijarActiva(tx, r.id, true));
    const ok = datos<{ resultado: string }>(await llamarTool('regla_ejecutar', { id: r.id, datos: { nombre: 'Ana' } }));
    expect(ok.resultado).toBe('ok');
    expect(hechas).toEqual(['nota:hola Ana']);
    // Quien ejecuta no tiene permiso de la herramienta: la acción se rechaza.
    const sin = datos<{ resultado: string }>(await llamarTool('regla_ejecutar', { id: r.id, datos: { nombre: 'Ana' } }, { permisos: PERMISOS.filter((p) => p !== 'cotizacion:editar') }));
    expect(sin.resultado).toBe('rechazada');
  });

  it('el historial lista por regla, simulada y resultado', async () => {
    const r = await regla({ disparador: { tipo: 'manual' } });
    await llamarTool('regla_probar', { id: r.id, datos: { nombre: 'a' } });
    await llamarTool('regla_ejecutar', { id: r.id, datos: { nombre: 'a' } });
    const todas = datos<{ items: unknown[] }>(await llamarTool('regla_ejecuciones_listar', { reglaId: r.id }));
    expect(todas.items).toHaveLength(2);
    const reales = datos<{ items: Array<{ resultado: string }> }>(await llamarTool('regla_ejecuciones_listar', { reglaId: r.id, simulada: false }));
    expect(reales.items.map((i) => i.resultado)).toEqual(['borrador_creado']);
    const pag = datos<{ items: unknown[]; siguiente: string | null }>(await llamarTool('regla_ejecuciones_listar', { reglaId: r.id, limite: 1 }));
    expect(pag.siguiente).not.toBeNull();
    const sig = datos<{ items: unknown[] }>(await llamarTool('regla_ejecuciones_listar', { reglaId: r.id, limite: 1, cursor: pag.siguiente }));
    expect(sig.items).toHaveLength(1);
  });

  it('desactivar apaga la regla y reglas_listar filtra', async () => {
    const r = await regla();
    expect(datos<R>(await llamarTool('regla_desactivar', { id: r.id })).activa).toBe(false);
    const l = datos<{ items: R[] }>(await llamarTool('reglas_listar', { activa: true }));
    expect(l.items).toHaveLength(0);
  });
});
