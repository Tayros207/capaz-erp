import type {
  AccesoDeModulo,
  ArgsDe,
  Ayuda,
  Canal,
  ContratoDeHerramienta,
  Criticidad,
  ErrorDeRespuesta,
  NombreDeHerramienta,
  Respuesta,
  SalidaDe,
} from '@capaz/shared';
import { CONTRATOS, CONTRATOS_DE_PLATAFORMA } from '@capaz/shared';
import type { z } from 'zod';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// Tipos de las herramientas del servidor (ARQUITECTURA-DE-IA, ADR-009). El contrato (entrada y
// salida) vive en `@capaz/shared`; aquí solo está lo que añade el servidor.

export type ContextoDeHerramienta = Readonly<{
  requestId: string;
  empresaId: string;
  /** `'sistema'` cuando no hay persona. */
  usuarioId: string;
  rol: string | null;
  permisos: readonly string[];
  modulos: readonly AccesoDeModulo[];
  canal: Canal;
}>;

/** `huella` es el estado sobre el que se confirma: si cambia, la confirmación deja de valer. */
export type Resumen = { resumen: string; huella: string };

export type DatosDeAuditoria = {
  entidadTipo?: string;
  entidadId?: string;
  resumen?: Record<string, string | number | boolean | null>;
};

export type ResultadoDeResumen =
  { ok: true; resumen: Resumen } | { ok: false; error: ErrorDeRespuesta };

export type Herramienta<N extends NombreDeHerramienta> = {
  /** Código de manifiesto; `core` para el núcleo. */
  modulo: string;
  /** Debe estar en el manifiesto de `modulo`. */
  permiso: string | null;
  criticidad: Criticidad;
  /** Acepta la cabecera `Idempotency-Key`. */
  idempotente?: boolean;
  /** Una regla automática nunca la ejecuta en modo `automatico`. */
  mueveDinero?: boolean;
  ayuda: Ayuda;
  /** Obligatorio si es crítica. */
  resumir?: (
    args: ArgsDe<N>,
    ctx: ContextoDeHerramienta,
    tx: Transaccion,
  ) => Promise<ResultadoDeResumen>;
  /** Solo campos seguros. */
  auditar?: (args: ArgsDe<N>, datos: SalidaDe<N> | null) => DatosDeAuditoria;
  ejecutar: (
    args: ArgsDe<N>,
    ctx: ContextoDeHerramienta,
    tx: Transaccion,
  ) => Promise<Respuesta<SalidaDe<N>>>;
};

/** La misma herramienta sin tipos concretos, con `nombre`, `entrada` y `salida` tomados de los contratos. */
export type HerramientaRegistrada = {
  nombre: string;
  modulo: string;
  permiso: string | null;
  criticidad: Criticidad;
  idempotente: boolean;
  mueveDinero: boolean;
  ayuda: Ayuda;
  entrada: z.ZodType;
  salida: z.ZodType;
  resumir:
    | ((
        args: unknown,
        ctx: ContextoDeHerramienta,
        tx: Transaccion,
      ) => Promise<ResultadoDeResumen>)
    | null;
  auditar: ((args: unknown, datos: unknown) => DatosDeAuditoria) | null;
  ejecutar: (
    args: unknown,
    ctx: ContextoDeHerramienta,
    tx: Transaccion,
  ) => Promise<Respuesta<unknown>>;
};

/**
 * Borra los tipos concretos de una herramienta para poder registrarlas todas juntas. Es seguro:
 * el ejecutor solo llama a `ejecutar` con lo que `entrada` ya validó.
 */
export function definirHerramienta<N extends NombreDeHerramienta>(
  nombre: N,
  h: Herramienta<N>,
): HerramientaRegistrada {
  const contrato = (
    { ...CONTRATOS, ...CONTRATOS_DE_PLATAFORMA } as Record<
      string,
      ContratoDeHerramienta | undefined
    >
  )[nombre];
  if (!contrato)
    throw new Error(
      `La herramienta «${String(nombre)}» no tiene contrato en @capaz/shared.`,
    );
  const { resumir, auditar, ejecutar, ...resto } = h;
  return {
    ...resto,
    nombre,
    idempotente: h.idempotente ?? false,
    mueveDinero: h.mueveDinero ?? false,
    entrada: contrato.entrada,
    salida: contrato.salida,
    resumir: resumir
      ? (args, ctx, tx) => resumir(args as ArgsDe<N>, ctx, tx)
      : null,
    auditar: auditar
      ? (args, datos) => auditar(args as ArgsDe<N>, datos as SalidaDe<N> | null)
      : null,
    ejecutar: (args, ctx, tx) => ejecutar(args as ArgsDe<N>, ctx, tx),
  };
}
