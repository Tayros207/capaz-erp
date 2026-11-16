import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { activarModulo, abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { DatabaseService } from '../../../infra/database/database.service.js';

// CRM, parte s2, por HTTP real: cierre y reapertura, actividades, resumen y fuentes de tiempo, con dos
// empresas, un member de lectura y uno con alcance «propios».

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let ajeno: Sesion;
let lector: Sesion;
let propio: Sesion;
let empresaA: string;
let empresaB: string;
let clienteA: string;

const PASADO = '2020-01-02';
const FUTURO = '2999-12-30';
const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;
const datos = (r: { cuerpo: any }) => {
  expect(r.cuerpo, JSON.stringify(r.cuerpo)).toMatchObject({ ok: true });
  return r.cuerpo.datos;
};
const eventos = (empresaId: string, tipo: string) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query('select carga from core.eventos_salida where tipo = $1 order by creado_en, id', [tipo])).rows.map((f: any) => f.carga));
const crear = async (s: Sesion, titulo: string, monto: number | null = null) =>
  datos(await s.herramienta('oportunidad_crear', { titulo, clienteId: clienteA, montoEstimadoCentimos: monto }));
const actividad = async (s: Sesion, oportunidadId: string, extra: Record<string, unknown> = {}) =>
  datos(await s.herramienta('actividad_crear', { oportunidadId, tipo: 'llamada', asunto: 'Confirmar medidas', ...extra }));
