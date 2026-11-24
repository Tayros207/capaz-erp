import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { lastValueFrom, toArray } from 'rxjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EventoDelAgente, TurnoDelAgente } from '@capaz/shared';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, conEmpresaDePruebas } from '../../pruebas/base-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { MODELO_DE_CHAT } from './modelo-de-chat.js';
import { guion, ModeloSimulado } from './modelo-simulado.js';
import { ServicioDeTurnos } from './servicio-de-turnos.js';

// El asistente ESCRIBE de verdad (dinero incluido), por el ejecutor real y con huella. Cada prueba mira tres cosas: qué quedó en
// el ERP, qué quedó en la huella (`core.agente_acciones`) y qué le contestó el ejecutor al modelo.

let app: AppDePruebas;
let appPool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let modelo: ModeloSimulado;
let servicio: ServicioDeTurnos;
let P: { sesion: Sesion; empresa: string; ctx: ContextoDeHerramienta };

const cuerpo = (mensaje = 'haz esto'): TurnoDelAgente => ({ turnoId: randomUUID(), mensaje, origen: 'texto' });
const como = () => ({ empresaId: P.empresa, usuarioId: P.sesion.usuarioId });
const filas = async (consulta: string) => conEmpresa(como(), async (tx) => (await tx.execute(sql.raw(consulta))).rows as Record<string, unknown>[]);
async function turno(c: TurnoDelAgente): Promise<EventoDelAgente[]> {
  const eventos = await lastValueFrom(servicio.iniciar(P.ctx, c).pipe(toArray()));
  return eventos.map((e) => e.data as EventoDelAgente);
}
/** Lo que el modelo recibió como resultado de su última herramienta. */
const ultimoResultado = () => JSON.parse((modelo.peticiones.at(-1)!.mensajes.at(-1) as { content: string }).content);
const movimientos = () => filas(`select id, estado from registro.movimientos`);

/** Una persona nueva con su empresa: el ritmo de turnos es por persona, y cada prueba necesita su propio hilo. */
async function personaNueva(nombre: string): Promise<typeof P> {
  const sesion = await abrirSesion(app, nombre);
  const empresa = await crearEmpresa(sesion, `Imprenta de ${nombre}`);
  return { sesion, empresa, ctx: (await app.obtener(ServicioDeAcceso).contextoDe(empresa, sesion.usuarioId, 'ui', 'prueba'))! };
}

beforeAll(async () => {
  process.env.AGENTE_PROVEEDOR = 'simulado';
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(appPool);
  modelo = app.obtener<ModeloSimulado>(MODELO_DE_CHAT as unknown as symbol);
  servicio = app.obtener(ServicioDeTurnos);
  P = await personaNueva('Dueña que escribe');
});
afterAll(async () => {
  delete process.env.AGENTE_PROVEEDOR;
  await app.cerrar();
  await appPool.end();
});

const ingreso = (montoCentimos: number, extra: Record<string, unknown> = {}) => ({ tipo: 'ingreso', montoCentimos, descripcion: 'Venta de tarjetas', ...extra });

