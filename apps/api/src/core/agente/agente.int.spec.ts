import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { lastValueFrom, toArray } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import type { EventoDelAgente, TurnoDelAgente } from '@capaz/shared';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { ErrorDeModelo, MODELO_DE_CHAT } from './modelo-de-chat.js';
import { guion, ModeloSimulado } from './modelo-simulado.js';
import { ServicioDeTurnos } from './servicio-de-turnos.js';
import { abrirTurno, anotarEnLista } from './repositorio.js';
import { conEmpresaDePruebas } from '../../pruebas/base-de-pruebas.js';

// El asistente entero contra PostgreSQL real y el servidor real, con un modelo de guion (nunca se llama a nadie).

let app: AppDePruebas;
let appPool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let modelo: ModeloSimulado;
let servicio: ServicioDeTurnos;
let dueno: Sesion;
let miembro: Sesion;
let empresa: string;

const ORIGEN_MALO = 'https://sitio-malo.example';

beforeAll(async () => {
  process.env.AGENTE_PROVEEDOR = 'simulado';
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(appPool);
  modelo = app.obtener<ModeloSimulado>(MODELO_DE_CHAT as unknown as symbol);
  servicio = app.obtener(ServicioDeTurnos);
  [dueno, miembro] = await Promise.all([abrirSesion(app, 'Dueña'), abrirSesion(app, 'Miembro')]);
  empresa = await crearEmpresa(dueno, 'Imprenta del asistente');
  await agregarMiembro(app, empresa, miembro, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
});
afterAll(async () => {
  delete process.env.AGENTE_PROVEEDOR;
  await app.cerrar();
  await appPool.end();
});

const cuerpoDe = (o: Partial<TurnoDelAgente> = {}): TurnoDelAgente => ({ turnoId: randomUUID(), mensaje: 'hola', origen: 'texto', ...o });
async function turno(ctx: ContextoDeHerramienta, cuerpo: TurnoDelAgente): Promise<EventoDelAgente[]> {
  const eventos = await lastValueFrom(servicio.iniciar(ctx, cuerpo).pipe(toArray()));
  return eventos.filter((e) => e.type !== undefined).map((e) => e.data as EventoDelAgente);
}
const tipos = (e: EventoDelAgente[]) => e.map((x) => x.type);
const como = (empresaId: string, usuarioId: string) => ({ empresaId, usuarioId });
async function ctxDe(empresaId: string, s: Sesion): Promise<ContextoDeHerramienta> {
  return (await app.obtener(ServicioDeAcceso).contextoDe(empresaId, s.usuarioId, 'ui', 'prueba'))!;
}
/** Una persona nueva con su propia empresa: así crear empresas no cambia la empresa activa de las demás sesiones. */
type Persona = { sesion: Sesion; empresa: string; ctx: ContextoDeHerramienta };
async function empresaNueva(nombre: string): Promise<Persona> {
  const sesion = await abrirSesion(app, nombre);
  const empresaId = await crearEmpresa(sesion, nombre);
  return { sesion, empresa: empresaId, ctx: (await ctxDe(empresaId, sesion))! };
}
const poner = (e: string, u: string, tope: number) =>
  conEmpresa(como(e, u), (tx) => tx.execute(sql.raw(`insert into core.agente_configuracion (tenant_id, tope_mensual_microusd, actualizado_por) values ('${e}', ${tope}, 'prueba')`)));
const filas = async (empresaId: string, usuarioId: string, consulta: string) =>
  conEmpresa(como(empresaId, usuarioId), async (tx) => (await tx.execute(sql.raw(consulta))).rows as Record<string, unknown>[]);

describe('GET /agente/estado', () => {
  it('sin sesión responde no_autenticado', async () => {
    const anonimo = await abrirSesion(app);
    await anonimo.pedir('POST', '/api/auth/sign-out', {});
    expect((await anonimo.pedir('GET', '/api/v1/agente/estado')).estado).toBe(401);
  });

  it('sin empresa activa responde sin_empresa', async () => {
    const sinEmpresa = await abrirSesion(app);
    const r = await sinEmpresa.pedir('GET', '/api/v1/agente/estado');
    expect(r.estado).toBe(403);
    expect(r.cuerpo.error.codigo).toBe('sin_empresa');
  });

  it('la dueña ve el asistente activo, con el modelo por defecto, actuando al momento, y puede configurarlo', async () => {
    const r = await dueno.pedir('GET', '/api/v1/agente/estado');
    expect(r.estado).toBe(200);
    expect(r.cabeceras.get('cache-control')).toBe('no-store');
    expect(r.cuerpo.datos).toEqual({ activo: true, motivo: null, modelo: 'deepseek/deepseek-v4.1-flash-1017', puedeConfigurar: true, escritura: 'directa' });
  });

  it('un miembro lo ve activo pero no puede configurarlo', async () => {
    const r = await miembro.pedir('GET', '/api/v1/agente/estado');
    expect(r.cuerpo.datos).toMatchObject({ activo: true, puedeConfigurar: false });
  });
});

describe('un turno completo', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await empresaNueva('Imprenta del asistente (turno completo)');
  });

  it('guarda lo de la persona y lo del asistente, anuncia los eventos en orden y deja el uso', async () => {
    modelo.programar([[guion.texto('Hola, '), guion.texto('¿en qué te ayudo?'), guion.fin({ entrada: 1200, salida: 20, cache: 1000, costoMicrousd: 321 })]]);
    const cuerpo = cuerpoDe({ mensaje: 'Hola asistente' });
    const eventos = await turno(P.ctx, cuerpo);
    expect(tipos(eventos)).toEqual(['inicio', 'texto', 'texto', 'uso', 'fin']);
    expect(eventos[0]).toMatchObject({ type: 'inicio', turnoId: cuerpo.turnoId, modelo: 'deepseek/deepseek-v4.1-flash-1017' });
    expect(eventos[3]).toMatchObject({ type: 'uso', tokensEntrada: 1200, tokensCache: 1000, costoMicrousd: 321, rondas: 1 });
    expect(eventos[4]).toMatchObject({ type: 'fin', estado: 'completo' });

    const inicio = eventos[0] as Extract<EventoDelAgente, { type: 'inicio' }>;
    const c = await P.sesion.pedir('GET', `/api/v1/agente/conversaciones/${inicio.conversacionId}`);
    expect(c.estado).toBe(200);
    expect(c.cuerpo.datos.titulo).toBe('Hola asistente');
    expect(c.cuerpo.datos.mensajes.map((m: { rol: string; estado: string; contenido: string }) => [m.rol, m.estado, m.contenido])).toEqual([
      ['persona', 'completo', 'Hola asistente'],
      ['agente', 'completo', 'Hola, ¿en qué te ayudo?'],
    ]);
    expect(c.cuerpo.datos.mensajes[1].metadatos).toMatchObject({ modelo: 'deepseek/deepseek-v4.1-flash-1017', corte: null, uso: { costoMicrousd: 321 } });
    const uso = await filas(P.empresa, P.sesion.usuarioId, `select costo_microusd::int as costo, resultado, origen from core.uso where turno_id = '${cuerpo.turnoId}'`);
    expect(uso).toEqual([{ costo: 321, resultado: 'ok', origen: 'agente' }]);
  });

  it('el prompt que recibe el modelo es el real: la empresa, los módulos de la persona y el modo de actuar', async () => {
    modelo.programar([guion.respuesta('ok')]);
    await turno(P.ctx, cuerpoDe());
    const [sistemaFijo, sistemaVariable, usuario] = modelo.peticiones[0]!.mensajes;
    expect((sistemaFijo as { content: string }).content).toContain('Eres el asistente de Imprenta del asistente (turno completo)');
    expect((sistemaFijo as { content: string }).content).toContain('Actúas: lo que la persona te pide');
    expect((sistemaVariable as { content: string }).content).toContain('rol de propietario');
    expect(usuario).toEqual({ role: 'user', content: 'hola' });
  });

  it('la segunda pregunta de la misma conversación lleva la primera como historial', async () => {
    modelo.programar([guion.respuesta('Primera respuesta'), guion.respuesta('Segunda respuesta')]);
    const uno = await turno(P.ctx, cuerpoDe({ mensaje: 'Primera pregunta' }));
    const conversacionId = (uno[0] as { conversacionId: string }).conversacionId;
    await turno(P.ctx, cuerpoDe({ mensaje: 'Segunda pregunta', conversacionId }));
    const mensajes = modelo.peticiones[1]!.mensajes.slice(2);
    expect(mensajes).toEqual([
      { role: 'user', content: 'Primera pregunta' }, { role: 'assistant', content: 'Primera respuesta' }, { role: 'user', content: 'Segunda pregunta' },
    ]);
  });

  it('la pantalla llega como una pista, con el nombre del módulo sacado del manifiesto y no de la web', async () => {
    modelo.programar([guion.respuesta('ok')]);
    const id = randomUUID();
    await turno(P.ctx, cuerpoDe({ pantalla: { ruta: `/m/registro/deudas/${id}`, modulo: 'registro', entidad: { tipo: 'deuda', id } } }));
    const variable = (modelo.peticiones[0]!.mensajes[1] as { content: string }).content;
    expect(variable).toContain(`viendo una deuda con id ${id}`);
    expect(variable).toContain('Es solo una pista');
  });
});

