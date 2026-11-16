CREATE TABLE "crm"."actividades" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"oportunidad_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"asunto" text NOT NULL,
	"nota" text,
	"vence_el" date,
	"hecha_en" timestamp with time zone,
	"hecha_por" text,
	"responsable_id" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actividad_tipo" CHECK ("crm"."actividades"."tipo" IN ('llamada', 'reunion', 'mensaje', 'tarea', 'nota')),
	CONSTRAINT "actividad_hecha" CHECK (("crm"."actividades"."hecha_en" is null) = ("crm"."actividades"."hecha_por" is null))
);
--> statement-breakpoint
CREATE TABLE "crm"."etapas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"orden" integer NOT NULL,
	"tipo" text DEFAULT 'abierta' NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_etapas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "etapa_orden" CHECK ("crm"."etapas"."orden" >= 0),
	CONSTRAINT "etapa_tipo" CHECK ("crm"."etapas"."tipo" IN ('abierta', 'ganada', 'perdida'))
);
--> statement-breakpoint
CREATE TABLE "crm"."oportunidades" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"titulo" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"etapa_id" uuid NOT NULL,
	"estado" text DEFAULT 'abierta' NOT NULL,
	"monto_estimado_centimos" bigint,
	"fecha_esperada" date,
	"responsable_id" text,
	"motivo_perdida" text,
	"cerrada_en" timestamp with time zone,
	"ultima_actividad_en" timestamp with time zone DEFAULT now() NOT NULL,
	"notas" text,
	"sucursal_id" uuid,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_oportunidades_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "crm_oportunidades_numero" UNIQUE("tenant_id","anio","numero"),
	CONSTRAINT "oportunidad_estado" CHECK ("crm"."oportunidades"."estado" IN ('abierta', 'ganada', 'perdida')),
	CONSTRAINT "oportunidad_monto" CHECK ("crm"."oportunidades"."monto_estimado_centimos" is null or "crm"."oportunidades"."monto_estimado_centimos" >= 0),
	CONSTRAINT "oportunidad_motivo" CHECK ("crm"."oportunidades"."estado" = 'perdida' or "crm"."oportunidades"."motivo_perdida" is null),
	CONSTRAINT "oportunidad_cierre" CHECK (("crm"."oportunidades"."estado" = 'abierta') = ("crm"."oportunidades"."cerrada_en" is null))
);
--> statement-breakpoint
ALTER TABLE "crm"."actividades" ADD CONSTRAINT "actividades_oportunidad_fk" FOREIGN KEY ("tenant_id","oportunidad_id") REFERENCES "crm"."oportunidades"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."oportunidades" ADD CONSTRAINT "oportunidades_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."oportunidades" ADD CONSTRAINT "oportunidades_etapa_fk" FOREIGN KEY ("tenant_id","etapa_id") REFERENCES "crm"."etapas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."oportunidades" ADD CONSTRAINT "oportunidades_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crm_actividades_oportunidad" ON "crm"."actividades" USING btree ("tenant_id","oportunidad_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crm_actividades_vence" ON "crm"."actividades" USING btree ("tenant_id","vence_el") WHERE "crm"."actividades"."hecha_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_crm_etapas_nombre" ON "crm"."etapas" USING btree ("tenant_id","nombre_normalizado") WHERE "crm"."etapas"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_crm_etapas_ganada" ON "crm"."etapas" USING btree ("tenant_id") WHERE "crm"."etapas"."tipo" = 'ganada' and "crm"."etapas"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_crm_etapas_perdida" ON "crm"."etapas" USING btree ("tenant_id") WHERE "crm"."etapas"."tipo" = 'perdida' and "crm"."etapas"."archivado_en" is null;--> statement-breakpoint
CREATE INDEX "idx_crm_oportunidades_etapa" ON "crm"."oportunidades" USING btree ("tenant_id","estado","etapa_id","ultima_actividad_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crm_oportunidades_cliente" ON "crm"."oportunidades" USING btree ("tenant_id","cliente_id");--> statement-breakpoint
CREATE INDEX "idx_crm_oportunidades_responsable" ON "crm"."oportunidades" USING btree ("tenant_id","responsable_id","estado");--> statement-breakpoint
CREATE INDEX "idx_crm_oportunidades_creador" ON "crm"."oportunidades" USING btree ("tenant_id","creado_por","creado_en" DESC NULLS LAST);--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de crm.

select core.aplicar_aislamiento('crm.etapas', 'completo');
--> statement-breakpoint
create trigger etapas_actualizado before update on crm.etapas
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger etapas_modulo before insert or update or delete on crm.etapas
  for each row execute function core.exigir_modulo_en_escritura('crm');
--> statement-breakpoint

select core.aplicar_aislamiento('crm.oportunidades', 'completo');
--> statement-breakpoint
create trigger oportunidades_actualizado before update on crm.oportunidades
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger oportunidades_modulo before insert or update or delete on crm.oportunidades
  for each row execute function core.exigir_modulo_en_escritura('crm');
--> statement-breakpoint

select core.aplicar_aislamiento('crm.actividades', 'completo');
--> statement-breakpoint
create trigger actividades_actualizado before update on crm.actividades
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger actividades_modulo before insert or update or delete on crm.actividades
  for each row execute function core.exigir_modulo_en_escritura('crm');
