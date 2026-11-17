import { rechazo, type ErrorDeRespuesta } from '@capaz/shared';
import { emitir } from '../../../core/eventos/emisor.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codigoDeCotizacion, elegirPosiciones, lineaParaEvento } from '../domain/cotizacion.js';
import { comprobarPaso, type EstadoDeCotizacion, type PasoDeCotizacion } from '../domain/estados.js';
import { totalesDe } from '../domain/lineas.js';
import { actualizarCotizacion, verCotizacion, type Alcance, type Cotizacion } from '../repositories/cotizaciones.repository.js';
import { lineasDe, registrarEvento, versionDe, type CanalDeEvento, type Version } from '../repositories/versiones.repository.js';

// La decisión del cliente sobre una cotización emitida: aceptar y rechazar. La comparten las herramientas
// `cotizacion_aceptar` y `cotizacion_rechazar` (persona de la empresa, canal `ui`) y el enlace público (canal `enlace`,
// sin usuario). Una sola lógica: el mismo estado, la misma fila de historial y los mismos eventos para Pedidos.

export type Bloqueada = { ok: true; c: Cotizacion; version: Version; estado: EstadoDeCotizacion; codigo: string } | { ok: false; error: ErrorDeRespuesta };
export type OrigenDeDecision = { canal: CanalDeEvento; usuarioId?: string | null };
/** Quien decide por el enlace no es una persona de la empresa: evento sin usuario. */
export const ORIGEN_ENLACE: OrigenDeDecision = { canal: 'enlace', usuarioId: null };
export const ORIGEN_PANTALLA: OrigenDeDecision = { canal: 'ui' };

/** Toma la cotización (bloqueada si `bloquear`) y comprueba que el paso se puede dar desde su estado. */
export async function tomarCotizacionPara(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, paso: PasoDeCotizacion, alcance: Alcance, bloquear = true): Promise<Bloqueada> {
  const c = await verCotizacion(tx, ctx, id, { alcance, bloquear });
  if (!c) return rechazo('no_encontrado', 'No existe esa cotización.');
  const estado = c.estado as EstadoDeCotizacion;
  const p = comprobarPaso(estado, paso);
  if (!p.ok) return rechazo('conflicto', p.motivo);
  const version = await versionDe(tx, ctx, c.id, c.versionActual);
  if (!version) throw new Error('La cotización no tiene su versión vigente.');
  return { ok: true, c, version, estado, codigo: codigoDeCotizacion(c.numero, c.anio, c.versionActual) };
}

/** Acepta las posiciones indicadas (todas si no hay opciones y no se indica ninguna) y avisa a Pedidos. Ya validado el paso. */
export async function registrarAceptacion(tx: Transaccion, ctx: ContextoDeEmpresa, t: Extract<Bloqueada, { ok: true }>, posiciones: readonly number[] | undefined, origen: OrigenDeDecision): Promise<{ ok: true } | { ok: false; error: ErrorDeRespuesta }> {
  const lineas = await lineasDe(tx, ctx, t.version.id);
  const e = elegirPosiciones({ posiciones, conOpciones: t.version.conOpciones, existentes: lineas.map((l) => l.posicion) });
  if (!e.ok) return rechazo(posiciones === undefined ? 'argumentos_invalidos' : 'conflicto', e.motivo);
  const elegidas = lineas.filter((l) => e.posiciones.includes(l.posicion));
  const totales = totalesDe(elegidas);
  await actualizarCotizacion(tx, ctx, t.c.id, { estado: 'aceptada', aceptadaEn: new Date(), lineasAceptadas: e.posiciones, totalAceptadoCentimos: totales.totalCentimos });
  await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'aceptada', datos: { posiciones: e.posiciones }, ...origen });
  await emitir(tx, 'cotizacion.aceptada', {
    id: t.c.id,
    codigo: t.codigo,
    version: t.version.version,
    clienteId: t.c.clienteId!,
    igvPorcentaje: t.version.igvPorcentaje,
    ...totales,
    lineas: elegidas.map((l) => lineaParaEvento(l, t.version.igvPorcentaje)),
  });
  return { ok: true };
}

/** Rechaza con el motivo (si lo hay) y avisa. La carga del evento no lleva el motivo: es un texto libre del cliente (R13). */
export async function registrarRechazo(tx: Transaccion, ctx: ContextoDeEmpresa, t: Extract<Bloqueada, { ok: true }>, motivo: string | null, origen: OrigenDeDecision): Promise<void> {
  await actualizarCotizacion(tx, ctx, t.c.id, { estado: 'rechazada', motivoRechazo: motivo });
  await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'rechazada', motivo, ...origen });
  await emitir(tx, 'cotizacion.rechazada', { id: t.c.id, codigo: t.codigo, version: t.version.version, clienteId: t.c.clienteId! });
}

/** Anota que la cotización emitida ya se le entregó al cliente (la usa `cotizacion_marcar_enviada` y el alta de un enlace). */
export async function registrarEnvio(tx: Transaccion, ctx: ContextoDeEmpresa, t: Extract<Bloqueada, { ok: true }>): Promise<void> {
  await actualizarCotizacion(tx, ctx, t.c.id, { estado: 'enviada' });
  await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'enviada' });
}
