import type { CandidatoParaGuiaDto, EstadoDeGuia, EstadoDePedido, GuiaCompletaDto, GuiaDto, LineaDeGuiaDto, ModalidadDeTraslado, MotivoDeTraslado, PreparacionDeGuiaDto } from '@capaz/shared';
import { codigoDeGuia, documentoDeCliente, pendienteDe, type LineaDePedidoParaGuia } from '../domain/guia.js';
import { codigoDePedido } from '../domain/pedido.js';
import type { Candidato, ClienteParaGuia, GuiaConConteo, LineaDeGuia } from '../repositories/guias.repository.js';
import type { Pedido } from '../repositories/pedidos.repository.js';

type Referencia = { id: string; codigo: string };
const iso = (f: Date | null) => f?.toISOString() ?? null;

export const aGuiaDto = (g: GuiaConConteo, pedidos: readonly Referencia[]): GuiaDto => ({
  id: g.id,
  codigo: codigoDeGuia(g.serie, g.numero),
  serie: g.serie,
  numero: g.numero,
  estado: g.estado as EstadoDeGuia,
  clienteId: g.clienteId,
  destinatarioNombre: g.destinatarioNombre,
  destinatarioDocumento: g.destinatarioDocumento,
  fechaEmision: g.fechaEmision,
  fechaTraslado: g.fechaTraslado,
  puntoPartida: g.puntoPartida,
  puntoLlegada: g.puntoLlegada,
  motivo: g.motivo as MotivoDeTraslado,
  motivoDetalle: g.motivoDetalle,
  modalidad: g.modalidad as ModalidadDeTraslado,
  transportista: g.transportista,
  conductor: g.conductor,
  licencia: g.licencia,
  placa: g.placa,
  bultos: g.bultos,
  observaciones: g.observaciones,
  pedidos: [...pedidos],
  lineas: g.lineas,
  anuladoEn: iso(g.anuladoEn),
  motivoAnulacion: g.motivoAnulacion,
  creadoPor: g.creadoPor,
  creadoEn: g.creadoEn.toISOString(),
});

export const aLineaDeGuiaDto = (l: LineaDeGuia): LineaDeGuiaDto => ({
  id: l.id,
  posicion: l.posicion,
  pedidoId: l.pedidoId,
  pedidoCodigo: l.pedidoId ? codigoDePedido(l.pedidoSerie, l.pedidoAnio, l.pedidoNumero) : null,
  pedidoLineaId: l.pedidoLineaId,
  productoId: l.productoId,
  descripcion: l.descripcion,
  unidad: l.unidad,
  cantidadMilesimas: l.cantidadMilesimas,
});

export function aGuiaCompleta(
  g: GuiaConConteo,
  lineas: readonly LineaDeGuia[],
  pedidos: readonly Referencia[],
  nombres: ReadonlyMap<string, string>,
): GuiaCompletaDto {
  return {
    ...aGuiaDto(g, pedidos),
    anuladoPor: g.anuladoPor,
    anuladoPorNombre: g.anuladoPor ? (nombres.get(g.anuladoPor) ?? null) : null,
    creadoPorNombre: nombres.get(g.creadoPor) ?? null,
    detalle: lineas.map(aLineaDeGuiaDto),
  };
}

const aCandidato = (c: Candidato): CandidatoParaGuiaDto => ({
  id: c.id,
  codigo: codigoDePedido(c.serie, c.anio, c.numero),
  estado: c.estado as EstadoDePedido,
  fecha: c.fecha,
  entregaEl: c.entregaEl,
  lineasPendientes: c.lineasPendientes,
});

export function aPreparacionDeGuia(
  cliente: ClienteParaGuia,
  pedidos: readonly Pedido[],
  lineas: readonly LineaDePedidoParaGuia[],
  enviadas: ReadonlyMap<string, number>,
  candidatos: readonly Candidato[],
): PreparacionDeGuiaDto {
  return {
    cliente: { id: cliente.id, nombre: cliente.nombre, documento: documentoDeCliente(cliente.documentoTipo, cliente.documentoNumero), direccion: cliente.direccion },
    pedidos: pedidos.map((p) => ({
      id: p.id,
      codigo: codigoDePedido(p.serie, p.anio, p.numero),
      estado: p.estado as EstadoDePedido,
      fecha: p.fecha,
      entregaEl: p.entregaEl,
      lineas: lineas
        .filter((l) => l.pedidoId === p.id)
        .map((l) => {
          const enviada = enviadas.get(l.id) ?? 0;
          return {
            pedidoLineaId: l.id,
            posicion: l.posicion,
            productoId: l.productoId,
            descripcion: l.descripcion,
            unidad: l.unidad,
            pedidaMilesimas: l.cantidadMilesimas,
            enviadaMilesimas: enviada,
            pendienteMilesimas: pendienteDe(l.cantidadMilesimas, enviada),
          };
        }),
    })),
    candidatos: candidatos.map(aCandidato),
  };
}

