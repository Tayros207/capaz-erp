-- El esquema `core` ya existe (0000_cimientos). Tabla generada por drizzle-kit; al final, la seguridad a mano.
CREATE TABLE "core"."empresa_config" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"zona_horaria" text DEFAULT 'America/Lima' NOT NULL,
	"moneda" text DEFAULT 'PEN' NOT NULL,
	"locale" text DEFAULT 'es-PE' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
select core.aplicar_aislamiento('core.empresa_config');
--> statement-breakpoint
create trigger empresa_config_actualizado before update on core.empresa_config
  for each row execute function core.tocar_actualizado_en();
