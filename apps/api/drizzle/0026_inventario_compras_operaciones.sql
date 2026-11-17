CREATE TABLE "insumos"."conteo_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"conteo_id" uuid NOT NULL,
	"articulo_id" uuid NOT NULL,
	"sistema_milesimas" bigint NOT NULL,
	"contada_milesimas" bigint,
	"contada_por" text,
	"contada_en" timestamp with time zone,
	"movimiento_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_conteo_lineas_articulo" UNIQUE("tenant_id","conteo_id","articulo_id"),
	CONSTRAINT "conteo_linea_sistema" CHECK ("insumos"."conteo_lineas"."sistema_milesimas" >= 0),
	CONSTRAINT "conteo_linea_contada" CHECK ("insumos"."conteo_lineas"."contada_milesimas" is null or "insumos"."conteo_lineas"."contada_milesimas" >= 0),
	CONSTRAINT "conteo_linea_contada_completa" CHECK (("insumos"."conteo_lineas"."contada_milesimas" is null) = ("insumos"."conteo_lineas"."contada_en" is null))
);
--> statement-breakpoint
CREATE TABLE "insumos"."conteos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"estado" text DEFAULT 'abierto' NOT NULL,
	"nota" text,
	"cerrado_en" timestamp with time zone,
	"cerrado_por" text,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_conteos_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "conteo_estado" CHECK ("insumos"."conteos"."estado" IN ('abierto', 'cerrado', 'anulado')),
	CONSTRAINT "conteo_cierre" CHECK (("insumos"."conteos"."estado" = 'cerrado') = ("insumos"."conteos"."cerrado_en" is not null)),
	CONSTRAINT "conteo_anulacion" CHECK (("insumos"."conteos"."estado" = 'anulado') = ("insumos"."conteos"."anulado_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "insumos"."transferencia_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"transferencia_id" uuid NOT NULL,
	"articulo_id" uuid NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_transferencia_lineas_articulo" UNIQUE("tenant_id","transferencia_id","articulo_id"),
	CONSTRAINT "transferencia_linea_cantidad" CHECK ("insumos"."transferencia_lineas"."cantidad_milesimas" > 0)
);
--> statement-breakpoint
CREATE TABLE "insumos"."transferencias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"origen_sucursal_id" uuid NOT NULL,
	"destino_sucursal_id" uuid NOT NULL,
	"fecha" date DEFAULT current_date NOT NULL,
	"nota" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_transferencias_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "transferencia_sucursales_distintas" CHECK ("insumos"."transferencias"."origen_sucursal_id" <> "insumos"."transferencias"."destino_sucursal_id")
);
--> statement-breakpoint
CREATE TABLE "compras"."facturas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"proveedor_id" uuid NOT NULL,
	"orden_id" uuid,
	"serie" text NOT NULL,
	"numero" text NOT NULL,
	"fecha" date NOT NULL,
	"vence_el" date,
	"moneda" text DEFAULT 'PEN' NOT NULL,
	"subtotal_centimos" bigint NOT NULL,
	"igv_centimos" bigint DEFAULT 0 NOT NULL,
	"total_centimos" bigint NOT NULL,
	"notas" text,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"motivo_anulacion" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_facturas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "factura_moneda" CHECK ("compras"."facturas"."moneda" in ('PEN', 'USD', 'EUR')),
	CONSTRAINT "factura_montos" CHECK ("compras"."facturas"."subtotal_centimos" >= 0 and "compras"."facturas"."igv_centimos" >= 0),
	CONSTRAINT "factura_total" CHECK ("compras"."facturas"."total_centimos" = "compras"."facturas"."subtotal_centimos" + "compras"."facturas"."igv_centimos"),
	CONSTRAINT "factura_anulacion" CHECK (("compras"."facturas"."anulado_en" is null) = ("compras"."facturas"."anulado_por" is null))
);
--> statement-breakpoint
CREATE TABLE "compras"."solicitud_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"producto_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_solicitud_lineas_posicion" UNIQUE("tenant_id","solicitud_id","posicion"),
	CONSTRAINT "solicitud_linea_posicion" CHECK ("compras"."solicitud_lineas"."posicion" >= 0),
	CONSTRAINT "solicitud_linea_cantidad" CHECK ("compras"."solicitud_lineas"."cantidad_milesimas" > 0)
);
--> statement-breakpoint
CREATE TABLE "compras"."solicitudes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer,
	"anio" integer,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"fecha" date NOT NULL,
	"necesaria_el" date,
	"area" text,
	"motivo" text,
	"orden_id" uuid,
	"solicitado_por" text NOT NULL,
	"resuelto_por" text,
	"resuelto_en" timestamp with time zone,
	"motivo_resolucion" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_solicitudes_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "solicitud_estado" CHECK ("compras"."solicitudes"."estado" IN ('borrador', 'pendiente', 'aprobada', 'rechazada', 'convertida', 'anulada')),
	CONSTRAINT "solicitud_numeracion" CHECK (("compras"."solicitudes"."numero" is null) = ("compras"."solicitudes"."anio" is null)),
	CONSTRAINT "solicitud_estado_numero" CHECK ("compras"."solicitudes"."estado" in ('borrador', 'anulada') or "compras"."solicitudes"."numero" is not null),
	CONSTRAINT "solicitud_resolucion" CHECK (("compras"."solicitudes"."estado" in ('aprobada', 'rechazada', 'convertida')) = ("compras"."solicitudes"."resuelto_en" is not null) or "compras"."solicitudes"."estado" = 'anulada'),
	CONSTRAINT "solicitud_conversion" CHECK (("compras"."solicitudes"."estado" = 'convertida') = ("compras"."solicitudes"."orden_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "insumos"."conteo_lineas" ADD CONSTRAINT "conteo_lineas_conteo_fk" FOREIGN KEY ("tenant_id","conteo_id") REFERENCES "insumos"."conteos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."conteo_lineas" ADD CONSTRAINT "conteo_lineas_articulo_fk" FOREIGN KEY ("tenant_id","articulo_id") REFERENCES "insumos"."articulos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."conteos" ADD CONSTRAINT "conteos_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."transferencia_lineas" ADD CONSTRAINT "transferencia_lineas_transferencia_fk" FOREIGN KEY ("tenant_id","transferencia_id") REFERENCES "insumos"."transferencias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."transferencia_lineas" ADD CONSTRAINT "transferencia_lineas_articulo_fk" FOREIGN KEY ("tenant_id","articulo_id") REFERENCES "insumos"."articulos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."transferencias" ADD CONSTRAINT "transferencias_origen_fk" FOREIGN KEY ("tenant_id","origen_sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos"."transferencias" ADD CONSTRAINT "transferencias_destino_fk" FOREIGN KEY ("tenant_id","destino_sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."facturas" ADD CONSTRAINT "facturas_proveedor_fk" FOREIGN KEY ("tenant_id","proveedor_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."facturas" ADD CONSTRAINT "facturas_orden_fk" FOREIGN KEY ("tenant_id","orden_id") REFERENCES "compras"."ordenes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."solicitud_lineas" ADD CONSTRAINT "solicitud_lineas_solicitud_fk" FOREIGN KEY ("tenant_id","solicitud_id") REFERENCES "compras"."solicitudes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."solicitud_lineas" ADD CONSTRAINT "solicitud_lineas_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras"."solicitudes" ADD CONSTRAINT "solicitudes_orden_fk" FOREIGN KEY ("tenant_id","orden_id") REFERENCES "compras"."ordenes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_insumos_conteos_numero" ON "insumos"."conteos" USING btree ("tenant_id","anio","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_insumos_conteos_abierto" ON "insumos"."conteos" USING btree ("tenant_id","sucursal_id") WHERE "insumos"."conteos"."estado" = 'abierto';--> statement-breakpoint
CREATE INDEX "idx_insumos_conteos_estado" ON "insumos"."conteos" USING btree ("tenant_id","estado","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_insumos_transferencias_numero" ON "insumos"."transferencias" USING btree ("tenant_id","anio","numero");--> statement-breakpoint
CREATE INDEX "idx_insumos_transferencias_fecha" ON "insumos"."transferencias" USING btree ("tenant_id","fecha" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_compras_facturas_comprobante" ON "compras"."facturas" USING btree ("tenant_id","proveedor_id","serie","numero") WHERE "compras"."facturas"."anulado_en" is null;--> statement-breakpoint
CREATE INDEX "idx_compras_facturas_orden" ON "compras"."facturas" USING btree ("tenant_id","orden_id") WHERE "compras"."facturas"."orden_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_compras_facturas_proveedor" ON "compras"."facturas" USING btree ("tenant_id","proveedor_id","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_compras_solicitudes_numero" ON "compras"."solicitudes" USING btree ("tenant_id","anio","numero") WHERE "compras"."solicitudes"."numero" is not null;--> statement-breakpoint
CREATE INDEX "idx_compras_solicitudes_estado" ON "compras"."solicitudes" USING btree ("tenant_id","estado","creado_en" DESC NULLS LAST);
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en estas tablas.
-- Inventario: una transferencia hecha no se edita ni se borra (ADR-012).
select core.aplicar_aislamiento('insumos.transferencias', 'insercion');
--> statement-breakpoint
create trigger transferencias_modulo before insert or update or delete on insumos.transferencias
  for each row execute function core.exigir_modulo_en_escritura('insumos');
--> statement-breakpoint
create trigger transferencias_inmutable before update or delete on insumos.transferencias
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
select core.aplicar_aislamiento('insumos.transferencia_lineas', 'insercion');
--> statement-breakpoint
create trigger transferencia_lineas_modulo before insert or update or delete on insumos.transferencia_lineas
  for each row execute function core.exigir_modulo_en_escritura('insumos');
--> statement-breakpoint
create trigger transferencia_lineas_inmutable before update or delete on insumos.transferencia_lineas
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
-- Conteos: se abren, se cuentan y se cierran o anulan; nunca se borran.
select core.aplicar_aislamiento('insumos.conteos', 'completo');
--> statement-breakpoint
create trigger conteos_actualizado before update on insumos.conteos
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger conteos_modulo before insert or update or delete on insumos.conteos
  for each row execute function core.exigir_modulo_en_escritura('insumos');
--> statement-breakpoint
create trigger conteos_sin_borrado before delete on insumos.conteos
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
select core.aplicar_aislamiento('insumos.conteo_lineas', 'completo');
--> statement-breakpoint
create trigger conteo_lineas_modulo before insert or update or delete on insumos.conteo_lineas
  for each row execute function core.exigir_modulo_en_escritura('insumos');
--> statement-breakpoint
-- Compras: solicitudes con líneas reemplazables en borrador; facturas anulables, sin borrado.
select core.aplicar_aislamiento('compras.solicitudes', 'completo');
--> statement-breakpoint
create trigger solicitudes_actualizado before update on compras.solicitudes
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger solicitudes_modulo before insert or update or delete on compras.solicitudes
  for each row execute function core.exigir_modulo_en_escritura('compras');
--> statement-breakpoint
create trigger solicitudes_sin_borrado before delete on compras.solicitudes
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
select core.aplicar_aislamiento('compras.solicitud_lineas', 'completo');
--> statement-breakpoint
create trigger solicitud_lineas_modulo before insert or update or delete on compras.solicitud_lineas
  for each row execute function core.exigir_modulo_en_escritura('compras');
--> statement-breakpoint
select core.aplicar_aislamiento('compras.facturas', 'completo');
--> statement-breakpoint
create trigger facturas_actualizado before update on compras.facturas
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger facturas_modulo before insert or update or delete on compras.facturas
  for each row execute function core.exigir_modulo_en_escritura('compras');
--> statement-breakpoint
create trigger facturas_sin_borrado before delete on compras.facturas
  for each row execute function core.rechazar_cambio();
