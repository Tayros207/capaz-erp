import { bigint, boolean, index, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

// Esquema técnico `auth`: tablas de Better Auth (ADR-011). Solo las toca `capaz_auth`, desde la
// librería de autenticación y el guardia; `capaz_app` no tiene ningún permiso aquí (ni puede leer
// contraseñas ni sesiones). Nombres de columna en snake_case; fechas con zona horaria.
// Partió de la salida de la CLI de Better Auth que ya usaba Cotizín; se verifica en
// `auth.int.spec.ts` contra la versión instalada.
//
// OJO: el id de la organización (`organization.id`) ES el `tenant_id` de toda tabla de negocio.

export const esquemaAuth = pgSchema('auth');

const conFechas = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const user = esquemaAuth.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  ...conFechas,
});

export const session = esquemaAuth.table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('active_organization_id'),
    ...conFechas,
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = esquemaAuth.table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    ...conFechas,
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = esquemaAuth.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...conFechas,
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

export const organization = esquemaAuth.table('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const member = esquemaAuth.table(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').default('member').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('member_organization_idx').on(t.organizationId), index('member_user_idx').on(t.userId)],
);

export const invitation = esquemaAuth.table(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('invitation_organization_idx').on(t.organizationId), index('invitation_email_idx').on(t.email)],
);

/** Limitador de intentos en la base (no en memoria): el servidor sigue sin estado (ADR-013). */
export const rateLimit = esquemaAuth.table('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: bigint('count', { mode: 'number' }).notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
