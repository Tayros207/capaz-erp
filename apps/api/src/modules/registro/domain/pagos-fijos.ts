import { normalizarNombre } from './catalogos.js';

// Copiar pagos fijos: reglas puras. Un pago fijo es una deuda por pagar marcada «fijo» que vence cada mes.

/** `dia`: el día del mes original (1 a 31) guardado al anotar el pago; `null` en los anteriores a ese dato (se usa el día de su vencimiento). */
export type FuenteDePagoFijo = { id: string; contactoId: string; concepto: string; totalCentimos: number; venceEn: string; sucursalId: string | null; dia: number | null; contactoNombre: string };
export type CopiaDePagoFijo = FuenteDePagoFijo & { origenId: string; fecha: string; venceEnNuevo: string };

/** `2026-01` → `2025-12`. */
export function mesAnterior(mes: string): string {
  const [anio, m] = mes.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(anio, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * El día original en el mes destino, recortado a su último día (31 de enero → 28 de febrero). `dia` es el día original
 * guardado: así 31 → 28 → 31 no se queda en 28. Sin él se usa el día de `venceEn`.
 */
export function diaEquivalente(venceEn: string, mesDestino: string, original: number | null = null): string {
  const [anio, m] = mesDestino.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const dia = Math.min(original ?? Number(venceEn.slice(8, 10)), ultimo);
  return `${mesDestino}-${String(dia).padStart(2, '0')}`;
}

/** Proveedor, concepto y día del mes de vencimiento: dos quincenas del mismo concepto son pagos distintos. */
export const claveDePagoFijo = (contactoId: string, concepto: string, venceEn: string): string => `${contactoId}|${normalizarNombre(concepto)}|${venceEn.slice(8, 10)}`;

/**
 * Qué fuentes se copian. Se omite la que ya tiene su copia (mismo origen) o una deuda viva del mismo proveedor y concepto
 * que vence en el mes destino (por ejemplo, anotada a mano). Dos fuentes iguales (mismo proveedor, concepto y día) dan una sola copia.
 */
export function decidirCopias(
  fuentes: FuenteDePagoFijo[],
  mes: string,
  existentes: { claves: ReadonlySet<string>; origenes: ReadonlySet<string> },
): { copias: CopiaDePagoFijo[]; yaExistian: number } {
  const claves = new Set(existentes.claves);
  const copias: CopiaDePagoFijo[] = [];
  let yaExistian = 0;
  for (const f of fuentes) {
    const origenId = `${f.id}:${mes}`;
    const venceEnNuevo = diaEquivalente(f.venceEn, mes, f.dia);
    const clave = claveDePagoFijo(f.contactoId, f.concepto, venceEnNuevo);
    if (existentes.origenes.has(origenId) || claves.has(clave)) {
      yaExistian += 1;
      continue;
    }
    claves.add(clave);
    copias.push({ ...f, origenId, fecha: `${mes}-01`, venceEnNuevo });
  }
  return { copias, yaExistian };
}

/** «Proveedor (concepto), …» de hasta 10 copias, y «y N más» si hay más. */
export function listaDeCopias(copias: readonly CopiaDePagoFijo[]): string {
  const lista = copias.slice(0, 10).map((c) => `${c.contactoNombre} (${c.concepto})`).join(', ');
  return copias.length > 10 ? `${lista} y ${copias.length - 10} más` : lista;
}
