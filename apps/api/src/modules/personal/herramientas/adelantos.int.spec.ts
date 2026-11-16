import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { auditoriaDe, codigo, confirmarCritica, crearColaborador, datos, eventosDe, hoyDe, mensaje } from './pruebas-de-personal.js';

// Personal por HTTP real, parte 2: adelantos (dinero) y resumen, con un member de lectura y uno de alcance «propios».
// La empresa A es solo de esta prueba: sus correlativos arrancan en 1.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: lectura
let propio: Sesion; // member de A: completo, alcance propios
let ajeno: Sesion; // owner de B
let empresaA: string;
let empresaB: string;
let rosa: { id: string };
let anio: number;

const adelanto = async (s: Sesion, args: Record<string, unknown>, clave?: string) => s.herramienta('adelanto_registrar', args, clave ? { clave } : {});

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de adelantos');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de adelantos');
  await Promise.all([activarModulo(empresaA, 'personal'), activarModulo(empresaB, 'personal')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'personal', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'personal', nivel: 'completo', alcance: 'propios' });
  rosa = await crearColaborador(dueno, 'Rosa Mamani Secreta', { documentoTipo: 'dni', documentoNumero: '45871236' });
  anio = Number((await hoyDe(dueno)).slice(0, 4));
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('adelanto_registrar', () => {
  it('registra con código correlativo, su evento sin datos personales y su auditoría sin nombres ni motivo', async () => {
    const hoy = await hoyDe(dueno);
    const r = await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 15_000, motivo: ' Pasajes de la semana ' });
    expect(r.estado).toBe(200);
    const a = datos(r);
    expect(a).toMatchObject({
      codigo: `ADE-${anio}-0001`, numero: 1, anio, colaboradorId: rosa.id, colaboradorNombre: 'Rosa Mamani Secreta', montoCentimos: 15_000,
      fecha: hoy, motivo: 'Pasajes de la semana', estado: 'registrado', anuladoEn: null, creadoPor: dueno.usuarioId,
    });
    const eventos = await eventosDe(appPool, empresaA, 'adelanto.registrado');
    expect(eventos).toEqual([{ tipo: 'adelanto.registrado', carga: { adelantoId: a.id, colaboradorId: rosa.id, montoCentimos: 15_000, fecha: hoy } }]);
    const todo = JSON.stringify([eventos, await auditoriaDe(appPool, empresaA)]);
    for (const secreto of ['Rosa', 'Mamani', '45871236', 'Pasajes']) expect(todo).not.toContain(secreto);
  });

  it('el correlativo no deja huecos: un rechazo no consume número y los siguientes son 2, 3…', async () => {
    expect(codigo(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 100, fecha: '2999-01-01' }))).toBe('argumentos_invalidos');
    expect(codigo(await adelanto(dueno, { colaboradorId: randomUUID(), montoCentimos: 100 }))).toBe('no_encontrado');
    expect(datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 200 })).codigo).toBe(`ADE-${anio}-0002`);
    expect(datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 300, fecha: '2026-01-02' })).codigo).toBe(`ADE-${anio}-0003`);
  });

  it('validación: monto cero, negativo o con decimales, campo de más y argumentos de contexto', async () => {
    for (const args of [{ montoCentimos: 0 }, { montoCentimos: -5 }, { montoCentimos: 10.5 }, { montoCentimos: 100, interes: 1 }, { montoCentimos: 'mucho' }, { montoCentimos: 100, fecha: '10/03/2026' }]) {
      const r = await adelanto(dueno, { colaboradorId: rosa.id, ...args });
      expect(r.estado, JSON.stringify(args)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
    }
    expect(codigo(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 100, usuarioId: 'otro' }))).toBe('argumento_prohibido');
  });

  it('rechaza a un colaborador de otra empresa o archivado', async () => {
    const deB = await crearColaborador(ajeno, 'Persona de B');
    expect(codigo(await adelanto(dueno, { colaboradorId: deB.id, montoCentimos: 100 }))).toBe('no_encontrado');
    const retirado = await crearColaborador(dueno, 'Retirado');
    datos(await dueno.herramienta('colaborador_archivar', { id: retirado.id }));
    expect(mensaje(await adelanto(dueno, { colaboradorId: retirado.id, montoCentimos: 100 }))).toMatch(/archivado/);
  });

  it('idempotencia: la misma clave no registra dos veces, ni emite dos eventos, ni gasta dos números', async () => {
    const clave = `ade-${randomUUID()}`;
    const antes = (await eventosDe(appPool, empresaA, 'adelanto.registrado')).length;
    const args = { colaboradorId: rosa.id, montoCentimos: 777 };
    const a = datos(await adelanto(dueno, args, clave));
    const b = datos(await adelanto(dueno, args, clave));
    expect(b.id).toBe(a.id);
    expect((await eventosDe(appPool, empresaA, 'adelanto.registrado')).length).toBe(antes + 1);
    expect(codigo(await adelanto(dueno, { ...args, montoCentimos: 778 }, clave))).toBe('conflicto');
    const siguiente = datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 1 }));
    expect(siguiente.numero).toBe(a.numero + 1);
  });

  it('correlativos sin huecos ni repetidos con registros simultáneos', async () => {
    const lote = await Promise.all(Array.from({ length: 6 }, (_, i) => adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 1000 + i })));
    const numeros = lote.map((r) => datos(r).numero as number).sort((x, y) => x - y);
    expect(new Set(numeros).size).toBe(6);
    expect(numeros.at(-1)! - numeros[0]!).toBe(5);
    const todos = datos(await dueno.herramienta('adelantos_listar', { estado: 'todos', limite: 100 })).items.map((i: any) => i.numero as number).sort((x: number, y: number) => x - y);
    expect(todos).toEqual(todos.map((_: number, i: number) => i + 1));
  });
});

