CREATE TABLE "core"."auditoria" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"modulo" text NOT NULL,
	"herramienta" text NOT NULL,
	"canal" text NOT NULL,
	"resultado" text NOT NULL,
	"codigo" text,
	"hash_args" text NOT NULL,
	"entidad_tipo" text,
	"entidad_id" text,
	"resumen" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" text NOT NULL,
	"duracion_ms" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auditoria_canal" CHECK ("core"."auditoria"."canal" IN ('ui', 'agente', 'mcp', 'sistema')),
	CONSTRAINT "auditoria_resultado" CHECK ("core"."auditoria"."resultado" IN ('ok', 'rechazada', 'pendiente_confirmacion'))
);
--> statement-breakpoint
CREATE TABLE "core"."confirmaciones_usadas" (
	"tenant_id" text NOT NULL,
	"jti" text NOT NULL,
	"usado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "confirmaciones_usadas_tenant_id_jti_pk" PRIMARY KEY("tenant_id","jti")
);
--> statement-breakpoint
CREATE TABLE "core"."idempotencia" (
	"tenant_id" text NOT NULL,
	"clave" text NOT NULL,
	"herramienta" text NOT NULL,
	"hash_args" text NOT NULL,
	"respuesta" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotencia_tenant_id_clave_pk" PRIMARY KEY("tenant_id","clave")
);
--> statement-breakpoint
CREATE INDEX "idx_auditoria_empresa" ON "core"."auditoria" USING btree ("tenant_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_auditoria_entidad" ON "core"."auditoria" USING btree ("tenant_id","entidad_tipo","entidad_id","creado_en" DESC NULLS LAST);
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====

-- Auditoría: la empresa lee e inserta; nadie modifica ni borra.
select core.aplicar_aislamiento('core.auditoria', 'insercion');
--> statement-breakpoint
create trigger auditoria_solo_insercion before update or delete on core.auditoria
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Confirmaciones usadas: la empresa inserta; la plataforma purga (delete, leyendo solo tenant_id y usado_en).
select core.aplicar_aislamiento('core.confirmaciones_usadas', 'insercion');
--> statement-breakpoint
select core.abrir_a_plataforma('core.confirmaciones_usadas', 'delete', 'tenant_id, usado_en');
--> statement-breakpoint

-- Idempotencia: la empresa la administra; la plataforma purga (delete, leyendo solo tenant_id y creado_en).
select core.aplicar_aislamiento('core.idempotencia', 'completo');
--> statement-breakpoint
select core.abrir_a_plataforma('core.idempotencia', 'delete', 'tenant_id, creado_en');
