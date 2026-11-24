import { exito, rechazo, type AccesoDeModulo, type EventoDelAgente, type ModoDeEscritura, type Respuesta } from '@capaz/shared';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import type { ContextoDeHerramienta, HerramientaRegistrada } from '../herramientas/tipos.js';
import { AVISO_DE_LARGO, AVISO_DE_RONDAS, AVISO_DE_TOPE, MAXIMO_DE_LLAMADAS_POR_RONDA, correrTurno } from './bucle.js';
import { ErrorDeModelo, type MensajeDeModelo } from './modelo-de-chat.js';
import { guion, ModeloSimulado } from './modelo-simulado.js';
import type { DependenciasDelBucle, EntradaDelBucle } from './tipos-del-turno.js';

// El bucle entero, con un modelo de guion y un ejecutor falso: sin red, sin base de datos.

const acceso = (codigo: string, o: Partial<AccesoDeModulo> = {}): AccesoDeModulo => ({ codigo, motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null, ...o });
const ctx = (o: Partial<ContextoDeHerramienta> = {}): ContextoDeHerramienta => ({
  requestId: 'r', empresaId: 'e1', usuarioId: 'u1', rol: 'member', permisos: [], modulos: [acceso('core'), acceso('ordenes'), acceso('registro')], canal: 'agente', ...o,
});
function herr(nombre: string, o: { modulo?: string; criticidad?: HerramientaRegistrada['criticidad']; mueveDinero?: boolean } = {}): HerramientaRegistrada {
  return {
    nombre, modulo: o.modulo ?? 'ordenes', permiso: null, criticidad: o.criticidad ?? 'lectura', idempotente: false, mueveDinero: o.mueveDinero ?? false,
    ayuda: { titulo: `Título de ${nombre}`, paraQueSirve: `Para ${nombre}`, cuandoUsarla: 'Cuando haga falta', campos: [], ejemploTecleado: `ejemplo ${nombre}`, ejemploHablado: '', erroresComunes: ['x'], relacionadas: [] },
    entrada: z.strictObject({ id: z.string().optional(), texto: z.string().optional() }), salida: z.unknown(), resumir: null, auditar: null, ejecutar: async () => exito({}),
  };
}

type Llamada = { nombre: string; args: unknown; ctx: ContextoDeHerramienta; clave: string };
function montar(o: { herramientas?: HerramientaRegistrada[]; respuestas?: Record<string, Respuesta<unknown> | (() => Respuesta<unknown>)>; proponer?: DependenciasDelBucle['proponer']; permitirRonda?: DependenciasDelBucle['permitirRonda'] } = {}) {
  const modelo = new ModeloSimulado();
  const eventos: EventoDelAgente[] = [];
  const llamadas: Llamada[] = [];
  const anotado: { clave: string; elemento: unknown }[] = [];
  const herramientas = o.herramientas ?? [herr('pedidos_listar'), herr('pedido_editar', { criticidad: 'normal' }), herr('captura_proponer', { modulo: 'core', criticidad: 'normal' }), herr('miembro_quitar', { modulo: 'core', criticidad: 'critica' })];
  const dep: DependenciasDelBucle = {
    modelo,
    registro: { todas: () => herramientas, obtener: (n) => herramientas.find((h) => h.nombre === n) },
    ejecutar: async (nombre, args, op) => {
      llamadas.push({ nombre, args, ctx: op.ctx, clave: op.claveDeIdempotencia });
      const r = o.respuestas?.[nombre];
      return typeof r === 'function' ? r() : (r ?? exito({ items: [{ id: 'a' }, { id: 'b' }] }));
    },
    proponer: o.proponer,
    emitir: (e) => eventos.push(e),
    anotar: async (clave, elemento) => { anotado.push({ clave, elemento }); },
    permitirRonda: o.permitirRonda ?? (async () => true),
    reloj: (() => { let t = 1000; return () => (t += 250); })(),
  };
  return { dep, modelo, eventos, llamadas, anotado };
}
const entrada = (o: Partial<EntradaDelBucle> = {}): EntradaDelBucle => ({
  turnoId: '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c01', ctx: ctx(), modelo: 'simulado/uno', modo: 'ninguna', pantalla: null, origen: 'texto',
  prompt: { fijo: 'FIJO', variable: 'VARIABLE' }, historial: [], mensaje: 'hola', maxRondas: 6, senal: new AbortController().signal, sesion: 's1', ...o,
});
const llamar = (id: string, nombre: string, args: unknown) => [guion.llamar(id, nombre, args)];
const tipos = (e: EventoDelAgente[]) => e.map((x) => x.type);
const mensajesDeLaRonda = (m: ModeloSimulado, i: number): MensajeDeModelo[] => m.peticiones[i]!.mensajes;
const modos: ModoDeEscritura[] = ['ninguna', 'borradores', 'directa'];