describe('adelanto_anular', () => {
  it('es crítica: pide confirmación sin cambiar nada; anula, emite el evento y conserva fila, monto y código', async () => {
    const a = datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 4_550 }));
    const args = { id: a.id, motivo: 'Se registró dos veces' };
    const pide = await dueno.herramienta('adelanto_anular', args);
    expect(pide.cuerpo.requiereConfirmacion.token).toBeTruthy();
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain('S/ 45.50');
    expect(datos(await lector.herramienta('adelantos_listar', { colaboradorId: rosa.id, limite: 100 })).items.find((i: any) => i.id === a.id).estado).toBe('registrado');
    const r = datos(await confirmarCritica(dueno, 'adelanto_anular', args));
    expect(r).toMatchObject({ id: a.id, codigo: a.codigo, estado: 'anulado', montoCentimos: 4_550, motivoAnulacion: 'Se registró dos veces', anuladoPor: dueno.usuarioId });
    expect(r.anuladoEn).not.toBeNull();
    const eventos = await eventosDe(appPool, empresaA, 'adelanto.anulado');
    expect(eventos.at(-1)).toEqual({ tipo: 'adelanto.anulado', carga: { adelantoId: a.id, colaboradorId: rosa.id, montoCentimos: 4_550 } });
    expect(JSON.stringify(await auditoriaDe(appPool, empresaA))).not.toContain('dos veces');
    // Ya anulado: no se anula otra vez, y su número no se reutiliza.
    expect(codigo(await confirmarCritica(dueno, 'adelanto_anular', args))).toBe('conflicto');
    expect(datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 10 })).numero).toBeGreaterThan(a.numero);
  });

  it('exige motivo, id válido; otra empresa y un inexistente son no_encontrado', async () => {
    const a = datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 50 }));
    expect(codigo(await dueno.herramienta('adelanto_anular', { id: a.id, motivo: '' }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('adelanto_anular', { id: 'no-es-uuid', motivo: 'x' }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('adelanto_anular', { id: randomUUID(), motivo: 'x' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('adelanto_anular', { id: a.id, motivo: 'x' }))).toBe('no_encontrado');
  });

  it('un adelanto no se borra ni se edita: la base lo impide aunque se intente', async () => {
    const a = datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 60 }));
    await expect(comoEmpresa(appPool, empresaA, (c) => c.query('delete from personal.adelantos where id = $1', [a.id]))).rejects.toThrow();
    await expect(comoEmpresa(appPool, empresaA, (c) => c.query('update personal.adelantos set monto_centimos = 1 where id = $1', [a.id]))).rejects.toThrow();
    expect(datos(await dueno.herramienta('adelantos_listar', { colaboradorId: rosa.id, limite: 100 })).items.find((i: any) => i.id === a.id).montoCentimos).toBe(60);
  });

  it('un member de lectura no registra ni anula; ve los adelantos', async () => {
    const a = datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 70 }));
    expect(codigo(await adelanto(lector, { colaboradorId: rosa.id, montoCentimos: 70 }))).toBe('modulo_solo_lectura');
    expect(codigo(await lector.herramienta('adelanto_anular', { id: a.id, motivo: 'x' }))).toBe('modulo_solo_lectura');
    expect(datos(await lector.herramienta('adelantos_listar', { limite: 100 })).items.some((i: any) => i.id === a.id)).toBe(true);
  });
});

