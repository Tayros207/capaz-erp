CREATE TABLE "core"."agente_configuracion" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"modelo" text,
	"tope_mensual_microusd" bigint,
	"escritura_directa" boolean DEFAULT false NOT NULL,
	"internet" boolean DEFAULT false NOT NULL,
	"actualizado_por" text NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agente_modelo_forma" CHECK ("core"."agente_configuracion"."modelo" is null or (length("core"."agente_configuracion"."modelo") <= 100 and "core"."agente_configuracion"."modelo" ~ '^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._:-]*$')),
	CONSTRAINT "agente_tope" CHECK ("core"."agente_configuracion"."tope_mensual_microusd" is null or "core"."agente_configuracion"."tope_mensual_microusd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "core"."agente_conversaciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"titulo" text NOT NULL,
	"favorita" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agente_conversaciones_persona_id" UNIQUE("tenant_id","usuario_id","id"),
	CONSTRAINT "agente_conversacion_titulo" CHECK (length("core"."agente_conversaciones"."titulo") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "core"."agente_mensajes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"conversacion_id" uuid NOT NULL,
	"turno_id" uuid NOT NULL,
	"rol" text NOT NULL,
	"estado" text DEFAULT 'completo' NOT NULL,
	"contenido" text DEFAULT '' NOT NULL,
	"metadatos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agente_mensajes_turno_rol" UNIQUE("tenant_id","conversacion_id","turno_id","rol"),
	CONSTRAINT "agente_mensaje_rol" CHECK ("core"."agente_mensajes"."rol" IN ('persona', 'agente')),
	CONSTRAINT "agente_mensaje_estado" CHECK ("core"."agente_mensajes"."estado" IN ('completo', 'en_curso', 'interrumpido', 'error')),
	CONSTRAINT "agente_mensaje_largo" CHECK (length("core"."agente_mensajes"."contenido") <= 40000)
);
--> statement-breakpoint
CREATE TABLE "core"."uso" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"origen" text NOT NULL,
	"turno_id" uuid NOT NULL,
	"modelo" text NOT NULL,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_salida" integer DEFAULT 0 NOT NULL,
	"tokens_cache" integer DEFAULT 0 NOT NULL,
	"costo_microusd" bigint DEFAULT 0 NOT NULL,
	"rondas" integer DEFAULT 0 NOT NULL,
	"duracion_ms" integer DEFAULT 0 NOT NULL,
	"resultado" text DEFAULT 'ok' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uso_origen" CHECK ("core"."uso"."origen" IN ('agente', 'titulo', 'captura')),
	CONSTRAINT "uso_resultado" CHECK ("core"."uso"."resultado" IN ('ok', 'cortado', 'error'))
);
--> statement-breakpoint
ALTER TABLE "core"."agente_mensajes" ADD CONSTRAINT "agente_mensajes_conversacion_fk" FOREIGN KEY ("tenant_id","usuario_id","conversacion_id") REFERENCES "core"."agente_conversaciones"("tenant_id","usuario_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agente_conversaciones_persona" ON "core"."agente_conversaciones" USING btree ("tenant_id","usuario_id","actualizado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_agente_mensajes_conversacion" ON "core"."agente_mensajes" USING btree ("tenant_id","conversacion_id","creado_en");--> statement-breakpoint
CREATE INDEX "idx_uso_empresa" ON "core"."uso" USING btree ("tenant_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_uso_persona" ON "core"."uso" USING btree ("tenant_id","usuario_id","creado_en" DESC NULLS LAST);
--> statement-breakpoint

-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
select core.aplicar_aislamiento('core.agente_configuracion', 'completo');
--> statement-breakpoint
create trigger agente_configuracion_actualizado before update on core.agente_configuracion
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint

-- Conversaciones y mensajes: además de la empresa, SOLO la persona dueña.
-- Política RESTRICTIVA (se suma con AND a «aislamiento»); sin cláusula TO: vale para todos los roles,
-- también el dueño de la base. No es una función ni usa security definer (regla 18).
select core.aplicar_aislamiento('core.agente_conversaciones', 'completo');
--> statement-breakpoint
drop policy if exists solo_propias on core.agente_conversaciones;
--> statement-breakpoint
create policy solo_propias on core.agente_conversaciones as restrictive
  using      (usuario_id = nullif(current_setting('app.user_id', true), ''))
  with check (usuario_id = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
select core.aplicar_aislamiento('core.agente_mensajes', 'completo');
--> statement-breakpoint
drop policy if exists solo_propias on core.agente_mensajes;
--> statement-breakpoint
create policy solo_propias on core.agente_mensajes as restrictive
  using      (usuario_id = nullif(current_setting('app.user_id', true), ''))
  with check (usuario_id = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint

-- Uso: de la empresa (el tope se suma entre todas las personas). Solo inserción, inmutable.
select core.aplicar_aislamiento('core.uso', 'insercion');
--> statement-breakpoint
create trigger uso_inmutable before update or delete on core.uso
  for each row execute function core.rechazar_cambio();
