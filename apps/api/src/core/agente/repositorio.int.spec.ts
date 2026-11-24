import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { agenteConversaciones, agenteMensajes, uso } from '../../db/esquema/core-agente.js';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import {
  abrirTurno, anotarEnLista, borrarConversacion, cerrarTurno, historialParaElModelo, lineaDeHechos, listarConversaciones,
  marcarFavorita, renombrar, retomarTurno, verConversacion, type TurnoAbierto,
} from './repositorio.js';
import { gastoDelMes, leerConfiguracion, registrarUso, turnosRecientes, zonaDeLaEmpresa, type UsoParaGuardar } from './repositorio-de-uso.js';

// El repositorio del asistente contra PostgreSQL real, con dos personas de la misma empresa.

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
beforeAll(() => {
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
});
afterAll(() => pool.end());

const como = (empresaId: string, usuarioId: string) => ({ empresaId, usuarioId });
const nuevo = (r: TurnoAbierto) => {
  if (r.tipo !== 'nuevo') throw new Error(`se esperaba un turno nuevo y fue ${r.tipo}`);
  return r;
};
const usoDe = (o: Partial<UsoParaGuardar> = {}): UsoParaGuardar => ({
  origen: 'agente', turnoId: randomUUID(), modelo: 'simulado/uno', tokensEntrada: 100, tokensSalida: 20, tokensCache: 0, costoMicrousd: 50, rondas: 1, duracionMs: 500, resultado: 'ok', ...o,
});

describe('abrirTurno', () => {
  it('crea la conversación con el título de las primeras 55 letras y deja dos mensajes: la persona y el asistente en curso', async () => {
    const E = empresaDePrueba();
    const turnoId = randomUUID();
    const mensaje = '  ¿Cuánto me debe   Cristina por las tarjetas de presentación que pidió el lunes pasado?  ';
    const r = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje })));
    const c = await conEmpresa(como(E, 'u_a'), (tx) => verConversacion(tx, r.conversacionId));
    // Espacios repetidos o de los bordes se limpian y el título se corta en 55 caracteres exactos.
    expect(c?.titulo).toBe(mensaje.replace(/\s+/g, ' ').trim().slice(0, 55));
    expect(c?.titulo).toHaveLength(55);
    expect(c?.titulo.startsWith('¿Cuánto me debe Cristina por las tarjetas')).toBe(true);
    expect(c?.mensajes.map((m) => [m.rol, m.estado])).toEqual([['persona', 'completo'], ['agente', 'en_curso']]);
    expect(c?.mensajes[0]?.contenido).toBe(mensaje);
  });

  it('un reintento con el mismo turnoId no duplica nada y devuelve el estado del mensaje que ya existe', async () => {
    const E = empresaDePrueba();
    const turnoId = randomUUID();
    const primero = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'hola' })));
    const otra = await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, conversacionId: primero.conversacionId, mensaje: 'hola' }));
    expect(otra).toMatchObject({ tipo: 'existente', mensajeAgenteId: primero.mensajeAgenteId, estado: 'en_curso', conversacionId: primero.conversacionId });
    expect(otra.tipo === 'existente' && otra.edadSegundos).toBeLessThan(5);
    const c = await conEmpresa(como(E, 'u_a'), (tx) => verConversacion(tx, primero.conversacionId));
    expect(c?.mensajes).toHaveLength(2);
  });

  it('un reintento SIN conversacionId (se perdió la respuesta del primer mensaje) reutiliza la conversación y no abre otra', async () => {
    const E = empresaDePrueba();
    const turnoId = randomUUID();
    const primero = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'primer mensaje' })));
    const otra = await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'primer mensaje' }));
    expect(otra).toMatchObject({ tipo: 'existente', conversacionId: primero.conversacionId, mensajeAgenteId: primero.mensajeAgenteId });
    expect((await conEmpresa(como(E, 'u_a'), (tx) => listarConversaciones(tx, { retencionDias: 90 }))).items).toHaveLength(1);
  });

  it('otra persona con el mismo turnoId NO reutiliza la conversación ajena', async () => {
    const E = empresaDePrueba();
    const turnoId = randomUUID();
    const de_a = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'mío' })));
    const de_b = nuevo(await conEmpresa(como(E, 'u_b'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'tuyo' })));
    expect(de_b.conversacionId).not.toBe(de_a.conversacionId);
  });

  it('con otro turno VIVO en la misma conversación, un mensaje nuevo se rechaza como «ocupada» y no guarda nada', async () => {
    const E = empresaDePrueba();
    const uno = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'primero' })));
    const r = await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), conversacionId: uno.conversacionId, mensaje: 'segundo sin esperar' }));
    expect(r).toEqual({ tipo: 'conversacion_ocupada' });
    const c = await conEmpresa(como(E, 'u_a'), (tx) => verConversacion(tx, uno.conversacionId));
    expect(c?.mensajes).toHaveLength(2);
  });

  it('terminado el turno anterior, la conversación acepta el siguiente; uno muerto (más de 150 s) tampoco bloquea', async () => {
    const E = empresaDePrueba();
    const uno = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'primero' })));
    await conEmpresa(como(E, 'u_a'), (tx) => tx.update(agenteMensajes).set({ actualizadoEn: sql`now() - interval '10 minutes'` }));
    const r = await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), conversacionId: uno.conversacionId, mensaje: 'segundo' }));
    expect(r.tipo).toBe('nuevo');
  });

  it('una conversación que no es de esta persona se trata como inexistente', async () => {
    const E = empresaDePrueba();
    const ajena = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'privado' })));
    const r = await conEmpresa(como(E, 'u_b'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), conversacionId: ajena.conversacionId, mensaje: 'intruso' }));
    expect(r).toEqual({ tipo: 'sin_conversacion' });
  });

  it('un turno puede continuar una conversación existente de la misma persona', async () => {
    const E = empresaDePrueba();
    const uno = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'primero' })));
    // El primer turno tiene que terminar antes: con uno vivo en la conversación, el segundo se rechaza como «ocupada».
    await conEmpresa(como(E, 'u_a'), (tx) => cerrarTurno(tx, { mensajeId: uno.mensajeAgenteId, conversacionId: uno.conversacionId, estado: 'completo', contenido: 'ok', metadatos: {}, uso: null }));
    const dos = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), conversacionId: uno.conversacionId, mensaje: 'segundo' })));
    expect(dos.conversacionId).toBe(uno.conversacionId);
  });
});

