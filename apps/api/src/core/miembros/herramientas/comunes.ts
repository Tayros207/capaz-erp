import { and, eq, sql } from 'drizzle-orm';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { empresaModulos } from '../../../db/esquema/core-modulos.js';
import type { Participante } from '../reglas.js';
import type { ContextoDeHerramienta } from '../../herramientas/tipos.js';

/** Serializa los cambios de miembros de una empresa: dos a la vez no pueden saltarse «el último propietario» ni el tope. */
export async function bloquearMiembros(tx: Transaccion, empresaId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'miembros:' + empresaId}))`);
}

export const actorDe = (ctx: ContextoDeHerramienta): Participante => ({ usuarioId: ctx.usuarioId, rol: ctx.rol });

export const aIso = (v: Date | string): string => new Date(v).toISOString();

export type FilaDeVista = { usuario_id: string; nombre: string; correo: string; rol: string; miembro_desde: Date | string };

/** Miembros de la empresa de la transacción, por la vista `core.v_miembros` (sin contraseñas ni sesiones). */
export async function miembrosDeLaVista(tx: Transaccion): Promise<FilaDeVista[]> {
  const { rows } = await tx.execute<FilaDeVista>(
    sql`select usuario_id, nombre, correo, rol, miembro_desde from core.v_miembros order by miembro_desde, nombre`,
  );
  return rows;
}

export async function contratosDeLaEmpresa(tx: Transaccion, empresaId: string) {
  return tx
    .select({ estado: empresaModulos.estado, maxUsuarios: empresaModulos.maxUsuarios })
    .from(empresaModulos)
    .where(eq(empresaModulos.tenantId, empresaId));
}

export async function moduloContratado(tx: Transaccion, empresaId: string, modulo: string): Promise<boolean> {
  const filas = await tx
    .select({ estado: empresaModulos.estado })
    .from(empresaModulos)
    .where(and(eq(empresaModulos.tenantId, empresaId), eq(empresaModulos.modulo, modulo)));
  return filas.some((f) => f.estado !== 'baja');
}
