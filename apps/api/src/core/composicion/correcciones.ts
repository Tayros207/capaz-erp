import { exito, type AjusteDeDeudaDto, type CorreccionListadaDto, type EntradaDe, type Respuesta, type CorreccionConAjusteDto } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';

// `correcciones_listar`: la huella visible de las correcciones. Junta la lista de Pedidos (`pedido_correcciones_listar`, que ya
// limita a las propias a quien no es dueño ni administrador) con el ajuste de deuda que cada una produjo (`deuda_ajustes_listar`,
// solo si la persona ve Registro). Nada se importa de los módulos: se llaman por nombre con el contexto de la persona.

export async function listarCorrecciones(
  ejecutor: EjecutorDeHerramientas,
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  args: EntradaDe<'correcciones_listar'>,
): Promise<Respuesta<{ items: CorreccionConAjusteDto[]; siguiente: string | null }>> {
  const r = await ejecutor.ejecutarDentro(tx, 'pedido_correcciones_listar', args, { ctx });
  if (!r.ok || !('datos' in r)) return r as Respuesta<never>;
  const pagina = r.datos as { items: CorreccionListadaDto[]; siguiente: string | null };
  const refs = pagina.items.map((c) => `pedido:${c.pedido.id}:v${c.version}`);
  const registro = ctx.modulos.find((m) => m.codigo === 'registro');
  const porRef = new Map<string, AjusteDeDeudaDto>();
  if (refs.length > 0 && registro?.puedeEntrar && ctx.permisos.includes('registro:ver')) {
    const a = await ejecutor.ejecutarDentro(tx, 'deuda_ajustes_listar', { origenRefs: refs }, { ctx });
    if (a.ok && 'datos' in a) for (const x of (a.datos as { items: AjusteDeDeudaDto[] }).items) if (x.origenRef) porRef.set(x.origenRef, x);
  }
  return exito({ items: pagina.items.map((c) => ({ ...c, ajuste: porRef.get(`pedido:${c.pedido.id}:v${c.version}`) ?? null })), siguiente: pagina.siguiente });
}