describe('anotar y cerrar el turno', () => {
  it('las acciones y borradores se anotan en cuanto ocurren y cerrar el turno no las pisa', async () => {
    const E = empresaDePrueba();
    const turnoId = randomUUID();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'crea el pedido' })));
    await conEmpresa(como(E, 'u_a'), async (tx) => {
      await anotarEnLista(tx, t.mensajeAgenteId, 'acciones', { herramienta: 'pedido_crear', titulo: 'Crear pedido', entidadTipo: 'pedido', entidadId: 'x' });
      await anotarEnLista(tx, t.mensajeAgenteId, 'borradores', { id: 'b1', herramienta: 'deuda_crear', resumen: 'Deuda de S/ 100', critica: false });
    });
    const enCurso = await conEmpresa(como(E, 'u_a'), (tx) => verConversacion(tx, t.conversacionId));
    expect(enCurso?.mensajes[1]?.metadatos).toMatchObject({ acciones: [{ titulo: 'Crear pedido' }], borradores: [{ id: 'b1' }] });

    await conEmpresa(como(E, 'u_a'), (tx) =>
      cerrarTurno(tx, { mensajeId: t.mensajeAgenteId, conversacionId: t.conversacionId, estado: 'completo', contenido: 'Listo.', metadatos: { modelo: 'simulado/uno', corte: null }, uso: usoDe({ turnoId }) }),
    );
    const c = await conEmpresa(como(E, 'u_a'), (tx) => verConversacion(tx, t.conversacionId));
    expect(c?.mensajes[1]).toMatchObject({ estado: 'completo', contenido: 'Listo.', metadatos: { modelo: 'simulado/uno', acciones: [{ titulo: 'Crear pedido' }], borradores: [{ id: 'b1' }] } });
  });

  it('cerrar el turno guarda el uso y mueve la conversación al principio de la lista', async () => {
    const E = empresaDePrueba();
    const vieja = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'vieja' })));
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'otra' })));
    await conEmpresa(como(E, 'u_a'), (tx) => cerrarTurno(tx, { mensajeId: vieja.mensajeAgenteId, conversacionId: vieja.conversacionId, estado: 'completo', contenido: 'ok', metadatos: {}, uso: usoDe({ costoMicrousd: 777 }) }));
    const lista = await conEmpresa(como(E, 'u_a'), (tx) => listarConversaciones(tx, { retencionDias: 90 }));
    expect(lista.items[0]?.id).toBe(vieja.conversacionId);
    expect(lista.items[1]?.id).toBe(t.conversacionId);
    expect(await conEmpresa(como(E, 'u_a'), (tx) => gastoDelMes(tx, new Date(), 'America/Lima'))).toBe(777);
  });

  it('un turno cortado sin hacer nada se puede retomar; el estado vuelve a «en curso»', async () => {
    const E = empresaDePrueba();
    const turnoId = randomUUID();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'x' })));
    await conEmpresa(como(E, 'u_a'), (tx) => cerrarTurno(tx, { mensajeId: t.mensajeAgenteId, conversacionId: t.conversacionId, estado: 'interrumpido', contenido: '', metadatos: { corte: 'tiempo' }, uso: null }));
    expect(await conEmpresa(como(E, 'u_a'), (tx) => retomarTurno(tx, t.mensajeAgenteId))).toBe(true);
    const r = await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, conversacionId: t.conversacionId, mensaje: 'x' }));
    expect(r).toMatchObject({ tipo: 'existente', estado: 'en_curso' });
  });

  it('dos reintentos simultáneos de un turno muerto: solo UNO lo retoma', async () => {
    const E = empresaDePrueba();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'x' })));
    await conEmpresa(como(E, 'u_a'), (tx) => cerrarTurno(tx, { mensajeId: t.mensajeAgenteId, conversacionId: t.conversacionId, estado: 'interrumpido', contenido: '', metadatos: {}, uso: null }));
    const resultados = await Promise.all([1, 2, 3].map(() => conEmpresa(como(E, 'u_a'), (tx) => retomarTurno(tx, t.mensajeAgenteId))));
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it('retomar un turno que sigue en curso y reciente no hace nada', async () => {
    const E = empresaDePrueba();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'x' })));
    expect(await conEmpresa(como(E, 'u_a'), (tx) => retomarTurno(tx, t.mensajeAgenteId))).toBe(false);
  });
});

