-- El esquema `personal` ya existe (0017); aquí solo van sus tablas.
CREATE TABLE "personal"."adelantos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"monto_centimos" bigint NOT NULL,
	"fecha" date NOT NULL,
	"motivo" text,
	"estado" text DEFAULT 'registrado' NOT NULL,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"motivo_anulacion" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_adelantos_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "personal_adelantos_numero" UNIQUE("tenant_id","anio","numero"),
	CONSTRAINT "adelanto_monto" CHECK ("personal"."adelantos"."monto_centimos" > 0),
	CONSTRAINT "adelanto_estado" CHECK ("personal"."adelantos"."estado" IN ('registrado', 'anulado')),
	CONSTRAINT "adelanto_anulacion" CHECK (("personal"."adelantos"."estado" = 'anulado') = ("personal"."adelantos"."anulado_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "personal"."asistencias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"entrada" timestamp with time zone,
	"salida" timestamp with time zone,
	"estado" text DEFAULT 'presente' NOT NULL,
	"nota" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_asistencias_colaborador_fecha" UNIQUE("tenant_id","colaborador_id","fecha"),
	CONSTRAINT "asistencia_estado" CHECK ("personal"."asistencias"."estado" IN ('presente', 'tardanza', 'falta', 'permiso', 'descanso')),
	CONSTRAINT "asistencia_salida" CHECK ("personal"."asistencias"."salida" is null or "personal"."asistencias"."entrada" is not null)
);
--> statement-breakpoint
CREATE TABLE "personal"."colaboradores" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"documento_tipo" text,
	"documento_numero" text,
	"telefono" text,
	"cargo" text,
	"usuario_id" text,
	"fecha_ingreso" date,
	"sucursal_id" uuid,
	"archivado_en" timestamp with time zone,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_colaboradores_empresa_id" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "personal"."adelantos" ADD CONSTRAINT "adelantos_colaborador_fk" FOREIGN KEY ("tenant_id","colaborador_id") REFERENCES "personal"."colaboradores"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal"."asistencias" ADD CONSTRAINT "asistencias_colaborador_fk" FOREIGN KEY ("tenant_id","colaborador_id") REFERENCES "personal"."colaboradores"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal"."colaboradores" ADD CONSTRAINT "colaboradores_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_personal_adelantos_colaborador" ON "personal"."adelantos" USING btree ("tenant_id","colaborador_id","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_personal_adelantos_fecha" ON "personal"."adelantos" USING btree ("tenant_id","fecha" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_personal_asistencias_fecha" ON "personal"."asistencias" USING btree ("tenant_id","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_personal_colaboradores_nombre" ON "personal"."colaboradores" USING btree ("tenant_id","nombre_normalizado") WHERE "personal"."colaboradores"."archivado_en" is null;--> statement-breakpoint
CREATE INDEX "idx_personal_colaboradores_usuario" ON "personal"."colaboradores" USING btree ("tenant_id","usuario_id") WHERE "personal"."colaboradores"."usuario_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_personal_colaboradores_sucursal" ON "personal"."colaboradores" USING btree ("tenant_id","sucursal_id") WHERE "personal"."colaboradores"."sucursal_id" is not null;
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de personal.

select core.aplicar_aislamiento('personal.colaboradores', 'completo');
--> statement-breakpoint
create trigger colaboradores_actualizado before update on personal.colaboradores
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger colaboradores_modulo before insert or update or delete on personal.colaboradores
  for each row execute function core.exigir_modulo_en_escritura('personal');
--> statement-breakpoint

select core.aplicar_aislamiento('personal.asistencias', 'completo');
--> statement-breakpoint
create trigger asistencias_actualizado before update on personal.asistencias
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger asistencias_modulo before insert or update or delete on personal.asistencias
  for each row execute function core.exigir_modulo_en_escritura('personal');
--> statement-breakpoint

-- Adelantos: inmutables salvo la anulación (ADR-012).
select core.aplicar_aislamiento('personal.adelantos', 'insercion');
--> statement-breakpoint
create trigger adelantos_modulo before insert or update or delete on personal.adelantos
  for each row execute function core.exigir_modulo_en_escritura('personal');
--> statement-breakpoint
grant update (estado, anulado_en, anulado_por, motivo_anulacion) on personal.adelantos to capaz_app;
