import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type pg from 'pg';
import { activarModulo } from '../../../core/herramientas/http-de-pruebas.js';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../../pruebas/base-de-pruebas.js';
import { prepararColaborador } from '../domain/colaborador.js';
import { decodificarCursorPorFecha } from '../domain/cursor.js';
import { anularAdelanto, bloquearAdelanto, insertarAdelanto, listarAdelantos, ultimosAdelantos, verAdelanto } from './adelantos.repository.js';
import { asistenciaDelDia, guardarAsistencia, listarAsistencias, verAsistencia } from './asistencias.repository.js';
import { actualizarColaborador, cambiarArchivado, colaboradorActivoPorNombre, crearColaborador, listarColaboradores, verColaborador } from './colaboradores.repository.js';
import { resumenDePersonal } from './resumen.repository.js';

// Repositorios de personal contra la base real, con dos empresas (ids únicos: las pruebas no vacían tablas).

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
const A = empresaDePrueba();
const B = empresaDePrueba();
const ctxA = { empresaId: A, usuarioId: 'ana' };
const ctxA2 = { empresaId: A, usuarioId: 'beto' };
const ctxB = { empresaId: B, usuarioId: 'carla' };

async function nuevo(ctx: typeof ctxA, nombre: string): Promise<string> {
  const p = prepararColaborador({ nombre, documentoTipo: 'dni', documentoNumero: '12345678', telefono: '987654321' });
  if (!p.ok) throw new Error(p.motivo);
  const c = await conEmpresa(ctx, (tx) => crearColaborador(tx, ctx, p.datos));
  if (!c) throw new Error('No se creó el colaborador de prueba.');
  return c.id;
}
const adelanto = (ctx: typeof ctxA, colaboradorId: string, numero: number, monto = 5000, fecha = '2026-03-10') =>
  conEmpresa(ctx, (tx) => insertarAdelanto(tx, ctx, { numero, anio: 2026, colaboradorId, montoCentimos: monto, fecha, motivo: null }));

beforeAll(async () => {
  const owner = abrirPool('owner');
  // El catálogo lo siembra el servidor al arrancar; aquí no hay servidor.
  await owner.query(`insert into core.modulos (codigo, nombre) values ('personal', 'Personal') on conflict do nothing`);
  await owner.end();
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
  await Promise.all([activarModulo(A, 'personal'), activarModulo(B, 'personal')]);
});
afterAll(() => pool.end());