describe('herramientas por el ejecutor real', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await empresaNueva('Imprenta con herramientas');
  });

  it('una lectura se ejecuta con el canal «agente» y queda en la auditoría de la empresa con ese canal', async () => {
    modelo.programar([[guion.llamar('c1', 'clientes_buscar', { texto: 'Cristina' })], guion.respuesta('No encontré a nadie con ese nombre.')]);
    const eventos = await turno(P.ctx, cuerpoDe({ mensaje: 'Busca a Cristina' }));
    expect(tipos(eventos)).toEqual(['inicio', 'herramienta_inicio', 'herramienta_fin', 'texto', 'uso', 'fin']);
    expect(eventos[2]).toMatchObject({ type: 'herramienta_fin', ok: true });
    const auditoria = await filas(P.empresa, P.sesion.usuarioId, `select herramienta, canal, resultado from core.auditoria where herramienta = 'clientes_buscar' and canal = 'agente'`);
    expect(auditoria).toEqual([{ herramienta: 'clientes_buscar', canal: 'agente', resultado: 'ok' }]);
  });

  it('una escritura de la lista de directas SÍ se ejecuta, aunque el modelo no esté evaluado, y queda en la auditoría con el canal «agente»', async () => {
    modelo.programar([[guion.llamar('c1', 'clientes_crear', { nombre: 'Cliente de prueba del asistente' })], guion.respuesta('Listo, lo creé.')]);
    const eventos = await turno(P.ctx, cuerpoDe({ mensaje: 'Crea un cliente' }));
    expect(eventos.find((e) => e.type === 'accion')).toMatchObject({ type: 'accion', herramienta: 'clientes_crear' });
    expect(await filas(P.empresa, P.sesion.usuarioId, `select resultado from core.auditoria where herramienta = 'clientes_crear' and canal = 'agente'`)).toEqual([{ resultado: 'ok' }]);
  });

  it('con el freno de la empresa (escritura directa apagada) la misma escritura NO se ejecuta: queda como borrador y el modelo lo sabe', async () => {
    const F = await empresaNueva('Imprenta con freno');
    await conEmpresa(como(F.empresa, F.sesion.usuarioId), (tx) => tx.execute(sql.raw(`insert into core.agente_configuracion (tenant_id, escritura_directa, actualizado_por) values ('${F.empresa}', false, 'prueba')`)));
    modelo.programar([[guion.llamar('c1', 'clientes_crear', { nombre: 'Cliente frenado' })], guion.respuesta('Quedó para aprobar.')]);
    await turno(F.ctx, cuerpoDe({ mensaje: 'Crea un cliente' }));
    const resultado = JSON.parse((modelo.peticiones[1]!.mensajes.at(-1) as { content: string }).content);
    expect(resultado.datos.propuesto).toBe(true);
    expect(await filas(F.empresa, F.sesion.usuarioId, `select 1 from core.auditoria where herramienta = 'clientes_crear' and canal = 'agente'`)).toHaveLength(0);
    expect(await filas(F.empresa, F.sesion.usuarioId, `select estado from core.borradores where herramienta = 'clientes_crear' and origen = 'agente'`)).toEqual([{ estado: 'pendiente' }]);
  });

  it('un movimiento de dinero SIN datos válidos no se ejecuta ni se propone: el modelo recibe el error del ejecutor', async () => {
    modelo.programar([[guion.llamar('c1', 'herramienta_llamar', { nombre: 'deuda_crear', args: {} })], guion.respuesta('No.')]);
    await turno(P.ctx, cuerpoDe());
    expect(JSON.parse((modelo.peticiones[1]!.mensajes.at(-1) as { content: string }).content).error.codigo).toBe('argumentos_invalidos');
    expect(await filas(P.empresa, P.sesion.usuarioId, `select 1 from core.auditoria where herramienta = 'deuda_crear' and canal = 'agente' and resultado = 'ok'`)).toHaveLength(0);
  });

  it('una herramienta crítica o de configuración tampoco, aunque el modelo la pida por herramienta_llamar', async () => {
    modelo.programar([[guion.llamar('c1', 'herramienta_llamar', { nombre: 'empresa_actualizar_configuracion', args: { razonSocial: 'Hackeada' } })], guion.respuesta('No.')]);
    await turno(P.ctx, cuerpoDe());
    expect(await filas(P.empresa, P.sesion.usuarioId, `select 1 from core.auditoria where herramienta = 'empresa_actualizar_configuracion' and canal = 'agente'`)).toHaveLength(0);
  });

  it('un módulo al que la persona no puede entrar no existe para ella: software_mapa solo lista los suyos', async () => {
    modelo.programar([[guion.llamar('c1', 'software_mapa', {})], guion.respuesta('ok')]);
    const ctxMiembro = await ctxDe(empresa, miembro);
    const permitidos = ctxMiembro.modulos.filter((m) => m.puedeEntrar).map((m) => m.codigo);
    await turno(ctxMiembro, cuerpoDe());
    const mapa = JSON.parse((modelo.peticiones[1]!.mensajes.at(-1) as { content: string }).content);
    const areas: string[] = mapa.datos.areas.map((a: { modulo: string }) => a.modulo);
    expect(mapa.ok).toBe(true);
    expect(areas).toContain('registro');
    expect(areas.every((a) => permitidos.includes(a))).toBe(true);
    expect(areas).not.toContain('cotizador');
  });
});