const ids = (r: { cuerpo: any }): string[] => datos(r).items.map((x: { id: string }) => x.id);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno, lector, propio] = await Promise.all(['Dueña', 'Ajena', 'Lector', 'Propio'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de seguimiento');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de seguimiento');
  await activarModulo(empresaA, 'crm');
  await activarModulo(empresaB, 'crm');
  await agregarMiembro(app, empresaA, lector, { modulo: 'crm', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'crm', nivel: 'completo', alcance: 'propios' });
  clienteA = datos(await dueno.herramienta('clientes_crear', { nombre: 'Imprenta Sol' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('cierre y reapertura (s2)', () => {
  it('ganar mueve a la etapa ganada, fija cerradaEn y emite oportunidad.ganada una sola vez', async () => {
    const o = await crear(dueno, 'Banners ganados', 250000);
    const g = datos(await dueno.herramienta('oportunidad_ganar', { id: o.id }));
    expect(g).toMatchObject({ estado: 'ganada', etapaNombre: 'Ganada', cerradaEn: expect.any(String) });
    expect([codigo(await dueno.herramienta('oportunidad_ganar', { id: o.id })), codigo(await dueno.herramienta('oportunidad_mover', { id: o.id, etapaId: o.etapaId }))]).toEqual(['conflicto', 'conflicto']);
    expect(await eventos(empresaA, 'oportunidad.ganada')).toEqual([{ id: o.id, codigo: o.codigo, titulo: 'Banners ganados', clienteId: clienteA, montoEstimadoCentimos: 250000 }]);
  });

  it('perder exige motivo y el evento no lo lleva; reabrir vuelve a la primera etapa y limpia el cierre', async () => {
    const o = await crear(dueno, 'Afiches perdidos');
    expect(codigo(await dueno.herramienta('oportunidad_perder', { id: o.id }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('oportunidad_perder', { id: o.id, motivo: '   ' }))).toBe('argumentos_invalidos');
    const p = datos(await dueno.herramienta('oportunidad_perder', { id: o.id, motivo: 'Eligió otro proveedor' }));
    expect(p).toMatchObject({ estado: 'perdida', etapaNombre: 'Perdida', motivoPerdida: 'Eligió otro proveedor' });
    expect((await eventos(empresaA, 'oportunidad.perdida')).at(-1)).toEqual({ id: o.id, codigo: o.codigo, clienteId: clienteA });
    const r = datos(await dueno.herramienta('oportunidad_reabrir', { id: o.id }));
    expect(r).toMatchObject({ estado: 'abierta', etapaNombre: 'Nuevo', motivoPerdida: null, cerradaEn: null });
    expect(codigo(await dueno.herramienta('oportunidad_reabrir', { id: o.id }))).toBe('conflicto');
  });
});

describe('actividades (s2)', () => {
  let o: { id: string; ultimaActividadEn: string };

  it('crear valida, es idempotente, suma pendientes y marca la oportunidad', async () => {
    o = await crear(dueno, 'Volantes con seguimiento');
    expect(codigo(await dueno.herramienta('actividad_crear', { oportunidadId: o.id, tipo: 'fax', asunto: 'X' }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('actividad_crear', { oportunidadId: o.id, tipo: 'nota', asunto: 'X', extra: 1 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('actividad_crear', { oportunidadId: o.id, tipo: 'nota', asunto: 'X', responsableId: ajeno.usuarioId }))).toBe('argumentos_invalidos');
    const clave = `act-${randomUUID()}`;
    const a = await dueno.herramienta('actividad_crear', { oportunidadId: o.id, tipo: 'tarea', asunto: 'Enviar prueba de color' }, { clave });
    const b = await dueno.herramienta('actividad_crear', { oportunidadId: o.id, tipo: 'tarea', asunto: 'Enviar prueba de color' }, { clave });
    expect(datos(b).id).toBe(datos(a).id);
    const ver = datos(await dueno.herramienta('oportunidad_ver', { id: o.id }));
    expect(ver.actividadesPendientes).toBe(1);
    expect(ver.actividades.map((x: any) => x.asunto)).toEqual(['Enviar prueba de color']);
    expect(Date.parse(ver.ultimaActividadEn)).toBeGreaterThan(Date.parse(o.ultimaActividadEn));
  });

  it('una actividad vencida aparece en «vencidas»; completar la pasa a «hechas» y una segunda vez es conflicto', async () => {
    const vencida = await actividad(dueno, o.id, { venceEl: PASADO });
    const futura = await actividad(dueno, o.id, { venceEl: FUTURO, asunto: 'Visitar la planta' });
    expect(vencida.vencida).toBe(true);
    expect(futura.vencida).toBe(false);
    const enVencidas = ids(await dueno.herramienta('actividades_listar', { estado: 'vencidas' }));
    expect(enVencidas).toContain(vencida.id);
    expect(enVencidas).not.toContain(futura.id);
    const hecha = datos(await dueno.herramienta('actividad_completar', { id: vencida.id, nota: 'Confirmó 3 banners' }));
    expect(hecha).toMatchObject({ vencida: false, nota: 'Confirmó 3 banners', hechaPor: dueno.usuarioId });
    expect(codigo(await dueno.herramienta('actividad_completar', { id: vencida.id }))).toBe('conflicto');
    expect(ids(await dueno.herramienta('actividades_listar', { estado: 'hechas' }))).toEqual([vencida.id]);
    expect(ids(await dueno.herramienta('actividades_listar', { estado: 'vencidas' }))).not.toContain(vencida.id);
  });

  it('pagina con cursor y filtra por oportunidad', async () => {
    const p1 = datos(await dueno.herramienta('actividades_listar', { estado: 'todas', oportunidadId: o.id, limite: 2 }));
    const p2 = datos(await dueno.herramienta('actividades_listar', { estado: 'todas', oportunidadId: o.id, limite: 2, cursor: p1.siguiente }));
    expect([...p1.items, ...p2.items]).toHaveLength(3);
    expect(p2.siguiente).toBeNull();
    expect(codigo(await dueno.herramienta('actividades_listar', { cursor: 'basura' }))).toBe('argumentos_invalidos');
  });
});

describe('alcance, permisos y aislamiento (s2)', () => {
  it('un member «propios» solo ve sus oportunidades y sus actividades, y no ve el resumen', async () => {
    const delDueno = await crear(dueno, 'Del dueño');
    const ajenaAct = await actividad(dueno, delDueno.id);
    const suya = await crear(propio, 'Del member');
    const suyaAct = await actividad(propio, suya.id);
    expect(ids(await propio.herramienta('oportunidades_listar', {}))).toEqual([suya.id]);
    expect(ids(await propio.herramienta('actividades_listar', { estado: 'todas' }))).toEqual([suyaAct.id]);
    for (const [nombre, args] of [
      ['oportunidad_ganar', { id: delDueno.id }],
      ['actividad_crear', { oportunidadId: delDueno.id, tipo: 'nota', asunto: 'X' }],
      ['actividad_completar', { id: ajenaAct.id }],
    ] as const) {
      expect(codigo(await propio.herramienta(nombre, args))).toBe('no_encontrado');
    }
    const r = await propio.herramienta('crm_resumen', { desde: PASADO, hasta: FUTURO });
    expect([r.estado, codigo(r), r.cuerpo.error.mensaje]).toEqual([403, 'sin_permiso', 'Tu acceso es solo a tus propios registros.']);
  });

  it('un member de lectura lee actividades y resumen pero no cierra ni anota', async () => {
    expect(datos(await lector.herramienta('crm_resumen', { desde: PASADO, hasta: FUTURO })).abiertas).toBeGreaterThan(0);
    const [o] = datos(await lector.herramienta('oportunidades_listar', {})).items;
    for (const [nombre, args] of [
      ['oportunidad_ganar', { id: o.id }],
      ['oportunidad_perder', { id: o.id, motivo: 'X' }],
      ['actividad_crear', { oportunidadId: o.id, tipo: 'nota', asunto: 'X' }],
    ] as const) {
      expect(codigo(await lector.herramienta(nombre, args))).toBe('modulo_solo_lectura');
    }
  });

  it('otra empresa no ve ni toca actividades ni oportunidades de A', async () => {
    const [o] = datos(await dueno.herramienta('oportunidades_listar', {})).items;
    const a = await actividad(dueno, o.id);
    expect(ids(await ajeno.herramienta('actividades_listar', { estado: 'todas' }))).toEqual([]);
    expect(codigo(await ajeno.herramienta('actividad_completar', { id: a.id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('oportunidad_ganar', { id: o.id }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('crm_resumen', { desde: PASADO, hasta: FUTURO }))).toMatchObject({ abiertas: 0, ganadas: 0, porEtapa: [] });
  });
});

describe('resumen y fuentes de tiempo (s2)', () => {
  it('cuenta abiertas por etapa con monto, ganadas y perdidas del período y actividades vencidas', async () => {
    const r = datos(await dueno.herramienta('crm_resumen', { desde: PASADO, hasta: FUTURO }));
    const listadas = datos(await dueno.herramienta('oportunidades_listar', { limite: 100 })).items;
    expect(r.abiertas).toBe(listadas.length);
    expect(r.porEtapa.map((e: any) => e.nombre)).toEqual(['Nuevo', 'Contactado', 'Propuesta enviada', 'Negociación']);
    expect(r.porEtapa.reduce((s: number, e: any) => s + e.cantidad, 0)).toBe(r.abiertas);
    expect(r).toMatchObject({ ganadas: 1, montoGanadoCentimos: 250000, perdidas: 0, actividadesVencidas: 0 });
    expect(datos(await dueno.herramienta('crm_resumen', { desde: '2000-01-01', hasta: '2000-12-31' }))).toMatchObject({ ganadas: 0, perdidas: 0 });
    expect(codigo(await dueno.herramienta('crm_resumen', { desde: FUTURO, hasta: PASADO }))).toBe('argumentos_invalidos');
  });

  it('las fuentes devuelven solo lo de la empresa de la transacción', async () => {
    const [o] = datos(await dueno.herramienta('oportunidades_listar', {})).items;
    const a = await actividad(dueno, o.id, { venceEl: PASADO, asunto: 'Llamar sin falta' });
    const fuentes = app.obtener(RegistroDeFuentesDeTiempo);
    const db = app.obtener(DatabaseService);
    const correr = (empresaId: string, clave: string) => db.conEmpresa({ empresaId, usuarioId: 'sistema' }, (tx) => fuentes.obtener(clave)!.candidatos(tx, new Date()));
    const vencenA = await correr(empresaA, 'crm.actividad_vence');
    expect(vencenA.find((c) => c.entidadId === a.id)).toEqual({
      entidadTipo: 'actividad',
      entidadId: a.id,
      fecha: new Date(`${PASADO}T12:00:00Z`),
      datos: { id: a.id, oportunidadId: o.id, oportunidadCodigo: o.codigo, asunto: 'Llamar sin falta', tipo: 'llamada' },
    });
    const quietasA = await correr(empresaA, 'crm.oportunidad_sin_movimiento');
    expect(quietasA.find((c) => c.entidadId === o.id)?.datos).toEqual({ id: o.id, codigo: o.codigo, titulo: o.titulo, clienteId: clienteA, etapaId: o.etapaId });
    expect(quietasA.every((c) => c.entidadTipo === 'oportunidad')).toBe(true);
    expect(await correr(empresaB, 'crm.actividad_vence')).toEqual([]);
    expect(await correr(empresaB, 'crm.oportunidad_sin_movimiento')).toEqual([]);
  });
});