describe('adelantos_listar, alcance «propios» y personal_resumen', () => {
  it('filtra por estado, colaborador y fechas, y pagina con cursor', async () => {
    const lista = (args: object) => dueno.herramienta('adelantos_listar', { colaboradorId: rosa.id, limite: 100, ...args });
    const vigentes = datos(await lista({})).items;
    const anulados = datos(await lista({ estado: 'anulados' })).items;
    const todos = datos(await lista({ estado: 'todos' })).items;
    expect(vigentes.every((i: any) => i.estado === 'registrado')).toBe(true);
    expect(anulados.length).toBeGreaterThan(0);
    expect(todos.length).toBe(vigentes.length + anulados.length);
    expect(datos(await lista({ estado: 'todos', desde: '2026-01-02', hasta: '2026-01-02' })).items.map((i: any) => i.fecha)).toEqual(['2026-01-02']);
    const p1 = datos(await lista({ limite: 2 }));
    expect(p1.items).toHaveLength(2);
    const p2 = datos(await lista({ limite: 2, cursor: p1.siguiente }));
    expect(p2.items[0].id).not.toBe(p1.items[0].id);
    expect(codigo(await lista({ cursor: 'basura' }))).toBe('argumentos_invalidos');
    expect(codigo(await lista({ desde: '2026-02-01', hasta: '2026-01-01' }))).toBe('argumentos_invalidos');
    expect(datos(await ajeno.herramienta('adelantos_listar', { limite: 100, estado: 'todos' })).items).toEqual([]);
  });

  it('con alcance «propios» solo ve y anula lo que registró; el resumen se le niega', async () => {
    const mio = datos(await adelanto(propio, { colaboradorId: rosa.id, montoCentimos: 90 }));
    const delDueno = datos(await adelanto(dueno, { colaboradorId: rosa.id, montoCentimos: 91 }));
    const visibles = datos(await propio.herramienta('adelantos_listar', { limite: 100, estado: 'todos' })).items.map((i: any) => i.id);
    expect(visibles).toEqual([mio.id]);
    expect(datos(await propio.herramienta('colaborador_ver', { id: rosa.id })).adelantos.map((i: any) => i.id)).toEqual([mio.id]);
    expect(codigo(await propio.herramienta('adelanto_anular', { id: delDueno.id, motivo: 'x' }))).toBe('no_encontrado');
    expect(datos(await confirmarCritica(propio, 'adelanto_anular', { id: mio.id, motivo: 'Me equivoqué' })).estado).toBe('anulado');
    const r = await propio.herramienta('personal_resumen', { desde: '2026-01-01', hasta: '2026-12-31' });
    expect(codigo(r)).toBe('sin_permiso');
  });

  it('personal_resumen: activos, marcas de hoy, asistencias por estado y adelantos vigentes (sin anulados)', async () => {
    const hoy = await hoyDe(dueno);
    const desde = `${anio}-01-01`;
    const hasta = `${anio}-12-31`;
    const antes = datos(await dueno.herramienta('personal_resumen', { desde, hasta }));
    const nuevo = await crearColaborador(dueno, 'Para el resumen');
    datos(await dueno.herramienta('asistencia_marcar', { colaboradorId: nuevo.id, estado: 'presente', entrada: true }));
    const a = datos(await adelanto(dueno, { colaboradorId: nuevo.id, montoCentimos: 2_500 }));
    const b = datos(await adelanto(dueno, { colaboradorId: nuevo.id, montoCentimos: 1_000 }));
    datos(await confirmarCritica(dueno, 'adelanto_anular', { id: b.id, motivo: 'error' }));
    const r = datos(await dueno.herramienta('personal_resumen', { desde, hasta }));
    expect(r.colaboradoresActivos).toBe(antes.colaboradoresActivos + 1);
    expect(r.hoy).toEqual({ fecha: hoy, marcados: antes.hoy.marcados + 1, sinMarcar: antes.hoy.sinMarcar });
    expect(r.adelantos.totalCentimos).toBe(antes.adelantos.totalCentimos + a.montoCentimos);
    expect(r.adelantos.anulados).toBe(antes.adelantos.anulados + 1);
    expect(r.asistenciasPorEstado.find((e: any) => e.estado === 'presente').cantidad).toBe(antes.asistenciasPorEstado.find((e: any) => e.estado === 'presente').cantidad + 1);
    expect(codigo(await dueno.herramienta('personal_resumen', { desde: hasta, hasta: desde }))).toBe('argumentos_invalidos');
    expect(datos(await ajeno.herramienta('personal_resumen', { desde, hasta })).adelantos).toEqual({ cantidad: 0, totalCentimos: 0, anulados: 0 });
  });
});
