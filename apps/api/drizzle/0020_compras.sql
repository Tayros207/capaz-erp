-- El esquema `compras` ya existe (0017); aquí solo van sus tablas.
CREATE TABLE "compras"."orden_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"orden_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"producto_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"costo_unitario_milesimas" bigint NOT NULL,
	"afecto_igv" boolean DEFAULT true NOT NULL,
	"importe_centimos" bigint NOT NULL,
	"recibido_milesimas" bigint DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_orden_lineas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "compras_orden_lineas_posicion" UNIQUE("tenant_id","orden_id","posicion"),
	CONSTRAINT "linea_posicion" CHECK ("compras"."orden_lineas"."posicion" >= 0),
	CONSTRAINT "linea_cantidad" CHECK ("compras"."orden_lineas"."cantidad_milesimas" > 0),
	CONSTRAINT "linea_costo" CHECK ("compras"."orden_lineas"."costo_unitario_milesimas" >= 0),
	CONSTRAINT "linea_importe" CHECK ("compras"."orden_lineas"."importe_centimos" >= 0),
	CONSTRAINT "linea_recibido" CHECK ("compras"."orden_lineas"."recibido_milesimas" >= 0),
	CONSTRAINT "linea_recibido_maximo" CHECK ("compras"."orden_lineas"."recibido_milesimas" <= "compras"."orden_lineas"."cantidad_milesimas")
);
--> statement-breakpoint
CREATE TABLE "compras"."ordenes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer,
	"serie" text,
	"anio" integer,
	"proveedor_id" uuid NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"fecha" date NOT NULL,
	"entrega_el" date,
	"igv_porcentaje" smallint DEFAULT 18 NOT NULL,
	"subtotal_centimos" bigint DEFAULT 0 NOT NULL,
	"igv_centimos" bigint DEFAULT 0 NOT NULL,
	"total_centimos" bigint DEFAULT 0 NOT NULL,
	"notas" text,
	"sucursal_id" uuid,
	"cancelado_en" timestamp with time zone,
	"cancelado_por" text,
	"motivo_cancelacion" text,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_ordenes_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "orden_numeracion" CHECK (("compras"."ordenes"."numero" is null) = ("compras"."ordenes"."serie" is null) and ("compras"."ordenes"."numero" is null) = ("compras"."ordenes"."anio" is null)),
	CONSTRAINT "orden_estado" CHECK ("compras"."ordenes"."estado" IN ('borrador', 'enviada', 'recibida_parcial', 'recibida', 'cancelada')),
	CONSTRAINT "orden_estado_numero" CHECK ("compras"."ordenes"."estado" in ('borrador', 'cancelada') or "compras"."ordenes"."numero" is not null),
	CONSTRAINT "orden_igv_porcentaje" CHECK ("compras"."ordenes"."igv_porcentaje" between 0 and 100),
	CONSTRAINT "orden_subtotal" CHECK ("compras"."ordenes"."subtotal_centimos" >= 0),
	CONSTRAINT "orden_igv" CHECK ("compras"."ordenes"."igv_centimos" >= 0),
	CONSTRAINT "orden_total" CHECK ("compras"."ordenes"."total_centimos" = "compras"."ordenes"."subtotal_centimos" + "compras"."ordenes"."igv_centimos"),
	CONSTRAINT "orden_cancelacion" CHECK (("compras"."ordenes"."estado" = 'cancelada') = ("compras"."ordenes"."cancelado_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "compras"."recepcion_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"recepcion_id" uuid NOT NULL,
	"orden_linea_id" uuid NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_recepcion_lineas_unica" UNIQUE("tenant_id","recepcion_id","orden_linea_id"),
	CONSTRAINT "recepcion_linea_cantidad" CHECK ("compras"."recepcion_lineas"."cantidad_milesimas" > 0)
);
--> statement-breakpoint
CREATE TABLE "compras"."recepciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"orden_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"fecha" date NOT NULL,
	"nota" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_recepciones_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "compras_recepciones_numero" UNIQUE("tenant_id","orden_id","numero"),
	CONSTRAINT "recepcion_numero" CHECK ("compras"."recepciones"."numero" > 0)
);
--> statement-breakpoint
ALTER TABLE "compras"."orden_lineas" ADD CONSTRAINT "orden_lineas_orden_fk" FOREIGN KEY ("tenant_id","orden_id") REFERENCES "compras"."ordenes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."orden_lineas" ADD CONSTRAINT "orden_lineas_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."ordenes" ADD CONSTRAINT "ordenes_proveedor_fk" FOREIGN KEY ("tenant_id","proveedor_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."ordenes" ADD CONSTRAINT "ordenes_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_recepcion_fk" FOREIGN KEY ("tenant_id","recepcion_id") REFERENCES "compras"."recepciones"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_orden_linea_fk" FOREIGN KEY ("tenant_id","orden_linea_id") REFERENCES "compras"."orden_lineas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."recepciones" ADD CONSTRAINT "recepciones_orden_fk" FOREIGN KEY ("tenant_id","orden_id") REFERENCES "compras"."ordenes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_compras_ordenes_numero" ON "compras"."ordenes" USING btree ("tenant_id","serie","anio","numero") WHERE "compras"."ordenes"."numero" is not null;--> statement-breakpoint
CREATE INDEX "idx_compras_ordenes_estado" ON "compras"."ordenes" USING btree ("tenant_id","estado","entrega_el");--> statement-breakpoint
CREATE INDEX "idx_compras_ordenes_proveedor" ON "compras"."ordenes" USING btree ("tenant_id","proveedor_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_compras_ordenes_creador" ON "compras"."ordenes" USING btree ("tenant_id","creado_por","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_compras_recepcion_lineas_orden_linea" ON "compras"."recepcion_lineas" USING btree ("tenant_id","orden_linea_id");
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de compras.

select core.aplicar_aislamiento('compras.ordenes', 'completo');
--> statement-breakpoint
create trigger ordenes_actualizado before update on compras.ordenes
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger ordenes_modulo before insert or update or delete on compras.ordenes
  for each row execute function core.exigir_modulo_en_escritura('compras');
--> statement-breakpoint
create trigger ordenes_sin_borrado before delete on compras.ordenes
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Las líneas de un borrador se reemplazan y `recibido_milesimas` se actualiza al recibir: modo completo.
select core.aplicar_aislamiento('compras.orden_lineas', 'completo');
--> statement-breakpoint
create trigger orden_lineas_modulo before insert or update or delete on compras.orden_lineas
  for each row execute function core.exigir_modulo_en_escritura('compras');
--> statement-breakpoint

-- Recepciones: solo se agregan (ADR-012). Un error se corrige con otra recepción o un ajuste.
select core.aplicar_aislamiento('compras.recepciones', 'insercion');
--> statement-breakpoint
create trigger recepciones_modulo before insert or update or delete on compras.recepciones
  for each row execute function core.exigir_modulo_en_escritura('compras');
--> statement-breakpoint
create trigger recepciones_inmutable before update or delete on compras.recepciones
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

select core.aplicar_aislamiento('compras.recepcion_lineas', 'insercion');
--> statement-breakpoint
create trigger recepcion_lineas_modulo before insert or update or delete on compras.recepcion_lineas
  for each row execute function core.exigir_modulo_en_escritura('compras');
--> statement-breakpoint
create trigger recepcion_lineas_inmutable before update or delete on compras.recepcion_lineas
  for each row execute function core.rechazar_cambio();
