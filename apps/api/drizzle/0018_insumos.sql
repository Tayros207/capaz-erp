-- El esquema `insumos` ya existe (0017); aquí solo van sus tablas.
CREATE TABLE "insumos"."articulos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"producto_id" uuid NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"minimo_milesimas" bigint DEFAULT 0 NOT NULL,
	"ultimo_costo_milesimas" bigint,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_articulos_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "insumos_articulos_producto" UNIQUE("tenant_id","producto_id"),
	CONSTRAINT "articulo_minimo" CHECK ("insumos"."articulos"."minimo_milesimas" >= 0),
	CONSTRAINT "articulo_ultimo_costo" CHECK ("insumos"."articulos"."ultimo_costo_milesimas" is null or "insumos"."articulos"."ultimo_costo_milesimas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "insumos"."existencias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"articulo_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cantidad_milesimas" bigint DEFAULT 0 NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_existencias_articulo_sucursal" UNIQUE("tenant_id","articulo_id","sucursal_id"),
	CONSTRAINT "existencia_no_negativa" CHECK ("insumos"."existencias"."cantidad_milesimas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "insumos"."movimientos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"articulo_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"existencia_resultante_milesimas" bigint NOT NULL,
	"costo_unitario_milesimas" bigint,
	"motivo" text,
	"origen_tipo" text,
	"origen_id" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimiento_tipo" CHECK ("insumos"."movimientos"."tipo" IN ('entrada', 'salida', 'ajuste')),
	CONSTRAINT "movimiento_signo" CHECK (("insumos"."movimientos"."tipo" = 'entrada' and "insumos"."movimientos"."cantidad_milesimas" > 0) or ("insumos"."movimientos"."tipo" = 'salida' and "insumos"."movimientos"."cantidad_milesimas" < 0) or ("insumos"."movimientos"."tipo" = 'ajuste' and "insumos"."movimientos"."cantidad_milesimas" <> 0)),
	CONSTRAINT "movimiento_existencia_resultante" CHECK ("insumos"."movimientos"."existencia_resultante_milesimas" >= 0),
	CONSTRAINT "movimiento_costo" CHECK ("insumos"."movimientos"."costo_unitario_milesimas" is null or "insumos"."movimientos"."costo_unitario_milesimas" >= 0),
	CONSTRAINT "movimiento_origen" CHECK (("insumos"."movimientos"."origen_tipo" is null) = ("insumos"."movimientos"."origen_id" is null))
);
--> statement-breakpoint
ALTER TABLE "insumos"."articulos" ADD CONSTRAINT "articulos_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."existencias" ADD CONSTRAINT "existencias_articulo_fk" FOREIGN KEY ("tenant_id","articulo_id") REFERENCES "insumos"."articulos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."existencias" ADD CONSTRAINT "existencias_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."movimientos" ADD CONSTRAINT "movimientos_articulo_fk" FOREIGN KEY ("tenant_id","articulo_id") REFERENCES "insumos"."articulos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."movimientos" ADD CONSTRAINT "movimientos_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_insumos_existencias_sucursal" ON "insumos"."existencias" USING btree ("tenant_id","sucursal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_insumos_movimientos_origen" ON "insumos"."movimientos" USING btree ("tenant_id","origen_tipo","origen_id","articulo_id") WHERE "insumos"."movimientos"."origen_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_insumos_movimientos_articulo" ON "insumos"."movimientos" USING btree ("tenant_id","articulo_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_insumos_movimientos_sucursal" ON "insumos"."movimientos" USING btree ("tenant_id","sucursal_id","creado_en" DESC NULLS LAST);
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de insumos.

select core.aplicar_aislamiento('insumos.articulos', 'completo');
--> statement-breakpoint
create trigger articulos_actualizado before update on insumos.articulos
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger articulos_modulo before insert or update or delete on insumos.articulos
  for each row execute function core.exigir_modulo_en_escritura('insumos');
--> statement-breakpoint

-- La existencia solo la cambia el código que inserta un movimiento, en la misma transacción y con la fila bloqueada.
select core.aplicar_aislamiento('insumos.existencias', 'completo');
--> statement-breakpoint
create trigger existencias_actualizado before update on insumos.existencias
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger existencias_modulo before insert or update or delete on insumos.existencias
  for each row execute function core.exigir_modulo_en_escritura('insumos');
--> statement-breakpoint

-- Movimientos de inventario: solo se agregan (ADR-012). Un error se corrige con otro movimiento.
select core.aplicar_aislamiento('insumos.movimientos', 'insercion');
--> statement-breakpoint
create trigger movimientos_modulo before insert or update or delete on insumos.movimientos
  for each row execute function core.exigir_modulo_en_escritura('insumos');
--> statement-breakpoint
create trigger movimientos_inmutable before update or delete on insumos.movimientos
  for each row execute function core.rechazar_cambio();
