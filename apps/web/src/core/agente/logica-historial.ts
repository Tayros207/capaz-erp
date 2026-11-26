import { plegarParaBuscar, type ConversacionDelAgente, type MensajeDelAgente } from '@capaz/shared';
import type { ElementoDeHilo } from './logica-hilo.ts';
import { idDelAgente } from './logica-turno.ts';

// La lista de conversaciones y cómo se vuelve a pintar una conversación guardada. Puras: la fecha de hoy se inyecta.

export type GrupoDeConversaciones = { clave: 'favoritas' | 'hoy' | 'ayer' | 'semana' | 'anteriores'; titulo: string; items: ConversacionDelAgente[] };

const TITULOS: Record<GrupoDeConversaciones['clave'], string> = { favoritas: 'Favoritas', hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana', anteriores: 'Anteriores' };
const ORDEN: readonly GrupoDeConversaciones['clave'][] = ['favoritas', 'hoy', 'ayer', 'semana', 'anteriores'];

/** El día (AAAA-MM-DD) de un instante en la zona horaria de la empresa: «hoy» para un taller en Lima no es «hoy» en UTC. */
const diaEnZona = (instante: Date, zona: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(instante);
const diasEntre = (a: string, b: string): number => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

function claveDeFecha(actualizadoEn: string, hoy: string, zona: string): Exclude<GrupoDeConversaciones['clave'], 'favoritas'> {
  const dias = diasEntre(hoy, diaEnZona(new Date(actualizadoEn), zona));
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return dias < 7 ? 'semana' : 'anteriores';
}

/** Favoritas arriba; después Hoy, Ayer, Esta semana y Anteriores. Los grupos vacíos no salen; dentro de cada grupo se conserva el orden recibido. */
export function agruparConversaciones(items: readonly ConversacionDelAgente[], ahora: Date, zona = 'America/Lima'): GrupoDeConversaciones[] {
  const hoy = diaEnZona(ahora, zona);
  const grupos = new Map<GrupoDeConversaciones['clave'], ConversacionDelAgente[]>();
  for (const c of items) {
    const clave = c.favorita ? 'favoritas' : claveDeFecha(c.actualizadoEn, hoy, zona);
    grupos.set(clave, [...(grupos.get(clave) ?? []), c]);
  }
  return ORDEN.flatMap((clave) => (grupos.has(clave) ? [{ clave, titulo: TITULOS[clave], items: grupos.get(clave) ?? [] }] : []));
}

/** Cuándo se usó, corto: la hora si fue hoy o ayer (el grupo ya dice el día) y la fecha si es más vieja o es una favorita. */
export function momentoDeConversacion(actualizadoEn: string, clave: GrupoDeConversaciones['clave'], zona = 'America/Lima'): string {
  const f = new Date(actualizadoEn);
  if (Number.isNaN(f.getTime())) return '';
  const formato: Intl.DateTimeFormatOptions = clave === 'hoy' || clave === 'ayer' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { day: 'numeric', month: 'short' };
  return new Intl.DateTimeFormat('es-PE', { ...formato, timeZone: zona }).format(f);
}

/** Busca por título sin distinguir mayúsculas ni tildes. Una búsqueda vacía no filtra. */
export function filtrarPorTitulo(items: readonly ConversacionDelAgente[], texto: string): ConversacionDelAgente[] {
  const buscado = plegarParaBuscar(texto).trim();
  return buscado === '' ? [...items] : items.filter((c) => plegarParaBuscar(c.titulo).includes(buscado));
}

const lista = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object') : []);
const textoDe = (x: unknown): string | null => (typeof x === 'string' && x.trim() !== '' ? x : null);

/** Lo que el asistente hizo y propuso en un turno, como líneas del hilo. Lee con tolerancia: un mensaje viejo no debe romper la lista. */
function hechosDe(m: MensajeDelAgente): ElementoDeHilo[] {
  const acciones = lista(m.metadatos.acciones).flatMap((a, i): ElementoDeHilo[] => {
    const titulo = textoDe(a.titulo);
    return titulo ? [{ id: `accion-${m.id}-${i}`, tipo: 'aviso', tono: 'info', texto: `Hecho: ${titulo}.` }] : [];
  });
  const borradores = lista(m.metadatos.borradores).flatMap((b, i): ElementoDeHilo[] => {
    const resumen = textoDe(b.resumen);
    return resumen ? [{ id: `propuesta-${m.id}-${i}`, tipo: 'aviso', tono: 'info', texto: `Propuso: ${resumen}. Falta aprobarlo.`, enlace: { texto: 'Abrir la Bandeja', ruta: '/bandeja' } }] : [];
  });
  return [...acciones, ...borradores];
}

/** Una conversación guardada, vuelta a pintar. Una respuesta que quedó «en curso» es una que se cortó: se muestra como interrumpida. */
export function mensajesAHilo(mensajes: readonly MensajeDelAgente[]): ElementoDeHilo[] {
  return mensajes.flatMap((m): ElementoDeHilo[] => {
    if (m.rol === 'persona') return [{ id: `persona-${m.id}`, tipo: 'persona', texto: m.contenido }];
    const estado = m.estado === 'completo' ? 'completo' : m.estado === 'error' ? 'error' : 'interrumpido';
    const burbuja: ElementoDeHilo[] = m.contenido.trim() === '' ? [] : [{ id: idDelAgente(m.turnoId), tipo: 'agente', texto: m.contenido, estado }];
    const hechos = hechosDe(m);
    const cortada: ElementoDeHilo[] = estado !== 'completo' && burbuja.length === 0 && hechos.length === 0 ? [{ id: `cortada-${m.id}`, tipo: 'aviso', tono: 'aviso', texto: 'La respuesta se interrumpió.' }] : [];
    return [...burbuja, ...hechos, ...cortada];
  });
}
