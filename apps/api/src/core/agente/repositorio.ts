import { and, asc, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import type { ConversacionConMensajes, ConversacionDelAgente, ListaDeConversaciones, MensajeDelAgente } from '@capaz/shared';
import { agenteConversaciones, agenteMensajes } from '../../db/esquema/core-agente.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { registrarUso, type UsoParaGuardar } from './repositorio-de-uso.js';

// Conversaciones y mensajes del asistente. Toda función recibe la transacción de `conEmpresa`: la empresa y la persona salen
// de la sesión de la base (`app.tenant_id`, `app.user_id`), nunca de un argumento, y la política `solo_propias` hace el resto.
// Ninguna transacción se deja abierta mientras se espera al modelo: cada paso es corto.

const TENANT = sql`current_setting('app.tenant_id', true)`;
const USUARIO = sql`current_setting('app.user_id', true)`;

export const LARGO_DEL_TITULO_AUTOMATICO = 55;
export const MAXIMO_DE_MENSAJES_DE_HISTORIAL = 30;
export const MAXIMO_DE_CARACTERES_DE_HISTORIAL = 24_000;
const MAXIMO_DE_CONTENIDO = 40_000;
/** Un turno «en curso» más viejo que esto se da por muerto (la función serverless pudo suspenderse). */
export const SEGUNDOS_PARA_DAR_POR_MUERTO = 150;
const POR_PAGINA = 50;

export type ListaDeAnotaciones = 'acciones' | 'borradores' | 'herramientas';

export type TurnoAbierto =
  | { tipo: 'sin_conversacion' }
  /** Otro turno de esta misma conversación sigue en curso: no se corren dos a la vez. */
  | { tipo: 'conversacion_ocupada' }
  | { tipo: 'nuevo'; conversacionId: string; mensajeAgenteId: string }
  | {
      tipo: 'existente';
      conversacionId: string;
      mensajeAgenteId: string;
      estado: MensajeDelAgente['estado'];
      contenido: string;
      metadatos: Record<string, unknown>;
      /** Segundos desde la última vez que se tocó el mensaje, medidos con el reloj de la base. */
      edadSegundos: number;
    };

const tituloDe = (mensaje: string): string => mensaje.replace(/\s+/g, ' ').trim().slice(0, LARGO_DEL_TITULO_AUTOMATICO) || 'Conversación';

/**
 * La conversación del turno: la que vino (si es de esta persona), la que ya creó un intento anterior con el MISMO `turnoId`
 * (así reintentar un primer mensaje cuya respuesta se perdió no abre una segunda conversación ni gasta dos veces), o una nueva.
 */
async function conversacionDelTurno(tx: Transaccion, id: string | undefined, turnoId: string, mensaje: string): Promise<string | null> {
  if (id) {
    const [fila] = await tx.select({ id: agenteConversaciones.id }).from(agenteConversaciones).where(eq(agenteConversaciones.id, id));
    return fila?.id ?? null;
  }
  const [previo] = await tx.select({ id: agenteMensajes.conversacionId }).from(agenteMensajes).where(and(eq(agenteMensajes.turnoId, turnoId), eq(agenteMensajes.rol, 'persona'))).limit(1);
  if (previo) return previo.id;
  const [nueva] = await tx
    .insert(agenteConversaciones)
    .values({ tenantId: TENANT, usuarioId: USUARIO, titulo: tituloDe(mensaje) })
    .returning({ id: agenteConversaciones.id });
  if (!nueva) throw new Error('No se pudo crear la conversación.');
  return nueva.id;
}

const objetivoDelTurno = [agenteMensajes.tenantId, agenteMensajes.conversacionId, agenteMensajes.turnoId, agenteMensajes.rol];

/** ¿Sigue vivo otro turno (distinto del actual) en esta conversación? Se mira ANTES de guardar nada. */
async function hayOtroTurnoEnCurso(tx: Transaccion, conversacionId: string, turnoId: string): Promise<boolean> {
  const [fila] = await tx
    .select({ id: agenteMensajes.id })
    .from(agenteMensajes)
    .where(and(
      eq(agenteMensajes.conversacionId, conversacionId), eq(agenteMensajes.rol, 'agente'), eq(agenteMensajes.estado, 'en_curso'), ne(agenteMensajes.turnoId, turnoId),
      sql`${agenteMensajes.actualizadoEn} > now() - make_interval(secs => ${SEGUNDOS_PARA_DAR_POR_MUERTO})`,
    ))
    .limit(1);
  return fila !== undefined;
}

/**
 * Guarda el mensaje de la persona y deja el del asistente en curso. Un reintento con el mismo `turnoId` no duplica nada:
 * devuelve el estado del mensaje que ya existe y quien llama decide si repetir (§6 del diseño).
 */
export async function abrirTurno(tx: Transaccion, p: { conversacionId?: string; turnoId: string; mensaje: string }): Promise<TurnoAbierto> {
  const conversacionId = await conversacionDelTurno(tx, p.conversacionId, p.turnoId, p.mensaje);
  if (!conversacionId) return { tipo: 'sin_conversacion' };
  if (await hayOtroTurnoEnCurso(tx, conversacionId, p.turnoId)) return { tipo: 'conversacion_ocupada' };
  const base = { tenantId: TENANT, usuarioId: USUARIO, conversacionId, turnoId: p.turnoId };
  await tx.insert(agenteMensajes).values({ ...base, rol: 'persona', estado: 'completo', contenido: p.mensaje }).onConflictDoNothing({ target: objetivoDelTurno });
  const [creado] = await tx
    .insert(agenteMensajes)
    .values({ ...base, rol: 'agente', estado: 'en_curso' })
    .onConflictDoNothing({ target: objetivoDelTurno })
    .returning({ id: agenteMensajes.id });
  if (creado) return { tipo: 'nuevo', conversacionId, mensajeAgenteId: creado.id };
  const [previo] = await tx
    .select({
      id: agenteMensajes.id,
      estado: agenteMensajes.estado,
      contenido: agenteMensajes.contenido,
      metadatos: agenteMensajes.metadatos,
      edad: sql<number>`extract(epoch from now() - ${agenteMensajes.actualizadoEn})::float8`,
    })
    .from(agenteMensajes)
    .where(and(eq(agenteMensajes.conversacionId, conversacionId), eq(agenteMensajes.turnoId, p.turnoId), eq(agenteMensajes.rol, 'agente')));
  if (!previo) throw new Error('El mensaje del turno no existe.');
  return {
    tipo: 'existente', conversacionId, mensajeAgenteId: previo.id, estado: previo.estado as MensajeDelAgente['estado'],
    contenido: previo.contenido, metadatos: previo.metadatos as Record<string, unknown>, edadSegundos: Number(previo.edad),
  };
}

/**
 * Vuelve a poner en curso un turno que se cortó sin hacer nada (repetirlo es inocuo). Es un UPDATE condicional: si otro reintento
 * ya lo retomó (está en curso y reciente), este pierde la carrera y devuelve `false`: no se corren dos a la vez.
 */
export async function retomarTurno(tx: Transaccion, mensajeId: string): Promise<boolean> {
  const retomados = await tx
    .update(agenteMensajes)
    .set({ estado: 'en_curso', actualizadoEn: sql`now()` })
    .where(and(eq(agenteMensajes.id, mensajeId), sql`(${agenteMensajes.estado} <> 'en_curso' or ${agenteMensajes.actualizadoEn} <= now() - make_interval(secs => ${SEGUNDOS_PARA_DAR_POR_MUERTO}))`))
    .returning({ id: agenteMensajes.id });
  return retomados.length > 0;
}

/**
 * Anota una acción, un borrador o una herramienta usada en los metadatos del mensaje, EN CUANTO ocurre. Así, si el turno se
 * corta, se sabe qué se hizo y un reintento no lo repite.
 */
export async function anotarEnLista(tx: Transaccion, mensajeId: string, clave: ListaDeAnotaciones, elemento: unknown): Promise<void> {
  const [fila] = await tx.select({ metadatos: agenteMensajes.metadatos }).from(agenteMensajes).where(eq(agenteMensajes.id, mensajeId)).for('update');
  if (!fila) return;
  const actuales = fila.metadatos as Record<string, unknown>;
  const lista = Array.isArray(actuales[clave]) ? (actuales[clave] as unknown[]) : [];
  await tx.update(agenteMensajes).set({ metadatos: { ...actuales, [clave]: [...lista, elemento] }, actualizadoEn: sql`now()` }).where(eq(agenteMensajes.id, mensajeId));
}

export type CierreDeTurno = {
  mensajeId: string;
  conversacionId: string;
  estado: Exclude<MensajeDelAgente['estado'], 'en_curso'>;
  contenido: string;
  /** Se mezcla con lo que ya había (las listas de acciones y borradores no se pisan). */
  metadatos: Record<string, unknown>;
  uso: UsoParaGuardar | null;
};

/** Cierra el mensaje del asistente, mueve la conversación al principio de la lista y guarda el uso, todo en una transacción corta. */
export async function cerrarTurno(tx: Transaccion, c: CierreDeTurno): Promise<void> {
  await tx
    .update(agenteMensajes)
    .set({ estado: c.estado, contenido: c.contenido.slice(0, MAXIMO_DE_CONTENIDO), metadatos: sql`${agenteMensajes.metadatos} || ${JSON.stringify(c.metadatos)}::jsonb`, actualizadoEn: sql`now()` })
    .where(eq(agenteMensajes.id, c.mensajeId));
  await tx.update(agenteConversaciones).set({ actualizadoEn: sql`now()` }).where(eq(agenteConversaciones.id, c.conversacionId));
  if (c.uso) await registrarUso(tx, c.uso);
}

type Hechos = { acciones?: { titulo?: string }[]; borradores?: { resumen?: string }[]; herramientas?: { nombre?: string; ok?: boolean }[] };

/** Dado el nombre de una herramienta, su título si es una CONSULTA (lectura) y `null` si no lo es o no se conoce. */
export type TituloDeConsulta = (herramienta: string) => string | null;

const unicos = (xs: string[]): string[] => [...new Set(xs)];

/**
 * «[Consulté: …]», «[Hizo: …]» y «[Propuso, falta aprobar: …]»: el registro REAL de lo que el asistente hizo con sus herramientas en un
 * turno. Sin él, en el turno siguiente el modelo ve sus datos pero no cómo los obtuvo, y puede acusarse de haberlos inventado (pasó en
 * producción). Solo cuenta lo que SÍ se consultó con éxito; los datos en sí no se guardan: al retomar vuelve a consultarlos.
 */
export function lineaDeHechos(metadatos: unknown, tituloDeConsulta?: TituloDeConsulta): string {
  const m = (metadatos ?? {}) as Hechos;
  const consulto = tituloDeConsulta
    ? unicos((m.herramientas ?? []).filter((h) => h.ok === true && typeof h.nombre === 'string').map((h) => tituloDeConsulta(h.nombre as string)).filter((t): t is string => t !== null && t !== ''))
    : [];
  const hizo = (m.acciones ?? []).map((a) => a.titulo).filter((t): t is string => typeof t === 'string' && t !== '');
  const propuso = (m.borradores ?? []).map((b) => b.resumen).filter((t): t is string => typeof t === 'string' && t !== '');
  return [
    consulto.length > 0 ? `[Consulté: ${consulto.join('; ')}]` : '',
    hizo.length > 0 ? `[Hizo: ${hizo.join('; ')}]` : '',
    propuso.length > 0 ? `[Propuso, falta aprobar: ${propuso.join('; ')}]` : '',
  ].filter(Boolean).join(' ');
}

export type MensajeDeHistorial = { role: 'user' | 'assistant'; content: string };

/**
 * Los últimos mensajes de la conversación que terminaron (completos o interrumpidos), solo texto, sin el turno en curso. Los
 * interrumpidos entran: un turno cortado por rondas o por tiempo pudo haber hecho cosas, y el asistente debe recordarlas para no repetirlas. Lo que el asistente leyó de las
 * herramientas no se guarda: al retomar, vuelve a consultarlo (los datos cambian entre un mensaje y otro).
 */
export async function historialParaElModelo(tx: Transaccion, conversacionId: string, turnoActual: string, tituloDeConsulta?: TituloDeConsulta): Promise<MensajeDeHistorial[]> {
  const filas = await tx
    .select({ rol: agenteMensajes.rol, contenido: agenteMensajes.contenido, metadatos: agenteMensajes.metadatos })
    .from(agenteMensajes)
    .where(and(eq(agenteMensajes.conversacionId, conversacionId), inArray(agenteMensajes.estado, ['completo', 'interrumpido']), ne(agenteMensajes.turnoId, turnoActual)))
    .orderBy(desc(agenteMensajes.creadoEn), desc(agenteMensajes.id))
    .limit(MAXIMO_DE_MENSAJES_DE_HISTORIAL);
  const salida: MensajeDeHistorial[] = [];
  let caracteres = 0;
  for (const f of filas) {
    const hechos = f.rol === 'agente' ? lineaDeHechos(f.metadatos, tituloDeConsulta) : '';
    const texto = [f.contenido, hechos].filter(Boolean).join('\n');
    if (texto === '') continue;
    if (caracteres + texto.length > MAXIMO_DE_CARACTERES_DE_HISTORIAL && salida.length > 0) break;
    caracteres += texto.length;
    salida.push({ role: f.rol === 'persona' ? 'user' : 'assistant', content: texto });
  }
  return salida.reverse();
}

const comoConversacion = (f: typeof agenteConversaciones.$inferSelect): ConversacionDelAgente => ({
  id: f.id, titulo: f.titulo, favorita: f.favorita, actualizadoEn: f.actualizadoEn.toISOString(),
});

/** Borra las conversaciones de esta persona más viejas que la retención (los mensajes primero: la llave no cascada). */
async function purgarViejas(tx: Transaccion, dias: number): Promise<void> {
  const viejas = await tx.select({ id: agenteConversaciones.id }).from(agenteConversaciones).where(lt(agenteConversaciones.actualizadoEn, sql`now() - make_interval(days => ${dias})`));
  if (viejas.length === 0) return;
  const ids = viejas.map((v) => v.id);
  await tx.delete(agenteMensajes).where(inArray(agenteMensajes.conversacionId, ids));
  await tx.delete(agenteConversaciones).where(inArray(agenteConversaciones.id, ids));
}

/** Las conversaciones de esta persona, de la más reciente a la más vieja, de 50 en 50. De paso aplica la retención. */
export async function listarConversaciones(tx: Transaccion, p: { antesDe?: Date; retencionDias: number }): Promise<ListaDeConversaciones> {
  await purgarViejas(tx, p.retencionDias);
  const filas = await tx
    .select()
    .from(agenteConversaciones)
    .where(p.antesDe ? lt(agenteConversaciones.actualizadoEn, p.antesDe) : undefined)
    .orderBy(desc(agenteConversaciones.actualizadoEn), desc(agenteConversaciones.id))
    .limit(POR_PAGINA + 1);
  return { items: filas.slice(0, POR_PAGINA).map(comoConversacion), hayMas: filas.length > POR_PAGINA };
}

export async function verConversacion(tx: Transaccion, id: string): Promise<ConversacionConMensajes | null> {
  const [conversacion] = await tx.select().from(agenteConversaciones).where(eq(agenteConversaciones.id, id));
  if (!conversacion) return null;
  const mensajes = await tx.select().from(agenteMensajes).where(eq(agenteMensajes.conversacionId, id)).orderBy(asc(agenteMensajes.creadoEn), asc(agenteMensajes.id));
  return {
    ...comoConversacion(conversacion),
    mensajes: mensajes.map((m) => ({
      id: m.id, turnoId: m.turnoId, rol: m.rol as MensajeDelAgente['rol'], estado: m.estado as MensajeDelAgente['estado'],
      contenido: m.contenido, metadatos: m.metadatos as Record<string, unknown>, creadoEn: m.creadoEn.toISOString(),
    })),
  };
}

/** Renombrar no mueve la conversación en la lista: `actualizado_en` solo cambia al guardar un mensaje. */
export async function renombrar(tx: Transaccion, id: string, titulo: string): Promise<ConversacionDelAgente | null> {
  const [f] = await tx.update(agenteConversaciones).set({ titulo }).where(eq(agenteConversaciones.id, id)).returning();
  return f ? comoConversacion(f) : null;
}

export async function marcarFavorita(tx: Transaccion, id: string, favorita: boolean): Promise<ConversacionDelAgente | null> {
  const [f] = await tx.update(agenteConversaciones).set({ favorita }).where(eq(agenteConversaciones.id, id)).returning();
  return f ? comoConversacion(f) : null;
}

/** Borra la conversación y sus mensajes. Las acciones que el asistente hizo siguen en la auditoría de la empresa. */
export async function borrarConversacion(tx: Transaccion, id: string): Promise<boolean> {
  await tx.delete(agenteMensajes).where(eq(agenteMensajes.conversacionId, id));
  const borradas = await tx.delete(agenteConversaciones).where(eq(agenteConversaciones.id, id)).returning({ id: agenteConversaciones.id });
  return borradas.length > 0;
}
