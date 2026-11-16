import { defineConfig } from 'drizzle-kit';

// Solo `generate` (nunca `push`, regla 6). Las migraciones se aplican con `scripts/migrar.ts`.
// No lleva credenciales: drizzle-kit no se conecta a ninguna base.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/esquema/index.ts',
  out: './drizzle',
  schemaFilter: ['auth', 'core', 'registro', 'cotizador', 'crm', 'ordenes', 'insumos', 'compras', 'personal'],
  migrations: { schema: 'core', table: 'migraciones' },
  strict: true,
  verbose: true,
});
