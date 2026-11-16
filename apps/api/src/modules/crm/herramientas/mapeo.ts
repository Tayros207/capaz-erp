import type { ActividadDto, EtapaDto, OportunidadDto } from '@capaz/shared';
import { actividadVencida, codigoDeOportunidad } from '../domain/oportunidad.js';
import type { ActividadCompleta } from '../repositories/actividades.repository.js';
import type { Etapa } from '../repositories/etapas.repository.js';
import type { OportunidadCompleta } from '../repositories/oportunidades.repository.js';

// Fila → DTO de los contratos de `crm`.

const iso = (f: Date | null): string | null => f?.toISOString() ?? null;

export const aEtapaDto = (e: Etapa): EtapaDto => ({
  id: e.id,
  nombre: e.nombre,
  orden: e.orden,
  tipo: e.tipo as EtapaDto['tipo'],
  archivadoEn: iso(e.archivadoEn),
});

export const aOportunidadDto = ({ o, clienteNombre, etapaNombre, pendientes }: OportunidadCompleta): OportunidadDto => ({
  id: o.id,
  codigo: codigoDeOportunidad(o.anio, o.numero),
  titulo: o.titulo,
  clienteId: o.clienteId,
  clienteNombre,
  etapaId: o.etapaId,
  etapaNombre,
  estado: o.estado as OportunidadDto['estado'],
  montoEstimadoCentimos: o.montoEstimadoCentimos,
  fechaEsperada: o.fechaEsperada,
  responsableId: o.responsableId,
  motivoPerdida: o.motivoPerdida,
  cerradaEn: iso(o.cerradaEn),
  ultimaActividadEn: o.ultimaActividadEn.toISOString(),
  notas: o.notas,
  sucursalId: o.sucursalId,
  actividadesPendientes: pendientes,
  creadoPor: o.creadoPor,
  creadoEn: o.creadoEn.toISOString(),
  actualizadoEn: o.actualizadoEn.toISOString(),
});

/** `hoy` es el día local de la empresa (R7): decide `vencida`. */
export const aActividadDto = ({ a, oportunidadAnio, oportunidadNumero, oportunidadTitulo }: ActividadCompleta, hoy: string): ActividadDto => ({
  id: a.id,
  oportunidadId: a.oportunidadId,
  oportunidadCodigo: codigoDeOportunidad(oportunidadAnio, oportunidadNumero),
  oportunidadTitulo,
  tipo: a.tipo as ActividadDto['tipo'],
  asunto: a.asunto,
  nota: a.nota,
  venceEl: a.venceEl,
  vencida: actividadVencida(a.venceEl, a.hechaEn !== null, hoy),
  hechaEn: iso(a.hechaEn),
  hechaPor: a.hechaPor,
  responsableId: a.responsableId,
  creadoPor: a.creadoPor,
  creadoEn: a.creadoEn.toISOString(),
});
