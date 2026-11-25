import { MAXIMO_DE_TEXTO_DE_CAPTURA, type Respuesta } from '@capaz/shared';
import { SEGUNDOS_MAXIMOS_DE_GRABACION } from './logica-audio.ts';
import type { EstadoDeReconocedor, ViaDeVoz } from './reconocedor.ts';

// Lógica pura del reconocedor de voz: unir resultados y sesiones, y recortar. Sin navegador.

export type ListaDeResultados = {
  length: number;
  [indice: number]: { isFinal: boolean; [alternativa: number]: { transcript: string } | undefined } | undefined;
};

const transcripcion = (r: ListaDeResultados[number]): string => r?.[0]?.transcript ?? '';

/**
 * Texto de una sesión del reconocedor. En modo continuo se concatena todo; en el modo por sesiones
 * (Android) se unen los finales con el último parcial sin repetirlo.
 */
export function unirResultados(resultados: ListaDeResultados, continuo: boolean): string {
  if (continuo) {
    let texto = '';
    for (let i = 0; i < resultados.length; i++) texto += transcripcion(resultados[i]);
    return texto.trim();
  }
  let final = '';
  let parcial = '';
  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    if (r?.isFinal) final += transcripcion(r);
    else parcial = transcripcion(r);
  }
  final = final.trim();
  parcial = parcial.trim();
  if (!parcial) return final;
  if (!final) return parcial;
  if (final === parcial || final.endsWith(parcial)) return final;
  return `${final} ${parcial}`.trim();
}

/** Une sesiones de Android sin repetir palabras al reiniciar el micrófono. */
export function unirSesion(acumulado: string, sesion: string): string {
  const acc = acumulado.trim();
  const ses = sesion.trim();
  if (!acc) return ses;
  if (!ses) return acc;
  if (ses.startsWith(acc)) return ses;
  const accMin = acc.toLowerCase();
  const sesMin = ses.toLowerCase();
  for (let largo = Math.min(acc.length, 20); largo > 0; largo--) {
    if (sesMin.startsWith(accMin.slice(-largo))) return `${acc}${ses.slice(largo)}`.trim();
  }
  return `${acc} ${ses}`.trim();
}

export const recortarTexto = (texto: string, maximo = MAXIMO_DE_TEXTO_DE_CAPTURA): string => texto.slice(0, maximo);

/** Lo dictado a continuación de lo que ya estaba escrito, dentro del máximo permitido. */
export function unirConBase(base: string, dictado: string, maximo = MAXIMO_DE_TEXTO_DE_CAPTURA): string {
  const b = base.trimEnd();
  const d = dictado.trim();
  if (!b) return recortarTexto(d, maximo);
  if (!d) return recortarTexto(b, maximo);
  return recortarTexto(`${b} ${d}`, maximo);
}

export const AVISO_SIN_CONTEXTO_SEGURO = 'El micrófono necesita una conexión segura (https). Mientras tanto, escribe o usa el micrófono del teclado.';
export const AVISO_SIN_RECONOCIMIENTO = 'Este navegador no reconoce voz. Usa Chrome, o escribe.';

export const avisoDeErrorDeVoz = (codigo: string, android: boolean): string | null => {
  switch (codigo) {
    case 'no-speech':
      return 'No te escuché. Habla más cerca e intenta de nuevo.';
    case 'not-allowed':
    case 'service-not-allowed':
      return android
        ? 'Permite el micrófono: toca el candado en la barra de Chrome, elige Micrófono, Permitir, y recarga.'
        : 'Permite el micrófono: clic en el candado junto a la dirección, elige Micrófono, Permitir, y recarga.';
    case 'audio-capture':
      return 'No encontré el micrófono. Cierra otras apps que lo estén usando.';
    case 'network':
      return 'La voz necesita internet. Revisa tu conexión e intenta de nuevo.';
    default:
      return null;
  }
};

// --- Qué vía de voz usar y cómo se ve (Web Speech del navegador o grabar y transcribir en el servidor) ---

