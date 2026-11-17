import { MAXIMO_DE_TEXTO_DE_CAPTURA } from '@capaz/shared';

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