describe('colaboradores.repository', () => {
  it('crea, lo ve su empresa y no la otra; el nombre activo no se repite entre empresas distintas sí', async () => {
    const id = await nuevo(ctxA, 'Rosa Mamani');
    expect(await conEmpresa(ctxA, (tx) => verColaborador(tx, ctxA, id))).toMatchObject({ nombre: 'Rosa Mamani', nombreNormalizado: 'rosa mamani', creadoPor: 'ana', archivadoEn: null });
    expect(await conEmpresa(ctxB, (tx) => verColaborador(tx, ctxB, id))).toBeNull();
    expect(await conEmpresa(ctxB, (tx) => verColaborador(tx, ctxB, id, { bloquear: true }))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => verColaborador(tx, ctxB, id))).toBeNull();
    expect(await nuevo(ctxB, 'Rosa Mamani')).toBeTruthy();
    const dup = prepararColaborador({ nombre: 'ROSA  mamaní' });
    if (!dup.ok) throw new Error('x');
    expect(await conEmpresa(ctxA, (tx) => crearColaborador(tx, ctxA, dup.datos))).toBeNull();
    expect((await conEmpresa(ctxA, (tx) => colaboradorActivoPorNombre(tx, ctxA, 'rosa mamani')))?.id).toBe(id);
  });

  it('archivar libera el nombre y restaurar se puede; actualizar no alcanza otra empresa', async () => {
    const id = await nuevo(ctxA, 'Luis Poma');
    await conEmpresa(ctxA, (tx) => cambiarArchivado(tx, ctxA, id, true));
    expect(await conEmpresa(ctxA, (tx) => colaboradorActivoPorNombre(tx, ctxA, 'luis poma'))).toBeNull();
    const otro = await nuevo(ctxA, 'Luis Poma');
    expect(otro).not.toBe(id);
    await expect(conEmpresa(ctxA, (tx) => cambiarArchivado(tx, ctxA, id, false))).rejects.toThrow();
    const p = prepararColaborador({ nombre: 'Luis Poma Q', cargo: 'Operario' });
    if (!p.ok) throw new Error('x');
    await expect(conEmpresa(ctxB, (tx) => actualizarColaborador(tx, ctxB, otro, p.datos))).rejects.toThrow();
    await conEmpresa(ctxA, (tx) => actualizarColaborador(tx, ctxA, otro, p.datos));
    expect(await conEmpresa(ctxA, (tx) => verColaborador(tx, ctxA, otro))).toMatchObject({ nombre: 'Luis Poma Q', cargo: 'Operario' });
  });

  it('listado por nombre con cursor, búsqueda sin tildes y filtro de estado', async () => {
    const C = empresaDePrueba();
    const ctxC = { empresaId: C, usuarioId: 'dora' };
    await activarModulo(C, 'personal');
    const [z, a, m] = [await nuevo(ctxC, 'Zoila'), await nuevo(ctxC, 'Álvaro'), await nuevo(ctxC, 'Mónica')];
    await conEmpresa(ctxC, (tx) => cambiarArchivado(tx, ctxC, m, true));
    const listar = (f: Record<string, unknown>) => conEmpresa(ctxC, (tx) => listarColaboradores(tx, ctxC, { limite: 10, cursor: null, estado: 'activos', ...f }));
    expect((await listar({})).items.map((c) => c.id)).toEqual([a, z]);
    expect((await listar({ estado: 'todos' })).items.map((c) => c.id)).toEqual([a, m, z]);
    expect((await listar({ estado: 'archivados' })).items.map((c) => c.id)).toEqual([m]);
    expect((await listar({ buscar: 'ALVA' })).items.map((c) => c.id)).toEqual([a]);
    const p1 = await listar({ limite: 1 });
    expect(p1.items.map((c) => c.id)).toEqual([a]);
    expect(p1.siguiente).toBeTruthy();
    expect((await conEmpresa(ctxC, (tx) => listarColaboradores(tx, ctxC, { limite: 1, cursor: { nombre: 'alvaro', id: a }, estado: 'activos' }))).items.map((c) => c.id)).toEqual([z]);
  });
});