describe('historialParaElModelo', () => {
  async function conversacionConTurnos(E: string, n: number, contenido = 'mensaje'): Promise<{ conversacionId: string; ultimo: string }> {
    let conversacionId: string | undefined;
    let ultimo = '';
    for (let i = 0; i < n; i++) {
      const turnoId = randomUUID();
      ultimo = turnoId;
      const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, conversacionId, mensaje: `${contenido} ${i}` })));
      conversacionId = t.conversacionId;
      await conEmpresa(como(E, 'u_a'), (tx) => cerrarTurno(tx, { mensajeId: t.mensajeAgenteId, conversacionId: t.conversacionId, estado: 'completo', contenido: `respuesta ${i}`, metadatos: {}, uso: null }));
    }
    return { conversacionId: conversacionId!, ultimo };
  }

  it('devuelve los mensajes en orden, de la persona como «user» y del asistente como «assistant»', async () => {
    const E = empresaDePrueba();
    const { conversacionId } = await conversacionConTurnos(E, 2);
    const h = await conEmpresa(como(E, 'u_a'), (tx) => historialParaElModelo(tx, conversacionId, randomUUID()));
    expect(h.map((m) => [m.role, m.content])).toEqual([['user', 'mensaje 0'], ['assistant', 'respuesta 0'], ['user', 'mensaje 1'], ['assistant', 'respuesta 1']]);
  });

  it('deja fuera el turno actual', async () => {
    const E = empresaDePrueba();
    const { conversacionId, ultimo } = await conversacionConTurnos(E, 2);
    const h = await conEmpresa(como(E, 'u_a'), (tx) => historialParaElModelo(tx, conversacionId, ultimo));
    expect(h.map((m) => m.content)).toEqual(['mensaje 0', 'respuesta 0']);
  });

  it('un mensaje todavía en curso o con error no entra; el de la persona sí (ya quedó guardado)', async () => {
    const E = empresaDePrueba();
    const { conversacionId } = await conversacionConTurnos(E, 1);
    const turno2 = randomUUID();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: turno2, conversacionId, mensaje: 'sin cerrar' })));
    await conEmpresa(como(E, 'u_a'), (tx) => cerrarTurno(tx, { mensajeId: t.mensajeAgenteId, conversacionId, estado: 'error', contenido: 'nada útil', metadatos: {}, uso: null }));
    const h = await conEmpresa(como(E, 'u_a'), (tx) => historialParaElModelo(tx, conversacionId, randomUUID()));
    expect(h.map((m) => m.content)).toEqual(['mensaje 0', 'respuesta 0', 'sin cerrar']);
  });

  it('un turno INTERRUMPIDO entra con lo que hizo: así «continúa» no repite lo ya hecho', async () => {
    const E = empresaDePrueba();
    const turnoId = randomUUID();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId, mensaje: 'crea el cliente' })));
    await conEmpresa(como(E, 'u_a'), async (tx) => {
      await anotarEnLista(tx, t.mensajeAgenteId, 'acciones', { herramienta: 'clientes_crear', titulo: 'Crear cliente', entidadTipo: 'clientes', entidadId: null });
      await cerrarTurno(tx, { mensajeId: t.mensajeAgenteId, conversacionId: t.conversacionId, estado: 'interrumpido', contenido: 'Llegué al máximo de pasos.', metadatos: { corte: 'rondas' }, uso: null });
    });
    const h = await conEmpresa(como(E, 'u_a'), (tx) => historialParaElModelo(tx, t.conversacionId, randomUUID()));
    expect(h.at(-1)).toEqual({ role: 'assistant', content: 'Llegué al máximo de pasos.\n[Hizo: Crear cliente]' });
  });

  it('se queda con los 30 más recientes', async () => {
    const E = empresaDePrueba();
    const { conversacionId } = await conversacionConTurnos(E, 20);
    const h = await conEmpresa(como(E, 'u_a'), (tx) => historialParaElModelo(tx, conversacionId, randomUUID()));
    expect(h).toHaveLength(30);
    expect(h.at(-1)?.content).toBe('respuesta 19');
    expect(h[0]?.content).toBe('mensaje 5');
  });

  it('respeta el tope de 24.000 caracteres quedándose con lo más reciente', async () => {
    const E = empresaDePrueba();
    const { conversacionId } = await conversacionConTurnos(E, 12, 'x'.repeat(2500));
    const h = await conEmpresa(como(E, 'u_a'), (tx) => historialParaElModelo(tx, conversacionId, randomUUID()));
    expect(h.reduce((s, m) => s + m.content.length, 0)).toBeLessThanOrEqual(24_000);
    expect(h.at(-1)?.content).toBe('respuesta 11');
  });

  it('añade lo que el asistente hizo, para que lo recuerde en el turno siguiente', () => {
    expect(lineaDeHechos({ acciones: [{ titulo: 'Crear pedido' }], borradores: [{ resumen: 'Ingreso de S/ 500' }] })).toBe('[Hizo: Crear pedido] [Propuso, falta aprobar: Ingreso de S/ 500]');
    expect(lineaDeHechos({})).toBe('');
    expect(lineaDeHechos(null)).toBe('');
  });
});