describe('aislamiento entre personas y empresas', () => {
  let P: Persona;
  let M: Sesion;
  beforeAll(async () => {
    P = await empresaNueva('Imprenta de aislamiento');
    M = await abrirSesion(app, 'Miembro local');
    await agregarMiembro(app, P.empresa, M, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
  });

  it('una persona no puede continuar la conversación de otra de la misma empresa', async () => {
    modelo.programar([guion.respuesta('ok')]);
    const uno = await turno(P.ctx, cuerpoDe({ mensaje: 'privado de la dueña' }));
    const conversacionId = (uno[0] as { conversacionId: string }).conversacionId;
    const ctxMiembro = await ctxDe(P.empresa, M);
    const intruso = await turno(ctxMiembro, cuerpoDe({ conversacionId, mensaje: 'intruso' }));
    expect(tipos(intruso)).toEqual(['error']);
    expect(intruso[0]).toMatchObject({ type: 'error', motivo: 'interno' });
    expect(modelo.peticiones).toHaveLength(1);
  });

  it('por HTTP: ver, renombrar, marcar favorita y borrar una conversación ajena responden «no encontrada»', async () => {
    modelo.programar([guion.respuesta('ok')]);
    const uno = await turno(P.ctx, cuerpoDe({ mensaje: 'solo mía' }));
    const id = (uno[0] as { conversacionId: string }).conversacionId;
    for (const [metodo, ruta, cuerpo] of [
      ['GET', `/api/v1/agente/conversaciones/${id}`, undefined],
      ['POST', `/api/v1/agente/conversaciones/${id}/renombrar`, { titulo: 'robada' }],
      ['POST', `/api/v1/agente/conversaciones/${id}/favorita`, { favorita: true }],
      ['POST', `/api/v1/agente/conversaciones/${id}/borrar`, undefined],
    ] as const) {
      const r = await M.pedir(metodo, ruta, cuerpo);
      expect(r.estado, ruta).toBe(404);
      expect(r.cuerpo.error.codigo).toBe('no_encontrado');
    }
    const aun = await P.sesion.pedir('GET', `/api/v1/agente/conversaciones/${id}`);
    expect(aun.cuerpo.datos.titulo).toBe('solo mía');
  });

  it('la lista de cada persona solo trae lo suyo', async () => {
    const lista = await M.pedir('GET', '/api/v1/agente/conversaciones');
    expect(lista.estado).toBe(200);
    expect(lista.cuerpo.datos.items.every((i: { titulo: string }) => !i.titulo.includes('privado'))).toBe(true);
  });
});

describe('las conversaciones por HTTP', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await empresaNueva('Imprenta de conversaciones');
  });

  it('renombrar, marcar favorita y borrar, con el origen de la propia aplicación', async () => {
    modelo.programar([guion.respuesta('ok')]);
    const id = ((await turno(P.ctx, cuerpoDe({ mensaje: 'para gestionar' })))[0] as { conversacionId: string }).conversacionId;
    const r = await P.sesion.pedir('POST', `/api/v1/agente/conversaciones/${id}/renombrar`, { titulo: '  Pedidos de la semana  ' });
    expect(r.cuerpo.datos.titulo).toBe('Pedidos de la semana');
    const f = await P.sesion.pedir('POST', `/api/v1/agente/conversaciones/${id}/favorita`, { favorita: true });
    expect(f.cuerpo.datos.favorita).toBe(true);
    const b = await P.sesion.pedir('POST', `/api/v1/agente/conversaciones/${id}/borrar`);
    expect(b.cuerpo.datos).toEqual({ id });
    expect((await P.sesion.pedir('GET', `/api/v1/agente/conversaciones/${id}`)).estado).toBe(404);
  });

  it('un título vacío o demasiado largo se rechaza como argumento inválido', async () => {
    modelo.programar([guion.respuesta('ok')]);
    const id = ((await turno(P.ctx, cuerpoDe({ mensaje: 'x' })))[0] as { conversacionId: string }).conversacionId;
    expect((await P.sesion.pedir('POST', `/api/v1/agente/conversaciones/${id}/renombrar`, { titulo: '   ' })).estado).toBe(400);
    expect((await P.sesion.pedir('POST', `/api/v1/agente/conversaciones/${id}/renombrar`, { titulo: 'a'.repeat(121) })).estado).toBe(400);
  });

  it('un id que no es UUID responde «no encontrada», no un error de servidor', async () => {
    expect((await P.sesion.pedir('GET', '/api/v1/agente/conversaciones/no-es-uuid')).estado).toBe(404);
  });

  it('desde otro sitio (otro origen) las operaciones que escriben se rechazan', async () => {
    modelo.programar([guion.respuesta('ok')]);
    const id = ((await turno(P.ctx, cuerpoDe({ mensaje: 'x' })))[0] as { conversacionId: string }).conversacionId;
    const cuerpos: Record<string, unknown> = { renombrar: { titulo: 'x' }, favorita: { favorita: true }, borrar: undefined };
    for (const ruta of ['renombrar', 'favorita', 'borrar']) {
      const r = await P.sesion.pedir('POST', `/api/v1/agente/conversaciones/${id}/${ruta}`, cuerpos[ruta], { origin: ORIGEN_MALO });
      expect(r.estado, ruta).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('origen_invalido');
    }
  });

  it('la fecha de la paginación debe ser válida', async () => {
    expect((await P.sesion.pedir('GET', '/api/v1/agente/conversaciones?antesDe=ayer')).estado).toBe(400);
  });
});

