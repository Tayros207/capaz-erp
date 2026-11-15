import { CONTRATOS_DE_PLATAFORMA, type Ayuda, type Criticidad, type Respuesta } from '@capaz/shared';
import type { z } from 'zod';

// Tipos de las herramientas de plataforma. Son un registro APARTE del de las herramientas de empresa:
// corren con el rol de plataforma (`capaz_sistema`), sin empresa, y su «ctx» es el operador.

export type NombreDePlataforma = keyof typeof CONTRATOS_DE_PLATAFORMA;
export type ArgsDePlataforma<N extends NombreDePlataforma> = z.output<(typeof CONTRATOS_DE_PLATAFORMA)[N]['entrada']>;
export type SalidaDePlataforma<N extends NombreDePlataforma> = z.output<(typeof CONTRATOS_DE_PLATAFORMA)[N]['salida']>;

/** Conexión del grupo `sistema`, ya dentro de una transacción abierta por el ejecutor. */
export type Cliente = {
  query<R extends Record<string, any> = any>(texto: string, valores?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
};

export type ContextoDePlataforma = Readonly<{
  requestId: string;
  /** La persona operadora (id de usuario). Sale de la sesión, nunca de los argumentos. */
  operadorId: string;
  canal: 'ui';
}>;

export type ResumenDePlataforma = { resumen: string; huella: string };
export type ResultadoDeResumenDePlataforma =
  | { ok: true; resumen: ResumenDePlataforma }
  | Extract<Respuesta<never>, { ok: false; error: unknown }>;

/** Solo campos seguros: nunca enlaces, claves ni credenciales. */
export type AuditoriaDePlataforma = {
  empresaId?: string | null;
  resumen?: Record<string, string | number | boolean | null>;
};

export type HerramientaDePlataforma<N extends NombreDePlataforma> = {
  criticidad: Criticidad;
  ayuda: Ayuda;
  /** Obligatorio si es crítica. */
  resumir?: (args: ArgsDePlataforma<N>, ctx: ContextoDePlataforma, db: Cliente) => Promise<ResultadoDeResumenDePlataforma>;
  auditar?: (args: ArgsDePlataforma<N>, datos: SalidaDePlataforma<N> | null) => AuditoriaDePlataforma;
  ejecutar: (args: ArgsDePlataforma<N>, ctx: ContextoDePlataforma, db: Cliente) => Promise<Respuesta<SalidaDePlataforma<N>>>;
};

export type HerramientaDePlataformaRegistrada = {
  nombre: string;
  criticidad: Criticidad;
  ayuda: Ayuda;
  entrada: z.ZodType;
  salida: z.ZodType;
  resumir: ((args: unknown, ctx: ContextoDePlataforma, db: Cliente) => Promise<ResultadoDeResumenDePlataforma>) | null;
  auditar: ((args: unknown, datos: unknown) => AuditoriaDePlataforma) | null;
  ejecutar: (args: unknown, ctx: ContextoDePlataforma, db: Cliente) => Promise<Respuesta<unknown>>;
};

/** Borra los tipos concretos para registrarlas juntas; el ejecutor solo llama con lo que `entrada` ya validó. */
export function definirHerramientaDePlataforma<N extends NombreDePlataforma>(
  nombre: N,
  h: HerramientaDePlataforma<N>,
): HerramientaDePlataformaRegistrada {
  const c = CONTRATOS_DE_PLATAFORMA[nombre];
  return {
    nombre,
    criticidad: h.criticidad,
    ayuda: h.ayuda,
    entrada: c.entrada,
    salida: c.salida,
    resumir: h.resumir ? (a, ctx, db) => h.resumir!(a as ArgsDePlataforma<N>, ctx, db) : null,
    auditar: h.auditar ? (a, d) => h.auditar!(a as ArgsDePlataforma<N>, d as SalidaDePlataforma<N> | null) : null,
    ejecutar: (a, ctx, db) => h.ejecutar(a as ArgsDePlataforma<N>, ctx, db),
  };
}