describe('lista, renombrar, favorita y borrar', () => {
  it('pagina de 50 en 50 con «hayMas» y el cursor «antesDe»', async () => {
    const E = empresaDePrueba();
    await conEmpresa(como(E, 'u_a'), async (tx) => {
      await tx.execute(sql`insert into core.agente_conversaciones (tenant_id, usuario_id, titulo, actualizado_en) select current_setting('app.tenant_id'), 'u_a', 'c' || g, now() - make_interval(mins => g) from generate_series(1, 55) g`);
    });
    const p1 = await conEmpresa(como(E, 'u_a'), (tx) => listarConversaciones(tx, { retencionDias: 90 }));
    expect(p1.items).toHaveLength(50);
    expect(p1.hayMas).toBe(true);
    expect(p1.items[0]?.titulo).toBe('c1');
    const p2 = await conEmpresa(como(E, 'u_a'), (tx) => listarConversaciones(tx, { retencionDias: 90, antesDe: new Date(p1.items.at(-1)!.actualizadoEn) }));
    expect(p2.items).toHaveLength(5);
    expect(p2.hayMas).toBe(false);
  });

  it('aplica la retención: borra de esta persona las conversaciones viejas con sus mensajes, y solo las suyas', async () => {
    const E = empresaDePrueba();
    const mia = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'vieja mía' })));
    const ajena = nuevo(await conEmpresa(como(E, 'u_b'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'vieja ajena' })));
    await conEmpresa(como(E, 'u_a'), (tx) => tx.update(agenteConversaciones).set({ actualizadoEn: sql`now() - interval '100 days'` }));
    await conEmpresa(como(E, 'u_b'), (tx) => tx.update(agenteConversaciones).set({ actualizadoEn: sql`now() - interval '100 days'` }));
    const lista = await conEmpresa(como(E, 'u_a'), (tx) => listarConversaciones(tx, { retencionDias: 90 }));
    expect(lista.items).toHaveLength(0);
    expect(await conEmpresa(como(E, 'u_a'), (tx) => tx.select().from(agenteMensajes))).toHaveLength(0);
    // La de la otra persona sigue ahí hasta que ELLA liste.
    expect(await conEmpresa(como(E, 'u_b'), (tx) => verConversacion(tx, ajena.conversacionId))).not.toBeNull();
    expect(mia.conversacionId).not.toBe(ajena.conversacionId);
  });

  it('renombrar y marcar favorita no reordenan la lista', async () => {
    const E = empresaDePrueba();
    const a = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'a' })));
    const b = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'b' })));
    const antes = await conEmpresa(como(E, 'u_a'), (tx) => listarConversaciones(tx, { retencionDias: 90 }));
    expect(antes.items.map((i) => i.id)).toEqual([b.conversacionId, a.conversacionId]);
    const r = await conEmpresa(como(E, 'u_a'), (tx) => renombrar(tx, a.conversacionId, 'Pedidos de Cristina'));
    const f = await conEmpresa(como(E, 'u_a'), (tx) => marcarFavorita(tx, a.conversacionId, true));
    expect(r?.titulo).toBe('Pedidos de Cristina');
    expect(f?.favorita).toBe(true);
    const despues = await conEmpresa(como(E, 'u_a'), (tx) => listarConversaciones(tx, { retencionDias: 90 }));
    expect(despues.items.map((i) => i.id)).toEqual([b.conversacionId, a.conversacionId]);
    expect(despues.items[1]).toMatchObject({ titulo: 'Pedidos de Cristina', favorita: true });
  });

  it('borrar elimina la conversación y sus mensajes; otra persona no puede ni verla ni borrarla', async () => {
    const E = empresaDePrueba();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'secreto' })));
    expect(await conEmpresa(como(E, 'u_b'), (tx) => borrarConversacion(tx, t.conversacionId))).toBe(false);
    expect(await conEmpresa(como(E, 'u_b'), (tx) => renombrar(tx, t.conversacionId, 'robada'))).toBeNull();
    expect(await conEmpresa(como(E, 'u_a'), (tx) => borrarConversacion(tx, t.conversacionId))).toBe(true);
    expect(await conEmpresa(como(E, 'u_a'), (tx) => verConversacion(tx, t.conversacionId))).toBeNull();
    expect(await conEmpresa(como(E, 'u_a'), (tx) => tx.select().from(agenteMensajes))).toHaveLength(0);
  });
});