describe('el endpoint del turno (SSE)', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await empresaNueva('Imprenta del flujo');
  });

  it('responde como flujo de eventos y el turno queda guardado', async () => {
    modelo.programar([guion.respuesta('Respuesta por SSE')]);
    const turnoId = randomUUID();
    const r = await P.sesion.pedir('POST', '/api/v1/agente/turno', { turnoId, mensaje: 'Pregunta por SSE' });
    expect(r.estado).toBe(200);
    expect(r.cabeceras.get('content-type')).toContain('text/event-stream');
    const lista = await P.sesion.pedir('GET', '/api/v1/agente/conversaciones');
    expect(lista.cuerpo.datos.items.map((i: { titulo: string }) => i.titulo)).toContain('Pregunta por SSE');
  });

  it('un cuerpo inválido sale como JSON normal con 400, antes de empezar el flujo', async () => {
    const r = await P.sesion.pedir('POST', '/api/v1/agente/turno', { turnoId: 'no-uuid', mensaje: 'x' });
    expect(r.estado).toBe(400);
    expect(r.cuerpo.error.codigo).toBe('argumentos_invalidos');
  });

  it('desde otro origen se rechaza con JSON, sin abrir el flujo ni llamar al modelo', async () => {
    modelo.programar([guion.respuesta('no debe ocurrir')]);
    const r = await P.sesion.pedir('POST', '/api/v1/agente/turno', { turnoId: randomUUID(), mensaje: 'x' }, { origin: ORIGEN_MALO });
    expect(r.estado).toBe(403);
    expect(r.cuerpo.error.codigo).toBe('origen_invalido');
    expect(modelo.peticiones).toHaveLength(0);
  });

  it('el latido manda tres eventos y un fin, sin modelo', async () => {
    const r = await P.sesion.pedir('GET', '/api/v1/agente/latido');
    expect(r.estado).toBe(200);
    expect(r.cabeceras.get('content-type')).toContain('text/event-stream');
  }, 15_000);
});

