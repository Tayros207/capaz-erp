import type { EventoDelAgente, MensajeDelAgente, MotivoDeErrorDelAgente } from '@capaz/shared';
import { rutaDeLoHecho } from './logica-acciones.ts';
import type { ElementoDeHilo } from './logica-hilo.ts';

// Cómo los eventos de un turno se vuelven el hilo que ve la persona, y qué hacer cuando la conexión se corta a mitad. Puras: sin React.

type ElementoAgente = Extract<ElementoDeHilo, { tipo: 'agente' }>;

/** Las herramientas con las que el asistente se orienta (mapa, ficha, llamada indirecta): no son «trabajo» que la persona quiera ver. */
const HERRAMIENTAS_INTERNAS: ReadonlySet<string> = new Set(['software_mapa', 'herramienta_describir', 'herramienta_llamar']);

export const idDelAgente = (turnoId: string): string => `agente-${turnoId}`;
export const idDelError = (turnoId: string): string => `error-${turnoId}`;

/** Con el tope mensual o el asistente apagado, reintentar no sirve de nada: el botón no se ofrece. */
export const puedeReintentar = (motivo: MotivoDeErrorDelAgente): boolean => motivo !== 'tope_mensual' && motivo !== 'apagado';

function conAgente(hilo: readonly ElementoDeHilo[], turnoId: string, cambio: (a: ElementoAgente) => ElementoAgente): ElementoDeHilo[] {
  const id = idDelAgente(turnoId);
  const existe = hilo.some((e) => e.id === id);
  const base: readonly ElementoDeHilo[] = existe ? hilo : [...hilo, { id, tipo: 'agente', texto: '', estado: 'escribiendo' }];
  return base.map((e) => (e.id === id && e.tipo === 'agente' ? cambio(e) : e));
}

/**
 * Lo que el asistente consulta, hace o propone en un turno va ANTES de su texto: primero se ve el trabajo y luego la respuesta que lo resume.
 * La burbuja del turno se crea al empezar (para mostrar «pensando»), así que lo nuevo se coloca delante de ella.
 */
function antesDeLaRespuesta(hilo: readonly ElementoDeHilo[], turnoId: string, nuevo: ElementoDeHilo): ElementoDeHilo[] {
  const i = hilo.findIndex((e) => e.id === idDelAgente(turnoId));
  return i < 0 ? [...hilo, nuevo] : [...hilo.slice(0, i), nuevo, ...hilo.slice(i)];
}

/** Cierra las herramientas que seguían «en curso»: si el turno terminó, ninguna puede seguir consultando. */
const cerrarHerramientas = (hilo: readonly ElementoDeHilo[], estado: 'listo' | 'fallo'): ElementoDeHilo[] =>
  hilo.map((e) => (e.tipo === 'herramienta' && e.estado === 'en_curso' ? { ...e, estado } : e));

function alTerminarConError(hilo: readonly ElementoDeHilo[], e: Extract<EventoDelAgente, { type: 'error' }>, turnoId: string): ElementoDeHilo[] {
  const idAgente = idDelAgente(turnoId);
  // Una burbuja vacía no dice nada: si el asistente no llegó a escribir, solo queda el aviso.
  const sinVacia = hilo.filter((x) => !(x.id === idAgente && x.tipo === 'agente' && x.texto === ''));
  const marcada = sinVacia.map((x) => (x.id === idAgente && x.tipo === 'agente' ? { ...x, estado: 'error' as const } : x));
  const aviso: ElementoDeHilo = { id: idDelError(turnoId), tipo: 'aviso', tono: 'error', texto: e.mensaje };
  return [...cerrarHerramientas(marcada, 'fallo').filter((x) => x.id !== aviso.id), aviso];
}

/** Aplica un evento del turno al hilo. No muta nada: devuelve un hilo nuevo. */
export function aplicarEvento(hilo: readonly ElementoDeHilo[], e: EventoDelAgente, turnoId: string): ElementoDeHilo[] {
  switch (e.type) {
    case 'inicio':
      return conAgente(hilo, turnoId, (a) => a);
    case 'texto':
      return conAgente(hilo, turnoId, (a) => ({ ...a, texto: a.texto + e.delta }));
    case 'herramienta_inicio':
      return antesDeLaRespuesta(hilo, turnoId, { id: `herramienta-${e.id}`, tipo: 'herramienta', titulo: e.titulo, estado: 'en_curso', ...(HERRAMIENTAS_INTERNAS.has(e.nombre) ? { interna: true } : {}) });
    case 'herramienta_fin':
      return hilo.map((x) => (x.id === `herramienta-${e.id}` && x.tipo === 'herramienta' ? { ...x, estado: e.ok ? 'listo' : 'fallo', nota: e.nota } : x));
    case 'accion':
      return antesDeLaRespuesta(hilo, turnoId, { id: `accion-${turnoId}-${hilo.length}`, tipo: 'accion', titulo: e.titulo, ruta: rutaDeLoHecho(e.herramienta, e.entidadId) });
    case 'borrador':
      return antesDeLaRespuesta(hilo, turnoId, { id: `borrador-${e.borrador.id}`, tipo: 'borrador', propuesta: e.borrador, resuelto: null });
    case 'fin':
      return cerrarHerramientas(conAgente(hilo, turnoId, (a) => ({ ...a, estado: e.estado === 'completo' ? 'completo' : 'interrumpido' })), 'listo');
    case 'error':
      return alTerminarConError(hilo, e, turnoId);
    case 'uso':
      return [...hilo];
  }
}

