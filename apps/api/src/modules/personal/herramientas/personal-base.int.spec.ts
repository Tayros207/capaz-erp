import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { auditoriaDe, codigo, confirmarCritica, crearColaborador, datos, hoyDe, mensaje } from './pruebas-de-personal.js';

// Personal por HTTP real, parte 1: colaboradores y asistencia, con dos empresas, un member de solo lectura,
// uno sin el módulo, la empresa sin contratarlo y el módulo en baja.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: personal en lectura
let sinModulo: Sesion; // member de A: solo crm
let ajeno: Sesion; // owner de B
let empresaA: string;
let empresaB: string;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, sinModulo, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Sin módulo', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de personal');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de personal');
  await Promise.all([activarModulo(empresaA, 'personal'), activarModulo(empresaA, 'crm'), activarModulo(empresaB, 'personal')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'personal', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, sinModulo, { modulo: 'crm', nivel: 'completo', alcance: 'todos' });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('colaborador_crear y colaborador_editar', () => {
  it('crea con datos normalizados, devuelve la ficha vacía y no deja datos personales en la auditoría', async () => {
    const r = await dueno.herramienta('colaborador_crear', {
      nombre: '  Zenobia   Quispe Ñahui ', documentoTipo: 'dni', documentoNumero: '45871236', telefono: '+51 987 654 321', cargo: ' Operaria ', fechaIngreso: '2026-03-01',
    });
    expect(r.estado).toBe(200);
    expect(datos(r)).toMatchObject({
      nombre: 'Zenobia Quispe Ñahui', documentoTipo: 'dni', documentoNumero: '45871236', telefono: '+51987654321', cargo: 'Operaria',
      fechaIngreso: '2026-03-01', archivado: false, creadoPor: dueno.usuarioId, asistencias: [], adelantos: [],
    });
    const auditoria = JSON.stringify(await auditoriaDe(appPool, empresaA));
    for (const secreto of ['Zenobia', '45871236', '987654321']) expect(auditoria).not.toContain(secreto);
  });

  it('validación: nombre vacío, documento mal formado, campo de más y argumentos de contexto', async () => {
    for (const args of [{ nombre: '   ' }, { nombre: 'Ana', documentoTipo: 'dni', documentoNumero: '12' }, { nombre: 'Ana', documentoNumero: '12345678' }, { nombre: 'Ana', sueldo: 1 }, { nombre: 'Ana', telefono: 'abc' }]) {
      const r = await dueno.herramienta('colaborador_crear', args);
      expect(r.estado, JSON.stringify(args)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
    }
    expect(codigo(await dueno.herramienta('colaborador_crear', { nombre: 'Ana', usuarioId: 'x' }))).toBe('argumento_prohibido');
    expect(codigo(await dueno.herramienta('colaborador_crear', { nombre: 'Ana', empresaId: empresaB }))).toBe('argumento_prohibido');
  });

  it('rechaza una sucursal o una cuenta que no existen; acepta la cuenta de un miembro', async () => {
    expect(mensaje(await dueno.herramienta('colaborador_crear', { nombre: 'Con sucursal falsa', sucursalId: randomUUID() }))).toMatch(/sucursal/);
    expect(mensaje(await dueno.herramienta('colaborador_crear', { nombre: 'Con cuenta falsa', cuentaId: ajeno.usuarioId }))).toMatch(/cuenta/);
    expect(datos(await dueno.herramienta('colaborador_crear', { nombre: 'Con cuenta propia', cuentaId: lector.usuarioId })).cuentaId).toBe(lector.usuarioId);
  });

  it('el nombre activo no se repite: conflicto con candidatas; en otra empresa sí', async () => {
    const primero = await crearColaborador(dueno, 'Nombre Repetido');
    const r = await dueno.herramienta('colaborador_crear', { nombre: 'NOMBRE  repetído' });
    expect(r.estado).toBe(409);
    expect(r.cuerpo.error.candidatas).toEqual([{ id: primero.id, nombre: 'Nombre Repetido' }]);
    expect((await crearColaborador(ajeno, 'Nombre Repetido')).id).not.toBe(primero.id);
  });

  it('la misma clave de idempotencia no crea dos colaboradores', async () => {
    const clave = `col-${randomUUID()}`;
    const a = datos(await dueno.herramienta('colaborador_crear', { nombre: 'Idempotente Uno' }, { clave }));
    const b = datos(await dueno.herramienta('colaborador_crear', { nombre: 'Idempotente Uno' }, { clave }));
    expect(b.id).toBe(a.id);
    expect(codigo(await dueno.herramienta('colaborador_crear', { nombre: 'Otro nombre' }, { clave }))).toBe('conflicto');
  });

  it('editar cambia solo lo indicado, borra con null, exige un cambio y no pisa el nombre de otro', async () => {
    const c = await crearColaborador(dueno, 'Editable Uno', { cargo: 'Cajera', telefono: '987654321' });
    const otro = await crearColaborador(dueno, 'Editable Dos');
    const r = datos(await dueno.herramienta('colaborador_editar', { id: c.id, cargo: null, nombre: 'Editable Uno Bis' }));
    expect(r).toMatchObject({ nombre: 'Editable Uno Bis', cargo: null, telefono: '987654321' });
    expect(codigo(await dueno.herramienta('colaborador_editar', { id: c.id }))).toBe('argumentos_invalidos');
    const choque = await dueno.herramienta('colaborador_editar', { id: c.id, nombre: 'editable dos' });
    expect(choque.estado).toBe(409);
    expect(choque.cuerpo.error.candidatas[0].id).toBe(otro.id);
    expect(codigo(await dueno.herramienta('colaborador_editar', { id: c.id, documentoNumero: '12345678' }))).toBe('argumentos_invalidos');
    const auditoria = (await auditoriaDe(appPool, empresaA)).filter((f) => f.herramienta === 'colaborador_editar');
    expect(JSON.stringify(auditoria)).not.toContain('Editable');
  });

  it('archivar y restaurar: no se borra, el nombre se libera y restaurar choca si lo tomaron', async () => {
    const c = await crearColaborador(dueno, 'Archivable');
    expect(datos(await dueno.herramienta('colaborador_archivar', { id: c.id }))).toMatchObject({ archivado: true });
    expect(codigo(await dueno.herramienta('colaborador_archivar', { id: c.id }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('colaborador_editar', { id: c.id, cargo: 'x' }))).toBe('conflicto');
    const nuevo = await crearColaborador(dueno, 'Archivable');
    expect(codigo(await dueno.herramienta('colaborador_restaurar', { id: c.id }))).toBe('conflicto');
    datos(await dueno.herramienta('colaborador_archivar', { id: nuevo.id }));
    expect(datos(await dueno.herramienta('colaborador_restaurar', { id: c.id })).archivado).toBe(false);
    expect(codigo(await dueno.herramienta('colaborador_restaurar', { id: c.id }))).toBe('conflicto');
  });

  it('colaboradores_listar: busca sin tildes, filtra por estado y pagina con cursor', async () => {
    const E = await abrirSesion(app, 'Dueña de lista');
    await activarModulo(await crearEmpresa(E, 'Empresa de lista'), 'personal');
    const [b, a, c] = [await crearColaborador(E, 'Beatriz'), await crearColaborador(E, 'Ángela'), await crearColaborador(E, 'Carmen')];
    datos(await E.herramienta('colaborador_archivar', { id: c.id }));
    const ids = (r: any) => datos(r).items.map((i: any) => i.id);
    expect(ids(await E.herramienta('colaboradores_listar', {}))).toEqual([a.id, b.id]);
    expect(ids(await E.herramienta('colaboradores_listar', { estado: 'todos' }))).toEqual([a.id, b.id, c.id]);
    expect(ids(await E.herramienta('colaboradores_listar', { estado: 'archivados' }))).toEqual([c.id]);
    expect(ids(await E.herramienta('colaboradores_listar', { buscar: 'ANGE' }))).toEqual([a.id]);
    const p1 = datos(await E.herramienta('colaboradores_listar', { limite: 1 }));
    expect(p1.items[0].id).toBe(a.id);
    expect(ids(await E.herramienta('colaboradores_listar', { limite: 1, cursor: p1.siguiente }))).toEqual([b.id]);
    expect(codigo(await E.herramienta('colaboradores_listar', { cursor: 'basura' }))).toBe('argumentos_invalidos');
  });
});

describe('asistencia_marcar, asistencia_corregir y asistencias_listar', () => {
  it('marca la entrada y la salida de hoy con la hora del servidor, y no repite', async () => {
    const hoy = await hoyDe(dueno);
    const c = await crearColaborador(dueno, 'Marca Entrada');
    const e = datos(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, entrada: true }));
    expect(e).toMatchObject({ fecha: hoy, estado: 'presente', salida: null, colaboradorNombre: 'Marca Entrada' });
    expect(Date.now() - Date.parse(e.entrada)).toBeLessThan(60_000);
    expect(codigo(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, entrada: true }))).toBe('conflicto');
    const s = datos(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, salida: true }));
    expect(s.id).toBe(e.id);
    expect(s.salida).not.toBeNull();
    expect(codigo(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, salida: true }))).toBe('conflicto');
  });

  it('el estado se puede cambiar el mismo día (una fila por día) y falta limpia las horas', async () => {
    const c = await crearColaborador(dueno, 'Cambia Estado');
    const a = datos(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, estado: 'tardanza', entrada: true, nota: 'Llegó tarde' }));
    expect(a).toMatchObject({ estado: 'tardanza', nota: 'Llegó tarde' });
    expect(a.entrada).not.toBeNull();
    const b = datos(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, estado: 'falta' }));
    expect(b).toMatchObject({ id: a.id, estado: 'falta', entrada: null, salida: null, nota: 'Llegó tarde' });
    expect(codigo(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, estado: 'permiso', entrada: true }))).toBe('conflicto');
  });

  it('validación: sin nada que marcar, estado inválido, colaborador inexistente, de otra empresa o archivado', async () => {
    const c = await crearColaborador(dueno, 'Valida Marca');
    expect(codigo(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, estado: 'vacaciones' }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('asistencia_marcar', { colaboradorId: randomUUID(), estado: 'presente' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('asistencia_marcar', { colaboradorId: c.id, estado: 'presente' }))).toBe('no_encontrado');
    datos(await dueno.herramienta('colaborador_archivar', { id: c.id }));
    expect(codigo(await dueno.herramienta('asistencia_marcar', { colaboradorId: c.id, estado: 'presente' }))).toBe('conflicto');
  });

  it('corregir es crítica: pide confirmación sin cambiar nada, solo un día pasado, y guarda el motivo', async () => {
    const c = await crearColaborador(dueno, 'Corrige Dia');
    const args = { colaboradorId: c.id, fecha: '2026-01-05', estado: 'permiso', motivo: 'Cita médica' };
    const pide = await dueno.herramienta('asistencia_corregir', args);
    expect(pide.cuerpo.requiereConfirmacion.token).toBeTruthy();
    expect(datos(await dueno.herramienta('asistencias_listar', { desde: '2026-01-05' })).items.filter((i: any) => i.colaboradorId === c.id)).toEqual([]);
    const r = datos(await confirmarCritica(dueno, 'asistencia_corregir', args));
    expect(r).toMatchObject({ fecha: '2026-01-05', estado: 'permiso', nota: 'Corrección: Cita médica', entrada: null });
    const otra = datos(await confirmarCritica(dueno, 'asistencia_corregir', { ...args, estado: 'falta', motivo: 'No avisó' }));
    expect(otra).toMatchObject({ id: r.id, estado: 'falta' });
    const hoy = await hoyDe(dueno);
    expect(codigo(await dueno.herramienta('asistencia_corregir', { ...args, fecha: hoy }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('asistencia_corregir', { ...args, fecha: '2999-01-01' }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('asistencia_corregir', { ...args, motivo: '' }))).toBe('argumentos_invalidos');
    const aud = JSON.stringify((await auditoriaDe(appPool, empresaA)).filter((f) => f.herramienta === 'asistencia_corregir'));
    expect(aud).not.toContain('Cita médica');
    expect(aud).not.toContain('Corrige Dia');
  });

  it('asistencias_listar: por día, por rango y por colaborador; otra empresa no ve nada', async () => {
    const x = await crearColaborador(dueno, 'Lista Equis');
    for (const [fecha, estado] of [['2025-05-01', 'falta'], ['2025-05-02', 'descanso']] as const) {
      datos(await confirmarCritica(dueno, 'asistencia_corregir', { colaboradorId: x.id, fecha, estado, motivo: 'Carga' }));
    }
    const lista = async (s: Sesion, args: object) => datos(await s.herramienta('asistencias_listar', args)).items.filter((i: any) => i.colaboradorId === x.id);
    expect((await lista(dueno, { desde: '2025-05-01' })).map((i: any) => i.fecha)).toEqual(['2025-05-01']);
    expect((await lista(dueno, { desde: '2025-05-01', hasta: '2025-05-31' })).map((i: any) => i.fecha)).toEqual(['2025-05-02', '2025-05-01']);
    expect((await lista(lector, { desde: '2025-05-01', hasta: '2025-05-31', colaboradorId: x.id })).length).toBe(2);
    expect(await lista(ajeno, { desde: '2025-05-01', hasta: '2025-05-31' })).toEqual([]);
    expect(codigo(await dueno.herramienta('asistencias_listar', { desde: '2025-05-02', hasta: '2025-05-01' }))).toBe('argumentos_invalidos');
    const ficha = datos(await dueno.herramienta('colaborador_ver', { id: x.id }));
    expect(ficha.asistencias.map((i: any) => i.fecha)).toEqual(['2025-05-02', '2025-05-01']);
  });
});

describe('permisos, aislamiento y módulo en baja', () => {
  it('un member de lectura lee y recibe modulo_solo_lectura al escribir', async () => {
    const c = await crearColaborador(dueno, 'Visible para lector');
    expect(datos(await lector.herramienta('colaborador_ver', { id: c.id })).id).toBe(c.id);
    expect(datos(await lector.herramienta('colaboradores_listar', {})).items.length).toBeGreaterThan(0);
    for (const [nombre, args] of [
      ['colaborador_crear', { nombre: 'Intruso' }],
      ['colaborador_editar', { id: c.id, cargo: 'x' }],
      ['colaborador_archivar', { id: c.id }],
      ['colaborador_restaurar', { id: c.id }],
      ['asistencia_marcar', { colaboradorId: c.id, estado: 'presente' }],
      ['asistencia_corregir', { colaboradorId: c.id, fecha: '2026-01-05', estado: 'falta', motivo: 'x' }],
      ['adelanto_registrar', { colaboradorId: c.id, montoCentimos: 100 }],
      ['adelanto_anular', { id: randomUUID(), motivo: 'x' }],
    ] as const) {
      const r = await lector.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(codigo(r), nombre).toBe('modulo_solo_lectura');
    }
  });

  it('un member sin el módulo asignado recibe modulo_no_disponible hasta para leer', async () => {
    expect(codigo(await sinModulo.herramienta('colaboradores_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await sinModulo.herramienta('personal_resumen', { desde: '2026-01-01', hasta: '2026-01-31' }))).toBe('modulo_no_disponible');
    expect(codigo(await sinModulo.herramienta('asistencia_marcar', { colaboradorId: randomUUID(), estado: 'presente' }))).toBe('modulo_no_disponible');
  });

  it('otra empresa no ve ni toca nada: por id, por listado y al escribir', async () => {
    const c = await crearColaborador(dueno, 'Solo de A');
    expect(codigo(await ajeno.herramienta('colaborador_ver', { id: c.id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('colaborador_editar', { id: c.id, cargo: 'x' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('colaborador_archivar', { id: c.id }))).toBe('no_encontrado');
    expect(datos(await ajeno.herramienta('colaboradores_listar', { buscar: 'solo de a' })).items).toEqual([]);
  });

  it('empresa sin el módulo contratado: no entra', async () => {
    const nueva = await abrirSesion(app, 'Sin contrato');
    await crearEmpresa(nueva, 'Empresa sin personal');
    expect(codigo(await nueva.herramienta('colaboradores_listar', {}))).toBe('modulo_no_disponible');
    expect(codigo(await nueva.herramienta('colaborador_crear', { nombre: 'Nadie' }))).toBe('modulo_no_disponible');
  });

  it('módulo dado de baja: se lee, no se escribe por herramienta ni con un insert directo', async () => {
    const c = await crearColaborador(ajeno, 'Antes de la baja');
    await darDeBajaModulo(empresaB, 'personal');
    expect(datos(await ajeno.herramienta('colaborador_ver', { id: c.id })).nombre).toBe('Antes de la baja');
    expect(datos(await ajeno.herramienta('asistencias_listar', { desde: '2026-01-01' })).items).toEqual([]);
    for (const [nombre, args] of [
      ['colaborador_crear', { nombre: 'Nuevo' }],
      ['colaborador_editar', { id: c.id, cargo: 'x' }],
      ['asistencia_marcar', { colaboradorId: c.id, estado: 'presente' }],
      ['adelanto_registrar', { colaboradorId: c.id, montoCentimos: 100 }],
    ] as const) {
      expect(codigo(await ajeno.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    await expect(
      comoEmpresa(appPool, empresaB, (cn) => cn.query(`insert into personal.colaboradores (tenant_id, nombre, nombre_normalizado, creado_por) values ($1, 'X', 'x', 'u1')`, [empresaB])),
    ).rejects.toThrow(/no está activo/);
  });
});