describe('asistencias.repository', () => {
  it('una fila por colaborador y día: guardar de nuevo reemplaza; se ve por empresa', async () => {
    const col = await nuevo(ctxA, 'Asistente Uno');
    const t = new Date('2026-03-10T13:00:00Z');
    const id = await conEmpresa(ctxA, (tx) => guardarAsistencia(tx, ctxA, col, '2026-03-10', { estado: 'presente', entrada: t, salida: null, nota: null }));
    const id2 = await conEmpresa(ctxA2, (tx) => guardarAsistencia(tx, ctxA2, col, '2026-03-10', { estado: 'tardanza', entrada: t, salida: new Date('2026-03-10T22:00:00Z'), nota: 'n' }));
    expect(id2).toBe(id);
    const f = await conEmpresa(ctxA, (tx) => asistenciaDelDia(tx, ctxA, col, '2026-03-10', { bloquear: true }));
    expect(f).toMatchObject({ estado: 'tardanza', nota: 'n', creadoPor: 'ana' });
    expect(await conEmpresa(ctxB, (tx) => asistenciaDelDia(tx, ctxB, col, '2026-03-10'))).toBeNull();
    expect(await conEmpresa(ctxB, (tx) => verAsistencia(tx, ctxB, id))).toBeNull();
    expect((await conEmpresa(ctxA, (tx) => verAsistencia(tx, ctxA, id)))?.colaboradorNombre).toBe('Asistente Uno');
  });

  it('la base rechaza una salida sin entrada y un colaborador de otra empresa', async () => {
    const col = await nuevo(ctxA, 'Asistente Dos');
    await expect(conEmpresa(ctxA, (tx) => guardarAsistencia(tx, ctxA, col, '2026-03-11', { estado: 'presente', entrada: null, salida: new Date(), nota: null }))).rejects.toThrow();
    await expect(conEmpresa(ctxB, (tx) => guardarAsistencia(tx, ctxB, col, '2026-03-11', { estado: 'falta', entrada: null, salida: null, nota: null }))).rejects.toThrow();
  });

  it('lista un día o un rango, con cursor y filtro por colaborador', async () => {
    const C = empresaDePrueba();
    const ctxC = { empresaId: C, usuarioId: 'dora' };
    await activarModulo(C, 'personal');
    const [x, y] = [await nuevo(ctxC, 'Equis'), await nuevo(ctxC, 'Ye')];
    const marca = (col: string, fecha: string) => conEmpresa(ctxC, (tx) => guardarAsistencia(tx, ctxC, col, fecha, { estado: 'falta', entrada: null, salida: null, nota: null }));
    await Promise.all([marca(x, '2026-03-01'), marca(y, '2026-03-01'), marca(x, '2026-03-02')]);
    const listar = (f: Record<string, unknown>) => conEmpresa(ctxC, (tx) => listarAsistencias(tx, ctxC, { limite: 10, cursor: null, desde: '2026-03-01', ...f }));
    expect((await listar({})).items).toHaveLength(2);
    expect((await listar({ hasta: '2026-03-31' })).items).toHaveLength(3);
    expect((await listar({ hasta: '2026-03-31', colaboradorId: x })).items.map((i) => i.fecha)).toEqual(['2026-03-02', '2026-03-01']);
    const p1 = await listar({ hasta: '2026-03-31', limite: 2 });
    expect(p1.siguiente).toBeTruthy();
    expect(decodificarCursorPorFecha(p1.siguiente!)).toBeTruthy();
  });
});

describe('adelantos.repository', () => {
  it('inserta, ve por empresa y por alcance, y no repite número en el año', async () => {
    const col = await nuevo(ctxA, 'Con Adelanto');
    const id = await adelanto(ctxA, col, 1);
    expect(await conEmpresa(ctxA, (tx) => verAdelanto(tx, ctxA, id, null))).toMatchObject({ estado: 'registrado', montoCentimos: 5000, colaboradorNombre: 'Con Adelanto', creadoPor: 'ana' });
    expect(await conEmpresa(ctxB, (tx) => verAdelanto(tx, ctxB, id, null))).toBeNull();
    expect(await conEmpresa(ctxA2, (tx) => verAdelanto(tx, ctxA2, id, 'beto'))).toBeNull();
    expect(await conEmpresa(ctxA, (tx) => verAdelanto(tx, ctxA, id, 'ana'))).not.toBeNull();
    await expect(adelanto(ctxA, col, 1)).rejects.toThrow();
    await expect(adelanto(ctxA, col, 2, 0)).rejects.toThrow();
    await expect(adelanto(ctxB, col, 2)).rejects.toThrow();
  });

  it('anular conserva la fila y el monto; no se anula dos veces ni se borra ni se edita', async () => {
    const col = await nuevo(ctxA, 'Anulable');
    const id = await adelanto(ctxA, col, 10);
    expect(await conEmpresa(ctxA, (tx) => anularAdelanto(tx, ctxA2, id, 'duplicado'))).toBe(true);
    expect(await conEmpresa(ctxA, (tx) => anularAdelanto(tx, ctxA2, id, 'otra vez'))).toBe(false);
    expect(await conEmpresa(ctxA, (tx) => verAdelanto(tx, ctxA, id, null))).toMatchObject({ estado: 'anulado', anuladoPor: 'beto', motivoAnulacion: 'duplicado', montoCentimos: 5000 });
    await expect(conEmpresa(ctxA, (tx) => tx.execute(sql`delete from personal.adelantos where id = ${id}::uuid`))).rejects.toThrow(/Failed query/);
    await expect(conEmpresa(ctxA, (tx) => tx.execute(sql`update personal.adelantos set monto_centimos = 1 where id = ${id}::uuid`))).rejects.toThrow(/Failed query/);
    expect(await conEmpresa(ctxB, (tx) => bloquearAdelanto(tx, ctxB, id, null))).toBeNull();
  });

  it('lista por estado, colaborador y fechas con cursor; la ficha trae los últimos', async () => {
    const C = empresaDePrueba();
    const ctxC = { empresaId: C, usuarioId: 'dora' };
    await activarModulo(C, 'personal');
    const col = await nuevo(ctxC, 'Listada');
    const [a1, a2, a3] = [await adelanto(ctxC, col, 1, 100, '2026-03-01'), await adelanto(ctxC, col, 2, 200, '2026-03-05'), await adelanto(ctxC, col, 3, 300, '2026-03-09')];
    await conEmpresa(ctxC, (tx) => anularAdelanto(tx, ctxC, a2, 'error'));
    const listar = (f: Record<string, unknown>) => conEmpresa(ctxC, (tx) => listarAdelantos(tx, ctxC, { limite: 10, cursor: null, estado: 'vigentes', ...f }, null));
    expect((await listar({})).items.map((i) => i.id)).toEqual([a3, a1]);
    expect((await listar({ estado: 'anulados' })).items.map((i) => i.id)).toEqual([a2]);
    expect((await listar({ estado: 'todos', desde: '2026-03-02', hasta: '2026-03-08' })).items.map((i) => i.id)).toEqual([a2]);
    const p1 = await listar({ limite: 1 });
    expect(p1.siguiente).toBeTruthy();
    const p2 = await listar({ limite: 1, cursor: decodificarCursorPorFecha(p1.siguiente!)! });
    expect(p2.items.map((i) => i.id)).toEqual([a1]);
    expect((await conEmpresa(ctxC, (tx) => ultimosAdelantos(tx, ctxC, col, 2, null))).map((i) => i.id)).toEqual([a3, a2]);
  });
});