describe('correrTurno · conversación simple', () => {
  it('un saludo se contesta sin herramientas: el texto sale en eventos y el turno queda completo', async () => {
    const t = montar();
    t.modelo.programar([[guion.texto('Hola, '), guion.texto('Moisés.'), guion.fin({ entrada: 300, salida: 12, cache: 100, costoMicrousd: 40 })]]);
    const r = await correrTurno(t.dep, entrada());
    expect(r).toMatchObject({ texto: 'Hola, Moisés.', estado: 'completo', corte: null, motivo: null });
    expect(tipos(t.eventos)).toEqual(['texto', 'texto']);
    expect(r.uso).toMatchObject({ tokensEntrada: 300, tokensSalida: 12, tokensCache: 100, costoMicrousd: 40, rondas: 1 });
    expect(t.llamadas).toHaveLength(0);
  });

  it('le manda al modelo: el prompt fijo, el variable (aparte), el historial y el mensaje', async () => {
    const t = montar();
    t.modelo.programar([guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ historial: [{ role: 'user', content: 'antes' }, { role: 'assistant', content: 'respuesta anterior' }], mensaje: 'ahora' }));
    expect(mensajesDeLaRonda(t.modelo, 0)).toEqual([
      { role: 'system', content: 'FIJO' }, { role: 'system', content: 'VARIABLE' },
      { role: 'user', content: 'antes' }, { role: 'assistant', content: 'respuesta anterior' }, { role: 'user', content: 'ahora' },
    ]);
  });

  it('el modelo y la sesión de la entrada llegan al proveedor', async () => {
    const t = montar();
    t.modelo.programar([guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ modelo: 'deepseek/x', sesion: 'conv-9' }));
    expect(t.modelo.peticiones[0]).toMatchObject({ modelo: 'deepseek/x', sesion: 'conv-9' });
  });

  it('la duración se mide con el reloj inyectado', async () => {
    const t = montar();
    t.modelo.programar([guion.respuesta('ok')]);
    expect((await correrTurno(t.dep, entrada())).uso.duracionMs).toBe(250);
  });
});

