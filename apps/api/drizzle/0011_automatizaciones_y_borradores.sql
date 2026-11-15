CREATE TABLE "core"."borradores" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"herramienta" text NOT NULL,
	"modulo" text NOT NULL,
	"args" jsonb NOT NULL,
	"args_originales" jsonb NOT NULL,
	"resumen" text NOT NULL,
	"origen" text NOT NULL,
	"origen_ref" text,
	"prioridad" text DEFAULT 'normal' NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"corregido" boolean DEFAULT false NOT NULL,
	"propuesto_por" text NOT NULL,
	"propuesto_en" timestamp with time zone DEFAULT now() NOT NULL,
	"captura_iniciada_en" timestamp with time zone,
	"resuelto_por" text,
	"resuelto_en" timestamp with time zone,
	"motivo_descarte" text,
	"entidad_tipo" text,
	"entidad_id" text,
	CONSTRAINT "borrador_origen" CHECK ("core"."borradores"."origen" IN ('voz', 'texto', 'agente', 'regla', 'conector', 'importacion')),
	CONSTRAINT "borrador_prioridad" CHECK ("core"."borradores"."prioridad" IN ('normal', 'alta')),
	CONSTRAINT "borrador_estado" CHECK ("core"."borradores"."estado" IN ('pendiente', 'aprobado', 'descartado'))
);
--> statement-breakpoint
CREATE TABLE "core"."reglas_automaticas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"activa" boolean DEFAULT false NOT NULL,
	"disparador_tipo" text NOT NULL,
	"disparador" jsonb NOT NULL,
	"condiciones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acciones" jsonb NOT NULL,
	"modo" text DEFAULT 'borrador' NOT NULL,
	"limite_diario" integer DEFAULT 50 NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"archivado_en" timestamp with time zone,
	CONSTRAINT "reglas_automaticas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "regla_disparador_tipo" CHECK ("core"."reglas_automaticas"."disparador_tipo" IN ('evento', 'tiempo', 'webhook', 'manual')),
	CONSTRAINT "regla_modo" CHECK ("core"."reglas_automaticas"."modo" IN ('borrador', 'pide_aprobacion', 'automatico')),
	CONSTRAINT "regla_limite_diario" CHECK ("core"."reglas_automaticas"."limite_diario" > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."reglas_disparos" (
	"tenant_id" text NOT NULL,
	"regla_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reglas_disparos_tenant_id_regla_id_clave_pk" PRIMARY KEY("tenant_id","regla_id","clave")
);
--> statement-breakpoint
CREATE TABLE "core"."reglas_ejecuciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"regla_id" uuid NOT NULL,
	"disparado_por" jsonb NOT NULL,
	"simulada" boolean DEFAULT false NOT NULL,
	"resultado" text NOT NULL,
	"detalle" jsonb,
	"borrador_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regla_ejecucion_resultado" CHECK ("core"."reglas_ejecuciones"."resultado" IN ('ok', 'rechazada', 'omitida_por_limite', 'borrador_creado', 'sin_coincidencia'))
);
--> statement-breakpoint
ALTER TABLE "core"."reglas_ejecuciones" ADD CONSTRAINT "reglas_ejecuciones_regla_fk" FOREIGN KEY ("tenant_id","regla_id") REFERENCES "core"."reglas_automaticas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_borradores_estado" ON "core"."borradores" USING btree ("tenant_id","estado","propuesto_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_borradores_modulo" ON "core"."borradores" USING btree ("tenant_id","modulo","estado");--> statement-breakpoint
CREATE INDEX "idx_reglas_activa" ON "core"."reglas_automaticas" USING btree ("tenant_id","activa","disparador_tipo");--> statement-breakpoint
CREATE INDEX "idx_reglas_ejecuciones_regla" ON "core"."reglas_ejecuciones" USING btree ("tenant_id","regla_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reglas_ejecuciones_fecha" ON "core"."reglas_ejecuciones" USING btree ("tenant_id","creado_en" DESC NULLS LAST);
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====

-- Borradores: solo la empresa (el código nunca borra; aprueba o descarta).
select core.aplicar_aislamiento('core.borradores', 'completo');
--> statement-breakpoint

-- Reglas: de la empresa. La plataforma lee solo (id, tenant_id, activa, disparador_tipo) para saber
-- en qué empresas evaluar las reglas por tiempo.
select core.aplicar_aislamiento('core.reglas_automaticas', 'completo');
--> statement-breakpoint
select core.abrir_a_plataforma('core.reglas_automaticas', null, 'id, tenant_id, activa, disparador_tipo');
--> statement-breakpoint
create trigger reglas_automaticas_actualizado before update on core.reglas_automaticas
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint

select core.aplicar_aislamiento('core.reglas_ejecuciones', 'insercion');
--> statement-breakpoint
select core.aplicar_aislamiento('core.reglas_disparos', 'insercion');