/** Lo que trae el navegador. Se lee una vez al abrir la pantalla. */
export type CapacidadesDeVoz = {
  contextoSeguro: boolean;
  /** `SpeechRecognition` (Chrome, Edge, Safari). Firefox no lo trae. */
  reconocimiento: boolean;
  grabadora: boolean;
  microfono: boolean;
  audio: boolean;
};

export type ViaElegida = 'navegador' | 'audio' | 'ninguna' | 'sin_contexto_seguro';

/** Web Speech si existe; si no, grabar y transcribir (si hay con qué); si no, ninguna. Las dos piden https (o localhost). */
export function elegirViaDeVoz(c: CapacidadesDeVoz): ViaElegida {
  if (!c.contextoSeguro) return 'sin_contexto_seguro';
  if (c.reconocimiento) return 'navegador';
  if (c.grabadora && c.microfono && c.audio) return 'audio';
  return 'ninguna';
}

/** La línea de estado bajo la caja mientras se dicta. */
export function lineaDeEstadoDeVoz(estado: EstadoDeReconocedor, via: ViaDeVoz | undefined): string | null {
  if (estado === 'transcribiendo') return 'Transcribiendo…';
  if (estado !== 'escuchando') return null;
  return via === 'audio' ? 'Grabando… (toca para terminar)' : 'Escuchando… habla y revisa el texto antes de enviar.';
}

/** El texto del botón grande de la pantalla de dictado. */
export function etiquetaDelBotonDeVoz(estado: EstadoDeReconocedor, via: ViaDeVoz | undefined): string {
  if (estado === 'transcribiendo') return 'Transcribiendo…';
  if (estado !== 'escuchando') return 'Tocar para hablar';
  return via === 'audio' ? 'Grabando… (toca para terminar)' : 'Escuchando… toca para detener';
}

export const AVISO_TOPE_DE_GRABACION = `Llegaste al máximo de ${SEGUNDOS_MAXIMOS_DE_GRABACION} segundos: transcribí hasta ahí. Si falta algo, dicta otra vez.`;
export const AVISO_GRABACION_ILEGIBLE = 'No pude leer la grabación. Intenta de nuevo o escribe el texto.';

/** El nombre del error de `getUserMedia` como los códigos de Web Speech, para reutilizar sus avisos. */
export function codigoDeErrorDeMicrofono(nombre: string): string {
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'not-allowed';
  if (nombre === 'NotFoundError' || nombre === 'NotReadableError' || nombre === 'OverconstrainedError') return 'audio-capture';
  return 'desconocido';
}

export type DesenlaceDeTranscripcion = { texto: string; estado: Extract<EstadoDeReconocedor, 'listo' | 'error' | 'no_disponible'>; aviso: string | null };

/**
 * Qué queda tras la respuesta del servidor. Si el servidor no transcribe (apagado o tope del mes), el micrófono se quita y queda la nota
 * discreta: no tiene sentido volver a grabar. Lo demás se puede reintentar.
 */
export function desenlaceDeTranscripcion(r: Respuesta<{ texto: string }>): DesenlaceDeTranscripcion {
  if (r.ok) {
    const texto = recortarTexto(r.datos.texto.trim());
    return { texto, estado: 'listo', aviso: texto ? null : avisoDeErrorDeVoz('no-speech', false) };
  }
  const codigo = 'error' in r ? r.error.codigo : 'error_interno';
  const mensaje = 'error' in r ? r.error.mensaje : AVISO_GRABACION_ILEGIBLE;
  if (codigo === 'apagado') return { texto: '', estado: 'no_disponible', aviso: AVISO_SIN_RECONOCIMIENTO };
  if (codigo === 'tope_mensual') return { texto: '', estado: 'no_disponible', aviso: mensaje };
  if (codigo === 'sin_conexion') return { texto: '', estado: 'error', aviso: avisoDeErrorDeVoz('network', false) };
  return { texto: '', estado: 'error', aviso: mensaje };
}
