CREATE TABLE "core"."clientes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"tipo" text DEFAULT 'cliente' NOT NULL,
	"clase" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"documento_tipo" text,
	"documento_numero" text,
	"telefono" text,
	"correo" text,
	"direccion" text,
	"notas" text,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fusionado_en" uuid,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "cliente_tipo" CHECK ("core"."clientes"."tipo" IN ('cliente', 'proveedor', 'ambos')),
	CONSTRAINT "cliente_clase" CHECK ("core"."clientes"."clase" IN ('persona', 'empresa')),
	CONSTRAINT "cliente_documento_tipo" CHECK ("core"."clientes"."documento_tipo" IS NULL OR "core"."clientes"."documento_tipo" IN ('dni', 'ruc', 'ce', 'pasaporte', 'otro'))
);
--> statement-breakpoint
CREATE TABLE "core"."productos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"codigo" text,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"tipo" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"precio_unitario_milesimas" bigint DEFAULT 0 NOT NULL,
	"afecto_igv" boolean DEFAULT true NOT NULL,
	"descripcion" text,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "producto_tipo" CHECK ("core"."productos"."tipo" IN ('producto', 'servicio')),
	CONSTRAINT "producto_precio" CHECK ("core"."productos"."precio_unitario_milesimas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "core"."sucursales" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"telefono" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sucursales_empresa_codigo" UNIQUE("tenant_id","codigo"),
	CONSTRAINT "sucursal_codigo" CHECK ("core"."sucursales"."codigo" ~ '^[A-Z0-9]{2,6}$')
);
--> statement-breakpoint
ALTER TABLE "core"."clientes" ADD CONSTRAINT "clientes_fusionado_fk" FOREIGN KEY ("tenant_id","fusionado_en") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_clientes_nombre" ON "core"."clientes" USING btree ("tenant_id","nombre_normalizado") WHERE "core"."clientes"."fusionado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_clientes_documento" ON "core"."clientes" USING btree ("tenant_id","documento_tipo","documento_numero") WHERE "core"."clientes"."documento_numero" is not null and "core"."clientes"."fusionado_en" is null;--> statement-breakpoint
CREATE INDEX "idx_clientes_parecido" ON "core"."clientes" USING gin ("tenant_id" gin_trgm_ops,"nombre_normalizado" gin_trgm_ops) WHERE "core"."clientes"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_productos_nombre" ON "core"."productos" USING btree ("tenant_id","nombre_normalizado") WHERE "core"."productos"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_productos_codigo" ON "core"."productos" USING btree ("tenant_id","codigo") WHERE "core"."productos"."codigo" is not null;--> statement-breakpoint
CREATE INDEX "idx_productos_parecido" ON "core"."productos" USING gin ("tenant_id" gin_trgm_ops,"nombre_normalizado" gin_trgm_ops) WHERE "core"."productos"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sucursales_principal" ON "core"."sucursales" USING btree ("tenant_id") WHERE "core"."sucursales"."es_principal";
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====

-- Datos maestros: solo la empresa. La plataforma no los ve.
select core.aplicar_aislamiento('core.clientes', 'completo');
--> statement-breakpoint
create trigger clientes_actualizado before update on core.clientes
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.productos', 'completo');
--> statement-breakpoint
create trigger productos_actualizado before update on core.productos
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.sucursales', 'completo');
--> statement-breakpoint
create trigger sucursales_actualizado before update on core.sucursales
  for each row execute function core.tocar_actualizado_en();
