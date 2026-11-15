import { MAX_CARACTERES_DE_ARCHIVO, MAX_EVENTOS_POR_WEBHOOK, MAX_FILAS_IMPORTAR, type EntidadDeIntercambio } from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

export const ETIQUETA_DE_ESTADO_DE_CONEXION = {
  pendiente: 'Pendiente',
  activa: 'Activa',
  con_error: 'Con error',
  desactivada: 'Desactivada',
} as const;
export const TONO_DE_ESTADO_DE_CONEXION: Record<keyof typeof ETIQUETA_DE_ESTADO_DE_CONEXION, TonoDeInsignia> = {
  pendiente: 'aviso',
  activa: 'exito',
  con_error: 'peligro',
  desactivada: 'neutro',
};
export const ETIQUETA_DE_ESTADO_DE_ENVIO = { pendiente: 'Pendiente', enviado: 'Enviado', fallido: 'Fallido' } as const;
export const TONO_DE_ESTADO_DE_ENVIO: Record<keyof typeof ETIQUETA_DE_ESTADO_DE_ENVIO, TonoDeInsignia> = {
  pendiente: 'aviso',
  enviado: 'exito',
  fallido: 'peligro',
};
export const ETIQUETA_DE_AUTENTICACION = { clave_api: 'Clave de API', oauth2: 'Cuenta (OAuth)', ninguna: 'Sin credenciales' } as const;
export const ETIQUETA_DE_ENTIDAD: Record<EntidadDeIntercambio, string> = { clientes: 'Clientes', productos: 'Productos' };

// ---- Textos y valores de configuración ----

/** Texto escrito → valor: «true»/«false» a booleano, números a número, lo demás texto. */
export function valorDeTexto(texto: string): string | number | boolean {
  const t = texto.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return texto;
}

export function textoDeValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export type FilaDeCampo = { nombre: string; valor: string };

/** Filas escritas → objeto; descarta las sin nombre. Un nombre repetido es un error. */
export function objetoDeFilas(filas: readonly FilaDeCampo[]): { ok: true; datos: Record<string, unknown> } | { ok: false; error: string } {
  const datos: Record<string, unknown> = {};
  for (const f of filas) {
    const nombre = f.nombre.trim();
    if (!nombre) continue;
    if (nombre in datos) return { ok: false, error: `El campo «${nombre}» está repetido.` };
    datos[nombre] = valorDeTexto(f.valor);
  }
  return { ok: true, datos };
}

export function filasDeObjeto(objeto: Record<string, unknown>): FilaDeCampo[] {
  return Object.entries(objeto).map(([nombre, valor]) => ({ nombre, valor: textoDeValor(valor) }));
}

// ---- Webhooks ----

const EVENTO = /^(\*|[a-z][a-z0-9_]*\.(\*|[a-z][a-z0-9_]*))$/;

/** «cliente.creado, producto.*» (coma, espacio o salto de línea) → lista sin repetidos, validada. */
export function eventosDeTexto(texto: string): { ok: true; eventos: string[] } | { ok: false; error: string } {
  const eventos = [...new Set(texto.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean))];
  if (eventos.length === 0) return { ok: false, error: 'Elige al menos un evento.' };
  if (eventos.length > MAX_EVENTOS_POR_WEBHOOK) return { ok: false, error: `Como máximo ${MAX_EVENTOS_POR_WEBHOOK} eventos.` };
  const mala = eventos.find((e) => !EVENTO.test(e));
  if (mala) return { ok: false, error: `«${mala}» no es válido. Usa «cliente.creado», «cliente.*» o «*».` };
  return { ok: true, eventos };
}

export function validarUrlDeWebhook(url: string): string | undefined {
  const t = url.trim();
  if (!t) return 'Escribe la dirección que recibirá los envíos.';
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'La dirección debe empezar con https://.';
  } catch {
    return 'La dirección no es válida. Ejemplo: https://mi-sistema.pe/capaz.';
  }
  return undefined;
}

export function validarNombre(nombre: string, que: string): string | undefined {
  if (!nombre.trim()) return `Ponle un nombre ${que}.`;
  if (nombre.trim().length > 80) return 'El nombre es demasiado largo (máximo 80 caracteres).';
  return undefined;
}

// ---- Importar CSV ----

/** Filas de datos de un CSV (sin el encabezado ni las líneas vacías). Aproximado: no entiende saltos de línea entre comillas. */
export function contarFilasDeCsv(contenido: string): number {
  const lineas = contenido.split(/\r?\n/).filter((l) => l.trim() !== '').length;
  return Math.max(0, lineas - 1);
}

export function validarArchivoCsv(nombre: string, contenido: string): string | undefined {
  if (!/\.(csv|txt)$/i.test(nombre)) return 'Elige un archivo .csv (en Excel: Guardar como «CSV»).';
  if (contenido.trim() === '') return 'El archivo está vacío.';
  if (contenido.length > MAX_CARACTERES_DE_ARCHIVO) return `El archivo es demasiado grande: el máximo son ${MAX_CARACTERES_DE_ARCHIVO.toLocaleString('es-PE')} caracteres. Divídelo en partes.`;
  const filas = contarFilasDeCsv(contenido);
  if (filas > MAX_FILAS_IMPORTAR) return `El archivo tiene ${filas.toLocaleString('es-PE')} filas: el máximo son ${MAX_FILAS_IMPORTAR.toLocaleString('es-PE')} por importación. Divídelo en partes.`;
  return undefined;
}

export function resumenDeLectura(r: { total: number; nuevas?: number; creadas?: number; duplicadasTotal: number; erroresTotal: number }): string {
  const buenas = r.creadas ?? r.nuevas ?? 0;
  const verbo = r.creadas !== undefined ? 'creadas' : 'por crear';
  return `${r.total} filas leídas: ${buenas} ${verbo}, ${r.duplicadasTotal} repetidas (se omiten), ${r.erroresTotal} con error.`;
}

export function nombreDeArchivoSeguro(nombre: string): string {
  const limpio = nombre.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
  return limpio || 'exportacion.csv';
}

/** Muestra un instante de la API como fecha y hora locales; «—» si falta o no es válido. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}