describe('correrTurno · herramientas', () => {
  it('una lectura se ejecuta con el canal «agente», el resultado vuelve al modelo envuelto, y se anuncia en eventos', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'pedidos_listar', { texto: 'Cristina' }), guion.respuesta('Hay 2 pedidos.')]);
    const r = await correrTurno(t.dep, entrada());
    expect(t.llamadas).toHaveLength(1);
    expect(t.llamadas[0]).toMatchObject({ nombre: 'pedidos_listar', args: { texto: 'Cristina' } });
    expect(t.llamadas[0]!.ctx.canal).toBe('agente');
    const segunda = mensajesDeLaRonda(t.modelo, 1);
    expect(segunda.at(-2)).toMatchObject({ role: 'assistant', content: null, tool_calls: [{ id: 'c1', function: { name: 'pedidos_listar' } }] });
    expect(segunda.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(JSON.parse((segunda.at(-1) as { content: string }).content)).toEqual({ ok: true, datos: { items: [{ id: 'a' }, { id: 'b' }] } });
    expect(tipos(t.eventos)).toEqual(['herramienta_inicio', 'herramienta_fin', 'texto']);
    expect(t.eventos[0]).toEqual({ type: 'herramienta_inicio', id: 'c1', nombre: 'pedidos_listar', titulo: 'Título de pedidos_listar' });
    expect(t.eventos[1]).toEqual({ type: 'herramienta_fin', id: 'c1', ok: true, nota: '2 resultados' });
    expect(r.herramientas).toEqual([{ nombre: 'pedidos_listar', ok: true }]);
    expect(r.uso.rondas).toBe(2);
  });

  it('el empresaId, el usuarioId y el canal los pone el servidor aunque el modelo intente mandarlos', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'pedidos_listar', { empresaId: 'otra', canal: 'ui' }), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    expect(t.llamadas[0]!.ctx).toMatchObject({ empresaId: 'e1', usuarioId: 'u1', canal: 'agente' });
  });

  it('la clave de idempotencia es turno:ronda:índice', async () => {
    const t = montar();
    t.modelo.programar([[{ tipo: 'fin', motivo: 'tool_calls', razonamiento: null, uso: null, llamadas: [
      { id: 'a', type: 'function', function: { name: 'pedidos_listar', arguments: '{}' } }, { id: 'b', type: 'function', function: { name: 'pedidos_listar', arguments: '{}' } },
    ] }], guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ turnoId: 'T' }));
    expect(t.llamadas.map((l) => l.clave)).toEqual(['T:1:0', 'T:1:1']);
  });

  it('argumentos que no son JSON válido: NO se ejecuta nada y el modelo recibe el aviso para reenviarlos', async () => {
    const t = montar();
    t.modelo.programar([[guion.llamar('c1', 'pedidos_listar', null, '{"texto": "Cris')], guion.respuesta('perdón')]);
    const r = await correrTurno(t.dep, entrada());
    expect(t.llamadas).toHaveLength(0);
    const aviso = JSON.parse((mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content);
    expect(aviso).toMatchObject({ ok: false, error: { codigo: 'argumentos_invalidos' } });
    expect(aviso.error.mensaje).toContain('no son JSON válido');
    expect(t.eventos.find((e) => e.type === 'herramienta_fin')).toMatchObject({ ok: false });
    expect(r.estado).toBe('completo');
  });

  it('argumentos vacíos se leen como un objeto vacío', async () => {
    const t = montar();
    t.modelo.programar([[guion.llamar('c1', 'pedidos_listar', null, '')], guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    expect(t.llamadas[0]!.args).toEqual({});
  });

  it('una herramienta que no existe devuelve un error al modelo y no llega al ejecutor', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'inventada', {}), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    expect(t.llamadas).toHaveLength(0);
    expect(JSON.parse((mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content).error.codigo).toBe('herramienta_desconocida');
  });

  it('un error del ejecutor le llega al modelo con su mensaje en español, y el evento dice «no se pudo»', async () => {
    const t = montar({ respuestas: { pedidos_listar: rechazo('no_encontrado', 'No existe ese pedido.') } });
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), guion.respuesta('No lo encontré.')]);
    await correrTurno(t.dep, entrada());
    expect(JSON.parse((mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content)).toEqual({ ok: false, error: { codigo: 'no_encontrado', mensaje: 'No existe ese pedido.' } });
    expect(t.eventos.find((e) => e.type === 'herramienta_fin')).toMatchObject({ ok: false, nota: 'no se pudo' });
  });

  it('«sin permiso» del ejecutor se anuncia como tal, sin datos', async () => {
    const t = montar({ respuestas: { pedidos_listar: rechazo('sin_permiso', 'No tienes permiso.') } });
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    expect(t.eventos.find((e) => e.type === 'herramienta_fin')).toMatchObject({ nota: 'sin permiso' });
  });

  it('un resultado enorme se recorta antes de volver al modelo', async () => {
    const grande = exito({ items: Array.from({ length: 500 }, (_, i) => ({ id: `i${i}`, nombre: 'x'.repeat(50) })) });
    const t = montar({ respuestas: { pedidos_listar: grande } });
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    const contenido = (mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content;
    expect(contenido.length).toBeLessThanOrEqual(6000);
    expect(JSON.parse(contenido).datos._recortado.total).toBe(500);
  });

  it('el razonamiento del proveedor se reenvía tal cual DENTRO del turno', async () => {
    const t = montar();
    const razonamiento = [{ type: 'reasoning.text', text: 'pienso' }];
    t.modelo.programar([[{ tipo: 'fin', motivo: 'tool_calls', razonamiento, uso: null, llamadas: [{ id: 'c1', type: 'function', function: { name: 'pedidos_listar', arguments: '{}' } }] }], guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    expect(mensajesDeLaRonda(t.modelo, 1).at(-2)).toMatchObject({ role: 'assistant', reasoning_details: razonamiento });
  });

  it('el texto de una ronda con herramientas se conserva y se le devuelve al modelo en su mensaje', async () => {
    const t = montar();
    t.modelo.programar([[guion.texto('Voy a buscar. '), guion.llamar('c1', 'pedidos_listar', {})], guion.respuesta('Listo.')]);
    const r = await correrTurno(t.dep, entrada());
    expect(r.texto).toBe('Voy a buscar. Listo.');
    expect(mensajesDeLaRonda(t.modelo, 1).at(-2)).toMatchObject({ role: 'assistant', content: 'Voy a buscar. ' });
  });

  it(`se atienden como máximo ${MAXIMO_DE_LLAMADAS_POR_RONDA} llamadas por ronda; las demás reciben un aviso`, async () => {
    const t = montar();
    const muchas = Array.from({ length: MAXIMO_DE_LLAMADAS_POR_RONDA + 4 }, (_, i) => ({ id: `c${i}`, type: 'function' as const, function: { name: 'pedidos_listar', arguments: '{}' } }));
    t.modelo.programar([[{ tipo: 'fin', motivo: 'tool_calls', razonamiento: null, uso: null, llamadas: muchas }], guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    expect(t.llamadas).toHaveLength(MAXIMO_DE_LLAMADAS_POR_RONDA);
    const tool = mensajesDeLaRonda(t.modelo, 1).filter((m) => m.role === 'tool');
    expect(tool).toHaveLength(MAXIMO_DE_LLAMADAS_POR_RONDA + 4);
    expect(JSON.parse((tool.at(-1) as { content: string }).content).error.mensaje).toContain('Demasiadas llamadas');
  });
});

describe('correrTurno · la política manda, no el modelo', () => {
  it('una herramienta prohibida no llega al ejecutor en ningún modo, ni directa ni por herramienta_llamar', async () => {
    for (const modo of modos) {
      const t = montar();
      t.modelo.programar([[guion.llamar('c1', 'miembro_quitar', { id: 'x' })], [guion.llamar('c2', 'herramienta_llamar', { nombre: 'miembro_quitar', args: { id: 'x' } })], guion.respuesta('ok')]);
      await correrTurno(t.dep, entrada({ modo }));
      expect(t.llamadas, modo).toHaveLength(0);
      const resultado = JSON.parse((mensajesDeLaRonda(t.modelo, 2).at(-1) as { content: string }).content);
      expect(resultado.error.codigo).toBe('sin_permiso');
    }
  });

  it('sin permiso de escritura, una herramienta que cambia cosas no se ejecuta aunque el modelo la nombre', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'pedido_editar', { id: 'p1' }), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ modo: 'ninguna' }));
    expect(t.llamadas).toHaveLength(0);
  });

  it('en modo «borradores», lo que cambia algo no se ejecuta: se propone, y sin proponer se rechaza', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'pedido_editar', { id: 'p1' }), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ modo: 'borradores' }));
    expect(t.llamadas).toHaveLength(0);
    expect(JSON.parse((mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content).error.codigo).toBe('sin_permiso');
  });

  it('con proponer, un cambio queda como propuesta y el modelo lo sabe; el ejecutor no se toca', async () => {
    const propuestas: string[] = [];
    const t = montar({ proponer: async (nombre) => { propuestas.push(nombre); return exito({ ok: true, propuesto: true, nota: 'Quedó como borrador.' }); } });
    t.modelo.programar([llamar('c1', 'pedido_editar', { id: 'p1' }), guion.respuesta('Propuse el cambio.')]);
    await correrTurno(t.dep, entrada({ modo: 'borradores' }));
    expect(propuestas).toEqual(['pedido_editar']);
    expect(t.llamadas).toHaveLength(0);
  });

  it('con escritura directa, lo de la lista de directas se ejecuta y queda anotado como acción', async () => {
    const t = montar({ respuestas: { pedido_editar: exito({ id: '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f' }) } });
    t.modelo.programar([llamar('c1', 'pedido_editar', { id: 'x' }), guion.respuesta('Hecho.')]);
    const r = await correrTurno(t.dep, entrada({ modo: 'directa' }));
    expect(t.llamadas).toHaveLength(1);
    expect(r.acciones).toEqual([{ herramienta: 'pedido_editar', titulo: 'Título de pedido_editar', entidadTipo: 'pedido', entidadId: '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f' }]);
    expect(t.eventos.find((e) => e.type === 'accion')).toMatchObject({ herramienta: 'pedido_editar' });
    expect(t.anotado).toEqual([{ clave: 'acciones', elemento: r.acciones[0] }]);
  });

  it('una lectura no se anota como acción', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), guion.respuesta('ok')]);
    const r = await correrTurno(t.dep, entrada({ modo: 'directa' }));
    expect(r.acciones).toEqual([]);
    expect(t.anotado).toEqual([]);
  });
});

