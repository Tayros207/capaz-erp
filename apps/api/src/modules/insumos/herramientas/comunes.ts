import { exito, rechazo, type ArticuloDto, type Respuesta } from '@capaz/shared';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { existenciasDeArticulos, verArticulo, type Articulo } from '../repositories/articulos.repository.js';
import { sucursalParaMover, type Sucursal } from '../repositories/existencias.repository.js';
import { aArticuloDto } from './mapeo.js';

// Lo que comparten las herramientas de inventario.

export const MODULO = 'insumos';
export const NO_EXISTE = 'No existe ese artículo.';
export const SUCURSAL_INVALIDA = 'La sucursal no existe o está archivada.';
export const ARCHIVADO = 'El artículo está archivado: actívalo de nuevo para moverlo.';
export const CURSOR_INVALIDO = 'El cursor no es válido.';

export const alcanceDeInsumos = (ctx: ContextoDeHerramienta) => alcanceDe(ctx, MODULO);

export const CAMPO_ARTICULO = { nombre: 'articuloId', queSeAnota: 'Identificador del artículo de inventario.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' };
export const CAMPO_SUCURSAL = { nombre: 'sucursalId', queSeAnota: 'Sucursal donde está la existencia (opcional; sin ella, la principal).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000030' };
export const CAMPO_ID = { nombre: 'id', queSeAnota: 'Identificador del artículo de inventario.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' };

/** Auditoría (R13): identificador y cifras. Nunca el nombre del producto ni el motivo tecleado. */
export const auditarArticulo = (d: ArticuloDto | null, id?: string): DatosDeAuditoria => ({
  entidadTipo: 'articulo',
  entidadId: d?.id ?? id,
  ...(d && { resumen: { minimoMilesimas: d.minimoMilesimas, existenciaTotalMilesimas: d.existenciaTotalMilesimas, archivado: d.archivadoEn !== null } }),
});

/** El artículo con sus existencias por sucursal, tal como lo devuelven las herramientas de artículos. */
export async function responderArticulo(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<ArticuloDto>> {
  const a = await verArticulo(tx, ctx, id);
  if (!a) return rechazo('no_encontrado', NO_EXISTE);
  const existencias = await existenciasDeArticulos(tx, ctx, [a.id]);
  return exito(aArticuloDto(a, existencias.get(a.id) ?? []));
}

export type Destino = { articulo: Articulo; sucursal: Sucursal };
export type Rechazo = ReturnType<typeof rechazo>;

/**
 * Lo que necesita todo movimiento: el artículo (bloqueado si `bloquear`) activo y la sucursal vigente (la principal
 * si no se indica). Devuelve el rechazo listo si algo falta.
 */
export async function destinoDeMovimiento(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  articuloId: string,
  sucursalId: string | undefined,
  opciones: { bloquear: boolean },
): Promise<Destino | Rechazo> {
  const articulo = await verArticulo(tx, ctx, articuloId, { bloquear: opciones.bloquear });
  if (!articulo) return rechazo('no_encontrado', NO_EXISTE);
  if (articulo.archivadoEn) return rechazo('conflicto', ARCHIVADO);
  const sucursal = await sucursalParaMover(tx, ctx, sucursalId);
  if (!sucursal) return rechazo('argumentos_invalidos', SUCURSAL_INVALIDA);
  return { articulo, sucursal };
}
