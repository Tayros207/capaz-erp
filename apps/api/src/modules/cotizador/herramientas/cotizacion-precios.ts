import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { avisosDeCambioDePrecio } from '../domain/lineas.js';
import { margenDe } from '../domain/margen.js';
import { datosParaCopiar, lineasDe, type DatosDeVersion, type LineaDeVersion, type Version } from '../repositories/versiones.repository.js';
import { calcularLineas, entradasDe, type Calculo } from './cotizacion-comun.js';

// Precios al día: recalcular con la lista de hoy las líneas de lista de una versión y decir qué cambió.

export type PreciosDeHoy = { calculo: Calculo | null; avisos: string[] };

/**
 * Las líneas de la versión recalculadas con los precios de hoy. Sin líneas de lista (o por partes) no hay nada que
 * recalcular; si una lista ya no se puede cotizar (archivada), se conservan las líneas guardadas y se avisa.
 */
export async function preciosDeHoy(tx: Transaccion, ctx: ContextoDeHerramienta, version: Version, clienteId: string | null, guardadas?: LineaDeVersion[]): Promise<PreciosDeHoy> {
  if (version.modo === 'cuadro') return { calculo: null, avisos: [] };
  const lineas = guardadas ?? (await lineasDe(tx, ctx, version.id));
  if (!lineas.some((l) => l.origenPrecio === 'lista')) return { calculo: null, avisos: [] };
  const calculo = await calcularLineas(tx, ctx, entradasDe(lineas), clienteId, version.igvPorcentaje);
  if ('error' in calculo) return { calculo: null, avisos: [`No se pudieron poner al día los precios de lista: ${calculo.error.mensaje}`] };
  return { calculo, avisos: avisosDeCambioDePrecio(lineas.map((l) => ({ tipo: l.origenPrecio, descripcion: l.descripcion, importeCentimos: l.importeCentimos, detalle: l.detalle as Record<string, unknown> | null })), calculo.lineas) };
}

/** Los datos de la versión que se copia, con los totales y el margen de los precios de hoy si los hay. */
export function datosConPreciosDeHoy(actual: Version, hoy: PreciosDeHoy): DatosDeVersion {
  const base = datosParaCopiar(actual);
  if (!hoy.calculo) return base;
  return { ...base, ...hoy.calculo.totales, margenPct: margenDe(hoy.calculo.totales.subtotalCentimos, actual.costoCentimos) };
}
