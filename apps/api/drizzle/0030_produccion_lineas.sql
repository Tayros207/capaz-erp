CREATE TABLE "produccion"."orden_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"orden_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"precio_unitario_milesimas" bigint NOT NULL,
	"subtotal_centimos" bigint NOT NULL,
	"material" text,
	"medida" text,
	"colores" text,
	"acabado" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produccion_orden_items_posicion" UNIQUE("tenant_id","orden_id","posicion"),
	CONSTRAINT "orden_item_posicion" CHECK ("produccion"."orden_items"."posicion" >= 0),
	CONSTRAINT "orden_item_cantidad" CHECK ("produccion"."orden_items"."cantidad_milesimas" > 0),
	CONSTRAINT "orden_item_precio" CHECK ("produccion"."orden_items"."precio_unitario_milesimas" > 0),
	CONSTRAINT "orden_item_subtotal" CHECK ("produccion"."orden_items"."subtotal_centimos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP CONSTRAINT "orden_cantidad";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP CONSTRAINT "orden_adelanto_con_cliente";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP CONSTRAINT "orden_estado";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP CONSTRAINT "orden_montos";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP CONSTRAINT "ordenes_producto_fk";
--> statement-breakpoint
DROP INDEX "produccion"."idx_produccion_ordenes_cliente";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" ALTER COLUMN "cliente_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" ALTER COLUMN "total_centimos" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "produccion"."orden_items" ADD CONSTRAINT "orden_items_orden_fk" FOREIGN KEY ("tenant_id","orden_id") REFERENCES "produccion"."ordenes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_produccion_ordenes_entrega" ON "produccion"."ordenes" USING btree ("tenant_id","entrega_el") WHERE "produccion"."ordenes"."entrega_el" is not null;--> statement-breakpoint
CREATE INDEX "idx_produccion_ordenes_cliente" ON "produccion"."ordenes" USING btree ("tenant_id","cliente_id","fecha" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP COLUMN "producto_id";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP COLUMN "descripcion";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP COLUMN "unidad";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" DROP COLUMN "cantidad_milesimas";--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" ADD CONSTRAINT "orden_estado" CHECK ("produccion"."ordenes"."estado" IN ('pendiente', 'en_maquina', 'listo', 'entregado', 'anulada'));--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" ADD CONSTRAINT "orden_montos" CHECK ("produccion"."ordenes"."total_centimos" > 0 and "produccion"."ordenes"."adelanto_centimos" >= 0 and "produccion"."ordenes"."adelanto_centimos" <= "produccion"."ordenes"."total_centimos");
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- Las líneas se reemplazan al editar una orden: modo completo.
select core.aplicar_aislamiento('produccion.orden_items', 'completo');
--> statement-breakpoint
create trigger orden_items_modulo before insert or update or delete on produccion.orden_items
  for each row execute function core.exigir_modulo_en_escritura('produccion');