describe('resumen.repository', () => {
  it('cuenta lo de la empresa y deja fuera a los archivados y a los anulados', async () => {
    const C = empresaDePrueba();
    const ctxC = { empresaId: C, usuarioId: 'dora' };
    await activarModulo(C, 'personal');
    const [uno, dos, tres] = [await nuevo(ctxC, 'R Uno'), await nuevo(ctxC, 'R Dos'), await nuevo(ctxC, 'R Tres')];
    await conEmpresa(ctxC, (tx) => cambiarArchivado(tx, ctxC, tres, true));
    const marca = (col: string, fecha: string, estado: 'presente' | 'falta') =>
      conEmpresa(ctxC, (tx) => guardarAsistencia(tx, ctxC, col, fecha, { estado, entrada: estado === 'presente' ? new Date() : null, salida: null, nota: null }));
    await Promise.all([marca(uno, '2026-03-10', 'presente'), marca(uno, '2026-03-09', 'falta'), marca(tres, '2026-03-10', 'presente')]);
    const a1 = await adelanto(ctxC, dos, 1, 1500, '2026-03-02');
    await adelanto(ctxC, dos, 2, 2500, '2026-03-04');
    await conEmpresa(ctxC, (tx) => anularAdelanto(tx, ctxC, a1, 'error'));
    const r = await conEmpresa(ctxC, (tx) => resumenDePersonal(tx, { desde: '2026-03-01', hasta: '2026-03-31', hoy: '2026-03-10' }));
    expect(r).toMatchObject({
      colaboradoresActivos: 2,
      hoy: { fecha: '2026-03-10', marcados: 1, sinMarcar: 1 },
      adelantos: { cantidad: 1, totalCentimos: 2500, anulados: 1 },
    });
    expect(r.asistenciasPorEstado.find((e) => e.estado === 'presente')?.cantidad).toBe(2);
    expect(r.asistenciasPorEstado.find((e) => e.estado === 'falta')?.cantidad).toBe(1);
    const otra = await conEmpresa(ctxB, (tx) => resumenDePersonal(tx, { desde: '2026-03-01', hasta: '2026-03-31', hoy: '2026-03-10' }));
    expect(otra.adelantos).toEqual({ cantidad: 0, totalCentimos: 0, anulados: 0 });
  });
});
