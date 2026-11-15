import type { Candidata, ClienteDto } from '@capaz/shared';
import type { Cliente } from '../repositories/clientes.repository.js';

export const aClienteDto = (f: Cliente): ClienteDto => ({
  id: f.id,
  tipo: f.tipo as ClienteDto['tipo'],
  clase: f.clase as ClienteDto['clase'],
  nombre: f.nombre,
  documentoTipo: f.documentoTipo as ClienteDto['documentoTipo'],
  documentoNumero: f.documentoNumero,
  telefono: f.telefono,
  correo: f.correo,
  direccion: f.direccion,
  notas: f.notas,
  archivadoEn: f.archivadoEn?.toISOString() ?? null,
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aCandidata = (f: Cliente): Candidata => ({
  id: f.id,
  nombre: f.nombre,
  ...(f.documentoNumero && { detalle: `${f.documentoTipo?.toUpperCase()} ${f.documentoNumero}` }),
});
