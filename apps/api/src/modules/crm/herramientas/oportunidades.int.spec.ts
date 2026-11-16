import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { activarModulo, abrirSesion, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';

// CRM, parte s1, por HTTP real: etapas y oportunidades con dos empresas, miembros de lectura, sin el
// módulo y con alcance «propios», idempotencia, cursor y módulo dado de baja (R17).

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let ajeno: Sesion; // owner de B
let lector: Sesion; // member de A: crm con nivel lectura
let sinCrm: Sesion; // member de A: solo registro
let propio: Sesion; // member de A: crm completo con alcance «propios»
let empresaA: string;
let empresaB: string;
let clienteA: string;
let clienteB: string;

const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;
const datos = (r: { estado: number; cuerpo: any }) => {
  expect(r.cuerpo, JSON.stringify(r.cuerpo)).toMatchObject({ ok: true });
  return r.cuerpo.datos;
};
const eventos = (empresaId: string, tipo: string) =>
  comoEmpresa(appPool, empresaId, async (c) => {
    const r = await c.query('select carga from core.eventos_salida where tipo = $1 order by creado_en, id', [tipo]);
    return r.rows.map((f: { carga: any }) => f.carga);
  });
const etapas = async (s: Sesion) => datos(await s.herramienta('etapas_listar', {})).items as Array<{ id: string; nombre: string; orden: number; tipo: string }>;
const etapaLlamada = async (s: Sesion, nombre: string) => (await etapas(s)).find((e) => e.nombre === nombre)!;
const crear = async (s: Sesion, args: Record<string, unknown>) => datos(await s.herramienta('oportunidad_crear', { clienteId: clienteA, ...args }));

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno, lector, sinCrm, propio] = await Promise.all(['Dueña', 'Ajena', 'Lector', 'Sin CRM', 'Propio'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de crm');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de crm');
  for (const [e, m] of [[empresaA, 'crm'], [empresaA, 'registro'], [empresaB, 'crm']] as const) await activarModulo(e, m);
  await agregarMiembro(app, empresaA, lector, { modulo: 'crm', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, sinCrm, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'crm', nivel: 'completo', alcance: 'propios' });
  clienteA = datos(await dueno.herramienta('clientes_crear', { nombre: 'Imprenta Sol' })).id;
  clienteB = datos(await ajeno.herramienta('clientes_crear', { nombre: 'Gráfica Norte' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('oportunidades y etapas (s1)', () => {
  let opo: { id: string; codigo: string; etapaId: string };

  it('crea una oportunidad sin etapas previas: siembra el embudo y emite oportunidad.creada', async () => {
    expect(await etapas(dueno)).toEqual([]); // una lectura no siembra (R10)
    opo = await crear(dueno, { titulo: 'Banners para feria', montoEstimadoCentimos: 150000 });
    expect(opo).toMatchObject({ codigo: expect.stringMatching(/^OPO-\d{4}-0001$/), etapaNombre: 'Nuevo', estado: 'abierta', clienteNombre: 'Imprenta Sol', actividadesPendientes: 0, cerradaEn: null });
    expect((await etapas(dueno)).map((e) => `${e.orden}:${e.nombre}:${e.tipo}`)).toEqual([
      '0:Nuevo:abierta', '1:Contactado:abierta', '2:Propuesta enviada:abierta', '3:Negociación:abierta', '4:Ganada:ganada', '5:Perdida:perdida',
    ]);
    expect(await eventos(empresaA, 'oportunidad.creada')).toEqual([{ id: opo.id, codigo: opo.codigo, clienteId: clienteA, etapaId: opo.etapaId, montoEstimadoCentimos: 150000 }]);
    expect(datos(await dueno.herramienta('crm_iniciar', {}))).toEqual({ etapasCreadas: 0 });
  });

  it('se mueve dos etapas y el listado por etapa la refleja; a la misma etapa no emite; a una de cierre no', async () => {
    const contactado = await etapaLlamada(dueno, 'Contactado');
    const negociacion = await etapaLlamada(dueno, 'Negociación');
    expect(datos(await dueno.herramienta('oportunidad_mover', { id: opo.id, etapaId: contactado.id })).etapaNombre).toBe('Contactado');
    expect(datos(await dueno.herramienta('oportunidad_mover', { id: opo.id, etapaId: negociacion.id })).etapaNombre).toBe('Negociación');
    await dueno.herramienta('oportunidad_mover', { id: opo.id, etapaId: negociacion.id });
    const enNegociacion = datos(await dueno.herramienta('oportunidades_listar', { etapaId: negociacion.id })).items;
    expect(enNegociacion.map((o: any) => o.id)).toEqual([opo.id]);
    expect(datos(await dueno.herramienta('oportunidades_listar', { etapaId: opo.etapaId })).items).toEqual([]);
    expect((await eventos(empresaA, 'oportunidad.movida')).map((e: any) => [e.etapaAnteriorId, e.etapaId])).toEqual([
      [opo.etapaId, contactado.id],
      [contactado.id, negociacion.id],
    ]);
    const ganada = await etapaLlamada(dueno, 'Ganada');
    expect(codigo(await dueno.herramienta('oportunidad_mover', { id: opo.id, etapaId: ganada.id }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('oportunidad_crear', { titulo: 'X', clienteId: clienteA, etapaId: ganada.id }))).toBe('argumentos_invalidos');
  });

  it('valida: campo inválido o de más, cliente ajeno, responsable que no es de la empresa; sin evento', async () => {
    const antes = (await eventos(empresaA, 'oportunidad.creada')).length;
    const negativo = await dueno.herramienta('oportunidad_crear', { titulo: 'Afiches', clienteId: clienteA, montoEstimadoCentimos: -1 });
    expect([negativo.estado, codigo(negativo)]).toEqual([400, 'argumentos_invalidos']);
    expect(codigo(await dueno.herramienta('oportunidad_crear', { titulo: 'Afiches', clienteId: clienteA, sorpresa: 1 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('oportunidad_crear', { titulo: 'Afiches', clienteId: clienteB }))).toBe('no_encontrado');
    expect(codigo(await dueno.herramienta('oportunidad_crear', { titulo: 'Afiches', clienteId: clienteA, responsableId: ajeno.usuarioId }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('oportunidad_editar', { id: opo.id }))).toBe('argumentos_invalidos');
    expect((await eventos(empresaA, 'oportunidad.creada')).length).toBe(antes);
  });

  it('editar cambia solo lo que llega y null borra; el responsable puede ser un miembro', async () => {
    const r = datos(await dueno.herramienta('oportunidad_editar', { id: opo.id, montoEstimadoCentimos: null, notas: '  Llamar el lunes ', responsableId: lector.usuarioId }));
    expect(r).toMatchObject({ titulo: 'Banners para feria', montoEstimadoCentimos: null, notas: 'Llamar el lunes', responsableId: lector.usuarioId });
    expect(datos(await dueno.herramienta('oportunidad_editar', { id: opo.id, notas: null })).notas).toBeNull();
  });

  it('busca por título sin tildes ni mayúsculas', async () => {
    const navidad = await crear(dueno, { titulo: 'Campaña de Navidad' });
    expect(datos(await dueno.herramienta('oportunidades_listar', { buscar: 'CAMPANA de navidad' })).items.map((o: any) => o.id)).toEqual([navidad.id]);
    expect(datos(await dueno.herramienta('oportunidades_listar', { buscar: '100%' })).items).toEqual([]);
  });

  it('pagina con cursor sin repetir y rechaza un cursor inválido', async () => {
    await crear(dueno, { titulo: 'Volantes' });
    const p1 = datos(await dueno.herramienta('oportunidades_listar', { limite: 2 }));
    expect(p1.items).toHaveLength(2);
    const p2 = datos(await dueno.herramienta('oportunidades_listar', { limite: 2, cursor: p1.siguiente }));
    const ids = [...p1.items, ...p2.items].map((o: any) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(opo.id);
    expect(codigo(await dueno.herramienta('oportunidades_listar', { cursor: 'basura' }))).toBe('argumentos_invalidos');
  });

  it('la misma clave de idempotencia no crea dos oportunidades', async () => {
    const clave = `opo-${randomUUID()}`;
    const a = await dueno.herramienta('oportunidad_crear', { titulo: 'Idempotente', clienteId: clienteA }, { clave });
    const b = await dueno.herramienta('oportunidad_crear', { titulo: 'Idempotente', clienteId: clienteA }, { clave });
    expect(datos(b).id).toBe(datos(a).id);
    expect(datos(await dueno.herramienta('oportunidades_listar', { buscar: 'idempotente' })).items).toHaveLength(1);
  });

  it('etapas: crear queda última de las abiertas, duplicado es conflicto, ordenar exige todas, archivar tiene reglas', async () => {
    const nueva = datos(await dueno.herramienta('etapa_crear', { nombre: 'Muestra entregada' }));
    expect((await etapas(dueno)).slice(-3).map((e) => e.nombre)).toEqual(['Muestra entregada', 'Ganada', 'Perdida']);
    expect(codigo(await dueno.herramienta('etapa_crear', { nombre: 'muestra ENTREGADA' }))).toBe('conflicto');
    const abiertas = (await etapas(dueno)).filter((e) => e.tipo === 'abierta').map((e) => e.id);
    expect(codigo(await dueno.herramienta('etapas_ordenar', { ids: abiertas.slice(1) }))).toBe('argumentos_invalidos');
    const orden = datos(await dueno.herramienta('etapas_ordenar', { ids: [...abiertas].reverse() })).items.map((e: any) => e.id);
    expect(orden.slice(0, abiertas.length)).toEqual([...abiertas].reverse());
    const ganada = await etapaLlamada(dueno, 'Ganada');
    expect(codigo(await dueno.herramienta('etapa_archivar', { id: ganada.id }))).toBe('conflicto');
    expect(datos(await dueno.herramienta('etapa_editar', { id: ganada.id, nombre: 'Cerrada con éxito' })).tipo).toBe('ganada');
    const conOportunidades = await etapaLlamada(dueno, 'Negociación');
    expect(codigo(await dueno.herramienta('etapa_archivar', { id: conOportunidades.id }))).toBe('conflicto');
    expect(datos(await dueno.herramienta('etapa_archivar', { id: nueva.id })).archivadoEn).not.toBeNull();
    expect((await etapas(dueno)).map((e) => e.id)).not.toContain(nueva.id);
    expect(datos(await dueno.herramienta('etapas_listar', { incluirArchivadas: true })).items.map((e: any) => e.id)).toContain(nueva.id);
  });

  it('otra empresa no ve nada: ni por id, ni en listados, ni para cambiarlo', async () => {
    expect(codigo(await ajeno.herramienta('oportunidad_ver', { id: opo.id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('oportunidad_editar', { id: opo.id, titulo: 'Mío' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('oportunidad_mover', { id: opo.id, etapaId: opo.etapaId }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('etapa_editar', { id: opo.etapaId, nombre: 'Mía' }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('oportunidades_listar', { estado: 'todas' })).items).toEqual([]);
    expect(await etapas(ajeno)).toEqual([]);
  });

  it('un member de lectura lee pero recibe modulo_solo_lectura; sin el módulo, modulo_no_disponible', async () => {
    expect(datos(await lector.herramienta('oportunidad_ver', { id: opo.id })).id).toBe(opo.id);
    for (const [nombre, args] of [
      ['oportunidad_crear', { titulo: 'Intruso', clienteId: clienteA }],
      ['oportunidad_mover', { id: opo.id, etapaId: opo.etapaId }],
      ['etapa_crear', { nombre: 'Intrusa' }],
      ['crm_iniciar', {}],
    ] as const) {
      const r = await lector.herramienta(nombre, args);
      expect([r.estado, codigo(r)]).toEqual([403, 'modulo_solo_lectura']);
    }
    expect(codigo(await sinCrm.herramienta('oportunidades_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await sinCrm.herramienta('oportunidad_crear', { titulo: 'X', clienteId: clienteA }))).toBe('modulo_no_disponible');
  });

  it('un member con alcance «propios» solo ve y cambia lo suyo o lo que tiene a cargo', async () => {
    const suya = await crear(propio, { titulo: 'Stickers del member' });
    expect(datos(await propio.herramienta('oportunidades_listar', {})).items.map((o: any) => o.id)).toEqual([suya.id]);
    expect(codigo(await propio.herramienta('oportunidad_ver', { id: opo.id }))).toBe('no_encontrado');
    expect(codigo(await propio.herramienta('oportunidad_editar', { id: opo.id, titulo: 'Ajeno' }))).toBe('no_encontrado');
    await dueno.herramienta('oportunidad_editar', { id: opo.id, responsableId: propio.usuarioId });
    const vistas: string[] = datos(await propio.herramienta('oportunidades_listar', {})).items.map((o: any) => o.id);
    expect(new Set(vistas)).toEqual(new Set([suya.id, opo.id]));
    expect(datos(await dueno.herramienta('oportunidades_listar', { buscar: 'stickers' })).items).toHaveLength(1);
  });

  it('con el módulo dado de baja se lee, no se escribe, y la base rechaza un insert directo', async () => {
    await darDeBajaModulo(empresaA, 'crm');
    expect(datos(await dueno.herramienta('oportunidad_ver', { id: opo.id })).id).toBe(opo.id);
    const r = await dueno.herramienta('oportunidad_crear', { titulo: 'Tras la baja', clienteId: clienteA });
    expect([r.estado, codigo(r)]).toEqual([403, 'modulo_solo_lectura']);
    const directo = comoEmpresa(appPool, empresaA, (c) =>
      c.query(`insert into crm.etapas (tenant_id, nombre, nombre_normalizado, orden, creado_por) values ($1, 'Directa', 'directa', 9, 'x')`, [empresaA]),
    );
    await expect(directo).rejects.toThrow(/no está activo/);
  });
});