describe('correrTurno · captura_proponer (dictado por el chat)', () => {
  const borrador = { id: 'b1', herramienta: 'movimiento_registrar', resumen: 'Ingreso de S/ 500', args: { monto: 50000 }, sugerencias: [] };
  const conBorradores = exito({ borradores: [borrador], faltan: [], pista: null, interpretadoCon: 'reglas' });

  it('funciona incluso sin permiso de escritura, con el origen real y sin tiempo medido', async () => {
    const t = montar({ respuestas: { captura_proponer: conBorradores } });
    t.modelo.programar([llamar('c1', 'captura_proponer', { texto: 'Ingreso 500 soles', origen: 'texto', transcurridoMs: 99999 }), guion.respuesta('Quedó el borrador.')]);
    await correrTurno(t.dep, entrada({ modo: 'ninguna', origen: 'voz' }));
    expect(t.llamadas[0]).toMatchObject({ nombre: 'captura_proponer', args: { texto: 'Ingreso 500 soles', modulo: 'registro', origen: 'voz', transcurridoMs: 0 } });
  });

  it('cada borrador sale como evento «borrador» y se anota en cuanto aparece', async () => {
    const t = montar({ respuestas: { captura_proponer: conBorradores } });
    t.modelo.programar([llamar('c1', 'captura_proponer', { texto: 'x' }), guion.respuesta('ok')]);
    const r = await correrTurno(t.dep, entrada());
    expect(t.eventos.find((e) => e.type === 'borrador')).toEqual({ type: 'borrador', borrador: borrador, critica: false });
    expect(t.anotado).toEqual([{ clave: 'borradores', elemento: { id: 'b1', herramienta: 'movimiento_registrar', resumen: 'Ingreso de S/ 500', critica: false } }]);
    expect(r.borradores).toHaveLength(1);
  });

  it('un borrador de una herramienta crítica se marca como crítico', async () => {
    const critico = { ...borrador, id: 'b2', herramienta: 'venta_corregir' };
    const t = montar({ herramientas: [herr('captura_proponer', { modulo: 'core', criticidad: 'normal' }), herr('venta_corregir', { modulo: 'registro', criticidad: 'critica' })], respuestas: { captura_proponer: exito({ borradores: [critico], faltan: [], pista: null, interpretadoCon: 'reglas' }) } });
    t.modelo.programar([llamar('c1', 'captura_proponer', { texto: 'x' }), guion.respuesta('ok')]);
    const r = await correrTurno(t.dep, entrada());
    expect(r.borradores[0]?.critica).toBe(true);
  });

  it('un borrador con forma rara se ignora en lugar de romper el turno', async () => {
    const t = montar({ respuestas: { captura_proponer: exito({ borradores: [{ raro: true }] }) } });
    t.modelo.programar([llamar('c1', 'captura_proponer', { texto: 'x' }), guion.respuesta('ok')]);
    const r = await correrTurno(t.dep, entrada());
    expect(r.estado).toBe('completo');
    expect(r.borradores).toEqual([]);
  });
});

