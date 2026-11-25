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
  /** Asistente: `apagado` (por defecto) no llama a nadie; `simulado` es solo para pruebas; `openrouter` llama al modelo de verdad. */
  AGENTE_PROVEEDOR: z.enum(['apagado', 'simulado', 'openrouter']).default('apagado'),
  /** Llave del proveedor del modelo. Solo en `.env` o en las variables de Vercel; nunca en el código. */
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  /** Modelo por defecto del despliegue; cada empresa puede elegir otro del catálogo. */
  AGENTE_MODELO: z
    .string()
    .max(100)
    .regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i)
    .default('deepseek/deepseek-v4.1-flash-1017'),
  /** Esfuerzo de razonamiento. `none` es lo seguro con herramientas: algunos proveedores exigen devolver el razonamiento. */
  AGENTE_RAZONAMIENTO: z.enum(['none', 'low', 'high']).default('none'),
  /** Tope mensual por empresa, en dólares (provisional hasta que Moisés fije el suyo). Se convierte a millonésimas al usarlo. */
  AGENTE_TOPE_MENSUAL_USD: z.coerce.number().min(0).max(1000).default(5),
  /** Días que se conservan las conversaciones de cada persona. */
  AGENTE_RETENCION_DIAS: z.coerce.number().int().min(1).max(3650).default(90),
  /** Rondas de herramientas por turno, como máximo. */
  AGENTE_MAX_RONDAS: z.coerce.number().int().min(1).max(25).default(12),
  /** Internet para el asistente (buscar y leer páginas). `apagada` lo quita en todas las empresas: cada consulta cuesta y sale a un tercero. */
  AGENTE_INTERNET: z.enum(['activa', 'apagada']).default('activa'),
  /** El modelo que hace la búsqueda y la lectura de páginas (con las herramientas de servidor de OpenRouter). */
  AGENTE_WEB_MODELO: z
    .string()
    .max(100)
    .regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i)
    .default('anthropic/claude-sonnet-5.5'),
  /** Freno global de emergencia: `apagada` deja TODOS los cambios del asistente como borrador, en todas las empresas. */
  AGENTE_ESCRITURA: z.enum(['activa', 'apagada']).default('activa'),
  /** Modelo que entiende el dictado y rellena la propuesta. Solo se usa con `AGENTE_PROVEEDOR=openrouter`; si no, rigen las reglas. */
  CAPTURA_MODELO: z
    .string()
    .max(100)
    .regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i)
    .default('anthropic/claude-sonnet-5.5'),
});

/** Reglas que dependen de varias variables a la vez (el asistente no puede salir mal configurado a producción). */
const esquemaCompleto = esquemaDeConfig.superRefine((c, ctx) => {
  if (c.AGENTE_PROVEEDOR === 'simulado' && c.NODE_ENV === 'production') {
    ctx.addIssue({ code: 'custom', path: ['AGENTE_PROVEEDOR'], message: 'El proveedor simulado no se usa en producción.' });
  }
  if (c.AGENTE_PROVEEDOR === 'openrouter' && !c.OPENROUTER_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['OPENROUTER_API_KEY'], message: 'Falta la llave del proveedor.' });
  }
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
  const resultado = esquemaCompleto.safeParse(env);
  if (resultado.success) return resultado.data;
  const variables = [...new Set(resultado.error.issues.map((i) => String(i.path[0] ?? '?')))];
  throw new ConfigInvalida(variables);
}

/** Lee `process.env` (único lugar permitido). */
export const leerConfigDelEntorno = (): Config => leerConfig(process.env);

export const CONFIG = Symbol('CONFIG');
