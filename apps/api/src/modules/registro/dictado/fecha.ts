// REGLA NUEVA (no portada de Tairos.RC): fechas relativas. Solo retrocede: «ayer» y «anteayer».
// No entiende días de la semana ni fechas con número. Aritmética en UTC, sin Date local.

const MS_POR_DIA = 86_400_000;

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// Límites de palabra con letras Unicode (el \b de JavaScript no sirve con tildes).
const palabra = (cuerpo: string): RegExp => new RegExp(`(?<![\\p{L}])(?:${cuerpo})(?![\\p{L}])`, 'u');
const ANTEAYER = palabra('anteayer|antier|antes\\s+de\\s+ayer');
const AYER = palabra('ayer');

function restarDias(hoy: string, dias: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoy);
  if (!m) return null;
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(base - dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** AAAA-MM-DD si el texto dice «ayer» o «anteayer»; `null` en cualquier otro caso (hoy lo pone la herramienta). */
export function fechaDictada(texto: string, hoy: string): string | null {
  const t = normalizar(texto);
  if (ANTEAYER.test(t)) return restarDias(hoy, 2);
  if (AYER.test(t)) return restarDias(hoy, 1);
  return null;
}
