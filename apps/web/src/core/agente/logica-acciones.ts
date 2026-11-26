import type { ElementoDeHilo } from './logica-hilo.ts';

// Lo que el asistente hizo, mostrado como algo que se puede abrir; qué está haciendo ahora; y pequeños ayudantes de la pantalla vacía.
// Lógica pura, sin React: se prueba sin DOM.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La pantalla donde se ve lo que el asistente acaba de crear o cambiar. Solo con un id de verdad: nunca se arma una ruta con texto del modelo. */
export function rutaDeLoHecho(herramienta: string, entidadId: string | null): string | null {
  if (!entidadId || !UUID.test(entidadId)) return null;
  if (herramienta.startsWith('clientes_')) return `/clientes/${entidadId}`;
  if (herramienta.startsWith('productos_')) return `/productos/${entidadId}`;
  if (herramienta.startsWith('produccion_orden_')) return `/m/produccion/${entidadId}`;
  if (herramienta.startsWith('pedido_')) return `/m/ordenes/${entidadId}`;
  if (herramienta.startsWith('guia_')) return `/m/ordenes/guias/${entidadId}`;
  if (herramienta.startsWith('cotizacion_')) return `/m/cotizador/cotizaciones/${entidadId}`;
  if (herramienta.startsWith('oportunidad_')) return `/m/crm/oportunidades/${entidadId}`;
  if (herramienta.startsWith('movimiento_')) return `/m/registro/movimientos/${entidadId}`;
  if (herramienta.startsWith('deuda_')) return `/m/registro/deudas/${entidadId}`;
  return null;
}

export type EstadoVivo = { texto: string; nivel: 'pensando' | 'trabajando' | 'escribiendo' };

/** Qué está haciendo el asistente ahora mismo, para el cabezal: «Consultando…», «Escribiendo…». `null` si no hay una respuesta en curso. */
export function estadoVivo(hilo: readonly ElementoDeHilo[], ocupado: boolean): EstadoVivo | null {
  if (!ocupado) return null;
  const ultima = hilo.at(-1);
  const enCurso = [...hilo].reverse().find((e) => e.tipo === 'herramienta' && e.estado === 'en_curso');
  if (ultima?.tipo === 'agente' && ultima.estado === 'escribiendo' && ultima.texto !== '') return { texto: 'Escribiendo…', nivel: 'escribiendo' };
  if (enCurso?.tipo === 'herramienta') return { texto: `${enCurso.titulo}…`, nivel: 'trabajando' };
  return { texto: 'Pensando…', nivel: 'pensando' };
}

// Solo las formas CON tilde: «que» sin tilde es una conjunción («¿Quieres que lo confirme?») y no hace abierta la pregunta.
const PREGUNTA_ABIERTA = /(?:^|[^\p{L}])(cuál(?:es)?|qué|quién(?:es)?|cuánt[oa]s?|cómo|dónde|cuándo|dime|indícame|dame)(?![\p{L}])/iu;

/** Respuestas de un toque cuando la última respuesta del asistente es una pregunta de sí o no. Vacío si es una pregunta abierta. */
export function respuestasRapidas(hilo: readonly ElementoDeHilo[], ocupado: boolean): string[] {
  const ultima = hilo.at(-1);
  if (ocupado || ultima?.tipo !== 'agente' || ultima.estado !== 'completo') return [];
  const ultimoParrafo = ultima.texto.trim().split(/\n\s*\n|\n/).filter(Boolean).at(-1) ?? '';
  // Solo la última pregunta (desde su «¿»): lo anterior en el mismo párrafo no cuenta.
  const pregunta = ultimoParrafo.slice(Math.max(0, ultimoParrafo.lastIndexOf('¿')));
  if (!pregunta.endsWith('?') || PREGUNTA_ABIERTA.test(pregunta)) return [];
  return ['Sí', 'No'];
}

export function saludoPorHora(hora: number): string {
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export type AccionRapida = { icono: 'inicio' | 'cobro' | 'mas' | 'buscar'; titulo: string; detalle: string; frase: string };

/** Los atajos de la pantalla vacía. Rellenan la caja (no envían): la persona termina la frase o la corrige. */
export const ACCIONES_RAPIDAS: readonly AccionRapida[] = [
  { icono: 'inicio', titulo: 'Mi día', detalle: 'Entregas, cobros y pendientes', frase: '¿Qué tengo pendiente hoy?' },
  { icono: 'cobro', titulo: '¿Quién me debe?', detalle: 'Deudas por cobrar', frase: '¿Quién me debe?' },
  { icono: 'mas', titulo: 'Nuevo pedido', detalle: 'Cliente, productos y entrega', frase: 'Crea un pedido: cliente ' },
  { icono: 'buscar', titulo: 'Buscar cliente', detalle: 'Sus datos, deudas y pedidos', frase: 'Busca al cliente ' },
];
