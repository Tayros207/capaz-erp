CREATE TABLE "core"."agente_acciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"modelo" text NOT NULL,
	"conversacion_id" uuid NOT NULL,
	"turno_id" uuid NOT NULL,
	"ronda" integer NOT NULL,
	"indice" integer NOT NULL,
	"herramienta" text NOT NULL,
	"politica" text NOT NULL,
	"resultado" text NOT NULL,
	"codigo" text,
	"hash_args" text NOT NULL,
	"args" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"resumen_confirmado" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agente_accion_politica" CHECK ("core"."agente_acciones"."politica" IN ('directo', 'confirmada', 'propuesta')),
	CONSTRAINT "agente_accion_resultado" CHECK ("core"."agente_acciones"."resultado" IN ('ok', 'rechazada', 'pendiente_confirmacion', 'propuesta'))
);
--> statement-breakpoint
CREATE TABLE "core"."agente_lecciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"alcance" text DEFAULT 'persona' NOT NULL,
	"usuario_id" text NOT NULL,
	"tipo" text NOT NULL,
	"clave" text NOT NULL,
	"texto" text NOT NULL,
	"herramienta" text,
	"entidad_tipo" text,
	"entidad_id" text,
	"estado" text DEFAULT 'por_revisar' NOT NULL,
	"origen" text NOT NULL,
	"conversacion_id" uuid,
	"turno_id" uuid,
	"usos" integer DEFAULT 0 NOT NULL,
	"ultima_vez" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agente_lecciones_clave" UNIQUE("tenant_id","alcance","usuario_id","clave"),
	CONSTRAINT "agente_leccion_alcance" CHECK ("core"."agente_lecciones"."alcance" IN ('persona', 'empresa')),
	CONSTRAINT "agente_leccion_tipo" CHECK ("core"."agente_lecciones"."tipo" IN ('error_de_herramienta', 'correccion', 'preferencia', 'alias', 'regla_del_erp')),
	CONSTRAINT "agente_leccion_estado" CHECK ("core"."agente_lecciones"."estado" IN ('por_revisar', 'vigente', 'archivada')),
	CONSTRAINT "agente_leccion_origen" CHECK ("core"."agente_lecciones"."origen" IN ('persona', 'sistema', 'modelo')),
	CONSTRAINT "agente_leccion_texto" CHECK (length("core"."agente_lecciones"."texto") between 1 and 280),
	CONSTRAINT "agente_leccion_clave" CHECK (length("core"."agente_lecciones"."clave") between 1 and 160)
);
--> statement-breakpoint
ALTER TABLE "core"."agente_configuracion" ALTER COLUMN "escritura_directa" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "core"."agente_configuracion" ADD COLUMN "dinero_directo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."agente_configuracion" ADD COLUMN "tope_por_operacion_centimos" bigint;--> statement-breakpoint
CREATE INDEX "idx_agente_acciones_empresa" ON "core"."agente_acciones" USING btree ("tenant_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_agente_acciones_herramienta" ON "core"."agente_acciones" USING btree ("tenant_id","herramienta","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_agente_acciones_turno" ON "core"."agente_acciones" USING btree ("tenant_id","turno_id");--> statement-breakpoint
CREATE INDEX "idx_agente_lecciones_uso" ON "core"."agente_lecciones" USING btree ("tenant_id","estado","usos" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "core"."agente_configuracion" ADD CONSTRAINT "agente_tope_operacion" CHECK ("core"."agente_configuracion"."tope_por_operacion_centimos" is null or "core"."agente_configuracion"."tope_por_operacion_centimos" >= 0);
--> statement-breakpoint

-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- Huella del asistente: de la empresa, solo inserción e inmutable (nadie edita lo que hizo el asistente). Se consulta con la
-- herramienta `agente_acciones_listar` (permiso `auditoria:ver`).
select core.aplicar_aislamiento('core.agente_acciones', 'insercion');
--> statement-breakpoint
create trigger agente_acciones_inmutable before update or delete on core.agente_acciones
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Lecciones: además de la empresa, las de alcance «persona» son SOLO de su dueña; las de alcance «empresa» las ve toda la empresa.
-- Política RESTRICTIVA (se suma con AND a «aislamiento»); sin security definer (regla 18).
select core.aplicar_aislamiento('core.agente_lecciones', 'completo');
--> statement-breakpoint
drop policy if exists solo_propias on core.agente_lecciones;
--> statement-breakpoint
create policy solo_propias on core.agente_lecciones as restrictive
  using      (alcance = 'empresa' or usuario_id = nullif(current_setting('app.user_id', true), ''))
  with check (alcance = 'empresa' or usuario_id = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
create trigger agente_lecciones_actualizado before update on core.agente_lecciones
  for each row execute function core.tocar_actualizado_en();
