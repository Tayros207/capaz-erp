CREATE TABLE "ordenes"."pedido_eventos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"pedido_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado_anterior" text,
	"estado_nuevo" text,
	"nota" text,
	"usuario_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_tipo" CHECK ("ordenes"."pedido_eventos"."tipo" IN ('creado', 'editado', 'confirmado', 'estado', 'cancelado', 'nota'))
);
--> statement-breakpoint
CREATE TABLE "ordenes"."pedido_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"pedido_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"producto_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"precio_unitario_milesimas" bigint NOT NULL,
	"afecto_igv" boolean DEFAULT true NOT NULL,
	"importe_centimos" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_pedido_lineas_posicion" UNIQUE("tenant_id","pedido_id","posicion"),
	CONSTRAINT "linea_posicion" CHECK ("ordenes"."pedido_lineas"."posicion" >= 0),
	CONSTRAINT "linea_cantidad" CHECK ("ordenes"."pedido_lineas"."cantidad_milesimas" > 0),
	CONSTRAINT "linea_precio" CHECK ("ordenes"."pedido_lineas"."precio_unitario_milesimas" >= 0),
	CONSTRAINT "linea_importe" CHECK ("ordenes"."pedido_lineas"."importe_centimos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ordenes"."pedidos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer,
	"serie" text,
	"anio" integer,
	"cliente_id" uuid NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"fecha" date NOT NULL,
	"entrega_el" date,
	"responsable_id" text,
	"igv_porcentaje" smallint DEFAULT 18 NOT NULL,
	"subtotal_centimos" bigint DEFAULT 0 NOT NULL,
	"igv_centimos" bigint DEFAULT 0 NOT NULL,
	"total_centimos" bigint DEFAULT 0 NOT NULL,
	"notas" text,
	"sucursal_id" uuid,
	"origen_tipo" text,
	"origen_id" text,
	"confirmado_en" timestamp with time zone,
	"entregado_en" timestamp with time zone,
	"cancelado_en" timestamp with time zone,
	"cancelado_por" text,
	"motivo_cancelacion" text,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_pedidos_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "pedido_numeracion" CHECK (("ordenes"."pedidos"."numero" is null) = ("ordenes"."pedidos"."serie" is null) and ("ordenes"."pedidos"."numero" is null) = ("ordenes"."pedidos"."anio" is null)),
	CONSTRAINT "pedido_estado" CHECK ("ordenes"."pedidos"."estado" IN ('borrador', 'confirmado', 'en_proceso', 'listo', 'entregado', 'cancelado')),
	CONSTRAINT "pedido_estado_numero" CHECK ("ordenes"."pedidos"."estado" in ('borrador', 'cancelado') or "ordenes"."pedidos"."numero" is not null),
	CONSTRAINT "pedido_igv_porcentaje" CHECK ("ordenes"."pedidos"."igv_porcentaje" between 0 and 100),
	CONSTRAINT "pedido_subtotal" CHECK ("ordenes"."pedidos"."subtotal_centimos" >= 0),
	CONSTRAINT "pedido_igv" CHECK ("ordenes"."pedidos"."igv_centimos" >= 0),
	CONSTRAINT "pedido_total" CHECK ("ordenes"."pedidos"."total_centimos" = "ordenes"."pedidos"."subtotal_centimos" + "ordenes"."pedidos"."igv_centimos"),
	CONSTRAINT "pedido_origen" CHECK (("ordenes"."pedidos"."origen_tipo" is null) = ("ordenes"."pedidos"."origen_id" is null)),
	CONSTRAINT "pedido_cancelacion" CHECK (("ordenes"."pedidos"."estado" = 'cancelado') = ("ordenes"."pedidos"."cancelado_en" is not null))
);
--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD CONSTRAINT "pedido_eventos_pedido_fk" FOREIGN KEY ("tenant_id","pedido_id") REFERENCES "ordenes"."pedidos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_lineas" ADD CONSTRAINT "pedido_lineas_pedido_fk" FOREIGN KEY ("tenant_id","pedido_id") REFERENCES "ordenes"."pedidos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_lineas" ADD CONSTRAINT "pedido_lineas_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."pedidos" ADD CONSTRAINT "pedidos_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."pedidos" ADD CONSTRAINT "pedidos_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ordenes_pedido_eventos_pedido" ON "ordenes"."pedido_eventos" USING btree ("tenant_id","pedido_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ordenes_pedidos_numero" ON "ordenes"."pedidos" USING btree ("tenant_id","serie","anio","numero") WHERE "ordenes"."pedidos"."numero" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ordenes_pedidos_origen" ON "ordenes"."pedidos" USING btree ("tenant_id","origen_tipo","origen_id") WHERE "ordenes"."pedidos"."origen_id" is not null and "ordenes"."pedidos"."estado" <> 'cancelado';--> statement-breakpoint
CREATE INDEX "idx_ordenes_pedidos_estado" ON "ordenes"."pedidos" USING btree ("tenant_id","estado","entrega_el");--> statement-breakpoint
CREATE INDEX "idx_ordenes_pedidos_cliente" ON "ordenes"."pedidos" USING btree ("tenant_id","cliente_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ordenes_pedidos_responsable" ON "ordenes"."pedidos" USING btree ("tenant_id","responsable_id","estado");--> statement-breakpoint
CREATE INDEX "idx_ordenes_pedidos_creador" ON "ordenes"."pedidos" USING btree ("tenant_id","creado_por","creado_en" DESC NULLS LAST);--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de ordenes.

select core.aplicar_aislamiento('ordenes.pedidos', 'completo');
--> statement-breakpoint
create trigger pedidos_actualizado before update on ordenes.pedidos
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger pedidos_modulo before insert or update or delete on ordenes.pedidos
  for each row execute function core.exigir_modulo_en_escritura('ordenes');
--> statement-breakpoint
create trigger pedidos_sin_borrado before delete on ordenes.pedidos
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Las líneas de un borrador se reemplazan: modo completo.
select core.aplicar_aislamiento('ordenes.pedido_lineas', 'completo');
--> statement-breakpoint
create trigger pedido_lineas_modulo before insert or update or delete on ordenes.pedido_lineas
  for each row execute function core.exigir_modulo_en_escritura('ordenes');
--> statement-breakpoint

-- Historial de un pedido: solo se agrega (ADR-012).
select core.aplicar_aislamiento('ordenes.pedido_eventos', 'insercion');
--> statement-breakpoint
create trigger pedido_eventos_modulo before insert or update or delete on ordenes.pedido_eventos
  for each row execute function core.exigir_modulo_en_escritura('ordenes');
--> statement-breakpoint
create trigger pedido_eventos_inmutable before update or delete on ordenes.pedido_eventos
  for each row execute function core.rechazar_cambio();
