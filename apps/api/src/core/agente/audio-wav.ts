// Lectura de la cabecera de un WAV (PCM de 16 bits) para el dictado por audio. Pura: no guarda ni registra el audio, solo mide.
// El servidor no confía en lo que diga la web: la duración sale de la cabecera y del tamaño real de los datos.

export type CabeceraWav = { canales: number; frecuencia: number; bitsPorMuestra: number; bytesDeDatos: number; segundos: number };
export type LecturaDeWav = { ok: true; cabecera: CabeceraWav } | { ok: false; motivo: string };

const MINIMO_DE_FRECUENCIA = 8_000;
const MAXIMO_DE_FRECUENCIA = 48_000;
/** Un WAV bien hecho trae pocos bloques (fmt, data y quizá LIST): más es basura o un intento de gastar CPU. */
const MAXIMO_DE_BLOQUES = 16;

const MAL_FORMADO = 'El audio no es un WAV válido.';

const texto4 = (b: Uint8Array, desde: number): string => String.fromCharCode(b[desde] ?? 0, b[desde + 1] ?? 0, b[desde + 2] ?? 0, b[desde + 3] ?? 0);

type Formato = { codigo: number; canales: number; frecuencia: number; bytesPorSegundo: number; alineacion: number; bits: number };

function leerFormato(v: DataView, desde: number, tamano: number): Formato | null {
  if (tamano < 16) return null;
  return {
    codigo: v.getUint16(desde, true),
    canales: v.getUint16(desde + 2, true),
    frecuencia: v.getUint32(desde + 4, true),
    bytesPorSegundo: v.getUint32(desde + 8, true),
    alineacion: v.getUint16(desde + 12, true),
    bits: v.getUint16(desde + 14, true),
  };
}

/** Solo PCM lineal de 16 bits, mono o estéreo, de 8 a 48 kHz, con las cuentas de la cabecera coherentes entre sí. */
function formatoAdmitido(f: Formato): boolean {
  if (f.codigo !== 1 || f.bits !== 16) return false;
  if (f.canales < 1 || f.canales > 2) return false;
  if (f.frecuencia < MINIMO_DE_FRECUENCIA || f.frecuencia > MAXIMO_DE_FRECUENCIA) return false;
  return f.alineacion === f.canales * 2 && f.bytesPorSegundo === f.frecuencia * f.alineacion;
}

type Bloques = { formato: Formato | null; datos: number | null };

/** Recorre los bloques RIFF buscando `fmt ` y `data`. El tamaño de `data` no puede pasar del final real del archivo. */
function recorrerBloques(b: Uint8Array): Bloques | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const salida: Bloques = { formato: null, datos: null };
  let pos = 12;
  for (let i = 0; i < MAXIMO_DE_BLOQUES && pos + 8 <= b.length; i++) {
    const id = texto4(b, pos);
    const tamano = v.getUint32(pos + 4, true);
    const cuerpo = pos + 8;
    if (cuerpo + tamano > b.length) return null;
    if (id === 'fmt ') salida.formato = leerFormato(v, cuerpo, tamano);
    if (id === 'data') {
      salida.datos = tamano;
      return salida;
    }
    // Los bloques de tamaño impar llevan un byte de relleno.
    pos = cuerpo + tamano + (tamano % 2);
  }
  return salida;
}

export function leerWav(b: Uint8Array): LecturaDeWav {
  if (b.length < 44 || texto4(b, 0) !== 'RIFF' || texto4(b, 8) !== 'WAVE') return { ok: false, motivo: MAL_FORMADO };
  const bloques = recorrerBloques(b);
  if (!bloques?.formato || bloques.datos === null) return { ok: false, motivo: MAL_FORMADO };
  const f = bloques.formato;
  if (!formatoAdmitido(f)) return { ok: false, motivo: 'El audio debe ser WAV PCM de 16 bits (mono o estéreo, de 8 a 48 kHz).' };
  if (bloques.datos === 0 || bloques.datos % f.alineacion !== 0) return { ok: false, motivo: 'El audio está vacío o cortado.' };
  return {
    ok: true,
    cabecera: { canales: f.canales, frecuencia: f.frecuencia, bitsPorMuestra: f.bits, bytesDeDatos: bloques.datos, segundos: bloques.datos / f.bytesPorSegundo },
  };
}
