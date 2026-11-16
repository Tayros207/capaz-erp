import { rechazo, type OportunidadDto } from '@capaz/shared';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import type { Problema } from '../domain/oportunidad.js';
import { clienteValido, esMiembro, sucursalValida, verOportunidad } from '../repositories/oportunidades.repository.js';
import { aOportunidadDto } from './mapeo.js';

// Lo que comparten las herramientas de `crm`.

export const MODULO = 'crm';

export type Rechazo = ReturnType<typeof rechazo>;

/** Alcance «propios» del módulo (R4). */
export const propios = (ctx: ContextoDeHerramienta): boolean => alcanceDe(ctx, MODULO) === 'propios';

export const NO_EXISTE_OPORTUNIDAD = () => rechazo('no_encontrado', 'No existe esa oportunidad.');
export const NO_EXISTE_ETAPA = () => rechazo('no_encontrado', 'No existe esa etapa.');
export const desdeProblema = (p: Problema) => rechazo(p.codigo, p.mensaje);

export const auditarOportunidad = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'oportunidad', entidadId: d?.id });
export const auditarEtapa = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'etapa', entidadId: d?.id });

/** Relee la oportunidad completa (con cliente, etapa y pendientes) tras un cambio. */
export async function oportunidadDto(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<OportunidadDto> {
  const fila = await verOportunidad(tx, ctx, id, false);
  if (!fila) throw new Error('La oportunidad recién escrita no se pudo releer.');
  return aOportunidadDto(fila);
}

type Referencias = { clienteId?: string; sucursalId?: string | null; responsableId?: string | null };

/** Cliente (existe y no fusionado), sucursal (existe) y responsable (miembro de la empresa, regla 7). */
export async function problemaDeReferencias(tx: Transaccion, ctx: ContextoDeHerramienta, r: Referencias) {
  if (r.clienteId && !(await clienteValido(tx, ctx, r.clienteId))) return rechazo('no_encontrado', 'No existe ese cliente.');
  if (r.sucursalId && !(await sucursalValida(tx, ctx, r.sucursalId))) return rechazo('no_encontrado', 'No existe esa sucursal.');
  if (r.responsableId && !(await esMiembro(tx, r.responsableId))) {
    return rechazo('argumentos_invalidos', 'El responsable debe ser una persona de tu empresa.');
  }
  return null;
}