describe('correrTurno · meta-herramientas', () => {
  const variasAreas = [herr('pedidos_listar'), herr('pedido_editar', { criticidad: 'normal' }), herr('oportunidades_listar', { modulo: 'crm' }), herr('movimientos_listar', { modulo: 'registro' })];

  it('software_mapa solo lista lo que esta persona puede usar (sin «crm», que no tiene)', async () => {
    const t = montar({ herramientas: variasAreas });
    t.modelo.programar([llamar('c1', 'software_mapa', {}), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ modo: 'borradores' }));
    const mapa = JSON.parse((mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content);
    expect(mapa.datos.areas).toEqual([{ modulo: 'ordenes', herramientas: ['pedido_editar', 'pedidos_listar'] }, { modulo: 'registro', herramientas: ['movimientos_listar'] }]);
    expect(t.llamadas).toHaveLength(0);
  });

  it('software_mapa con un módulo da una línea por herramienta; con uno inaccesible, no confirma que exista', async () => {
    const t = montar({ herramientas: variasAreas });
    t.modelo.programar([llamar('c1', 'software_mapa', { modulo: 'ordenes' }), llamar('c2', 'software_mapa', { modulo: 'crm' }), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ modo: 'borradores' }));
    const uno = JSON.parse((mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content);
    expect(uno.datos.herramientas[0]).toEqual({ nombre: 'pedido_editar', paraQueSirve: 'Para pedido_editar', cambiaDatos: true });
    const dos = JSON.parse((mensajesDeLaRonda(t.modelo, 2).at(-1) as { content: string }).content);
    expect(dos.error.codigo).toBe('no_encontrado');
  });

  it('herramienta_describir da la ayuda y el esquema de los argumentos; de una inaccesible no confirma nada', async () => {
    const t = montar({ herramientas: variasAreas });
    t.modelo.programar([llamar('c1', 'herramienta_describir', { nombre: 'pedidos_listar' }), llamar('c2', 'herramienta_describir', { nombre: 'oportunidades_listar' }), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    const ok = JSON.parse((mensajesDeLaRonda(t.modelo, 1).at(-1) as { content: string }).content);
    expect(ok.datos).toMatchObject({ nombre: 'pedidos_listar', titulo: 'Título de pedidos_listar', cambiaDatos: false, argumentos: { type: 'object' } });
    const no = JSON.parse((mensajesDeLaRonda(t.modelo, 2).at(-1) as { content: string }).content);
    expect(no.error.mensaje).toContain('o no tienes acceso');
  });

  it('herramienta_llamar ejecuta la herramienta de adentro y se anuncia con SU nombre', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'herramienta_llamar', { nombre: 'pedidos_listar', args: { texto: 'Ana' } }), guion.respuesta('ok')]);
    const r = await correrTurno(t.dep, entrada());
    expect(t.llamadas[0]).toMatchObject({ nombre: 'pedidos_listar', args: { texto: 'Ana' } });
    expect(t.eventos[0]).toMatchObject({ type: 'herramienta_inicio', nombre: 'pedidos_listar' });
    expect(r.herramientas).toEqual([{ nombre: 'pedidos_listar', ok: true }]);
  });

  it('herramienta_llamar sin nombre, o apuntando a una herramienta interna, se rechaza sin ejecutar nada', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'herramienta_llamar', {}), llamar('c2', 'herramienta_llamar', { nombre: 'herramienta_llamar' }), guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada());
    expect(t.llamadas).toHaveLength(0);
  });
});

