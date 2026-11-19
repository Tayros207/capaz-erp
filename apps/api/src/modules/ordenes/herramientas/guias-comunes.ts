import { exito, rechazo, type GuiaCompletaDto, type Respuesta } from '@capaz/shared';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { lineasDeGuia, pedidosDeGuias, verGuia } from '../repositories/guias.repository.js';
import { nombresDeMiembros } from '../repositories/pedidos.repository.js';
import { alcanceDePedidos } from './comunes.js';
import { aGuiaCompleta } from './guia-mapeo.js';

// Lo que comparten las herramientas de guías de remisión.

export const NO_EXISTE_GUIA = 'No existe esa guía.';
export const ID_DE_GUIA = { nombre: 'id', queSeAnota: 'Identificador de la guía.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' };

/** Auditoría (R13): solo identificador, código, estado y cifras. Nunca nombres ni direcciones. */
export const auditarGuia = (_args: unknown, d: GuiaCompletaDto | null): DatosDeAuditoria => ({
  entidadTipo: 'guia',
  entidadId: d?.id,
  ...(d && { resumen: { codigo: d.codigo, estado: d.estado, lineas: d.lineas, pedidos: d.pedidos.length } }),
});

/** La guía con sus líneas y pedidos, tal como la devuelve toda herramienta de guías. */
export async function responderGuia(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<GuiaCompletaDto>> {
  const guia = await verGuia(tx, ctx, id, { alcance: alcanceDePedidos(ctx) });
  if (!guia) return rechazo('no_encontrado', NO_EXISTE_GUIA);
  const [lineas, pedidos] = [await lineasDeGuia(tx, ctx, id), await pedidosDeGuias(tx, ctx, [id])];
  const nombres = await nombresDeMiembros(tx, [guia.creadoPor, ...(guia.anuladoPor ? [guia.anuladoPor] : [])]);
  return exito(aGuiaCompleta(guia, lineas, pedidos.get(id) ?? [], nombres));
}
