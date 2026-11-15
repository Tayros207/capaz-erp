import { and, eq } from 'drizzle-orm';
import type { Respuesta } from '@capaz/shared';
import { confirmacionesUsadas, idempotencia } from '../../db/esquema/core-herramientas.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// Estado de las herramientas que vive en la base: confirmaciones ya usadas e idempotencia. Todo
// ocurre dentro de la transacción de la llamada, así que si la llamada se revierte, esto también.

/** Marca la confirmación como usada. Falso si ya lo estaba (una dos veces a la vez: la segunda espera y pierde). */
export async function reservarConfirmacion(tx: Transaccion, empresaId: string, jti: string): Promise<boolean> {
  const filas = await tx
    .insert(confirmacionesUsadas)
    .values({ tenantId: empresaId, jti })
    .onConflictDoNothing()
    .returning({ jti: confirmacionesUsadas.jti });
  return filas.length > 0;
}

export type ReservaDeClave =
  | { tipo: 'nueva' }
  | { tipo: 'repetida'; respuesta: Respuesta<unknown> }
  | { tipo: 'conflicto' };

/**
 * Inserta la clave al empezar. Con la clave ya existente y los mismos argumentos devuelve la
 * respuesta guardada; con otra herramienta u otros argumentos, conflicto. Dos peticiones
 * simultáneas con la misma clave: la segunda espera a que la primera termine (índice único).
 */
export async function reservarClave(
  tx: Transaccion,
  empresaId: string,
  clave: string,
  herramienta: string,
  hashArgs: string,
): Promise<ReservaDeClave> {
  const nueva = await tx
    .insert(idempotencia)
    .values({ tenantId: empresaId, clave, herramienta, hashArgs })
    .onConflictDoNothing()
    .returning({ clave: idempotencia.clave });
  if (nueva.length > 0) return { tipo: 'nueva' };
  const [previa] = await tx
    .select()
    .from(idempotencia)
    .where(and(eq(idempotencia.tenantId, empresaId), eq(idempotencia.clave, clave)));
  if (!previa || previa.herramienta !== herramienta || previa.hashArgs !== hashArgs || previa.respuesta == null) {
    return { tipo: 'conflicto' };
  }
  return { tipo: 'repetida', respuesta: previa.respuesta as Respuesta<unknown> };
}

export async function guardarRespuesta(
  tx: Transaccion,
  empresaId: string,
  clave: string,
  respuesta: Respuesta<unknown>,
): Promise<void> {
  await tx
    .update(idempotencia)
    .set({ respuesta })
    .where(and(eq(idempotencia.tenantId, empresaId), eq(idempotencia.clave, clave)));
}
