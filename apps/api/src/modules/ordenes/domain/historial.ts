import { createHash } from 'node:crypto';
import { CLIENTE_DE_HISTORIAL_SIN_NOMBRE, MAX_FILAS_IMPORTAR, type FilaConMotivo } from '@capaz/shared';
import { normalizarNombre } from '../../../core/clientes/domain/normalizacion.js';
import { leerCsv, type Separador } from '../../../core/intercambio/csv.js';
import { mapearColumnasDeHistorial, type CampoDeHistorial } from './historial-columnas.js';

// Reglas puras del importador del historial: leer el archivo fila por fila, validar y sacar la huella. Sin base.

export const MAXIMO_DE_DESCRIPCION = 300;
export const MAXIMO_DE_NOTAS = 2000;
export const MAXIMO_DE_NOMBRE = 200;
export const MAXIMO_DE_TOTAL_CENTIMOS = 100_000_000; // S/ 1,000,000.00
const MAXIMO_DE_ETIQUETA = 200;

export type FilaDeHistorial = {
  fila: number;
  fecha: string;
  /** Nombre del cliente tal como viene; `null` si venía vacío o «(sin nombre)» (va a «Clientes varios»). */
  cliente: string | null;
  clienteOriginal: string | null;
  descripcion: string;
  /** El texto completo, solo si la descripción se cortó. */
  notas: string | null;
  totalCentimos: number;
  cobradoCentimos: number | null;
  rubro: string | null;
  fuente: string | null;
  huella: string;
};

export type LecturaDeHistorial =
  | { ok: true; separador: Separador; total: number; columnasIgnoradas: string[]; omitidasPorFecha: number; errores: FilaConMotivo[]; filas: FilaDeHistorial[] }
  | { ok: false; motivo: string };

const MOTIVO_TOTAL = 'total: usa un monto en soles mayor que cero, por ejemplo 80 o 80.50.';