describe('el dinero que el asistente mueve solo', () => {
  it('un ingreso chico de hoy se registra, queda en la auditoría del ERP Y en la huella del asistente (argumentos y resultado)', async () => {
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(25_000))], guion.respuesta('Registré el ingreso de S/ 250.00.')]);
    const eventos = await turno(cuerpo());
    expect(eventos.find((e) => e.type === 'accion')).toMatchObject({ herramienta: 'movimiento_registrar' });
    expect(await movimientos()).toHaveLength(1);
    const huella = await filas(`select politica, resultado, modelo, herramienta, args->>'montoCentimos' as monto, despues->>'estado' as estado from core.agente_acciones where herramienta = 'movimiento_registrar'`);
    expect(huella).toEqual([{ politica: 'directo', resultado: 'ok', modelo: 'deepseek/deepseek-v4.1-flash-1017', herramienta: 'movimiento_registrar', monto: '25000', estado: expect.any(String) }]);
    expect(await filas(`select canal, resultado from core.auditoria where herramienta = 'movimiento_registrar'`)).toEqual([{ canal: 'agente', resultado: 'ok' }]);
  });

  it('más de S/ 1,000 en una operación NO se mueve: queda como borrador del asistente, con su huella', async () => {
    const antes = (await movimientos()).length;
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(150_000))], guion.respuesta('Quedó para aprobar.')]);
    const eventos = await turno(cuerpo());
    expect((await movimientos()).length).toBe(antes);
    expect(eventos.find((e) => e.type === 'borrador')).toBeDefined();
    expect(await filas(`select origen, estado, herramienta from core.borradores where origen = 'agente' and herramienta = 'movimiento_registrar'`)).toEqual([{ origen: 'agente', estado: 'pendiente', herramienta: 'movimiento_registrar' }]);
    expect(await filas(`select politica, resultado from core.agente_acciones where resultado = 'propuesta'`)).toEqual([{ politica: 'propuesta', resultado: 'propuesta' }]);
  });

  it('con una fecha que no es hoy tampoco: el asistente solo registra dinero con la fecha de hoy', async () => {
    const antes = (await movimientos()).length;
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(1_000, { fecha: '2020-01-01' }))], guion.respuesta('Pendiente de aprobar.')]);
    await turno(cuerpo());
    expect((await movimientos()).length).toBe(antes);
    expect(ultimoResultado().datos.motivo).toContain('fecha de hoy');
  });

  it('la misma operación de dinero repetida hace poco se rechaza (no se duplica un cobro)', async () => {
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(25_000))], guion.respuesta('No lo repito.')]);
    const antes = (await movimientos()).length;
    await turno(cuerpo());
    expect((await movimientos()).length).toBe(antes);
    expect(ultimoResultado().error.mensaje).toContain('ya se hizo');
  });

  it('cambiar solo la descripción no vuelve «distinta» una operación: se rechaza igual (no se duplica un cobro)', async () => {
    const antes = (await movimientos()).length;
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(25_000, { descripcion: 'Venta de tarjetas (otra vez)' }))], guion.respuesta('No lo repito.')]);
    await turno(cuerpo());
    expect((await movimientos()).length).toBe(antes);
    expect(ultimoResultado().error.mensaje).toContain('ya se hizo');
  });

  it('si el sistema ya dejó una propuesta pendiente para ese cliente, el asistente no crea la deuda a mano', async () => {
    const contactoId = randomUUID();
    await filas(`insert into core.borradores (tenant_id, herramienta, modulo, args, args_originales, resumen, origen, propuesto_por) values (current_setting('app.tenant_id'), 'deuda_crear', 'registro', '{"contactoId":"${contactoId}"}', '{}', 'Deuda del pedido', 'modulo', 'sistema')`);
    modelo.programar([[guion.llamar('c1', 'deuda_crear', { tipo: 'por_cobrar', contactoId, concepto: 'Pedido 1', totalCentimos: 50_000 })], guion.respuesta('Ya estaba propuesta.')]);
    await turno(cuerpo());
    expect(ultimoResultado().error.mensaje).toContain('El sistema ya dejó una propuesta');
  });

  it('con el freno de dinero de la empresa apagado, todo el dinero queda como borrador aunque lo demás siga directo', async () => {
    const F = await abrirSesion(app, 'Dueña con freno de dinero');
    const empresa = await crearEmpresa(F, 'Imprenta con freno de dinero');
    await conEmpresa({ empresaId: empresa, usuarioId: F.usuarioId }, (tx) => tx.execute(sql.raw(`insert into core.agente_configuracion (tenant_id, dinero_directo, actualizado_por) values ('${empresa}', false, 'prueba')`)));
    const ctx = (await app.obtener(ServicioDeAcceso).contextoDe(empresa, F.usuarioId, 'ui', 'prueba'))!;
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(1_000))], guion.respuesta('Pendiente.')]);
    await lastValueFrom(servicio.iniciar(ctx, cuerpo()).pipe(toArray()));
    const hechos = await conEmpresa({ empresaId: empresa, usuarioId: F.usuarioId }, async (tx) => (await tx.execute(sql.raw(`select count(*)::int as n from registro.movimientos`))).rows[0]);
    expect(hechos).toEqual({ n: 0 });
  });
});

