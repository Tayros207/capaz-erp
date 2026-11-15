import { RUTA_DE_DATO, type Condicion } from '@capaz/shared';

// Evaluador PURO de condiciones y sustitución de plantillas. Sin código ni expresiones: seis operadores
// sobre rutas con puntos, y `{{ruta.del.dato}}` en los textos.

const PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);

/** Busca `ruta` en `raiz` siguiendo solo propias; `undefined` si no existe. */
export function valorDe(raiz: unknown, ruta: string): unknown {
  if (!RUTA_DE_DATO.test(ruta)) return undefined;
  let actual: unknown = raiz;
  for (const parte of ruta.split('.')) {
    if (PROHIBIDAS.has(parte) || actual === null || typeof actual !== 'object') return undefined;
    if (!Object.hasOwn(actual, parte)) return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

const esPrimitivo = (v: unknown): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v);
const FECHA = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

function comoNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Orden entre dos valores: por número, por fecha ISO o nada (nulo = no comparables). */
function ordenar(a: unknown, b: unknown): number | null {
  const x = comoNumero(a);
  const y = comoNumero(b);
  if (x !== null && y !== null) return x - y;
  if (typeof a === 'string' && typeof b === 'string' && FECHA.test(a) && FECHA.test(b)) {
    const f = Date.parse(a);
    const g = Date.parse(b);
    if (!Number.isNaN(f) && !Number.isNaN(g)) return f - g;
  }
  return null;
}

function iguales(a: unknown, b: unknown): boolean {
  if (esPrimitivo(a) && esPrimitivo(b)) {
    const x = comoNumero(a);
    const y = comoNumero(b);
    return x !== null && y !== null && typeof a !== 'boolean' && typeof b !== 'boolean' ? x === y : String(a) === String(b);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function contiene(a: unknown, b: unknown): boolean {
  if (Array.isArray(a)) return a.some((x) => iguales(x, b));
  if (typeof a === 'string' && esPrimitivo(b)) return a.toLowerCase().includes(String(b).toLowerCase());
  return false;
}

export function evaluarCondicion(c: Condicion, raiz: unknown): boolean {
  const v = valorDe(raiz, c.campo);
  const hay = v !== undefined && v !== null;
  switch (c.op) {
    case 'existe':
      return hay === (c.valor ?? true);
    case 'igual':
      return hay && iguales(v, c.valor);
    case 'distinto':
      return !hay || !iguales(v, c.valor);
    case 'mayor':
      return hay && (ordenar(v, c.valor) ?? Number.NEGATIVE_INFINITY) > 0;
    case 'menor':
      return hay && (ordenar(v, c.valor) ?? Number.POSITIVE_INFINITY) < 0;
    case 'contiene':
      return hay && contiene(v, c.valor);
  }
}

/** Todas unidas por «y». Sin condiciones: siempre coincide. */
export const evaluarCondiciones = (cs: readonly Condicion[], raiz: unknown): boolean => cs.every((c) => evaluarCondicion(c, raiz));

const PLANTILLA = /\{\{\s*([^{}]*?)\s*\}\}/g;
const SOLO_PLANTILLA = /^\{\{\s*([^{}]*?)\s*\}\}$/;

const comoTexto = (v: unknown): string => (typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean));

/**
 * Sustituye `{{ruta}}` en los valores de texto (en profundidad; las claves no se tocan). Un texto que es
 * solo una plantilla conserva el tipo del dato. Una ruta sin dato se anota en `faltantes`.
 */
export function sustituir(valor: unknown, raiz: unknown): { valor: unknown; faltantes: string[] } {
  const faltantes: string[] = [];
  const ir = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const sola = SOLO_PLANTILLA.exec(v);
      if (sola?.[1] !== undefined) {
        const d = valorDe(raiz, sola[1]);
        if (d === undefined || d === null) faltantes.push(sola[1]);
        return d ?? null;
      }
      return v.replace(PLANTILLA, (_t, ruta: string) => {
        const d = valorDe(raiz, ruta);
        if (d === undefined || d === null) {
          faltantes.push(ruta);
          return '';
        }
        return comoTexto(d);
      });
    }
    if (Array.isArray(v)) return v.map(ir);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ir(x)]));
    return v;
  };
  const resultado = ir(valor);
  return { valor: resultado, faltantes: [...new Set(faltantes)] };
}

// --- días en la zona horaria de la empresa ---

export function diaLocal(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