/** «80», «80.5», «80,50» a céntimos, sin decimales binarios; hasta 2 decimales. `null` si no es un monto. */
export function centimosDeTexto(t: string): number | null {
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** `AAAA-MM-DD` de un día que existe en el calendario. */
export function esDiaValido(t: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/** `sha256('v1|fecha|cliente|descripción|total|cobrado|n')`: `n` cuenta las veces que esta misma fila va en el archivo. */
export function huellaDeFila(f: { fecha: string; cliente: string; descripcion: string; totalCentimos: number; cobradoCentimos: number | null }, n: number): string {
  const partes = ['v1', f.fecha, normalizarNombre(f.cliente), normalizarNombre(f.descripcion), String(f.totalCentimos), f.cobradoCentimos === null ? '' : String(f.cobradoCentimos), String(n)];
  return createHash('sha256').update(partes.join('|')).digest('hex');
}

const textoONulo = (v: string | undefined, max = MAXIMO_DE_ETIQUETA): string | null => (v?.trim() ? v.trim().slice(0, max) : null);
const sinNombre = (t: string): boolean => t === '' || normalizarNombre(t) === '(sin nombre)';
export const claveDeCliente = (nombre: string): string => normalizarNombre(nombre);
export const CLAVE_DE_CLIENTE_VARIOS = claveDeCliente(CLIENTE_DE_HISTORIAL_SIN_NOMBRE);

type Validada = Omit<FilaDeHistorial, 'huella' | 'fila'>;

/** Valida una fila (la fecha de corte y la huella se resuelven fuera). */
export function validarDatos(celda: (c: CampoDeHistorial) => string, hoy: string): { ok: true; valor: Validada } | { ok: false; motivo: string } {
  const fecha = celda('fecha');
  if (!esDiaValido(fecha)) return { ok: false, motivo: 'La fecha debe ir como AAAA-MM-DD.' };
  if (fecha > hoy) return { ok: false, motivo: 'La fecha es futura.' };
  const completa = celda('descripcion').trim();
  if (!completa) return { ok: false, motivo: 'Falta la descripción del trabajo.' };
  const total = centimosDeTexto(celda('total'));
  if (total === null || total <= 0) return { ok: false, motivo: MOTIVO_TOTAL };
  if (total > MAXIMO_DE_TOTAL_CENTIMOS) return { ok: false, motivo: 'El total pasa de S/ 1,000,000.00: revísalo.' };
  const cobradoTexto = celda('cobrado').trim();
  const cobrado = cobradoTexto === '' ? null : centimosDeTexto(cobradoTexto);
  if (cobradoTexto !== '' && cobrado === null) return { ok: false, motivo: 'cobrado: usa un monto en soles de cero o más, por ejemplo 80 o 80.50.' };
  if (cobrado !== null && cobrado > total) return { ok: false, motivo: 'Lo cobrado no puede pasar del total.' };
  const cliente = celda('cliente').trim();
  if (cliente.length > MAXIMO_DE_NOMBRE) return { ok: false, motivo: 'El nombre del cliente pasa de 200 caracteres.' };
  const larga = completa.length > MAXIMO_DE_DESCRIPCION;
  return {
    ok: true,
    valor: {
      fecha,
      cliente: sinNombre(cliente) ? null : cliente,
      clienteOriginal: textoONulo(celda('clienteOriginal'), MAXIMO_DE_NOMBRE),
      descripcion: larga ? `${completa.slice(0, MAXIMO_DE_DESCRIPCION - 1)}…` : completa,
      notas: larga ? completa.slice(0, MAXIMO_DE_NOTAS) : null,
      totalCentimos: total,
      cobradoCentimos: cobrado,
      rubro: textoONulo(celda('rubro')),
      fuente: textoONulo(celda('fuente')),
    },
  };
}

/**
 * Lee el archivo completo. `hoy` es el día de la empresa (la fecha no puede ser posterior) y `desde` el corte:
 * lo anterior se omite sin error. La huella cuenta cuántas veces va la misma fila dentro del archivo.
 */
export function leerHistorial(contenido: string, opciones: { separador?: Separador; desde: string; hoy: string }): LecturaDeHistorial {
  const lectura = leerCsv(contenido, { separador: opciones.separador ?? 'auto', maxFilas: MAX_FILAS_IMPORTAR });
  if (!lectura.ok) return lectura;
  const [encabezado, ...datos] = lectura.filas;
  if (!encabezado) return { ok: false, motivo: 'El archivo no tiene encabezado.' };
  const columnas = mapearColumnasDeHistorial(encabezado.celdas);
  if ('error' in columnas) return { ok: false, motivo: columnas.error };
  if (datos.length === 0) return { ok: false, motivo: 'El archivo solo tiene el encabezado: no hay filas que importar.' };

  const errores: FilaConMotivo[] = [];
  const filas: FilaDeHistorial[] = [];
  const apariciones = new Map<string, number>();
  let omitidasPorFecha = 0;
  for (const f of datos) {
    if (f.celdas.length > encabezado.celdas.length) {
      errores.push({ fila: f.numero, motivo: 'Tiene más columnas que el encabezado.' });
      continue;
    }
    const celda = (c: CampoDeHistorial): string => {
      const i = columnas.indices[c];
      return i === undefined ? '' : (f.celdas[i] ?? '').trim();
    };
    const fechaCruda = celda('fecha');
    if (esDiaValido(fechaCruda) && fechaCruda <= opciones.hoy && fechaCruda < opciones.desde) {
      omitidasPorFecha++;
      continue;
    }
    const r = validarDatos(celda, opciones.hoy);
    if (!r.ok) {
      errores.push({ fila: f.numero, motivo: r.motivo });
      continue;
    }
    const base = { fecha: r.valor.fecha, cliente: r.valor.clienteOriginal ?? r.valor.cliente ?? '', descripcion: celda('descripcion'), totalCentimos: r.valor.totalCentimos, cobradoCentimos: r.valor.cobradoCentimos };
    const clave = huellaDeFila(base, 0);
    const n = (apariciones.get(clave) ?? 0) + 1;
    apariciones.set(clave, n);
    filas.push({ ...r.valor, fila: f.numero, huella: huellaDeFila(base, n) });
  }
  return { ok: true, separador: lectura.separador, total: datos.length, columnasIgnoradas: columnas.ignoradas, omitidasPorFecha, errores, filas };
}
