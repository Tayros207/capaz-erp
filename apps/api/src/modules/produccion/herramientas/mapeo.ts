import type { EstadoDeOrdenDeProduccion, LineaDeOrdenDto, OrdenDeProduccionCompletaDto, OrdenDeProduccionDto } from '@capaz/shared';
import { codigoDeOrden, estaAtrasada, estadoDePago, resumenDeLineas, saldoDe } from '../domain/orden.js';
import type { EventoDeOrden, Item, Orden } from '../repositories/ordenes.repository.js';

export const aOrdenDto = (o: Orden, items: readonly Item[], hoy: string): OrdenDeProduccionDto => ({
  id: o.id,
  codigo: codigoDeOrden(o.anio, o.numero),
  numero: o.numero,
  anio: o.anio,
  estado: o.estado as EstadoDeOrdenDeProduccion,
  fecha: o.fecha,
  entregaEl: o.entregaEl,
  atrasada: estaAtrasada(o.estado as EstadoDeOrdenDeProduccion, o.entregaEl, hoy),
  clienteId: o.clienteId,
  clienteNombre: o.clienteNombre,
  resumen: resumenDeLineas(items.map((i) => i.descripcion)),
  totalLineas: items.length,
  totalCentimos: o.totalCentimos,
  adelantoCentimos: o.adelantoCentimos,
  saldoCentimos: saldoDe(o.totalCentimos, o.adelantoCentimos),
  estadoDePago: estadoDePago(o.totalCentimos, o.adelantoCentimos),
  notas: o.notas,
  entregadoEn: o.entregadoEn?.toISOString() ?? null,
  anuladoEn: o.anuladoEn?.toISOString() ?? null,
  motivoAnulacion: o.motivoAnulacion,
  destinoAdelanto: o.destinoAdelanto as OrdenDeProduccionDto['destinoAdelanto'],
  creadoEn: o.creadoEn.toISOString(),
});

export const aLineaDto = (i: Item): LineaDeOrdenDto => ({
  posicion: i.posicion,
  descripcion: i.descripcion,
  unidad: i.unidad,
  cantidadMilesimas: i.cantidadMilesimas,
  precioUnitarioMilesimas: i.precioUnitarioMilesimas,
  subtotalCentimos: i.subtotalCentimos,
  material: i.material,
  medida: i.medida,
  colores: i.colores,
  acabado: i.acabado,
});

export const aOrdenCompleta = (o: Orden, items: readonly Item[], eventos: readonly EventoDeOrden[], hoy: string): OrdenDeProduccionCompletaDto => ({
  ...aOrdenDto(o, items, hoy),
  lineas: items.map(aLineaDto),
  historial: eventos.map((e) => ({
    tipo: e.tipo as OrdenDeProduccionCompletaDto['historial'][number]['tipo'],
    estadoAnterior: e.estadoAnterior as EstadoDeOrdenDeProduccion | null,
    estadoNuevo: e.estadoNuevo as EstadoDeOrdenDeProduccion,
    nota: e.nota,
    usuarioId: e.usuarioId,
    creadoEn: e.creadoEn.toISOString(),
  })),
});