describe('uso, tope y ritmo', () => {
  async function sembrarUso(E: string, filas: { cuando: string; costo: number; usuario?: string }[]) {
    for (const f of filas) {
      await conEmpresa(como(E, f.usuario ?? 'u_a'), (tx) => tx.insert(uso).values({ tenantId: sql`current_setting('app.tenant_id')`, usuarioId: sql`current_setting('app.user_id')`, origen: 'agente', turnoId: randomUUID(), modelo: 'm', costoMicrousd: f.costo, creadoEn: new Date(f.cuando) }));
    }
  }

  it('el gasto del mes suma solo el mes en curso EN LA ZONA DE LA EMPRESA (el 1.° empieza a las 00:00 de Lima, no de UTC)', async () => {
    const E = empresaDePrueba();
    await sembrarUso(E, [
      { cuando: '2026-12-01T04:59:00Z', costo: 1000 }, // 23:59 del 30 de noviembre en Lima: mes anterior
      { cuando: '2026-12-01T05:00:00Z', costo: 20 },   // 00:00 del 1.° de diciembre en Lima
      { cuando: '2026-12-10T12:00:00Z', costo: 3 },
      { cuando: '2026-11-15T12:00:00Z', costo: 500 },  // mes anterior
    ]);
    expect(await conEmpresa(como(E, 'u_a'), (tx) => gastoDelMes(tx, new Date('2026-12-15T12:00:00Z'), 'America/Lima'))).toBe(23);
    expect(await conEmpresa(como(E, 'u_a'), (tx) => gastoDelMes(tx, new Date('2026-12-15T12:00:00Z'), 'UTC'))).toBe(1023);
  });

  it('el gasto es de toda la empresa: lo de otra persona también cuenta; lo de otra empresa no', async () => {
    const E = empresaDePrueba();
    await sembrarUso(E, [{ cuando: '2026-12-02T12:00:00Z', costo: 10, usuario: 'u_a' }, { cuando: '2026-12-03T12:00:00Z', costo: 5, usuario: 'u_b' }]);
    await sembrarUso(empresaDePrueba(), [{ cuando: '2026-12-02T12:00:00Z', costo: 9999 }]);
    expect(await conEmpresa(como(E, 'u_b'), (tx) => gastoDelMes(tx, new Date('2026-12-15T12:00:00Z'), 'America/Lima'))).toBe(15);
  });

  it('sin gasto el total es cero', async () => {
    expect(await conEmpresa(como(empresaDePrueba(), 'u_a'), (tx) => gastoDelMes(tx, new Date(), 'America/Lima'))).toBe(0);
  });

  it('los turnos recientes cuentan los terminados y los que siguen en curso, solo de ESA persona', async () => {
    const E = empresaDePrueba();
    await conEmpresa(como(E, 'u_a'), async (tx) => { await registrarUso(tx, usoDe()); await registrarUso(tx, usoDe()); });
    await conEmpresa(como(E, 'u_b'), (tx) => registrarUso(tx, usoDe()));
    nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'en curso' })));
    expect(await conEmpresa(como(E, 'u_a'), (tx) => turnosRecientes(tx, 60))).toBe(3);
    expect(await conEmpresa(como(E, 'u_b'), (tx) => turnosRecientes(tx, 60))).toBe(1);
  });

  it('borrar las conversaciones NO baja la cuenta de turnos: el límite no se esquiva', async () => {
    const E = empresaDePrueba();
    const t = nuevo(await conEmpresa(como(E, 'u_a'), (tx) => abrirTurno(tx, { turnoId: randomUUID(), mensaje: 'x' })));
    await conEmpresa(como(E, 'u_a'), (tx) => cerrarTurno(tx, { mensajeId: t.mensajeAgenteId, conversacionId: t.conversacionId, estado: 'completo', contenido: 'ok', metadatos: {}, uso: usoDe() }));
    await conEmpresa(como(E, 'u_a'), (tx) => borrarConversacion(tx, t.conversacionId));
    expect(await conEmpresa(como(E, 'u_a'), (tx) => turnosRecientes(tx, 60))).toBe(1);
  });

  it('un turno viejo fuera de la ventana no cuenta', async () => {
    const E = empresaDePrueba();
    await sembrarUso(E, [{ cuando: new Date(Date.now() - 3600_000).toISOString(), costo: 1 }]);
    expect(await conEmpresa(como(E, 'u_a'), (tx) => turnosRecientes(tx, 60))).toBe(0);
    expect(await conEmpresa(como(E, 'u_a'), (tx) => turnosRecientes(tx, 86_400))).toBe(1);
  });

  it('el uso no se puede cambiar ni borrar', async () => {
    const E = empresaDePrueba();
    await conEmpresa(como(E, 'u_a'), (tx) => registrarUso(tx, usoDe()));
    await expect(conEmpresa(como(E, 'u_a'), (tx) => tx.execute(sql`update core.uso set costo_microusd = 0`))).rejects.toThrow();
  });
});

describe('configuración y zona', () => {
  it('sin configuración devuelve null; con ella, la fila de ESA empresa', async () => {
    const E = empresaDePrueba();
    expect(await conEmpresa(como(E, 'u_a'), (tx) => leerConfiguracion(tx))).toBeNull();
    await conEmpresa(como(E, 'u_a'), (tx) => tx.execute(sql`insert into core.agente_configuracion (tenant_id, modelo, actualizado_por) values (current_setting('app.tenant_id'), 'deepseek/x', 'u_a')`));
    expect(await conEmpresa(como(E, 'u_a'), (tx) => leerConfiguracion(tx))).toMatchObject({ modelo: 'deepseek/x', escrituraDirecta: true, dineroDirecto: true, topePorOperacionCentimos: null, internet: false });
    expect(await conEmpresa(como(empresaDePrueba(), 'u_a'), (tx) => leerConfiguracion(tx))).toBeNull();
  });

  it('la zona por defecto es Lima cuando la empresa no la configuró', async () => {
    expect(await conEmpresa(como(empresaDePrueba(), 'u_a'), (tx) => zonaDeLaEmpresa(tx))).toBe('America/Lima');
  });
});
