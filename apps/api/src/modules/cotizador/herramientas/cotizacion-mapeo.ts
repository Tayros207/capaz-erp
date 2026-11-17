import { CONDICIONES_VACIAS, type CotizacionCompletaDto, type CotizacionDto, type VistaDelCuadroDto } from '@capaz/shared';
import { codigoDeCotizacion } from '../domain/cotizacion.js';
import { ajusteDeDetalle } from '../domain/lineas.js';
import type { EstadoDeCotizacion } from '../domain/estados.js';
import type { Cotizacion, CotizacionConTotales } from '../repositories/cotizaciones.repository.js';
import type { EventoDeCotizacion, LineaDeVersion, Version } from '../repositories/versiones.repository.js';

// Fila → DTO. Costo y margen salen solo si quien pregunta tiene `cotizador:costos`.

const iso = (f: Date | null): string | null => (f ? f.toISOString() : null);
const nombreDe = (c: Cotizacion): string | null => c.clienteNombre ?? c.clienteNombreVivo;

export const aCotizacionDto = (c: CotizacionConTotales): CotizacionDto => ({
  id: c.id,
  codigo: codigoDeCotizacion(c.numero, c.anio, c.versionActual),
  numero: c.numero,
  anio: c.anio,
  titulo: c.titulo,
  estado: c.estado as EstadoDeCotizacion,
  clienteId: c.clienteId,
  clienteNombre: nombreDe(c),
  versionActual: c.versionActual,
  conOpciones: c.conOpciones,
  igvPorcentaje: c.igvPorcentaje,
  subtotalCentimos: c.subtotalCentimos,
  igvCentimos: c.igvCentimos,
  totalCentimos: c.totalCentimos,
  validaHasta: c.validaHasta,
  cantidadDeLineas: c.cantidadDeLineas,
  creadoPor: c.creadoPor,
  creadoEn: c.creadoEn.toISOString(),
  actualizadoEn: c.actualizadoEn.toISOString(),
});

/** Lo que el evento anotó, en texto: las opciones que eligió el cliente al aceptar. */
function detalleDeEvento(h: EventoDeCotizacion): string | null {
  const posiciones = (h.datos as { posiciones?: unknown } | null)?.posiciones;
  if (h.tipo !== 'aceptada' || !Array.isArray(posiciones) || posiciones.length === 0) return null;
  const n = posiciones.filter((p): p is number => typeof p === 'number').map((p) => p + 1);
  return n.length === 1 ? `Eligió la línea ${n[0]}` : `Eligió las líneas ${n.slice(0, -1).join(', ')} y ${n.at(-1)}`;
}

function aLineaDto(l: LineaDeVersion): CotizacionCompletaDto['lineas'][number] {
  const detalle = (l.detalle ?? {}) as Record<string, unknown>;
  const esLista = l.origenPrecio === 'lista';
  const ajuste = ajusteDeDetalle(detalle);
  return {
    posicion: l.posicion,
    tipo: l.origenPrecio as 'lista' | 'manual',
    productoId: l.productoId,
    listaId: l.listaId,
    descripcion: l.descripcion,
    unidad: l.unidad,
    cantidadMilesimas: l.cantidadMilesimas,
    precioUnitarioMilesimas: l.precioUnitarioMilesimas,
    importeCentimos: l.importeCentimos,
    igvCentimos: l.igvCentimos,
    totalCentimos: l.totalCentimos,
    precioListaCentimos: esLista && typeof detalle.precioListaCentimos === 'number' ? detalle.precioListaCentimos : null,
    ajuste: esLista && ajuste.tipo !== 'ninguno' ? ajuste : null,
  };
}

export type PartesDeCotizacion = { c: Cotizacion; version: Version; lineas: LineaDeVersion[]; versiones: Version[]; historial: EventoDeCotizacion[]; veCostos: boolean; cuadro?: VistaDelCuadroDto | null; avisos?: string[] };

export function aCotizacionCompleta({ c, version: v, lineas, versiones, historial, veCostos, cuadro = null, avisos = [] }: PartesDeCotizacion): CotizacionCompletaDto {
  const base = aCotizacionDto({ ...c, conOpciones: v.conOpciones, igvPorcentaje: v.igvPorcentaje, subtotalCentimos: v.subtotalCentimos, igvCentimos: v.igvCentimos, totalCentimos: v.totalCentimos, cantidadDeLineas: lineas.length });
  return {
    ...base,
    codigo: codigoDeCotizacion(c.numero, c.anio, v.version),
    version: v.version,
    modo: v.modo as CotizacionCompletaDto['modo'],
    cuadro,
    notas: c.notas,
    observaciones: v.observaciones,
    condiciones: { ...CONDICIONES_VACIAS, ...(v.condiciones as Partial<CotizacionCompletaDto['condiciones']>) },
    costoCentimos: veCostos ? v.costoCentimos : null,
    margenPct: veCostos ? v.margenPct : null,
    motivoMargenBajo: veCostos ? v.motivoMargenBajo : null,
    emitidaEn: iso(v.emitidaEn),
    lineas: lineas.map(aLineaDto),
    lineasAceptadas: (c.lineasAceptadas as number[] | null) ?? null,
    totalAceptadoCentimos: c.totalAceptadoCentimos,
    aceptadaEn: iso(c.aceptadaEn),
    motivoRechazo: c.motivoRechazo,
    anuladoEn: iso(c.anuladoEn),
    motivoAnulacion: c.motivoAnulacion,
    versiones: versiones.map((x) => ({ version: x.version, subtotalCentimos: x.subtotalCentimos, totalCentimos: x.totalCentimos, emitidaEn: iso(x.emitidaEn) })),
    avisos,
    historial: historial.map((h) => ({ tipo: h.tipo as CotizacionCompletaDto['historial'][number]['tipo'], version: h.version, motivo: h.motivo, usuarioId: h.usuarioId, canal: h.canal as CotizacionCompletaDto['historial'][number]['canal'], detalle: detalleDeEvento(h), creadoEn: h.creadoEn.toISOString() })),
  };
}
