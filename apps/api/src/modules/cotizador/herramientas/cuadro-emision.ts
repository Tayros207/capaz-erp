import { rechazo, type ErrorDeRespuesta } from '@capaz/shared';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { evaluarBorrador, leerCuadro, type CuadroEvaluado } from '../domain/cuadro-calculo.js';
import { prepararEmisionDeCuadro, type EmisionDeCuadro } from '../domain/cuadro-emision.js';
import { copiarCuadro, marcarCuadroEmitido } from '../repositories/cuadro.repository.js';
import { reemplazarLineas, versionDe, type Version } from '../repositories/versiones.repository.js';
import { configuracionVigente, recalcularVersion } from './cuadro-version.js';

// Lo que `cotizacion_emitir`, `cotizacion_nueva_version` y `cotizacion_duplicar` hacen de más cuando la versión es por partes.

export type CuadroPorEmitir = { evaluado: CuadroEvaluado; emision: EmisionDeCuadro; igvPorcentaje: number };
type Preparado = { ok: true; valor: CuadroPorEmitir } | { ok: false; error: ErrorDeRespuesta };

/** Valida el cuadro (trabajo, imposición, filas, utilidad posible, precios que crecen) y arma lo que se congelaría. Solo lee. */
export async function prepararCuadroParaEmitir(tx: Transaccion, ctx: ContextoDeHerramienta, version: Version): Promise<Preparado> {
  const leido = leerCuadro(version.entrada);
  if (!leido.ok) return rechazo('conflicto', leido.mensaje);
  const vigente = await configuracionVigente(tx, ctx);
  const evaluado = evaluarBorrador(leido.cuadro, vigente.motor);
  if (!evaluado.ok) return rechazo('conflicto', evaluado.error.mensaje);
  const emision = prepararEmisionDeCuadro(evaluado.valor, vigente.igvPorcentaje, vigente.motor);
  if (!emision.ok) return rechazo('conflicto', emision.error.mensaje);
  return { ok: true, valor: { evaluado: evaluado.valor, emision: emision.valor, igvPorcentaje: vigente.igvPorcentaje } };
}

/** Congela el cuadro: líneas y totales en céntimos, el cuadro tal como se emitió y su foto (`resultado`), en un solo `update`. */
export async function emitirCuadro(tx: Transaccion, ctx: ContextoDeHerramienta, version: Version, p: CuadroPorEmitir, extra: { condiciones: object; motivoMargenBajo: string | null }): Promise<void> {
  const e = p.emision;
  await reemplazarLineas(tx, ctx, version.id, e.lineas);
  await marcarCuadroEmitido(tx, ctx, version.id, {
    entrada: p.evaluado.cuadro,
    igvPorcentaje: p.igvPorcentaje,
    conOpciones: e.conOpciones,
    ...e.totales,
    costoCentimos: e.costoCentimos,
    margenPct: e.margenPct,
    condiciones: extra.condiciones,
    motivoMargenBajo: extra.motivoMargenBajo,
    resultado: { ...e.emision, motivoMargenBajo: extra.motivoMargenBajo, emitidaEn: new Date().toISOString(), emitidaPor: ctx.usuarioId },
  });
}

/** Nueva versión o duplicado de una cotización por partes: copia el cuadro y lo recalcula con la configuración de hoy. */
export async function copiarCuadroSiAplica(tx: Transaccion, ctx: ContextoDeHerramienta, origen: Version, nuevaVersionId: string, cotizacionId: string, numero: number): Promise<void> {
  if (origen.modo !== 'cuadro') return;
  await copiarCuadro(tx, ctx, origen.id, nuevaVersionId);
  const nueva = await versionDe(tx, ctx, cotizacionId, numero);
  if (nueva) await recalcularVersion(tx, ctx, nueva);
}
