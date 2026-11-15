import { EVENTOS, type CargaDe, type TipoDeEvento } from '@capaz/shared';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { transaccionEnCurso, type Transaccion } from '../../infra/database/con-empresa.js';

/** Canal de `LISTEN/NOTIFY` con el que `emitir` despierta al relevo. */
export const CANAL_DE_EVENTOS = 'capaz_eventos';

export class EmitirSinTransaccion extends Error {
  constructor() {
    super('emitir exige la transacción de conEmpresa: llámalo dentro de conEmpresa(ctx, async (tx) => ...).');
    this.name = 'EmitirSinTransaccion';
  }
}

export class CargaDeEventoInvalida extends Error {
  constructor(
    readonly tipo: string,
    detalle: string,
  ) {
    super(`La carga del evento «${tipo}» no es válida: ${detalle}`);
    this.name = 'CargaDeEventoInvalida';
  }
}

type MapaDeEventos = Readonly<Record<string, z.ZodType>>;

/**
 * Crea un `emitir` para un mapa de eventos concreto (el real es `EVENTOS`; las pruebas pasan el suyo).
 * Inserta en `core.eventos_salida` dentro de la transacción del llamador: si esa transacción se
 * revierte, el evento no existe. La señal al relevo es un `pg_notify` en la misma transacción, que
 * Postgres entrega solo al confirmar.
 */
export function crearEmisor<M extends MapaDeEventos>(mapa: M) {
  return async function emitir<T extends keyof M & string>(tx: Transaccion, tipo: T, carga: z.output<M[T]>): Promise<void> {
    if (transaccionEnCurso() !== tx) throw new EmitirSinTransaccion();
    const esquema = mapa[tipo];
    if (!esquema) throw new CargaDeEventoInvalida(tipo, 'el tipo no está declarado.');
    const r = esquema.safeParse(carga);
    if (!r.success) throw new CargaDeEventoInvalida(tipo, r.error.issues.map((i) => `${i.path.join('.') || 'carga'}: ${i.message}`).join('; '));
    // La empresa sale de la sesión de la transacción (regla 4), nunca de un argumento.
    await tx.execute(
      sql`insert into core.eventos_salida (tenant_id, tipo, carga)
          values (current_setting('app.tenant_id', true), ${tipo}, ${JSON.stringify(r.data)}::jsonb)`,
    );
    await tx.execute(sql`select pg_notify(${CANAL_DE_EVENTOS}, '')`);
  };
}

/** `emitir(tx, tipo, carga)` para los eventos reales de `@capaz/shared`. */
export const emitir: <T extends TipoDeEvento>(tx: Transaccion, tipo: T, carga: CargaDe<T>) => Promise<void> = crearEmisor(EVENTOS);
