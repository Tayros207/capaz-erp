import { emitir } from '../../../core/eventos/emisor.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { aplicarMovimiento, mensajeDeFaltante, type Movimiento } from '../domain/existencia.js';
import { actualizarArticulo, type Articulo } from '../repositories/articulos.repository.js';
import { fijarExistencia, tomarExistencia, type Sucursal } from '../repositories/existencias.repository.js';
import { insertarMovimiento } from '../repositories/movimientos.repository.js';

// El único camino que cambia una existencia (lo usan mover, recibir y ajustar): toma la fila con bloqueo, aplica la
// regla del dominio, inserta el movimiento, fija la existencia y emite, todo en la transacción del ejecutor.

export type PedidoDeMovimiento = {
  /** Ya bloqueado por quien llama (`verArticulo(..., { bloquear: true })`) y activo. */
  articulo: Articulo;
  sucursal: Sucursal;
  /** El movimiento, o cómo calcularlo a partir de lo que hay (ajuste a lo contado). `null`: no hay nada que mover. */
  movimiento: Movimiento | ((actualMilesimas: number) => Movimiento | null);
  costoUnitarioMilesimas: number | null;
  motivo: string | null;
  origen: { tipo: string; id: string } | null;
};

export type MovimientoRegistrado = { ok: true; movimientoId: string; resultanteMilesimas: number };
export type MovimientoRechazado = { ok: false; motivo: 'faltante'; mensaje: string } | { ok: false; motivo: 'sin_cambio' } | { ok: false; motivo: 'origen_repetido' };

export async function registrarMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, p: PedidoDeMovimiento): Promise<MovimientoRegistrado | MovimientoRechazado> {
  const { articulo, sucursal } = p;
  const existencia = await tomarExistencia(tx, ctx, articulo.id, sucursal.id);
  const m = typeof p.movimiento === 'function' ? p.movimiento(existencia.cantidadMilesimas) : p.movimiento;
  if (!m) return { ok: false, motivo: 'sin_cambio' };
  const a = aplicarMovimiento(existencia.cantidadMilesimas, m, articulo.minimoMilesimas);
  if (!a.ok) return { ok: false, motivo: 'faltante', mensaje: mensajeDeFaltante(a, articulo.unidad) };
  const costo = m.tipo === 'entrada' ? p.costoUnitarioMilesimas : null;
  const movimientoId = await insertarMovimiento(tx, ctx, {
    articuloId: articulo.id,
    sucursalId: sucursal.id,
    tipo: m.tipo,
    cantidadMilesimas: m.cantidadMilesimas,
    existenciaResultanteMilesimas: a.resultanteMilesimas,
    costoUnitarioMilesimas: costo,
    motivo: p.motivo,
    origenTipo: p.origen?.tipo ?? null,
    origenId: p.origen?.id ?? null,
  });
  if (!movimientoId) return { ok: false, motivo: 'origen_repetido' };
  await fijarExistencia(tx, ctx, existencia.id, a.resultanteMilesimas);
  // P3-2: el último costo es solo informativo; lo actualiza una entrada que lo trae.
  if (costo !== null) await actualizarArticulo(tx, ctx, articulo.id, { ultimoCostoMilesimas: costo });
  await emitir(tx, 'existencia.movida', { articuloId: articulo.id, sucursalId: sucursal.id, tipo: m.tipo, cantidadMilesimas: m.cantidadMilesimas });
  if (a.cruzaMinimo) {
    await emitir(tx, 'existencia.bajo_minimo', { articuloId: articulo.id, sucursalId: sucursal.id, cantidadMilesimas: a.resultanteMilesimas, minimoMilesimas: articulo.minimoMilesimas });
  }
  return { ok: true, movimientoId, resultanteMilesimas: a.resultanteMilesimas };
}
