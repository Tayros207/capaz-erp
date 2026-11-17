import type { TipoDeCliente } from './cliente.js';

// Reglas puras de la fusión de clientes: sin base ni framework.

/** Si uno era cliente y el otro proveedor, el resultante es «ambos»; si coinciden, se conserva. */
export const combinarTipos = (destino: TipoDeCliente, origen: TipoDeCliente): TipoDeCliente => (destino === origen ? destino : 'ambos');

export type DatosDeContacto = { documentoTipo: string | null; documentoNumero: string | null; telefono: string | null; correo: string | null; direccion: string | null };

/** Lo que el destino no tiene y el repetido sí: se completa sin pisar nada. El documento va completo (tipo y número) o no va. */
export function completarDatos(destino: DatosDeContacto, origen: DatosDeContacto): Partial<DatosDeContacto> {
  const c: Partial<DatosDeContacto> = {};
  if (!destino.documentoNumero && origen.documentoNumero && origen.documentoTipo) {
    c.documentoTipo = origen.documentoTipo;
    c.documentoNumero = origen.documentoNumero;
  }
  if (!destino.telefono && origen.telefono) c.telefono = origen.telefono;
  if (!destino.correo && origen.correo) c.correo = origen.correo;
  if (!destino.direccion && origen.direccion) c.direccion = origen.direccion;
  return c;
}

/** Cuántas filas se mueven en total. */
export const totalDeFilas = (r: ReadonlyArray<{ filas: number }>): number => r.reduce((s, x) => s + x.filas, 0);

