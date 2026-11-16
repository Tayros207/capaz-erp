import type { AdelantoDto, AsistenciaDto, ColaboradorCompletoDto, ColaboradorDto, EstadoDeAdelanto, EstadoDeAsistencia } from '@capaz/shared';
import { codigoDeAdelanto } from '../domain/adelanto.js';
import type { Adelanto } from '../repositories/adelantos.repository.js';
import type { Asistencia } from '../repositories/asistencias.repository.js';
import type { Colaborador } from '../repositories/colaboradores.repository.js';

const iso = (f: Date | null) => f?.toISOString() ?? null;

export const aColaboradorDto = (f: Colaborador): ColaboradorDto => ({
  id: f.id,
  nombre: f.nombre,
  documentoTipo: f.documentoTipo as ColaboradorDto['documentoTipo'],
  documentoNumero: f.documentoNumero,
  telefono: f.telefono,
  cargo: f.cargo,
  cuentaId: f.usuarioId,
  fechaIngreso: f.fechaIngreso,
  sucursalId: f.sucursalId,
  archivado: f.archivadoEn !== null,
  archivadoEn: iso(f.archivadoEn),
  creadoPor: f.creadoPor,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aAsistenciaDto = (f: Asistencia): AsistenciaDto => ({
  id: f.id,
  colaboradorId: f.colaboradorId,
  colaboradorNombre: f.colaboradorNombre,
  fecha: f.fecha,
  estado: f.estado as EstadoDeAsistencia,
  entrada: iso(f.entrada),
  salida: iso(f.salida),
  nota: f.nota,
  creadoPor: f.creadoPor,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aAdelantoDto = (f: Adelanto): AdelantoDto => ({
  id: f.id,
  codigo: codigoDeAdelanto(f.anio, f.numero),
  numero: f.numero,
  anio: f.anio,
  colaboradorId: f.colaboradorId,
  colaboradorNombre: f.colaboradorNombre,
  montoCentimos: f.montoCentimos,
  fecha: f.fecha,
  motivo: f.motivo,
  estado: f.estado as EstadoDeAdelanto,
  anuladoEn: iso(f.anuladoEn),
  anuladoPor: f.anuladoPor,
  motivoAnulacion: f.motivoAnulacion,
  creadoPor: f.creadoPor,
  creadoEn: f.creadoEn.toISOString(),
});

export const aColaboradorCompleto = (f: Colaborador, asistencias: readonly Asistencia[], adelantos: readonly Adelanto[]): ColaboradorCompletoDto => ({
  ...aColaboradorDto(f),
  asistencias: asistencias.map(aAsistenciaDto),
  adelantos: adelantos.map(aAdelantoDto),
});
