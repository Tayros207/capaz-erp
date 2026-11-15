CREATE TABLE "core"."claves_api" (
	"hash" text PRIMARY KEY NOT NULL,
	"id" uuid DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"prefijo" text NOT NULL,
	"alcance" text[] DEFAULT '{}'::text[] NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_en" timestamp with time zone,
	"revocada_en" timestamp with time zone,
	CONSTRAINT "claves_api_empresa_id" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "core"."conectores" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"version" text DEFAULT '0.0.0' NOT NULL,
	"capacidades" text[] DEFAULT '{}'::text[] NOT NULL,
	"autenticacion" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conector_autenticacion" CHECK ("core"."conectores"."autenticacion" IN ('clave_api', 'oauth2', 'ninguna'))
);
--> statement-breakpoint
CREATE TABLE "core"."conexiones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"conector" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"configuracion" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credenciales_cifradas" text,
	"clave_version" smallint,
	"ultimo_error" text,
	"ultimo_uso_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conexiones_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "conexiones_empresa_conector" UNIQUE("tenant_id","conector"),
	CONSTRAINT "conexion_estado" CHECK ("core"."conexiones"."estado" IN ('pendiente', 'activa', 'con_error', 'desactivada'))
);
--> statement-breakpoint
CREATE TABLE "core"."referencias_externas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"conector" text NOT NULL,
	"entidad" text NOT NULL,
	"id_interno" text NOT NULL,
	"id_externo" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."sincronizaciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"conector" text NOT NULL,
	"conexion_id" uuid,
	"tipo" text NOT NULL,
	"entidad" text NOT NULL,
	"estado" text DEFAULT 'en_curso' NOT NULL,
	"cursor" text,
	"total" integer,
	"procesados" integer DEFAULT 0 NOT NULL,
	"errores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"iniciado_por" text NOT NULL,
	"iniciado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminado_en" timestamp with time zone,
	CONSTRAINT "sincronizacion_tipo" CHECK ("core"."sincronizaciones"."tipo" IN ('importar', 'exportar', 'sincronizar')),
	CONSTRAINT "sincronizacion_estado" CHECK ("core"."sincronizaciones"."estado" IN ('en_curso', 'ok', 'con_errores', 'fallida'))
);
--> statement-breakpoint
CREATE TABLE "core"."webhooks_entrantes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"clave_api_id" uuid NOT NULL,
	"evento" text NOT NULL,
	"clave_idempotencia" text NOT NULL,
	"carga" jsonb NOT NULL,
	"recibido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"procesado_en" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "core"."webhooks_envios" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"webhook_id" uuid NOT NULL,
	"evento_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"codigo_http" integer,
	"ultimo_error" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_en" timestamp with time zone,
	CONSTRAINT "webhook_envio_estado" CHECK ("core"."webhooks_envios"."estado" IN ('pendiente', 'enviado', 'fallido'))
);
--> statement-breakpoint
CREATE TABLE "core"."webhooks_salientes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"url" text NOT NULL,
	"eventos" text[] NOT NULL,
	"secreto_cifrado" text NOT NULL,
	"clave_version" smallint NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_envio_en" timestamp with time zone,
	"ultimo_error" text,
	CONSTRAINT "webhooks_salientes_empresa_id" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "core"."conexiones" ADD CONSTRAINT "conexiones_conector_conectores_codigo_fk" FOREIGN KEY ("conector") REFERENCES "core"."conectores"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."sincronizaciones" ADD CONSTRAINT "sincronizaciones_conexion_fk" FOREIGN KEY ("tenant_id","conexion_id") REFERENCES "core"."conexiones"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."webhooks_entrantes" ADD CONSTRAINT "webhooks_entrantes_clave_fk" FOREIGN KEY ("tenant_id","clave_api_id") REFERENCES "core"."claves_api"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."webhooks_envios" ADD CONSTRAINT "webhooks_envios_webhook_fk" FOREIGN KEY ("tenant_id","webhook_id") REFERENCES "core"."webhooks_salientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referencias_externas" ON "core"."referencias_externas" USING btree ("tenant_id","conector","entidad","id_externo");--> statement-breakpoint
CREATE INDEX "idx_referencias_internas" ON "core"."referencias_externas" USING btree ("tenant_id","conector","entidad","id_interno");--> statement-breakpoint
CREATE INDEX "idx_sincronizaciones_inicio" ON "core"."sincronizaciones" USING btree ("tenant_id","iniciado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_webhooks_entrantes_idempotencia" ON "core"."webhooks_entrantes" USING btree ("tenant_id","clave_api_id","clave_idempotencia");--> statement-breakpoint
CREATE INDEX "idx_webhooks_entrantes_recibido" ON "core"."webhooks_entrantes" USING btree ("tenant_id","recibido_en" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_webhooks_envios_evento" ON "core"."webhooks_envios" USING btree ("tenant_id","webhook_id","evento_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_envios_estado" ON "core"."webhooks_envios" USING btree ("tenant_id","estado","creado_en" DESC NULLS LAST);
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====

-- Catálogo de conectores (sin tenant_id): lo leen ambos roles; solo la plataforma lo escribe (se sincroniza al arrancar).
grant select on core.conectores to capaz_app, capaz_sistema;
--> statement-breakpoint
grant insert, update, delete on core.conectores to capaz_sistema;
--> statement-breakpoint

-- Conexiones: de la empresa. La plataforma ve solo metadatos; NUNCA las credenciales cifradas.
select core.aplicar_aislamiento('core.conexiones', 'completo');
--> statement-breakpoint
select core.abrir_a_plataforma('core.conexiones', null, 'id, tenant_id, conector, estado, ultimo_uso_en, creado_en');
--> statement-breakpoint
create trigger conexiones_actualizado before update on core.conexiones
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint

select core.aplicar_aislamiento('core.referencias_externas', 'completo');
--> statement-breakpoint
select core.aplicar_aislamiento('core.sincronizaciones', 'completo');
--> statement-breakpoint

-- Claves de API: la plataforma resuelve la empresa por el hash (lee solo lo necesario) y anota el último uso.
select core.aplicar_aislamiento('core.claves_api', 'completo');
--> statement-breakpoint
select core.abrir_a_plataforma('core.claves_api', null, 'hash, tenant_id, id, alcance, revocada_en');
--> statement-breakpoint
grant update (ultimo_uso_en) on core.claves_api to capaz_sistema;
--> statement-breakpoint

select core.aplicar_aislamiento('core.webhooks_entrantes', 'completo');
--> statement-breakpoint
select core.aplicar_aislamiento('core.webhooks_salientes', 'completo');
--> statement-breakpoint
create trigger webhooks_salientes_actualizado before update on core.webhooks_salientes
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.webhooks_envios', 'completo');
