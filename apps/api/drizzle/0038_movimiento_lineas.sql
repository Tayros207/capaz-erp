CREATE TABLE "registro"."movimiento_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"producto_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"precio_unitario_milesimas" bigint NOT NULL,
	"subtotal_centimos" bigint NOT NULL,
	CONSTRAINT "registro_movimiento_lineas_orden" UNIQUE("tenant_id","movimiento_id","orden"),
	CONSTRAINT "movimiento_linea_orden" CHECK ("registro"."movimiento_lineas"."orden" >= 0 and "registro"."movimiento_lineas"."orden" < 50),
	CONSTRAINT "movimiento_linea_descripcion" CHECK (length("registro"."movimiento_lineas"."descripcion") between 1 and 300),
	CONSTRAINT "movimiento_linea_unidad" CHECK (length("registro"."movimiento_lineas"."unidad") between 1 and 20),
	CONSTRAINT "movimiento_linea_cantidad" CHECK ("registro"."movimiento_lineas"."cantidad_milesimas" > 0),
	CONSTRAINT "movimiento_linea_precio" CHECK ("registro"."movimiento_lineas"."precio_unitario_milesimas" >= 0),
	CONSTRAINT "movimiento_linea_subtotal" CHECK ("registro"."movimiento_lineas"."subtotal_centimos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "registro"."movimiento_lineas" ADD CONSTRAINT "movimiento_lineas_movimiento_fk" FOREIGN KEY ("tenant_id","movimiento_id") REFERENCES "registro"."movimientos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."movimiento_lineas" ADD CONSTRAINT "movimiento_lineas_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ===== Seguridad a mano =====
select core.aplicar_aislamiento('registro.movimiento_lineas', 'insercion');
--> statement-breakpoint
create trigger movimiento_lineas_modulo before insert or update or delete on registro.movimiento_lineas
  for each row execute function core.exigir_modulo_en_escritura('registro');
--> statement-breakpoint
create trigger movimiento_lineas_inmutable before update or delete on registro.movimiento_lineas
  for each row execute function core.rechazar_cambio();
