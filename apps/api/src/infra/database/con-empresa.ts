import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// La ÚNICA puerta a la base para el código de negocio (regla 2; portado de Cotizín). Abre una
// transacción con el grupo de conexiones de la aplicación (`capaz_app`), fija `app.tenant_id` y
// `app.user_id` con `set_config(..., true)` (locales a la transacción: el pooling no los filtra)
// y corre `fn`. De ahí para abajo la RLS aísla aunque un `where` se olvide.

export type BaseDeDatos = NodePgDatabase<Record<string, never>>;
export type Transaccion = Parameters<Parameters<BaseDeDatos['transaction']>[0]>[0];

export type ContextoDeEmpresa = { empresaId: string; usuarioId: string };

type Activa = { empresaId: string; tx: Transaccion };
const transaccionActual = new AsyncLocalStorage<Activa>();

export class CambioDeEmpresa extends Error {
  constructor() {
    super('No se puede cambiar de empresa dentro de una transacción activa.');
    this.name = 'CambioDeEmpresa';
  }
}

export function crearConEmpresa(db: BaseDeDatos) {
  return async function conEmpresa<T>(ctx: ContextoDeEmpresa, fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    if (!ctx.empresaId) throw new Error('conEmpresa exige una empresa.');
    const actual = transaccionActual.getStore();
    if (actual) {
      if (actual.empresaId !== ctx.empresaId) throw new CambioDeEmpresa();
      return fn(actual.tx);
    }
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.tenant_id', ${ctx.empresaId}, true), set_config('app.user_id', ${ctx.usuarioId}, true)`,
      );
      return transaccionActual.run({ empresaId: ctx.empresaId, tx }, () => fn(tx));
    });
  };
}

export type ConEmpresa = ReturnType<typeof crearConEmpresa>;

/** La transacción en curso, si el llamador está dentro de `conEmpresa`. */
export const transaccionEnCurso = (): Transaccion | undefined => transaccionActual.getStore()?.tx;
