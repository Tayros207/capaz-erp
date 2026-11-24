import type { AccionDelAgente, Leccion } from '@capaz/shared';

// Textos y formatos de las pantallas de control del asistente: lo que hizo y lo que aprendió. Sin DOM, para probarlos.

const RESULTADOS: Record<AccionDelAgente['resultado'], string> = {
  ok: 'Hecho',
  rechazada: 'No se pudo',
  pendiente_confirmacion: 'Pidió confirmar',
  propuesta: 'Dejó un borrador',
};
export const etiquetaDeResultado = (r: AccionDelAgente['resultado']): string => RESULTADOS[r];

const POLITICAS: Record<AccionDelAgente['politica'], string> = { directo: 'Lo hizo solo', confirmada: 'Acción crítica confirmada', propuesta: 'Para que una persona lo apruebe' };
export const etiquetaDePolitica = (p: AccionDelAgente['politica']): string => POLITICAS[p];

const ESTADOS: Record<Leccion['estado'], string> = { por_revisar: 'Por revisar', vigente: 'Vigente', archivada: 'Archivada' };
export const etiquetaDeEstadoDeLeccion = (e: Leccion['estado']): string => ESTADOS[e];

const ORIGENES: Record<Leccion['origen'], string> = { persona: 'La dijo una persona', sistema: 'La aprendió sola', modelo: 'La propuso el asistente' };
export const etiquetaDeOrigenDeLeccion = (o: Leccion['origen']): string => ORIGENES[o];

/** Céntimos enteros → «S/ 1,000.00». Nunca con decimales de `number` (regla 9): se parte en enteros. */
export function formatoSoles(centimos: number): string {
  const entero = Math.trunc(centimos / 100);
  const resto = Math.abs(centimos % 100).toString().padStart(2, '0');
  return `S/ ${entero.toLocaleString('en-US')}.${resto}`;
}

/** Lo que la persona escribe en soles («1000», «1,000.50») → céntimos enteros, o `null` si no es un importe válido. */
export function solesACentimos(texto: string): number | null {
  const limpio = texto.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const [enteros = '0', decimales = ''] = limpio.split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
}

/** «24 nov, 14:05» en la hora de la persona; las fechas ya vienen en ISO. */
export function fechaCorta(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);
}

/** Los argumentos de una acción, para mostrarlos sin volcar objetos enormes: claves y valores simples, recortado. */
export function resumenDeArgumentos(args: unknown, maximo = 140): string {
  if (args === null || typeof args !== 'object') return '';
  const partes = Object.entries(args as Record<string, unknown>)
    .filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
    .map(([k, v]) => `${k}: ${String(v)}`);
  const texto = partes.join(' · ');
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}

/** El nombre de una herramienta como se lee en una lista: «movimiento_registrar» → «Movimiento registrar». */
export function tituloDeHerramienta(nombre: string): string {
  const t = nombre.replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