describe('una acción crítica: confirmación propia del asistente', () => {
  beforeEach(async () => {
    P = await personaNueva(`Dueña ${randomUUID().slice(0, 6)}`);
  });

  it('la primera llamada solo pide confirmar (sin hacer nada y sin mostrarle el token al modelo); repetida en el paso siguiente se ejecuta', async () => {
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(40_000, { descripcion: 'Para anular' }))], guion.respuesta('ok')]);
    await turno(cuerpo());
    const [{ id }] = (await filas(`select id from registro.movimientos where monto_centimos = 40000`)) as { id: string }[];
    const anular = { id, motivo: 'Lo pidió la dueña' };
    modelo.programar([[guion.llamar('c2', 'movimiento_anular', anular)], [guion.llamar('c3', 'movimiento_anular', anular)], guion.respuesta('Anulado.')]);
    await turno(cuerpo('anula ese ingreso'));
    // Primer paso: pendiente, y el modelo no vio ningún token.
    const primero = JSON.parse((modelo.peticiones.at(-2)!.mensajes.at(-1) as { content: string }).content);
    expect(primero.datos.pendiente).toBe(true);
    expect(JSON.stringify(primero)).not.toContain('token');
    // Segundo paso: hecho.
    expect(ultimoResultado().ok).toBe(true);
    expect(await filas(`select estado from registro.movimientos where id = '${id}'`)).toEqual([{ estado: 'anulado' }]);
    expect(await filas(`select politica, resultado from core.agente_acciones where herramienta = 'movimiento_anular' order by creado_en`)).toEqual([
      { politica: 'confirmada', resultado: 'pendiente_confirmacion' },
      { politica: 'confirmada', resultado: 'ok' },
    ]);
  });

  it('una crítica de dinero (corregir un movimiento) con un monto grande NO pide confirmación: pasa por las guardas y queda como borrador', async () => {
    modelo.programar([[guion.llamar('c0', 'movimiento_registrar', ingreso(30_000, { descripcion: 'Para corregir' }))], guion.respuesta('ok')]);
    await turno(cuerpo());
    const [{ id }] = (await filas(`select id from registro.movimientos where monto_centimos = 30000`)) as { id: string }[];
    modelo.programar([[guion.llamar('c1', 'movimiento_corregir', { id, montoCentimos: 5_000_000 })], guion.respuesta('Quedó para aprobar.')]);
    await turno(cuerpo());
    expect(ultimoResultado().datos.propuesto).toBe(true);
    expect(await filas(`select monto_centimos from registro.movimientos where id = '${id}'`)).toEqual([{ monto_centimos: '30000' }]);
  });

  it('si el modelo repite la llamada en el MISMO paso, sigue pendiente: no hay confirmación sin una vuelta de por medio', async () => {
    modelo.programar([[guion.llamar('c1', 'movimiento_registrar', ingreso(41_000, { descripcion: 'Otro' }))], guion.respuesta('ok')]);
    await turno(cuerpo());
    const hecho = (await filas(`select id from registro.movimientos where monto_centimos = 41000`)) as { id: string }[];
    expect(hecho, JSON.stringify(ultimoResultado())).toHaveLength(1);
    const [{ id }] = hecho as [{ id: string }];
    const anular = { id, motivo: 'x' };
    modelo.programar([[guion.llamarVarias([{ id: 'c2', nombre: 'movimiento_anular', args: anular }, { id: 'c3', nombre: 'movimiento_anular', args: anular }])], guion.respuesta('Pendiente.')]);
    await turno(cuerpo());
    expect(await filas(`select estado from registro.movimientos where id = '${id}'`)).toEqual([{ estado: 'activo' }]);
  });

  it('lo que decide una persona (cerrar la semana) siempre queda como borrador, aunque sea crítico', async () => {
    modelo.programar([[guion.llamar('c1', 'herramienta_llamar', { nombre: 'semana_cerrar', args: { desde: '2026-11-16', conteos: [{ cuentaId: randomUUID(), contadoCentimos: 0 }] } })], guion.respuesta('Pendiente.')]);
    await turno(cuerpo());
    expect(await filas(`select estado from core.borradores where herramienta = 'semana_cerrar' and origen = 'agente'`)).toEqual([{ estado: 'pendiente' }]);
  });
});

describe('la huella no se toca', () => {
  it('nadie puede cambiar ni borrar lo que quedó anotado', async () => {
    await expect(filas(`update core.agente_acciones set herramienta = 'otra'`)).rejects.toThrow();
    await expect(filas(`delete from core.agente_acciones`)).rejects.toThrow();
  });
});