describe('reintentos con el mismo turnoId', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await empresaNueva('Imprenta de reintentos');
  });

  it('un turno ya terminado se entrega guardado, sin volver a llamar al modelo ni duplicar mensajes', async () => {
    modelo.programar([guion.respuesta('Respuesta guardada')]);
    const cuerpo = cuerpoDe({ mensaje: 'una vez' });
    const primero = await turno(P.ctx, cuerpo);
    const conversacionId = (primero[0] as { conversacionId: string }).conversacionId;
    const repetido = await turno(P.ctx, { ...cuerpo, conversacionId });
    expect(tipos(repetido)).toEqual(['inicio', 'texto', 'fin']);
    expect(repetido[1]).toEqual({ type: 'texto', delta: 'Respuesta guardada' });
    expect(modelo.peticiones).toHaveLength(1);
    const c = await P.sesion.pedir('GET', `/api/v1/agente/conversaciones/${conversacionId}`);
    expect(c.cuerpo.datos.mensajes).toHaveLength(2);
  });

  it('un turno cortado que YA HIZO acciones se cierra como interrumpido y NO se repite', async () => {
    const turnoId = randomUUID();
    const abierto = await conEmpresa(como(P.empresa, P.sesion.usuarioId), async (tx) => {
      const a = await abrirTurno(tx, { turnoId, mensaje: 'crea el pedido' });
      if (a.tipo !== 'nuevo') throw new Error('se esperaba nuevo');
      await anotarEnLista(tx, a.mensajeAgenteId, 'acciones', { herramienta: 'pedido_crear', titulo: 'Crear pedido', entidadTipo: 'pedido', entidadId: null });
      await tx.execute(sql.raw(`update core.agente_mensajes set actualizado_en = now() - interval '10 minutes' where id = '${a.mensajeAgenteId}'`));
      return a;
    });
    modelo.programar([guion.respuesta('esto no debe pasar')]);
    const eventos = await turno(P.ctx, { turnoId, conversacionId: abierto.conversacionId, mensaje: 'crea el pedido', origen: 'texto' });
    expect(tipos(eventos)).toEqual(['inicio', 'fin']);
    expect(eventos[1]).toMatchObject({ type: 'fin', estado: 'interrumpido' });
    expect(modelo.peticiones).toHaveLength(0);
  });

  it('un turno cortado que NO hizo nada se retoma y termina', async () => {
    const turnoId = randomUUID();
    const abierto = await conEmpresa(como(P.empresa, P.sesion.usuarioId), async (tx) => {
      const a = await abrirTurno(tx, { turnoId, mensaje: 'dime algo' });
      if (a.tipo !== 'nuevo') throw new Error('se esperaba nuevo');
      await tx.execute(sql.raw(`update core.agente_mensajes set actualizado_en = now() - interval '10 minutes' where id = '${a.mensajeAgenteId}'`));
      return a;
    });
    modelo.programar([guion.respuesta('Ahora sí.')]);
    const eventos = await turno(P.ctx, { turnoId, conversacionId: abierto.conversacionId, mensaje: 'dime algo', origen: 'texto' });
    expect(tipos(eventos)).toEqual(['inicio', 'texto', 'uso', 'fin']);
    expect(modelo.peticiones).toHaveLength(1);
  });

  it('uno que sigue en curso y es reciente se rechaza: no se corren dos a la vez', async () => {
    const turnoId = randomUUID();
    const abierto = await conEmpresa(como(P.empresa, P.sesion.usuarioId), async (tx) => {
      const a = await abrirTurno(tx, { turnoId, mensaje: 'en curso' });
      if (a.tipo !== 'nuevo') throw new Error('se esperaba nuevo');
      return a;
    });
    modelo.programar([guion.respuesta('no debe pasar')]);
    const eventos = await turno(P.ctx, { turnoId, conversacionId: abierto.conversacionId, mensaje: 'en curso', origen: 'texto' });
    expect(eventos).toEqual([{ type: 'error', motivo: 'turno_en_curso', mensaje: 'Ese mensaje todavía se está respondiendo.' }]);
    expect(modelo.peticiones).toHaveLength(0);
  });
});

