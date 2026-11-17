import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { auditoriaDe, codigo, crearColaborador, datos, eventosDe, hoyDe, mensaje } from './pruebas-de-personal.js';

// Personal · contratos y vacaciones (0028) por HTTP real, con un member de lectura y otra empresa.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion; // member de A: lectura (sin contratos ni aprobar)
let ajeno: Sesion; // owner de B
let empresaA: string;
let luis: { id: string };
let hoy: string;

const contrato = (extra: Record<string, unknown> = {}) =>
  dueno.herramienta('contrato_crear', { colaboradorId: luis.id, tipo: 'indeterminado', inicio: '2026-01-01', remuneracionMensualCentimos: 150_000, ...extra });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de contratos');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de contratos');
  await Promise.all([activarModulo(empresaA, 'personal'), activarModulo(empresaB, 'personal')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'personal', nivel: 'lectura', alcance: 'todos' });
  luis = await crearColaborador(dueno, 'Luis Paz', { fechaIngreso: '2025-01-01' });
  hoy = await hoyDe(dueno);
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('contratos de trabajo', () => {
  it('registra un contrato vigente y no admite un segundo mientras siga vigente', async () => {
    const c = datos(await contrato());
    expect(c).toMatchObject({ tipo: 'indeterminado', estado: 'vigente', colaboradorNombre: 'Luis Paz', remuneracionMensualCentimos: 150_000, jornadaHorasSemana: 48, fin: null });
    expect(codigo(await contrato({ inicio: '2026-06-01' }))).toBe('conflicto');
  });

  it('plazo fijo y prácticas exigen fin; el fin no puede ser anterior; valida colaborador y montos', async () => {
    expect(codigo(await contrato({ tipo: 'plazo_fijo' }))).toBe('argumentos_invalidos');
    expect(mensaje(await contrato({ tipo: 'practicas' }))).toMatch(/fecha de fin/);
    expect(codigo(await contrato({ tipo: 'locacion', inicio: '2026-03-01', fin: '2026-01-01' }))).toBe('argumentos_invalidos');
    expect(codigo(await contrato({ colaboradorId: randomUUID() }))).toBe('no_encontrado');
    expect(codigo(await contrato({ remuneracionMensualCentimos: -1 }))).toBe('argumentos_invalidos');
    expect(codigo(await contrato({ jornadaHorasSemana: 0 }))).toBe('argumentos_invalidos');
  });

  it('termina el vigente con su motivo y permite registrar el siguiente; el historial queda', async () => {
    const vigente = datos(await dueno.herramienta('contratos_listar', {})).items[0];
    expect(codigo(await dueno.herramienta('contrato_terminar', { id: vigente.id, motivo: 'x', fecha: '2025-12-31' }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('contrato_terminar', { id: vigente.id }))).toBe('argumentos_invalidos');
    const t = datos(await dueno.herramienta('contrato_terminar', { id: vigente.id, motivo: 'Renovación', fecha: '2026-02-28' }));
    expect(t).toMatchObject({ estado: 'terminado', terminadoEn: '2026-02-28', motivoTermino: 'Renovación' });
    expect(codigo(await dueno.herramienta('contrato_terminar', { id: vigente.id, motivo: 'otra vez' }))).toBe('conflicto');
    const nuevo = datos(await contrato({ tipo: 'plazo_fijo', inicio: '2026-03-01', fin: '2026-08-31', remuneracionMensualCentimos: 180_000 }));
    expect(nuevo.estado).toBe('vigente');
    expect(datos(await dueno.herramienta('contratos_listar', { estado: 'todos', colaboradorId: luis.id })).items).toHaveLength(2);
    expect(datos(await dueno.herramienta('contratos_listar', { estado: 'terminados' })).items.map((x: any) => x.id)).toEqual([vigente.id]);
  });

  it('la remuneración no sale en la auditoría; el lector no ve ni crea contratos; la otra empresa no ve nada', async () => {
    const filas = await auditoriaDe(appPool, empresaA);
    const texto = JSON.stringify(filas.filter((f) => String(f.herramienta).startsWith('contrato')));
    expect(texto).not.toMatch(/150000|180000|Luis Paz/);
    expect((await lector.herramienta('contratos_listar', {})).estado).toBe(403);
    expect((await lector.herramienta('contrato_crear', { colaboradorId: luis.id, tipo: 'indeterminado', inicio: '2026-01-01', remuneracionMensualCentimos: 1 })).estado).toBe(403);
    expect(datos(await ajeno.herramienta('contratos_listar', {})).items).toEqual([]);
    const id = datos(await dueno.herramienta('contratos_listar', {})).items[0].id;
    expect(codigo(await ajeno.herramienta('contrato_terminar', { id, motivo: 'x' }))).toBe('no_encontrado');
  });
});

describe('vacaciones', () => {
  let primera: string;
  const solicitar = (extra: Record<string, unknown> = {}) => dueno.herramienta('vacaciones_solicitar', { colaboradorId: luis.id, desde: '2026-07-01', hasta: '2026-07-15', ...extra });

  it('calcula los días corridos y queda pendiente; no se cruza con otras del mismo colaborador', async () => {
    const v = datos(await solicitar({ motivo: 'Viaje' }));
    primera = v.id;
    expect(v).toMatchObject({ dias: 15, estado: 'solicitada', colaboradorNombre: 'Luis Paz', resueltoEn: null });
    expect(codigo(await solicitar({ desde: '2026-07-15', hasta: '2026-07-20' }))).toBe('conflicto');
    expect(datos(await solicitar({ desde: '2026-07-16', hasta: '2026-07-18' })).dias).toBe(3);
  });

  it('valida el orden de las fechas y el colaborador', async () => {
    expect(codigo(await solicitar({ desde: '2026-09-10', hasta: '2026-09-01' }))).toBe('argumentos_invalidos');
    expect(codigo(await solicitar({ colaboradorId: randomUUID() }))).toBe('no_encontrado');
    expect(codigo(await solicitar({ desde: '2026-9-1' }))).toBe('argumentos_invalidos');
  });

  it('rechazar exige motivo; aprobar deja quién y cuándo, emite el evento sin datos personales y descuenta del saldo', async () => {
    expect(codigo(await dueno.herramienta('vacaciones_resolver', { id: primera, decision: 'rechazar' }))).toBe('argumentos_invalidos');
    const antes = datos(await dueno.herramienta('vacaciones_saldo', { colaboradorId: luis.id, fecha: '2026-06-30' }));
    expect(antes).toMatchObject({ devengadosDias: 42, gozadosDias: 0, porAprobarDias: 18, saldoDias: 42 });
    const a = datos(await dueno.herramienta('vacaciones_resolver', { id: primera, decision: 'aprobar' }));
    expect(a).toMatchObject({ estado: 'aprobada', resueltoPor: expect.any(String), resueltoEn: expect.any(String) });
    expect((await eventosDe(appPool, empresaA, 'vacaciones.resuelta')).at(-1)!.carga).toEqual({ id: primera, decision: 'aprobar' });
    const despues = datos(await dueno.herramienta('vacaciones_saldo', { colaboradorId: luis.id, fecha: '2026-06-30' }));
    expect(despues).toMatchObject({ gozadosDias: 15, porAprobarDias: 3, saldoDias: 27 });
    expect(codigo(await dueno.herramienta('vacaciones_resolver', { id: primera, decision: 'rechazar', motivo: 'x' }))).toBe('conflicto');
  });

  it('anular devuelve los días al saldo y libera las fechas; una rechazada no cuenta', async () => {
    datos(await dueno.herramienta('vacaciones_anular', { id: primera, motivo: 'Cambio de fechas' }));
    expect(datos(await dueno.herramienta('vacaciones_saldo', { colaboradorId: luis.id, fecha: '2026-06-30' })).saldoDias).toBe(42);
    expect(codigo(await dueno.herramienta('vacaciones_anular', { id: primera, motivo: 'otra vez' }))).toBe('conflicto');
    const otra = datos(await solicitar({ desde: '2026-07-01', hasta: '2026-07-10' }));
    datos(await dueno.herramienta('vacaciones_resolver', { id: otra.id, decision: 'rechazar', motivo: 'Cierre de mes' }));
    expect(datos(await dueno.herramienta('vacaciones_saldo', { colaboradorId: luis.id, fecha: '2026-06-30' })).gozadosDias).toBe(0);
  });

  it('lista por estado; el lector lee pero no solicita ni aprueba; la otra empresa no ve nada', async () => {
    expect(datos(await dueno.herramienta('vacaciones_listar', { estado: 'abiertas' })).items).toHaveLength(1);
    expect(datos(await dueno.herramienta('vacaciones_listar', { estado: 'todas' })).items).toHaveLength(3);
    expect(datos(await lector.herramienta('vacaciones_listar', {})).items).toHaveLength(1);
    expect(datos(await lector.herramienta('vacaciones_saldo', { colaboradorId: luis.id })).colaboradorId).toBe(luis.id);
    expect((await lector.herramienta('vacaciones_solicitar', { colaboradorId: luis.id, desde: '2026-10-01', hasta: '2026-10-02' })).estado).toBe(403);
    expect((await lector.herramienta('vacaciones_resolver', { id: primera, decision: 'aprobar' })).estado).toBe(403);
    expect(datos(await ajeno.herramienta('vacaciones_listar', { estado: 'todas' })).items).toEqual([]);
    expect(codigo(await ajeno.herramienta('vacaciones_saldo', { colaboradorId: luis.id }))).toBe('no_encontrado');
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
