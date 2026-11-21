import { saldoDeCierreSchema, type CategoriaDto, type CierreDto, type CuentaDto, type DeudaDto, type MovimientoDeSemanaDto, type MovimientoDto } from '@capaz/shared';
import { codigoDeDeuda, codigoDeMovimiento } from '../domain/codigos.js';
import { correccionDeReferencia, esCorregible } from '../domain/correccion.js';
import { transferenciaDeReferencia } from '../domain/transferencia.js';
import { estaVencida, type EstadoDeDeuda } from '../domain/deuda.js';
import type { Categoria } from '../repositories/categorias.repository.js';
import type { Cierre } from '../repositories/cierres.repository.js';
import type { Cuenta } from '../repositories/cuentas.repository.js';
import type { Deuda, DeudaConContacto } from '../repositories/deudas.repository.js';
import type { Movimiento, MovimientoConNombres } from '../repositories/movimientos.repository.js';

// Fila → DTO. El código visible y la marca «vencida» se calculan aquí con las funciones del dominio.

const iso = (f: Date | null): string | null => (f ? f.toISOString() : null);

export const aCuentaDto = (f: Cuenta, saldoCentimos: number): CuentaDto => ({
  id: f.id,
  nombre: f.nombre,
  tipo: f.tipo as CuentaDto['tipo'],
  sucursalId: f.sucursalId,
  esPrincipal: f.esPrincipal,
  saldoInicialCentimos: f.saldoInicialCentimos,
  saldoCentimos,
  archivadoEn: iso(f.archivadoEn),
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aCategoriaDto = (f: Categoria): CategoriaDto => ({
  id: f.id,
  nombre: f.nombre,
  tipo: f.tipo as CategoriaDto['tipo'],
  archivadoEn: iso(f.archivadoEn),
});

export const codigoDe = (f: Pick<Movimiento, 'anio' | 'numero'>): string => codigoDeMovimiento(f.anio, f.numero);
export const codigoDeLaDeuda = (f: Pick<Deuda, 'tipo' | 'anio' | 'numero'>): string => codigoDeDeuda(f.tipo as DeudaDto['tipo'], f.anio, f.numero);

export const aMovimientoDto = (f: MovimientoConNombres): MovimientoDto => ({
  id: f.id,
  codigo: codigoDe(f),
  numero: f.numero,
  anio: f.anio,
  tipo: f.tipo as MovimientoDto['tipo'],
  fecha: f.fecha,
  montoCentimos: f.montoCentimos,
  cuentaId: f.cuentaId,
  cuentaNombre: f.cuentaNombre,
  categoriaId: f.categoriaId,
  categoriaNombre: f.categoriaNombre,
  contactoId: f.contactoId,
  contactoNombre: f.contactoNombre,
  medioDePago: f.medioDePago as MovimientoDto['medioDePago'],
  descripcion: f.descripcion,
  deudaId: f.deudaId,
  sucursalId: f.sucursalId,
  transferenciaId: transferenciaDeReferencia(f.origenRef),
  corregible: esCorregible(f),
  correccionDe: correccionDeReferencia(f.origenRef),
  reemplazadoPor: null,
  lineas: [],
  origen: f.origen as MovimientoDto['origen'],
  estado: f.estado as MovimientoDto['estado'],
  anuladoEn: iso(f.anuladoEn),
  motivoAnulacion: f.motivoAnulacion,
  creadoPor: f.creadoPor,
  creadoEn: f.creadoEn.toISOString(),
});

/** Marca, en un movimiento anulado, la versión vigente de su cadena de correcciones (la calcula quien lista). */
export const conReemplazo = (dto: MovimientoDto, reemplazadoPor: MovimientoDto['reemplazadoPor']): MovimientoDto => ({ ...dto, reemplazadoPor });

/** `hoy`: día de la empresa (`hoyDeLaEmpresa`), para marcar la deuda como vencida. */
export const aDeudaDto = (f: DeudaConContacto, hoy: string): DeudaDto => ({
  id: f.id,
  codigo: codigoDeLaDeuda(f),
  numero: f.numero,
  anio: f.anio,
  tipo: f.tipo as DeudaDto['tipo'],
  contactoId: f.contactoId,
  contactoNombre: f.contactoNombre,
  concepto: f.concepto,
  totalCentimos: f.totalCentimos,
  abonadoCentimos: f.abonadoCentimos,
  saldoCentimos: f.totalCentimos - f.abonadoCentimos,
  fecha: f.fecha,
  venceEn: f.venceEn,
  vencida: estaVencida({ estado: f.estado as EstadoDeDeuda, venceEn: f.venceEn }, hoy),
  estado: f.estado as DeudaDto['estado'],
  origenTipo: f.origenTipo,
  origenId: f.origenId,
  sucursalId: f.sucursalId,
  notas: f.notas,
  fijo: (f.datosExtra as { fijo?: unknown } | null)?.fijo === true,
  anuladoEn: iso(f.anuladoEn),
  motivoAnulacion: f.motivoAnulacion,
  creadoPor: f.creadoPor,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aMovimientoDeSemana = (f: MovimientoConNombres): MovimientoDeSemanaDto => ({
  id: f.id,
  codigo: codigoDe(f),
  fecha: f.fecha,
  tipo: f.tipo as MovimientoDeSemanaDto['tipo'],
  montoCentimos: f.montoCentimos,
  cuentaNombre: f.cuentaNombre,
  contactoNombre: f.contactoNombre,
  descripcion: f.descripcion,
  medioDePago: f.medioDePago,
});

export const aCierreDto = (f: Cierre): CierreDto => {
  const saldos = saldoDeCierreSchema.array().parse(f.saldos);
  return {
    id: f.id,
    desde: f.desde,
    hasta: f.hasta,
    saldos,
    diferenciaTotalCentimos: saldos.reduce((suma, s) => suma + s.diferenciaCentimos, 0),
    notas: f.notas,
    cerradoPor: f.cerradoPor,
    cerradoEn: f.cerradoEn.toISOString(),
  };
};
