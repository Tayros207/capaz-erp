import type { VistaDelCuadroDto } from '@capaz/shared';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { CONFIGURACION_POR_DEFECTO } from '../domain/configuracion.js';
import { evaluarVersion, type CuadroEvaluado } from '../domain/cuadro-calculo.js';
import { configuracionDeMotor } from '../domain/cuadro-configuracion.js';
import { resumenDeBorrador } from '../domain/cuadro-emision.js';
import type { ConfiguracionEmpresa, Emision } from '../domain/cuadro-tipos.js';
import { armarVista } from '../domain/cuadro-vista.js';
import { leerConfiguracion } from '../repositories/configuracion.repository.js';
import { guardarCuadro } from '../repositories/cuadro.repository.js';
import { reemplazarLineas, type Version } from '../repositories/versiones.repository.js';

// Lo que toda herramienta del cuadro (y `cotizacion_ver`) necesita de una versión en modo cuadro: la configuración con que se
// calcula, la evaluación y la vista. No importa de `cotizacion-comun.ts` para que éste pueda importarlo sin ciclo.

export type ConfiguracionVigente = { motor: ConfiguracionEmpresa; igvPorcentaje: number };

/** La configuración del Cotizador de la empresa, lista para el motor; sin fila todavía, los valores de partida. */
export async function configuracionVigente(tx: Transaccion, ctx: ContextoDeHerramienta): Promise<ConfiguracionVigente> {
  const fila = await leerConfiguracion(tx, ctx);
  return { motor: configuracionDeMotor(fila), igvPorcentaje: fila?.igvPorcentaje ?? CONFIGURACION_POR_DEFECTO.igvPorcentaje };
}

export type Evaluada = { ok: true; evaluado: CuadroEvaluado; config: ConfiguracionEmpresa } | { ok: false; mensaje: string };

/** Evalúa una versión: la emitida con su foto congelada, el borrador con la configuración vigente. */
export function evaluarDeVersion(version: Version, vigente: ConfiguracionVigente): Evaluada {
  const emitida = version.emitidaEn !== null;
  const congelada = emitida ? (version.resultado as Emision | null)?.configuracion : undefined;
  const config = congelada ?? vigente.motor;
  const r = evaluarVersion(version.entrada, version.resultado, emitida, config);
  return r.ok ? { ok: true, evaluado: r.valor, config } : { ok: false, mensaje: r.error.mensaje };
}

export type VistaDeVersion = { ok: true; vista: VistaDelCuadroDto; evaluado: CuadroEvaluado } | { ok: false; mensaje: string };

export async function vistaDeVersion(tx: Transaccion, ctx: ContextoDeHerramienta, version: Version, verCostos: boolean): Promise<VistaDeVersion> {
  const e = evaluarDeVersion(version, await configuracionVigente(tx, ctx));
  if (!e.ok) return e;
  return { ok: true, evaluado: e.evaluado, vista: armarVista(e.evaluado, { cotizacionId: version.cotizacionId, version: version.version, verCostos }, e.config) };
}

/**
 * Guarda el cuadro de un borrador con todo lo que se deriva de él: las líneas (una por cantidad enviada), los totales, el costo y el
 * margen de la cantidad base. Así `cotizacion_ver`, el listado y los pasos siguientes ven siempre lo mismo que el cuadro.
 */
export async function guardarBorrador(tx: Transaccion, ctx: ContextoDeHerramienta, version: Version, evaluado: CuadroEvaluado, vigente: ConfiguracionVigente): Promise<void> {
  const r = resumenDeBorrador(evaluado, vigente.igvPorcentaje);
  await guardarCuadro(tx, ctx, version.id, {
    entrada: evaluado.cuadro,
    igvPorcentaje: vigente.igvPorcentaje,
    conOpciones: r.conOpciones,
    ...r.totales,
    costoCentimos: r.costoCentimos,
    margenPct: r.margenPct,
  });
  await reemplazarLineas(tx, ctx, version.id, r.lineas);
}

/** Recalcula una versión recién copiada (nueva versión, duplicar) con la configuración de hoy. */
export async function recalcularVersion(tx: Transaccion, ctx: ContextoDeHerramienta, version: Version): Promise<void> {
  const vigente = await configuracionVigente(tx, ctx);
  const e = evaluarDeVersion({ ...version, emitidaEn: null, resultado: null }, vigente);
  if (e.ok) await guardarBorrador(tx, ctx, version, e.evaluado, vigente);
}