describe('correrTurno · tope mensual y argumentos rotos', () => {
  it('antes de cada ronda desde la segunda se pregunta si el tope lo permite, con lo que ya costó el turno', async () => {
    const preguntas: number[] = [];
    const t = montar({ permitirRonda: async (costo) => { preguntas.push(costo); return true; } });
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), llamar('c2', 'pedidos_listar', {}), guion.respuesta('fin')]);
    await correrTurno(t.dep, entrada());
    expect(preguntas).toEqual([50, 100]); // el guion cuesta 50 por ronda; la primera ronda no pregunta (la admisión ya lo hizo)
  });

  it('si el tope ya no alcanza, el turno se corta con aviso, queda interrumpido y no llama al modelo otra vez', async () => {
    const t = montar({ permitirRonda: async () => false });
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), guion.respuesta('esto no debe llegar')]);
    const r = await correrTurno(t.dep, entrada());
    expect(t.modelo.peticiones).toHaveLength(1);
    expect(t.llamadas).toHaveLength(1);
    expect(r).toMatchObject({ estado: 'interrumpido', corte: 'tope' });
    expect(r.texto.endsWith(AVISO_DE_TOPE)).toBe(true);
  });

  it('una respuesta sin herramientas nunca pregunta por el tope (ya se comprobó al admitir el turno)', async () => {
    const t = montar({ permitirRonda: async () => { throw new Error('no debía preguntar'); } });
    t.modelo.programar([guion.respuesta('hola')]);
    expect((await correrTurno(t.dep, entrada())).estado).toBe('completo');
  });

  it('un JSON roto se atiende con aviso pero NO se reenvía roto al proveedor en el historial de la ronda', async () => {
    const t = montar();
    t.modelo.programar([[guion.llamar('c1', 'pedidos_listar', null, '{"texto": "Cris')], guion.respuesta('perdón')]);
    await correrTurno(t.dep, entrada());
    const asistente = mensajesDeLaRonda(t.modelo, 1).at(-2) as { tool_calls: { function: { arguments: string } }[] };
    expect(asistente.tool_calls[0]!.function.arguments).toBe('{}');
    expect(t.llamadas).toHaveLength(0);
  });
});

