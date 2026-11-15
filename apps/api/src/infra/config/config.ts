import { z } from 'zod';

// Configuración del servidor, validada al arrancar. Este es el ÚNICO archivo del servidor que lee
// `process.env` (regla 2). Los scripts de migración tienen su propia configuración: el servidor
// nunca recibe la credencial del dueño de la base (regla 16).

const url = z.url();
const secreto = z.string().min(32);
/** 32 bytes en base64 (clave de cifrado de las conexiones). */
const claveDe32Bytes = z.string().refine((v) => /^[A-Za-z0-9+/]+={0,2}$/.test(v) && Buffer.from(v, 'base64').length === 32, {
  error: 'Debe ser 32 bytes en base64.',
});

export const esquemaDeConfig = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  /** Rol de negocio (`capaz_app`, sujeto a RLS). Hasta la fase 2 es provisional. */
  DATABASE_URL_APP: url,
  /** Rol de autenticación (`capaz_auth`): Better Auth y el guardia de identidad. */
  DATABASE_URL_AUTH: url,
  /** Rol de plataforma (`capaz_sistema`): catálogo de módulos y contratación (fase 4) y consola (fase 9). */
  DATABASE_URL_SISTEMA: url,
  BETTER_AUTH_SECRET: secreto,
  BETTER_AUTH_URL: url,
  CONFIRMACION_SECRET: secreto,
  ORIGENES_PERMITIDOS: z
    .string()
    .default('http://localhost:5173')
    .transform((texto) =>
      texto
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .pipe(z.array(url).min(1)),
  ALTA_DE_EMPRESAS: z.enum(['plataforma', 'abierta']).default('plataforma'),
  /** Intentos de inicio de sesión o registro por minuto y por dirección (limitador de Better Auth). */
  INTENTOS_DE_ACCESO: z.coerce.number().int().min(1).max(1000).default(5),
  /** Activa el relevo (barrido periódico de eventos y tareas). Las pruebas lo apagan. */
  RELEVO_ACTIVO: z.stringbool().default(true),
  RELEVO_BARRIDO_SEGUNDOS: z.coerce.number().int().min(1).max(86_400).default(60),
  /** Clave de cifrado de las credenciales de conexiones. Opcional hasta la fase 11a; luego obligatoria en producción. */
  CONEXIONES_CLAVE: claveDe32Bytes.optional(),
  CONEXIONES_CLAVE_VERSION: z.coerce.number().int().min(1).default(1),
  /** Solo las pruebas lo activan, para el servidor simulado de conexiones. */
  PERMITIR_DESTINOS_LOCALES: z.stringbool().default(false),
});

export type Config = z.infer<typeof esquemaDeConfig>;

export class ConfigInvalida extends Error {
  constructor(readonly variables: readonly string[]) {
    super(
      `Configuración inválida. Revisa estas variables en .env (ver .env.example):\n${variables
        .map((v) => `  - ${v}`)
        .join('\n')}`,
    );
    this.name = 'ConfigInvalida';
  }
}

/** Valida el entorno. Nunca incluye valores en el error: pueden ser secretos. */
export function leerConfig(env: Record<string, string | undefined>): Config {
  const resultado = esquemaDeConfig.safeParse(env);
  if (resultado.success) return resultado.data;
  const variables = [...new Set(resultado.error.issues.map((i) => String(i.path[0] ?? '?')))];
  throw new ConfigInvalida(variables);
}

/** Lee `process.env` (único lugar permitido). */
export const leerConfigDelEntorno = (): Config => leerConfig(process.env);

export const CONFIG = Symbol('CONFIG');
