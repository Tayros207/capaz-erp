CREATE TABLE "personal"."contratos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"inicio" date NOT NULL,
	"fin" date,
	"remuneracion_mensual_centimos" bigint DEFAULT 0 NOT NULL,
	"jornada_horas_semana" integer DEFAULT 48 NOT NULL,
	"estado" text DEFAULT 'vigente' NOT NULL,
	"terminado_en" date,
	"motivo_termino" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_contratos_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "contrato_tipo" CHECK ("personal"."contratos"."tipo" IN ('indeterminado', 'plazo_fijo', 'locacion', 'practicas')),
	CONSTRAINT "contrato_estado" CHECK ("personal"."contratos"."estado" IN ('vigente', 'terminado')),
	CONSTRAINT "contrato_fechas" CHECK ("personal"."contratos"."fin" is null or "personal"."contratos"."fin" >= "personal"."contratos"."inicio"),
	CONSTRAINT "contrato_plazo" CHECK ("personal"."contratos"."tipo" not in ('plazo_fijo', 'practicas') or "personal"."contratos"."fin" is not null),
	CONSTRAINT "contrato_remuneracion" CHECK ("personal"."contratos"."remuneracion_mensual_centimos" >= 0),
	CONSTRAINT "contrato_jornada" CHECK ("personal"."contratos"."jornada_horas_semana" between 1 and 84),
	CONSTRAINT "contrato_termino" CHECK (("personal"."contratos"."estado" = 'terminado') = ("personal"."contratos"."terminado_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "personal"."vacaciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"dias" integer NOT NULL,
	"estado" text DEFAULT 'solicitada' NOT NULL,
	"motivo" text,
	"resuelto_por" text,
	"resuelto_en" timestamp with time zone,
	"motivo_resolucion" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_vacaciones_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "vacaciones_estado" CHECK ("personal"."vacaciones"."estado" IN ('solicitada', 'aprobada', 'rechazada', 'anulada')),
	CONSTRAINT "vacaciones_fechas" CHECK ("personal"."vacaciones"."hasta" >= "personal"."vacaciones"."desde"),
	CONSTRAINT "vacaciones_dias" CHECK ("personal"."vacaciones"."dias" between 1 and 366),
	CONSTRAINT "vacaciones_resolucion" CHECK (("personal"."vacaciones"."estado" in ('aprobada', 'rechazada')) = ("personal"."vacaciones"."resuelto_en" is not null) or "personal"."vacaciones"."estado" = 'anulada')
);
--> statement-breakpoint
ALTER TABLE "personal"."contratos" ADD CONSTRAINT "contratos_colaborador_fk" FOREIGN KEY ("tenant_id","colaborador_id") REFERENCES "personal"."colaboradores"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal"."vacaciones" ADD CONSTRAINT "vacaciones_colaborador_fk" FOREIGN KEY ("tenant_id","colaborador_id") REFERENCES "personal"."colaboradores"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_personal_contratos_vigente" ON "personal"."contratos" USING btree ("tenant_id","colaborador_id") WHERE "personal"."contratos"."estado" = 'vigente';--> statement-breakpoint
CREATE INDEX "idx_personal_contratos_colaborador" ON "personal"."contratos" USING btree ("tenant_id","colaborador_id","inicio" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_personal_vacaciones_colaborador" ON "personal"."vacaciones" USING btree ("tenant_id","colaborador_id","desde" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_personal_vacaciones_estado" ON "personal"."vacaciones" USING btree ("tenant_id","estado","desde");
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en estas tablas.
select core.aplicar_aislamiento('personal.contratos', 'completo');
--> statement-breakpoint
create trigger contratos_actualizado before update on personal.contratos
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger contratos_modulo before insert or update or delete on personal.contratos
  for each row execute function core.exigir_modulo_en_escritura('personal');
--> statement-breakpoint
create trigger contratos_sin_borrado before delete on personal.contratos
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
select core.aplicar_aislamiento('personal.vacaciones', 'completo');
--> statement-breakpoint
create trigger vacaciones_actualizado before update on personal.vacaciones
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger vacaciones_modulo before insert or update or delete on personal.vacaciones
  for each row execute function core.exigir_modulo_en_escritura('personal');
--> statement-breakpoint
create trigger vacaciones_sin_borrado before delete on personal.vacaciones
  for each row execute function core.rechazar_cambio();
