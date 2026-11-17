CREATE TABLE "core"."categorias_producto" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"padre_id" uuid,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_producto_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "categoria_producto_no_es_su_padre" CHECK ("core"."categorias_producto"."padre_id" is null or "core"."categorias_producto"."padre_id" <> "core"."categorias_producto"."id")
);
--> statement-breakpoint
CREATE TABLE "core"."cliente_comercial" (
	"tenant_id" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"condicion_pago_dias" integer DEFAULT 0 NOT NULL,
	"limite_credito_centimos" bigint,
	"moneda" text DEFAULT 'PEN' NOT NULL,
	"vendedor_id" text,
	"segmento" text,
	"sitio_web" text,
	"agente_retencion" boolean DEFAULT false NOT NULL,
	"sujeto_detraccion" boolean DEFAULT false NOT NULL,
	"banco" text,
	"cuenta_bancaria" text,
	"cci" text,
	"notas_comerciales" text,
	"actualizado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cliente_comercial_pkey" PRIMARY KEY("tenant_id","cliente_id"),
	CONSTRAINT "cliente_comercial_plazo" CHECK ("core"."cliente_comercial"."condicion_pago_dias" between 0 and 365),
	CONSTRAINT "cliente_comercial_limite" CHECK ("core"."cliente_comercial"."limite_credito_centimos" is null or "core"."cliente_comercial"."limite_credito_centimos" >= 0),
	CONSTRAINT "cliente_comercial_moneda" CHECK ("core"."cliente_comercial"."moneda" in ('PEN', 'USD', 'EUR'))
);
--> statement-breakpoint
CREATE TABLE "core"."cliente_contactos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"cargo" text,
	"telefono" text,
	"correo" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"notas" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cliente_contactos_empresa_id" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "core"."cliente_direcciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" text DEFAULT 'entrega' NOT NULL,
	"direccion" text NOT NULL,
	"ciudad" text,
	"departamento" text,
	"referencia" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cliente_direcciones_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "cliente_direccion_tipo" CHECK ("core"."cliente_direcciones"."tipo" in ('fiscal', 'entrega', 'otra'))
);
--> statement-breakpoint
CREATE TABLE "core"."producto_ficha" (
	"tenant_id" text NOT NULL,
	"producto_id" uuid NOT NULL,
	"categoria_id" uuid,
	"marca" text,
	"sku" text,
	"codigo_barras" text,
	"costo_milesimas" bigint,
	"peso_gramos" numeric(12, 3),
	"alto_mm" integer,
	"ancho_mm" integer,
	"largo_mm" integer,
	"vendible" boolean DEFAULT true NOT NULL,
	"comprable" boolean DEFAULT true NOT NULL,
	"actualizado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "producto_ficha_pkey" PRIMARY KEY("tenant_id","producto_id"),
	CONSTRAINT "producto_ficha_costo" CHECK ("core"."producto_ficha"."costo_milesimas" is null or "core"."producto_ficha"."costo_milesimas" >= 0),
	CONSTRAINT "producto_ficha_medidas" CHECK (("core"."producto_ficha"."peso_gramos" is null or "core"."producto_ficha"."peso_gramos" >= 0) and ("core"."producto_ficha"."alto_mm" is null or "core"."producto_ficha"."alto_mm" >= 0) and ("core"."producto_ficha"."ancho_mm" is null or "core"."producto_ficha"."ancho_mm" >= 0) and ("core"."producto_ficha"."largo_mm" is null or "core"."producto_ficha"."largo_mm" >= 0))
);
--> statement-breakpoint
CREATE TABLE "core"."producto_unidades" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"producto_id" uuid NOT NULL,
	"unidad" text NOT NULL,
	"factor_milesimas" bigint NOT NULL,
	"para_compra" boolean DEFAULT true NOT NULL,
	"para_venta" boolean DEFAULT true NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "producto_unidades_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "producto_unidades_unica" UNIQUE("tenant_id","producto_id","unidad"),
	CONSTRAINT "producto_unidad_factor" CHECK ("core"."producto_unidades"."factor_milesimas" > 0)
);
--> statement-breakpoint
ALTER TABLE "core"."categorias_producto" ADD CONSTRAINT "categorias_producto_padre_fk" FOREIGN KEY ("tenant_id","padre_id") REFERENCES "core"."categorias_producto"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cliente_comercial" ADD CONSTRAINT "cliente_comercial_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cliente_contactos" ADD CONSTRAINT "cliente_contactos_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cliente_direcciones" ADD CONSTRAINT "cliente_direcciones_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."producto_ficha" ADD CONSTRAINT "producto_ficha_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."producto_ficha" ADD CONSTRAINT "producto_ficha_categoria_fk" FOREIGN KEY ("tenant_id","categoria_id") REFERENCES "core"."categorias_producto"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."producto_unidades" ADD CONSTRAINT "producto_unidades_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categorias_producto_nombre" ON "core"."categorias_producto" USING btree ("tenant_id","nombre_normalizado") WHERE "core"."categorias_producto"."archivado_en" is null;--> statement-breakpoint
CREATE INDEX "idx_cliente_contactos_cliente" ON "core"."cliente_contactos" USING btree ("tenant_id","cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cliente_contactos_principal" ON "core"."cliente_contactos" USING btree ("tenant_id","cliente_id") WHERE "core"."cliente_contactos"."es_principal";--> statement-breakpoint
CREATE INDEX "idx_cliente_direcciones_cliente" ON "core"."cliente_direcciones" USING btree ("tenant_id","cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cliente_direcciones_principal" ON "core"."cliente_direcciones" USING btree ("tenant_id","cliente_id","tipo") WHERE "core"."cliente_direcciones"."es_principal";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_producto_ficha_sku" ON "core"."producto_ficha" USING btree ("tenant_id","sku") WHERE "core"."producto_ficha"."sku" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_producto_ficha_barras" ON "core"."producto_ficha" USING btree ("tenant_id","codigo_barras") WHERE "core"."producto_ficha"."codigo_barras" is not null;--> statement-breakpoint
CREATE INDEX "idx_producto_ficha_categoria" ON "core"."producto_ficha" USING btree ("tenant_id","categoria_id") WHERE "core"."producto_ficha"."categoria_id" is not null;
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- Maestros ampliados: solo la empresa. La plataforma no los ve.
select core.aplicar_aislamiento('core.cliente_comercial', 'completo');
--> statement-breakpoint
create trigger cliente_comercial_actualizado before update on core.cliente_comercial
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.cliente_contactos', 'completo');
--> statement-breakpoint
create trigger cliente_contactos_actualizado before update on core.cliente_contactos
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.cliente_direcciones', 'completo');
--> statement-breakpoint
create trigger cliente_direcciones_actualizado before update on core.cliente_direcciones
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.categorias_producto', 'completo');
--> statement-breakpoint
create trigger categorias_producto_actualizado before update on core.categorias_producto
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.producto_ficha', 'completo');
--> statement-breakpoint
create trigger producto_ficha_actualizado before update on core.producto_ficha
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
select core.aplicar_aislamiento('core.producto_unidades', 'completo');
--> statement-breakpoint
create trigger producto_unidades_actualizado before update on core.producto_unidades
  for each row execute function core.tocar_actualizado_en();
