import { exito, rechazo, type CotizacionCompletaDto, type LineaDeCotizacionEntrada, type Respuesta } from '@capaz/shared';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { CONFIGURACION_POR_DEFECTO } from '../domain/configuracion.js';
import { armarLineas, entradaDeLineaGuardada, totalesDe, type LineaArmada, type Totales } from '../domain/lineas.js';
import type { RedondeoComercial } from '../domain/precios.js';
import { ajusteDe } from '../repositories/ajustes.repository.js';
import { leerConfiguracion } from '../repositories/configuracion.repository.js';
import { clienteVigente, listasParaLineas, productosVigentes, verCotizacion, type Alcance } from '../repositories/cotizaciones.repository.js';
import { historialDe, lineasDe, versionDe, versionesDe, type LineaDeVersion } from '../repositories/versiones.repository.js';
import { aCotizacionCompleta } from './cotizacion-mapeo.js';
import { vistaDeVersion } from './cuadro-version.js';

// Lo que comparten las herramientas de cotizaciones. Precios y totales SIN IGV; el IGV se calcula por línea.

export const NO_EXISTE = 'No existe esa cotización.';
export const CAMPO_ID = { nombre: 'id', queSeAnota: 'Identificador de la cotización.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' };

export const alcanceDeCotizaciones = (ctx: ContextoDeHerramienta): Alcance => alcanceDe(ctx, 'cotizador');
/** Costo y margen: solo con `cotizador:costos`. */
export const veCostos = (ctx: ContextoDeHerramienta): boolean => ctx.permisos.includes('cotizador:costos');

/** Auditoría (R13): solo identificador, código, estado y cifras. Nunca nombres, notas ni motivos. */
export const auditarCotizacion = (_args: unknown, d: CotizacionCompletaDto | null): DatosDeAuditoria => ({
  entidadTipo: 'cotizacion',
  entidadId: d?.id,
  ...(d && { resumen: { codigo: d.codigo, estado: d.estado, version: d.version, totalCentimos: d.totalCentimos } }),
});

/** La cotización con la versión pedida (por defecto la vigente), sus líneas, versiones e historial. */
export async function responderCotizacion(tx: Transaccion, ctx: ContextoDeHerramienta, id: string, numeroDeVersion?: number): Promise<Respuesta<CotizacionCompletaDto>> {
  const c = await verCotizacion(tx, ctx, id, { alcance: alcanceDeCotizaciones(ctx) });
  if (!c) return rechazo('no_encontrado', NO_EXISTE);
  const version = await versionDe(tx, ctx, id, numeroDeVersion ?? c.versionActual);
  if (!version) return rechazo('no_encontrado', 'No existe esa versión de la cotización.');
  const [lineas, versiones, historial] = [await lineasDe(tx, ctx, version.id), await versionesDe(tx, ctx, id), await historialDe(tx, ctx, id)];
  // Una cotización por partes lleva la vista de su cuadro (costos y margen solo con `cotizador:costos`).
  const vista = version.modo === 'cuadro' ? await vistaDeVersion(tx, ctx, version, veCostos(ctx)) : null;
  if (vista && !vista.ok) return rechazo('conflicto', vista.mensaje);
  return exito(aCotizacionCompleta({ c, version, lineas, versiones, historial, veCostos: veCostos(ctx), cuadro: vista?.vista ?? null }));
}

export type Calculo = { lineas: LineaArmada[]; totales: Totales; igvPorcentaje: number };
export type Fallo = { ok: false; error: { codigo: 'conflicto' | 'argumentos_invalidos' | 'no_encontrado'; mensaje: string } };

/** Cliente y productos que cita una cotización. Devuelve el motivo del rechazo o `null`. */
export async function comprobarReferencias(tx: Transaccion, ctx: ContextoDeHerramienta, r: { clienteId?: string | null; lineas?: readonly LineaDeCotizacionEntrada[] }): Promise<string | null> {
  if (r.clienteId && !(await clienteVigente(tx, ctx, r.clienteId))) return 'El cliente no existe o está archivado.';
  const productos = (r.lineas ?? []).flatMap((l) => (l.tipo === 'manual' && l.productoId ? [l.productoId] : []));
  if (!(await productosVigentes(tx, ctx, productos))) return 'Un producto de las líneas no existe o está archivado.';
  return null;
}

/** Arma las líneas con los precios de hoy: lista → ajuste del cliente → redondeo → IGV de la configuración. */
export async function calcularLineas(tx: Transaccion, ctx: ContextoDeHerramienta, entradas: readonly LineaDeCotizacionEntrada[], clienteId: string | null, igvPorcentaje?: number): Promise<Calculo | Fallo> {
  const config = await leerConfiguracion(tx, ctx);
  const igv = igvPorcentaje ?? config?.igvPorcentaje ?? CONFIGURACION_POR_DEFECTO.igvPorcentaje;
  const redondeo = (config?.redondeoComercial ?? CONFIGURACION_POR_DEFECTO.redondeoComercial) as RedondeoComercial;
  const listas = await listasParaLineas(tx, ctx, entradas.flatMap((l) => (l.tipo === 'lista' ? [l.listaId] : [])));
  const ajuste = clienteId ? await ajusteDe(tx, ctx, clienteId) : null;
  const r = armarLineas(entradas, { listas, ajusteClientePct: ajuste?.porcentaje ?? null, redondeo, igvPorcentaje: igv });
  if (!r.ok) return { ok: false, error: { codigo: r.codigo, mensaje: r.mensaje } };
  return { lineas: r.lineas, totales: totalesDe(r.lineas), igvPorcentaje: igv };
}

/** Las líneas guardadas vueltas a entrada (para recalcular las de lista cuando cambia el cliente). */
export const entradasDe = (lineas: readonly LineaDeVersion[]): LineaDeCotizacionEntrada[] =>
  lineas.map((l) => entradaDeLineaGuardada({ ...l, tipo: l.origenPrecio as 'lista' | 'manual' }));
