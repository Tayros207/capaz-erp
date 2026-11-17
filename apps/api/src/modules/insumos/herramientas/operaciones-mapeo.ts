import type { ConteoDto, ConteoResumenDto, KardexDto, TransferenciaDeInsumosDto } from '@capaz/shared';
import type { Kardex } from '../domain/kardex.js';
import type { Conteo, LineaDeConteo, LineaDeTransferencia, Transferencia } from '../repositories/operaciones.repository.js';

export const aTransferenciaDto = (t: Transferencia, lineas: readonly LineaDeTransferencia[]): TransferenciaDeInsumosDto => ({
  id: t.id,
  numero: t.numero,
  anio: t.anio,
  origenSucursalId: t.origenSucursalId,
  origenCodigo: t.origenCodigo,
  destinoSucursalId: t.destinoSucursalId,
  destinoCodigo: t.destinoCodigo,
  fecha: t.fecha,
  nota: t.nota,
  lineas: [...lineas],
  creadoEn: t.creadoEn.toISOString(),
});

export const aResumenDeConteoDto = (c: Conteo): ConteoResumenDto => ({
  id: c.id,
  numero: c.numero,
  anio: c.anio,
  sucursalId: c.sucursalId,
  sucursalCodigo: c.sucursalCodigo,
  estado: c.estado as ConteoDto['estado'],
  nota: c.nota,
  totalLineas: c.totalLineas,
  lineasContadas: c.lineasContadas,
  cerradoEn: c.cerradoEn?.toISOString() ?? null,
  anuladoEn: c.anuladoEn?.toISOString() ?? null,
  creadoEn: c.creadoEn.toISOString(),
});

export const aConteoDto = (c: Conteo, lineas: readonly LineaDeConteo[]): ConteoDto => ({
  ...aResumenDeConteoDto(c),
  lineas: lineas.map((l) => ({
    articuloId: l.articuloId,
    nombre: l.nombre,
    unidad: l.unidad,
    sistemaMilesimas: l.sistemaMilesimas,
    contadaMilesimas: l.contadaMilesimas,
    diferenciaMilesimas: l.contadaMilesimas === null ? null : l.contadaMilesimas - l.sistemaMilesimas,
    movimientoId: l.movimientoId,
  })),
});

export const aKardexDto = (a: { id: string; nombre: string; unidad: string }, sucursalId: string | null, k: Kardex): KardexDto => ({
  articuloId: a.id,
  nombre: a.nombre,
  unidad: a.unidad,
  sucursalId,
  items: k.items,
  saldoMilesimas: k.saldoMilesimas,
  costoPromedioMilesimas: k.costoPromedioMilesimas,
  valorTotalCentimos: k.valorTotalCentimos,
  costosIncompletos: k.costosIncompletos,
});