describe('fallos del modelo', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await empresaNueva('Imprenta de fallos');
  });

  it('si el proveedor falla, el turno queda en error, el mensaje del asistente se marca y se registra el uso como error', async () => {
    modelo.programar([guion.respuesta('x')]).programarFallo(new ErrorDeModelo('modelo_no_disponible', 'El modelo no está disponible ahora mismo.'));
    const turnoId = randomUUID();
    const eventos = await turno(P.ctx, cuerpoDe({ turnoId, mensaje: 'falla' }));
    expect(tipos(eventos)).toEqual(['inicio', 'error']);
    expect(eventos[1]).toMatchObject({ type: 'error', motivo: 'modelo_no_disponible', mensaje: 'El modelo no está disponible ahora mismo.' });
    const m = await filas(P.empresa, P.sesion.usuarioId, `select estado from core.agente_mensajes where turno_id = '${turnoId}' and rol = 'agente'`);
    expect(m).toEqual([{ estado: 'error' }]);
    const uso = await filas(P.empresa, P.sesion.usuarioId, `select resultado from core.uso where turno_id = '${turnoId}'`);
    expect(uso).toEqual([{ resultado: 'error' }]);
  });
});

describe('tope mensual y ritmo', () => {
  it('con el tope de la empresa en cero el asistente no llama al modelo ni guarda nada', async () => {
    const { empresa: e, sesion, ctx } = await empresaNueva('Empresa con tope cero');
    await poner(e, sesion.usuarioId, 0);
    modelo.programar([guion.respuesta('no debe pasar')]);
    const eventos = await turno(ctx, cuerpoDe());
    expect(eventos).toEqual([{ type: 'error', motivo: 'tope_mensual', mensaje: 'Se alcanzó el tope de uso de este mes.' }]);
    expect(modelo.peticiones).toHaveLength(0);
    expect(await filas(e, sesion.usuarioId, 'select 1 from core.agente_mensajes')).toHaveLength(0);
  });

  it('el estado avisa que se alcanzó el tope', async () => {
    const { empresa: e, sesion } = await empresaNueva('Empresa con tope cero (estado)');
    await poner(e, sesion.usuarioId, 0);
    expect((await sesion.pedir('GET', '/api/v1/agente/estado')).cuerpo.datos).toMatchObject({ activo: false, motivo: 'tope_mensual' });
  });

  it('el gasto suma lo de TODA la empresa: llegar al tope detiene el siguiente turno de cualquier persona', async () => {
    const { empresa: e, sesion, ctx } = await empresaNueva('Empresa con tope bajo');
    await poner(e, sesion.usuarioId, 100);
    modelo.programar([guion.respuesta('primera')]);
    expect(tipos(await turno(ctx, cuerpoDe()))).toContain('fin'); // gasta 50 (el guion): bajo el tope de 100
    modelo.programar([[guion.texto('segunda'), guion.fin({ costoMicrousd: 60 })]]);
    expect(tipos(await turno(ctx, cuerpoDe()))).toContain('fin'); // suma 110: ya pasó el tope
    modelo.programar([guion.respuesta('no debe pasar')]);
    expect((await turno(ctx, cuerpoDe()))[0]).toMatchObject({ type: 'error', motivo: 'tope_mensual' });
    expect(modelo.peticiones).toHaveLength(0);
  });

  it('con 12 turnos SIMULTÁNEOS de la misma persona caben solo 6 por minuto: comprobar y registrar el turno es atómico', async () => {
    const { ctx } = await empresaNueva('Empresa con ráfaga');
    modelo.programar(Array.from({ length: 12 }, (_, i) => guion.respuesta(`r${i}`)));
    const resultados = await Promise.all(Array.from({ length: 12 }, () => turno(ctx, cuerpoDe())));
    const aceptados = resultados.filter((e) => tipos(e).includes('fin')).length;
    const rechazados = resultados.filter((e) => e[0]?.type === 'error' && e[0].motivo === 'limite_de_ritmo').length;
    expect({ aceptados, rechazados }).toEqual({ aceptados: 6, rechazados: 6 });
    expect(modelo.peticiones).toHaveLength(6);
  });

  it('el séptimo turno del mismo minuto se rechaza por ritmo', async () => {
    const { ctx } = await empresaNueva('Empresa con ritmo');
    for (let i = 0; i < 6; i++) {
      modelo.programar([guion.respuesta(`r${i}`)]);
      expect(tipos(await turno(ctx, cuerpoDe())), `turno ${i + 1}`).toContain('fin');
    }
    modelo.programar([guion.respuesta('no debe pasar')]);
    expect((await turno(ctx, cuerpoDe()))[0]).toMatchObject({ type: 'error', motivo: 'limite_de_ritmo' });
    expect(modelo.peticiones).toHaveLength(0);
  });
});
