import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization as pluginOrganizacion } from 'better-auth/plugins';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Config } from '../../infra/config/config.js';
import type { DatabaseService } from '../../infra/database/database.service.js';
import * as esquema from '../../db/esquema/auth.js';

// Better Auth con sus tablas en el esquema `auth` y la conexión de `capaz_auth` (ADR-011). Correo y
// contraseña, plugin de organizaciones (la empresa ES la organización; su id es el `tenant_id`),
// caché de sesión en cookie y limitador de intentos guardado en la BASE (el servidor no guarda estado).
// El correo no se verifica todavía: no hay proveedor de correo (ver RELEVO). Por eso el alta de
// empresas es cerrada por defecto y cambiar el correo o pedir un restablecimiento está bloqueado.

export const AUTH = Symbol('AUTH');

/** Vida de la sesión: 4 horas. Mientras se usa, se renueva cada 30 min (vence a las 4 h sin actividad). */
const VIDA_DE_SESION_S = 4 * 60 * 60;
const RENOVACION_DE_SESION_S = 30 * 60;

export function crearAuth(db: DatabaseService, config: Config) {
  const drizzleAuth = drizzle(db.auth);
  const intentos = config.INTENTOS_DE_ACCESO;

  return betterAuth({
    appName: 'Capaz ERP',
    baseURL: config.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: config.ORIGENES_PERMITIDOS,
    database: drizzleAdapter(drizzleAuth, { provider: 'pg', schema: esquema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    session: { expiresIn: VIDA_DE_SESION_S, updateAge: RENOVACION_DE_SESION_S, cookieCache: { enabled: true, maxAge: 5 * 60 } },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: intentos },
        '/sign-up/email': { window: 60, max: intentos },
        '/reset-password': { window: 60, max: intentos },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Better Auth deja `activeOrganizationId` en nulo al iniciar sesión: se fija la empresa
          // más antigua del usuario (lección de Cotizín), para que no caiga en «crea tu empresa».
          before: async (sesion) => {
            const [primera] = await drizzleAuth
              .select({ empresaId: esquema.member.organizationId })
              .from(esquema.member)
              .where(eq(esquema.member.userId, sesion.userId))
              .orderBy(asc(esquema.member.createdAt))
              .limit(1);
            return { data: { ...sesion, activeOrganizationId: primera?.empresaId ?? null } };
          },
        },
      },
    },
    plugins: [
      pluginOrganizacion({
        // Las empresas se crean por `POST /api/v1/empresas` (que respeta ALTA_DE_EMPRESAS) o por la
        // plataforma; la ruta propia de la librería está cerrada en la lista blanca.
        allowUserToCreateOrganization: config.ALTA_DE_EMPRESAS === 'abierta',
        creatorRole: 'owner',
      }),
    ],
  });
}

export type Auth = ReturnType<typeof crearAuth>;
