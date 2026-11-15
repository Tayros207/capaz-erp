CREATE TABLE "core"."empresa_modulos" (
	"tenant_id" text NOT NULL,
	"modulo" text NOT NULL,
	"estado" text DEFAULT 'activo' NOT NULL,
	"alta_en" timestamp with time zone DEFAULT now() NOT NULL,
	"prueba_hasta" timestamp with time zone,
	"baja_en" timestamp with time zone,
	"motivo" text,
	"plan" text,
	"precio_acordado_centimos" bigint,
	"vigente_hasta" timestamp with time zone,
	"max_usuarios" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresa_modulos_tenant_id_modulo_pk" PRIMARY KEY("tenant_id","modulo"),
	CONSTRAINT "empresa_modulo_estado" CHECK ("core"."empresa_modulos"."estado" IN ('prueba', 'activo', 'suspendido', 'baja')),
	CONSTRAINT "empresa_modulo_prueba" CHECK (("core"."empresa_modulos"."estado" = 'prueba') = ("core"."empresa_modulos"."prueba_hasta" IS NOT NULL)),
	CONSTRAINT "empresa_modulo_baja" CHECK (("core"."empresa_modulos"."estado" = 'baja') = ("core"."empresa_modulos"."baja_en" IS NOT NULL)),
	CONSTRAINT "empresa_modulo_precio" CHECK ("core"."empresa_modulos"."precio_acordado_centimos" IS NULL OR "core"."empresa_modulos"."precio_acordado_centimos" >= 0),
	CONSTRAINT "empresa_modulo_usuarios" CHECK ("core"."empresa_modulos"."max_usuarios" IS NULL OR "core"."empresa_modulos"."max_usuarios" > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."empresa_modulos_eventos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"modulo" text NOT NULL,
	"evento" text NOT NULL,
	"estado_anterior" text,
	"estado_nuevo" text NOT NULL,
	"motivo" text,
	"actor" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modulo_evento_tipo" CHECK ("core"."empresa_modulos_eventos"."evento" IN ('alta', 'prueba', 'suspension', 'baja', 'reactivacion', 'cambio'))
);
--> statement-breakpoint
CREATE TABLE "core"."modulos" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"version" text DEFAULT '0.0.0' NOT NULL,
	"depende_de" text[] DEFAULT '{}'::text[] NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"por_defecto" boolean DEFAULT false NOT NULL,
	"prueba_dias" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."plan_modulos" (
	"plan" text NOT NULL,
	"modulo" text NOT NULL,
	CONSTRAINT "plan_modulos_plan_modulo_pk" PRIMARY KEY("plan","modulo")
);
--> statement-breakpoint
CREATE TABLE "core"."planes" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"precio_centimos" bigint DEFAULT 0 NOT NULL,
	"usuarios_incluidos" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_precio" CHECK ("core"."planes"."precio_centimos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "core"."plataforma_admins" (
	"usuario_id" text PRIMARY KEY NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."solicitudes_modulo" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"modulo" text NOT NULL,
	"usuario_id" text NOT NULL,
	"nota" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"atendido_en" timestamp with time zone,
	CONSTRAINT "solicitud_estado" CHECK ("core"."solicitudes_modulo"."estado" IN ('pendiente', 'atendida', 'descartada'))
);
--> statement-breakpoint
CREATE TABLE "core"."usuario_modulos" (
	"tenant_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"modulo" text NOT NULL,
	"nivel" text DEFAULT 'completo' NOT NULL,
	"alcance" text DEFAULT 'todos' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_modulos_tenant_id_usuario_id_modulo_pk" PRIMARY KEY("tenant_id","usuario_id","modulo"),
	CONSTRAINT "usuario_modulo_nivel" CHECK ("core"."usuario_modulos"."nivel" IN ('completo', 'lectura')),
	CONSTRAINT "usuario_modulo_alcance" CHECK ("core"."usuario_modulos"."alcance" IN ('todos', 'propios'))
);
--> statement-breakpoint
ALTER TABLE "core"."empresa_modulos" ADD CONSTRAINT "empresa_modulos_modulo_modulos_codigo_fk" FOREIGN KEY ("modulo") REFERENCES "core"."modulos"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."empresa_modulos" ADD CONSTRAINT "empresa_modulos_plan_planes_codigo_fk" FOREIGN KEY ("plan") REFERENCES "core"."planes"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."empresa_modulos_eventos" ADD CONSTRAINT "empresa_modulos_eventos_modulo_modulos_codigo_fk" FOREIGN KEY ("modulo") REFERENCES "core"."modulos"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."plan_modulos" ADD CONSTRAINT "plan_modulos_plan_planes_codigo_fk" FOREIGN KEY ("plan") REFERENCES "core"."planes"("codigo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."plan_modulos" ADD CONSTRAINT "plan_modulos_modulo_modulos_codigo_fk" FOREIGN KEY ("modulo") REFERENCES "core"."modulos"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."solicitudes_modulo" ADD CONSTRAINT "solicitudes_modulo_modulo_modulos_codigo_fk" FOREIGN KEY ("modulo") REFERENCES "core"."modulos"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."usuario_modulos" ADD CONSTRAINT "usuario_modulo_contratado" FOREIGN KEY ("tenant_id","modulo") REFERENCES "core"."empresa_modulos"("tenant_id","modulo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_modulos_eventos_empresa" ON "core"."empresa_modulos_eventos" USING btree ("tenant_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_solicitudes_pendientes" ON "core"."solicitudes_modulo" USING btree ("creado_en") WHERE "core"."solicitudes_modulo"."estado" = 'pendiente';
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====

-- Catálogos sin tenant_id: los lee cualquiera de los dos roles; solo la plataforma escribe.
grant select on core.modulos, core.planes, core.plan_modulos to capaz_app, capaz_sistema;
--> statement-breakpoint
grant insert, update, delete on core.modulos, core.planes, core.plan_modulos to capaz_sistema;
--> statement-breakpoint

-- Contratación: la empresa solo LEE la suya; la plataforma la administra.
select core.aplicar_aislamiento('core.empresa_modulos', 'lectura');
--> statement-breakpoint
select core.abrir_a_plataforma('core.empresa_modulos', 'insert, update');
--> statement-breakpoint
create trigger empresa_modulos_actualizado before update on core.empresa_modulos
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint

-- Historial: solo inserción (lo escribe el disparador de 0003).
select core.aplicar_aislamiento('core.empresa_modulos_eventos', 'lectura');
--> statement-breakpoint
select core.abrir_a_plataforma('core.empresa_modulos_eventos', 'insert');
--> statement-breakpoint
create trigger empresa_modulos_eventos_solo_insercion before update or delete on core.empresa_modulos_eventos
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Asignación de módulos a usuarios: la administra cada empresa. La plataforma no la ve.
select core.aplicar_aislamiento('core.usuario_modulos', 'completo');
--> statement-breakpoint

-- Solicitudes: la empresa inserta (solo estas columnas) y lee; la plataforma solo las atiende.
select core.aplicar_aislamiento('core.solicitudes_modulo', 'insercion');
--> statement-breakpoint
revoke insert on core.solicitudes_modulo from capaz_app;
--> statement-breakpoint
grant insert (tenant_id, modulo, usuario_id, nota) on core.solicitudes_modulo to capaz_app;
--> statement-breakpoint
select core.abrir_a_plataforma('core.solicitudes_modulo');
--> statement-breakpoint
grant update (estado, atendido_en) on core.solicitudes_modulo to capaz_sistema;
--> statement-breakpoint

-- Administradores de plataforma: solo la plataforma. La empresa no tiene acceso alguno.
grant select, insert, delete on core.plataforma_admins to capaz_sistema;
