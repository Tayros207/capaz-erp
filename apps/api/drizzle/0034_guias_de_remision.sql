CREATE TABLE "ordenes"."guia_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"guia_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"pedido_id" uuid,
	"pedido_linea_id" uuid,
	"producto_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_guia_lineas_posicion" UNIQUE("tenant_id","guia_id","posicion"),
	CONSTRAINT "guia_linea_posicion" CHECK ("ordenes"."guia_lineas"."posicion" >= 0),
	CONSTRAINT "guia_linea_cantidad" CHECK ("ordenes"."guia_lineas"."cantidad_milesimas" > 0),
	CONSTRAINT "guia_linea_origen" CHECK (("ordenes"."guia_lineas"."pedido_id" is null) = ("ordenes"."guia_lineas"."pedido_linea_id" is null))
);
--> statement-breakpoint
CREATE TABLE "ordenes"."guias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"serie" text NOT NULL,
	"numero" integer NOT NULL,
	"estado" text DEFAULT 'emitida' NOT NULL,
	"cliente_id" uuid NOT NULL,
	"destinatario_nombre" text NOT NULL,
	"destinatario_documento" text,
	"fecha_emision" date NOT NULL,
	"fecha_traslado" date NOT NULL,
	"punto_partida" text NOT NULL,
	"punto_llegada" text NOT NULL,
	"motivo" text NOT NULL,
	"motivo_detalle" text,
	"modalidad" text NOT NULL,
	"transportista" text,
	"conductor" text,
	"licencia" text,
	"placa" text,
	"bultos" text,
	"observaciones" text,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"motivo_anulacion" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_guias_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "guia_numero" CHECK ("ordenes"."guias"."numero" > 0),
	CONSTRAINT "guia_estado" CHECK ("ordenes"."guias"."estado" IN ('emitida', 'anulada')),
	CONSTRAINT "guia_motivo" CHECK ("ordenes"."guias"."motivo" IN ('venta', 'entrega_de_trabajo', 'traslado_entre_locales', 'otro')),
	CONSTRAINT "guia_motivo_detalle" CHECK ("ordenes"."guias"."motivo" <> 'otro' or "ordenes"."guias"."motivo_detalle" is not null),
	CONSTRAINT "guia_modalidad" CHECK ("ordenes"."guias"."modalidad" IN ('privado', 'publico')),
	CONSTRAINT "guia_transportista" CHECK ("ordenes"."guias"."modalidad" <> 'publico' or "ordenes"."guias"."transportista" is not null),
	CONSTRAINT "guia_anulacion" CHECK (("ordenes"."guias"."estado" = 'anulada') = ("ordenes"."guias"."anulado_en" is not null) and ("ordenes"."guias"."anulado_en" is null) = ("ordenes"."guias"."anulado_por" is null) and ("ordenes"."guias"."anulado_en" is null) = ("ordenes"."guias"."motivo_anulacion" is null))
);
--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" DROP CONSTRAINT "evento_tipo";--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD COLUMN "guia_id" uuid;--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_lineas" ADD CONSTRAINT "ordenes_pedido_lineas_pedido_id" UNIQUE("tenant_id","pedido_id","id");--> statement-breakpoint
ALTER TABLE "ordenes"."guia_lineas" ADD CONSTRAINT "guia_lineas_guia_fk" FOREIGN KEY ("tenant_id","guia_id") REFERENCES "ordenes"."guias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."guia_lineas" ADD CONSTRAINT "guia_lineas_pedido_fk" FOREIGN KEY ("tenant_id","pedido_id") REFERENCES "ordenes"."pedidos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."guia_lineas" ADD CONSTRAINT "guia_lineas_pedido_linea_fk" FOREIGN KEY ("tenant_id","pedido_id","pedido_linea_id") REFERENCES "ordenes"."pedido_lineas"("tenant_id","pedido_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."guia_lineas" ADD CONSTRAINT "guia_lineas_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."guias" ADD CONSTRAINT "guias_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ordenes_guia_lineas_origen" ON "ordenes"."guia_lineas" USING btree ("tenant_id","guia_id","pedido_linea_id") WHERE "ordenes"."guia_lineas"."pedido_linea_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_ordenes_guia_lineas_pedido" ON "ordenes"."guia_lineas" USING btree ("tenant_id","pedido_id","pedido_linea_id") WHERE "ordenes"."guia_lineas"."pedido_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ordenes_guias_numero" ON "ordenes"."guias" USING btree ("tenant_id","serie","numero");--> statement-breakpoint
CREATE INDEX "idx_ordenes_guias_creado" ON "ordenes"."guias" USING btree ("tenant_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ordenes_guias_cliente" ON "ordenes"."guias" USING btree ("tenant_id","cliente_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ordenes_guias_creador" ON "ordenes"."guias" USING btree ("tenant_id","creado_por","creado_en" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD CONSTRAINT "pedido_eventos_guia_fk" FOREIGN KEY ("tenant_id","guia_id") REFERENCES "ordenes"."guias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD CONSTRAINT "evento_guia" CHECK (("ordenes"."pedido_eventos"."tipo" in ('guia_emitida', 'guia_anulada')) = ("ordenes"."pedido_eventos"."guia_id" is not null));--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD CONSTRAINT "evento_tipo" CHECK ("ordenes"."pedido_eventos"."tipo" IN ('creado', 'editado', 'confirmado', 'estado', 'cancelado', 'nota', 'datos_editados', 'guia_emitida', 'guia_anulada'));
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- Guías de remisión (control interno, sin SUNAT): inmutables salvo la anulación (ADR-012). Ni se borran ni reutilizan número.
select core.aplicar_aislamiento('ordenes.guias', 'insercion');
--> statement-breakpoint
grant update (estado, anulado_en, anulado_por, motivo_anulacion) on ordenes.guias to capaz_app;
--> statement-breakpoint
create trigger guias_modulo before insert or update or delete on ordenes.guias
  for each row execute function core.exigir_modulo_en_escritura('ordenes');
--> statement-breakpoint
create trigger guias_sin_borrado before delete on ordenes.guias
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
-- Las líneas quedan como se emitieron: reimpresión idéntica.
select core.aplicar_aislamiento('ordenes.guia_lineas', 'insercion');
--> statement-breakpoint
create trigger guia_lineas_modulo before insert or update or delete on ordenes.guia_lineas
  for each row execute function core.exigir_modulo_en_escritura('ordenes');
--> statement-breakpoint
create trigger guia_lineas_inmutable before update or delete on ordenes.guia_lineas
  for each row execute function core.rechazar_cambio();
