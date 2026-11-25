import type { CapturaPropuesta } from '@capaz/shared';

// El hilo del asistente: lo que se ve en pantalla, como una lista que solo crece. Lógica pura, sin React: se prueba sin DOM.

export type Resolucion = 'aprobado' | 'descartado' | 'despues';
export type TonoDeAviso = 'info' | 'aviso' | 'error';
export type EnlaceDeAviso = { texto: string; ruta: string };

export type ElementoDeHilo =
  | { id: string; tipo: 'persona'; texto: string }
  | { id: string; tipo: 'agente'; texto: string; estado: 'escribiendo' | 'completo' | 'error' | 'interrumpido' }
  | { id: string; tipo: 'borrador'; propuesta: CapturaPropuesta['borradores'][number]; resuelto: Resolucion | null }
  | { id: string; tipo: 'aviso'; tono: TonoDeAviso; texto: string; enlace?: EnlaceDeAviso }
  /** Algo que el asistente HIZO (lo confirmó el servidor): se pinta como una tarjeta con un enlace a lo creado. */
  | { id: string; tipo: 'accion'; titulo: string; ruta: string | null }
  /** Una herramienta que el asistente está usando o ya usó: «Consultando pedidos…». Nunca lleva datos, solo una nota corta. */
  | { id: string; tipo: 'herramienta'; titulo: string; estado: 'en_curso' | 'listo' | 'fallo'; nota?: string; interna?: boolean };

export type AccionDeHilo =
  | { tipo: 'persona_envia'; id: string; texto: string }
  | { tipo: 'captura_respondio'; id: string; propuesta: CapturaPropuesta }
  | { tipo: 'aviso'; id: string; tono: TonoDeAviso; texto: string; enlace?: EnlaceDeAviso }
  | { tipo: 'borrador_resuelto'; borradorId: string; resolucion: Resolucion }
  | { tipo: 'limpiar' };

/** Frases de ejemplo que el vacío del panel ofrece; rellenan la caja, no envían. */
export const SUGERENCIAS_INICIALES: readonly string[] = [
  'Ingreso 500 soles, cliente Juan Pérez, flyers',
  'Egreso 350 soles, proveedor Pacheco, cartulina',
  'Abono de 100 soles de Cristina',
];

/** Con el asistente activo se le puede preguntar: las frases de ejemplo cambian. Rellenan la caja, no envían. */
export const SUGERENCIAS_CON_ASISTENTE: readonly string[] = ['¿Qué tengo pendiente hoy?', '¿Quién me debe?', 'Registra un ingreso de '];

const MENSAJE_SIN_REGISTRO = 'No pude armar un registro con eso.';

function textoSinRegistro(faltan: readonly string[], pista: string | null): string {
  const partes = [MENSAJE_SIN_REGISTRO];
  if (faltan.length > 0) partes.push(`Falta: ${faltan.join(', ')}.`);
  if (pista) partes.push(pista);
  return partes.join(' ');
}

function elementosDeCaptura(id: string, p: CapturaPropuesta): ElementoDeHilo[] {
  if (p.borradores.length === 0) {
    return [{ id: `${id}-sin-registro`, tipo: 'aviso', tono: 'aviso', texto: textoSinRegistro(p.faltan, p.pista) }];
  }
  const tarjetas: ElementoDeHilo[] = p.borradores.map((b) => ({ id: `${id}-${b.id}`, tipo: 'borrador', propuesta: b, resuelto: null }));
  if (p.faltan.length === 0) return tarjetas;
  return [...tarjetas, { id: `${id}-revisa`, tipo: 'aviso', tono: 'aviso', texto: `Revisa: ${p.faltan.join(', ')}.` }];
}

export function reducirHilo(hilo: readonly ElementoDeHilo[], a: AccionDeHilo): ElementoDeHilo[] {
  switch (a.tipo) {
    case 'persona_envia':
      return [...hilo, { id: a.id, tipo: 'persona', texto: a.texto }];
    case 'captura_respondio':
      return [...hilo, ...elementosDeCaptura(a.id, a.propuesta)];
    case 'aviso':
      return [...hilo, { id: a.id, tipo: 'aviso', tono: a.tono, texto: a.texto, ...(a.enlace ? { enlace: a.enlace } : {}) }];
    case 'borrador_resuelto':
      return hilo.map((e) => (e.tipo === 'borrador' && e.propuesta.id === a.borradorId ? { ...e, resuelto: a.resolucion } : e));
    case 'limpiar':
      return [];
  }
}
