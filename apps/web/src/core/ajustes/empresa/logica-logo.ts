// Lógica pura del logo: validación del archivo, reducción de tamaño y búsqueda de una versión que quepa.
// El logo se guarda como data URL; nunca SVG ni URLs externas.

export const ANCHO_MAXIMO_LOGO = 400;
export const MAXIMO_CARACTERES_LOGO = 150_000;
/** Tamaño máximo del archivo que se lee en el navegador (se reduce antes de guardar). */
export const MAXIMO_BYTES_ARCHIVO = 8 * 1024 * 1024;
export const TIPOS_DE_LOGO = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type TipoDeLogo = (typeof TIPOS_DE_LOGO)[number];

const PREFIJO_SEGURO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Solo un data URL png/jpeg/webp se muestra; cualquier otra cosa (SVG, http…) no se renderiza. */
export function logoSeguro(valor: string | null | undefined): string | null {
  return valor && valor.length <= MAXIMO_CARACTERES_LOGO && PREFIJO_SEGURO.test(valor) ? valor : null;
}

/** Mensaje si el archivo elegido no sirve, o nulo. */
export function validarArchivoDeLogo(archivo: { type: string; size: number }): string | null {
  if (!(TIPOS_DE_LOGO as readonly string[]).includes(archivo.type)) return 'El logo debe ser una imagen PNG, JPEG o WebP (no se aceptan SVG).';
  if (archivo.size > MAXIMO_BYTES_ARCHIVO) return 'El archivo pesa demasiado: elige una imagen de menos de 8 MB.';
  if (archivo.size === 0) return 'El archivo está vacío.';
  return null;
}

/** Reduce al ancho máximo conservando la proporción; nunca agranda ni deja una medida en cero. */
export function dimensionesReducidas(ancho: number, alto: number, maximo = ANCHO_MAXIMO_LOGO): { ancho: number; alto: number } {
  if (!(ancho > 0) || !(alto > 0)) return { ancho: 1, alto: 1 };
  if (ancho <= maximo) return { ancho: Math.round(ancho), alto: Math.round(alto) };
  const factor = maximo / ancho;
  return { ancho: maximo, alto: Math.max(1, Math.round(alto * factor)) };
}

export type IntentoDeCodificacion = { tipo: TipoDeLogo; calidad: number; escala: number };

/** Intentos de más a menos fiel: primero PNG a tamaño completo, luego WebP/JPEG más comprimidos y más chicos. */
export const INTENTOS: readonly IntentoDeCodificacion[] = [
  { tipo: 'image/png', calidad: 1, escala: 1 },
  { tipo: 'image/webp', calidad: 0.9, escala: 1 },
  { tipo: 'image/webp', calidad: 0.75, escala: 1 },
  { tipo: 'image/jpeg', calidad: 0.8, escala: 1 },
  { tipo: 'image/png', calidad: 1, escala: 0.75 },
  { tipo: 'image/webp', calidad: 0.7, escala: 0.75 },
  { tipo: 'image/jpeg', calidad: 0.7, escala: 0.75 },
  { tipo: 'image/png', calidad: 1, escala: 0.5 },
  { tipo: 'image/webp', calidad: 0.6, escala: 0.5 },
  { tipo: 'image/jpeg', calidad: 0.6, escala: 0.5 },
  { tipo: 'image/jpeg', calidad: 0.5, escala: 0.3 },
];

export const MENSAJE_LOGO_NO_CABE = 'No logramos que el logo quepa: prueba con una imagen más simple o más pequeña.';

/**
 * Recorre los intentos hasta que uno produzca un data URL del tipo pedido que quepa en el límite.
 * `codificar` lo pone el navegador (canvas); si un formato no se soporta devuelve otro tipo y se salta.
 */
export function elegirLogo(codificar: (intento: IntentoDeCodificacion) => string | null, limite = MAXIMO_CARACTERES_LOGO): string | null {
  for (const intento of INTENTOS) {
    const url = codificar(intento);
    if (url && url.startsWith(`data:${intento.tipo};base64,`) && url.length <= limite) return url;
  }
  return null;
}