describe('correrTurno · cortes y fallos', () => {
  it('si el modelo sigue pidiendo herramientas hasta la última ronda, el turno se corta con aviso y queda interrumpido', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), llamar('c2', 'pedidos_listar', {}), llamar('c3', 'pedidos_listar', {})]);
    const r = await correrTurno(t.dep, entrada({ maxRondas: 3 }));
    expect(t.llamadas).toHaveLength(3);
    expect(r).toMatchObject({ estado: 'interrumpido', corte: 'rondas' });
    expect(r.texto.endsWith(AVISO_DE_RONDAS)).toBe(true);
    expect(t.modelo.peticiones).toHaveLength(3);
  });

  it('si la respuesta se corta por largo, las llamadas a medias se descartan y se avisa', async () => {
    const t = montar();
    t.modelo.programar([[guion.texto('Empiezo'), { tipo: 'fin', motivo: 'length', razonamiento: null, uso: null, llamadas: [{ id: 'c1', type: 'function', function: { name: 'pedidos_listar', arguments: '{"tex' } }] }]]);
    const r = await correrTurno(t.dep, entrada());
    expect(t.llamadas).toHaveLength(0);
    expect(r).toMatchObject({ estado: 'interrumpido', corte: 'error' });
    expect(r.texto.endsWith(AVISO_DE_LARGO)).toBe(true);
  });

  it('un error del modelo a mitad de flujo deja el turno en error y se conserva lo ya dicho', async () => {
    const t = montar();
    t.modelo.programar([[guion.texto('Voy a'), { tipo: 'fin', motivo: 'error', razonamiento: null, uso: null, llamadas: [] }]]);
    const r = await correrTurno(t.dep, entrada());
    expect(r).toMatchObject({ estado: 'error', corte: 'error', motivo: 'modelo_no_disponible', texto: 'Voy a' });
  });

  it('un flujo que termina sin cierre se trata como error', async () => {
    const t = montar();
    t.modelo.programar([[guion.texto('Hola')]]);
    expect((await correrTurno(t.dep, entrada())).estado).toBe('error');
  });

  it.each([
    ['modelo_no_disponible', 'error', 'modelo_no_disponible'],
    ['interno', 'error', 'interno'],
    ['tiempo_agotado', 'interrumpido', 'tiempo_agotado'],
    ['cancelado', 'interrumpido', 'tiempo_agotado'],
  ] as const)('si el proveedor falla con «%s», el turno queda «%s» con motivo «%s»', async (falla, estado, motivo) => {
    const t = montar();
    t.modelo.programar([guion.respuesta('x')]).programarFallo(new ErrorDeModelo(falla, 'mensaje del proveedor'));
    const r = await correrTurno(t.dep, entrada());
    expect(r).toMatchObject({ estado, motivo, mensajeDeError: 'mensaje del proveedor' });
  });

  it('una excepción inesperada no tumba el bucle: queda como error interno sin filtrar el mensaje', async () => {
    const t = montar();
    t.modelo.programar([guion.respuesta('x')]).programarFallo(new Error('secreto de la base: clave=123'));
    const r = await correrTurno(t.dep, entrada());
    expect(r).toMatchObject({ estado: 'error', motivo: 'interno', mensajeDeError: 'Ocurrió un error inesperado.' });
    expect(JSON.stringify(r)).not.toContain('clave=123');
  });

  it('si se agota el tiempo entre dos llamadas a herramientas, deja de ejecutar y queda interrumpido', async () => {
    const control = new AbortController();
    const t = montar({ respuestas: { pedidos_listar: () => { control.abort(); return exito({ items: [] }); } } });
    t.modelo.programar([[{ tipo: 'fin', motivo: 'tool_calls', razonamiento: null, uso: null, llamadas: [
      { id: 'a', type: 'function', function: { name: 'pedidos_listar', arguments: '{}' } }, { id: 'b', type: 'function', function: { name: 'pedidos_listar', arguments: '{}' } },
    ] }]]);
    const r = await correrTurno(t.dep, entrada({ senal: control.signal }));
    expect(t.llamadas).toHaveLength(1);
    expect(r).toMatchObject({ estado: 'interrumpido', corte: 'tiempo', motivo: 'tiempo_agotado' });
  });

  it('el uso suma todas las rondas aunque el turno falle al final', async () => {
    const t = montar();
    t.modelo.programar([[guion.llamar('c1', 'pedidos_listar', {})], [{ tipo: 'fin', motivo: 'error', razonamiento: null, uso: { entrada: 200, salida: 5, cache: 0, costoMicrousd: 7 }, llamadas: [] }]]);
    const r = await correrTurno(t.dep, entrada());
    expect(r.uso).toMatchObject({ tokensEntrada: 300, tokensSalida: 25, costoMicrousd: 57, rondas: 2 });
  });

  it('nunca ejecuta una llamada que no sea de la ronda actual: sin herramientas pedidas, no se toca el ejecutor', async () => {
    const t = montar();
    t.modelo.programar([guion.respuesta('hola')]);
    await correrTurno(t.dep, entrada());
    expect(t.llamadas).toHaveLength(0);
  });
});

describe('correrTurno · lo que ve el modelo', () => {
  it('con escritura «ninguna» el catálogo solo trae lecturas, captura_proponer y las tres meta-herramientas', async () => {
    const t = montar();
    t.modelo.programar([guion.respuesta('ok')]);
    await correrTurno(t.dep, entrada({ modo: 'ninguna', pantalla: { ruta: '/m/ordenes', modulo: 'ordenes', entidad: null } }));
    const nombres = (t.modelo.peticiones[0]!.herramientas as { function: { name: string } }[]).map((h) => h.function.name);
    // Primero lo de siempre, después lo de la pantalla (solo lecturas) y al final las meta-herramientas.
    expect(nombres).toEqual(['captura_proponer', 'pedidos_listar', 'software_mapa', 'herramienta_describir', 'herramienta_llamar']);
  });

  it('cada ronda recibe la conversación completa hasta ese momento', async () => {
    const t = montar();
    t.modelo.programar([llamar('c1', 'pedidos_listar', {}), llamar('c2', 'pedidos_listar', {}), guion.respuesta('fin')]);
    await correrTurno(t.dep, entrada());
    expect(t.modelo.peticiones.map((p) => p.mensajes.length)).toEqual([3, 5, 7]);
  });
});