/** La respuesta guardada de un turno cuando la conexión se cortó y se consulta la conversación. */
export type Recuperacion =
  | { tipo: 'completo'; texto: string }
  | { tipo: 'interrumpido'; texto: string }
  | { tipo: 'error' }
  | { tipo: 'seguir' };

/** Un turno «en curso» más viejo que esto se da por muerto (la función del servidor pudo suspenderse). */
export const MS_PARA_DAR_POR_INTERRUMPIDO = 150_000;
export const ESPERA_INICIAL_MS = 3_000;
export const ESPERA_ENTRE_CONSULTAS_MS = 4_000;
export const MAXIMO_DE_CONSULTAS = 5;

/** Lo que dice la conversación guardada sobre el turno que se quedó sin respuesta: ¿terminó, se cortó, o sigue? */
export function decidirRecuperacion(mensajes: readonly MensajeDelAgente[], turnoId: string, ahoraMs: number): Recuperacion {
  const m = mensajes.find((x) => x.turnoId === turnoId && x.rol === 'agente');
  if (!m) return { tipo: 'seguir' };
  if (m.estado === 'completo') return { tipo: 'completo', texto: m.contenido };
  if (m.estado === 'interrumpido') return { tipo: 'interrumpido', texto: m.contenido };
  if (m.estado === 'error') return { tipo: 'error' };
  return ahoraMs - Date.parse(m.creadoEn) >= MS_PARA_DAR_POR_INTERRUMPIDO ? { tipo: 'interrumpido', texto: m.contenido } : { tipo: 'seguir' };
}

const sinAvisosDelTurno = (hilo: readonly ElementoDeHilo[], turnoId: string): ElementoDeHilo[] => hilo.filter((e) => e.id !== idDelError(turnoId) && e.id !== `cortada-${turnoId}`);

/** Para reintentar: quita lo que dejó el intento anterior (el aviso de error o de corte) sin tocar el resto de la conversación. */
export const limpiarParaReintentar = sinAvisosDelTurno;

/**
 * La conexión se cortó y la conversación guardada dice cómo terminó el turno. Si terminó, la respuesta guardada reemplaza
 * a la que se alcanzó a pintar (que pudo quedar a medias); si se cortó, queda interrumpida con un aviso.
 */
export function aplicarRecuperacion(hilo: readonly ElementoDeHilo[], r: Exclude<Recuperacion, { tipo: 'seguir' }>, turnoId: string): ElementoDeHilo[] {
  const id = idDelAgente(turnoId);
  const base = sinAvisosDelTurno(hilo, turnoId);
  if (r.tipo === 'completo') {
    const sinBurbuja = base.filter((e) => e.id !== id);
    return cerrarHerramientas([...sinBurbuja, { id, tipo: 'agente' as const, texto: r.texto, estado: 'completo' as const }], 'listo');
  }
  const aviso: ElementoDeHilo = { id: idDelError(turnoId), tipo: 'aviso', tono: 'aviso', texto: r.tipo === 'error' ? 'No se pudo terminar la respuesta.' : 'La respuesta se interrumpió.' };
  const marcada = base.map((e) => (e.id === id && e.tipo === 'agente' ? { ...e, texto: r.tipo === 'interrumpido' && r.texto.length > e.texto.length ? r.texto : e.texto, estado: 'interrumpido' as const } : e));
  return [...cerrarHerramientas(marcada, 'fallo'), aviso];
}

/** La persona pulsó «Detener»: la respuesta queda como interrumpida. El servidor sigue y la respuesta completa queda en el historial. */
export function aplicarDetencion(hilo: readonly ElementoDeHilo[], turnoId: string): ElementoDeHilo[] {
  const id = idDelAgente(turnoId);
  const vacia = hilo.filter((e) => !(e.id === id && e.tipo === 'agente' && e.texto === ''));
  const marcada = vacia.map((e) => (e.id === id && e.tipo === 'agente' ? { ...e, estado: 'interrumpido' as const } : e));
  return [...cerrarHerramientas(marcada, 'fallo'), { id: `cortada-${turnoId}`, tipo: 'aviso', tono: 'info', texto: 'Detuviste la respuesta.' }];
}
