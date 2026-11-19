import type { DetalleDeEventoDePedido, EstadoDePedido, EventoDePedidoDto, LineaDePedidoDto, PedidoCompletoDto, PedidoDto } from '@capaz/shared';
import { estaAtrasado } from '../domain/estados.js';
import { codigoDeGuia } from '../domain/guia.js';
import { codigoDePedido } from '../domain/pedido.js';
import type { EventoDePedido, LineaDePedido, Pedido } from '../repositories/pedidos.repository.js';

const iso = (f: Date | null) => f?.toISOString() ?? null;

/** `hoy` es el día de la empresa (`AAAA-MM-DD`): decide `atrasado`. */
export const aPedidoDto = (f: Pedido, hoy: string): PedidoDto => ({
  id: f.id,
  codigo: codigoDePedido(f.serie, f.anio, f.numero),
  numero: f.numero,
  serie: f.serie,
  anio: f.anio,
  clienteId: f.clienteId,
  clienteNombre: f.clienteNombre,
  estado: f.estado as EstadoDePedido,
  fecha: f.fecha,
  entregaEl: f.entregaEl,
  atrasado: estaAtrasado(f.estado as EstadoDePedido, f.entregaEl, hoy),
  responsableId: f.responsableId,
  igvPorcentaje: f.igvPorcentaje,
  subtotalCentimos: f.subtotalCentimos,
  igvCentimos: f.igvCentimos,
  totalCentimos: f.totalCentimos,
  notas: f.notas,
  sucursalId: f.sucursalId,
  origenTipo: f.origenTipo,
  origenId: f.origenId,
  confirmadoEn: iso(f.confirmadoEn),
  entregadoEn: iso(f.entregadoEn),
  canceladoEn: iso(f.canceladoEn),
  motivoCancelacion: f.motivoCancelacion,
  lineas: f.lineas,
  creadoPor: f.creadoPor,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aLineaDto = (l: LineaDePedido): LineaDePedidoDto => ({
  id: l.id,
  posicion: l.posicion,
  productoId: l.productoId,
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
  precioUnitarioMilesimas: l.precioUnitarioMilesimas,
  afectoIgv: l.afectoIgv,
  importeCentimos: l.importeCentimos,
});

export const aEventoDto = (e: EventoDePedido): EventoDePedidoDto => ({
  id: e.id,
  tipo: e.tipo,
  estadoAnterior: e.estadoAnterior,
  estadoNuevo: e.estadoNuevo,
  nota: e.nota,
  usuarioId: e.usuarioId,
  usuarioNombre: e.usuarioNombre,
  detalle: (e.detalle as DetalleDeEventoDePedido | null) ?? null,
  guia: e.guiaId && e.guiaSerie !== null && e.guiaNumero !== null ? { id: e.guiaId, codigo: codigoDeGuia(e.guiaSerie, e.guiaNumero) } : null,
  creadoEn: e.creadoEn.toISOString(),
});

export const aPedidoCompleto = (f: Pedido, lineas: readonly LineaDePedido[], historial: readonly EventoDePedido[], hoy: string): PedidoCompletoDto => ({
  ...aPedidoDto(f, hoy),
  detalle: lineas.map(aLineaDto),
  historial: historial.map(aEventoDto),
});
