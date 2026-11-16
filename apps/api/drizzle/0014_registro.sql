-- El esquema `registro` ya existe (0000); aquí solo van sus tablas.
CREATE TABLE "registro"."categorias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"tipo" text NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registro_categorias_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "categoria_tipo" CHECK ("registro"."categorias"."tipo" IN ('ingreso', 'egreso'))
);
--> statement-breakpoint
CREATE TABLE "registro"."cuentas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"tipo" text NOT NULL,
	"sucursal_id" uuid,
	"es_principal" boolean DEFAULT false NOT NULL,
	"saldo_inicial_centimos" bigint DEFAULT 0 NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registro_cuentas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "cuenta_tipo" CHECK ("registro"."cuentas"."tipo" IN ('caja', 'banco', 'billetera'))
);
--> statement-breakpoint
CREATE TABLE "registro"."deudas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"tipo" text NOT NULL,
	"contacto_id" uuid NOT NULL,
	"concepto" text NOT NULL,
	"total_centimos" bigint NOT NULL,
	"abonado_centimos" bigint DEFAULT 0 NOT NULL,
	"fecha" date NOT NULL,
	"vence_en" date,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"origen_tipo" text,
	"origen_id" text,
	"sucursal_id" uuid,
	"notas" text,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"motivo_anulacion" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registro_deudas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "registro_deudas_numero" UNIQUE("tenant_id","tipo","anio","numero"),
	CONSTRAINT "deuda_tipo" CHECK ("registro"."deudas"."tipo" IN ('por_cobrar', 'por_pagar')),
	CONSTRAINT "deuda_total" CHECK ("registro"."deudas"."total_centimos" > 0),
	CONSTRAINT "deuda_abonado" CHECK ("registro"."deudas"."abonado_centimos" >= 0 and "registro"."deudas"."abonado_centimos" <= "registro"."deudas"."total_centimos"),
	CONSTRAINT "deuda_vence" CHECK ("registro"."deudas"."vence_en" is null or "registro"."deudas"."vence_en" >= "registro"."deudas"."fecha"),
	CONSTRAINT "deuda_estado" CHECK ("registro"."deudas"."estado" IN ('pendiente', 'parcial', 'pagada', 'anulada')),
	CONSTRAINT "deuda_origen" CHECK (("registro"."deudas"."origen_tipo" is null) = ("registro"."deudas"."origen_id" is null)),
	CONSTRAINT "deuda_anulacion" CHECK (("registro"."deudas"."estado" = 'anulada') = ("registro"."deudas"."anulado_en" is not null)),
	CONSTRAINT "deuda_estado_y_abonado" CHECK ("registro"."deudas"."estado" = 'anulada' or ("registro"."deudas"."estado" = 'pendiente' and "registro"."deudas"."abonado_centimos" = 0) or ("registro"."deudas"."estado" = 'parcial' and "registro"."deudas"."abonado_centimos" > 0 and "registro"."deudas"."abonado_centimos" < "registro"."deudas"."total_centimos") or ("registro"."deudas"."estado" = 'pagada' and "registro"."deudas"."abonado_centimos" = "registro"."deudas"."total_centimos"))
);
--> statement-breakpoint
CREATE TABLE "registro"."movimientos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"tipo" text NOT NULL,
	"fecha" date NOT NULL,
	"monto_centimos" bigint NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"categoria_id" uuid,
	"contacto_id" uuid,
	"medio_de_pago" text DEFAULT 'efectivo' NOT NULL,
	"descripcion" text,
	"deuda_id" uuid,
	"sucursal_id" uuid,
	"origen" text DEFAULT 'teclado' NOT NULL,
	"origen_ref" text,
	"estado" text DEFAULT 'activo' NOT NULL,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"motivo_anulacion" text,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registro_movimientos_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "registro_movimientos_numero" UNIQUE("tenant_id","anio","numero"),
	CONSTRAINT "movimiento_tipo" CHECK ("registro"."movimientos"."tipo" IN ('ingreso', 'egreso')),
	CONSTRAINT "movimiento_monto" CHECK ("registro"."movimientos"."monto_centimos" > 0),
	CONSTRAINT "movimiento_medio" CHECK ("registro"."movimientos"."medio_de_pago" IN ('efectivo', 'transferencia', 'yape', 'plin', 'tarjeta', 'otro')),
	CONSTRAINT "movimiento_origen" CHECK ("registro"."movimientos"."origen" IN ('teclado', 'voz', 'agente', 'regla', 'conector', 'importacion', 'modulo')),
	CONSTRAINT "movimiento_estado" CHECK ("registro"."movimientos"."estado" IN ('activo', 'anulado')),
	CONSTRAINT "movimiento_anulacion" CHECK (("registro"."movimientos"."estado" = 'anulado') = ("registro"."movimientos"."anulado_en" is not null))
);
--> statement-breakpoint
ALTER TABLE "registro"."cuentas" ADD CONSTRAINT "cuentas_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."deudas" ADD CONSTRAINT "deudas_contacto_fk" FOREIGN KEY ("tenant_id","contacto_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."deudas" ADD CONSTRAINT "deudas_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."movimientos" ADD CONSTRAINT "movimientos_cuenta_fk" FOREIGN KEY ("tenant_id","cuenta_id") REFERENCES "registro"."cuentas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."movimientos" ADD CONSTRAINT "movimientos_categoria_fk" FOREIGN KEY ("tenant_id","categoria_id") REFERENCES "registro"."categorias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."movimientos" ADD CONSTRAINT "movimientos_contacto_fk" FOREIGN KEY ("tenant_id","contacto_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."movimientos" ADD CONSTRAINT "movimientos_deuda_fk" FOREIGN KEY ("tenant_id","deuda_id") REFERENCES "registro"."deudas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro"."movimientos" ADD CONSTRAINT "movimientos_sucursal_fk" FOREIGN KEY ("tenant_id","sucursal_id") REFERENCES "core"."sucursales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_registro_categorias_nombre" ON "registro"."categorias" USING btree ("tenant_id","tipo","nombre_normalizado") WHERE "registro"."categorias"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_registro_cuentas_nombre" ON "registro"."cuentas" USING btree ("tenant_id","nombre_normalizado") WHERE "registro"."cuentas"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_registro_cuentas_principal" ON "registro"."cuentas" USING btree ("tenant_id") WHERE "registro"."cuentas"."es_principal";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_registro_deudas_origen" ON "registro"."deudas" USING btree ("tenant_id","origen_tipo","origen_id") WHERE "registro"."deudas"."origen_id" is not null and "registro"."deudas"."estado" <> 'anulada';--> statement-breakpoint
CREATE INDEX "idx_registro_deudas_vence" ON "registro"."deudas" USING btree ("tenant_id","tipo","estado","vence_en");--> statement-breakpoint
CREATE INDEX "idx_registro_deudas_contacto" ON "registro"."deudas" USING btree ("tenant_id","contacto_id","estado");--> statement-breakpoint
CREATE INDEX "idx_registro_deudas_creador" ON "registro"."deudas" USING btree ("tenant_id","creado_por","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_registro_movimientos_fecha" ON "registro"."movimientos" USING btree ("tenant_id","fecha" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_registro_movimientos_cuenta" ON "registro"."movimientos" USING btree ("tenant_id","cuenta_id","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_registro_movimientos_deuda" ON "registro"."movimientos" USING btree ("tenant_id","deuda_id") WHERE "registro"."movimientos"."deuda_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_registro_movimientos_contacto" ON "registro"."movimientos" USING btree ("tenant_id","contacto_id","fecha" DESC NULLS LAST) WHERE "registro"."movimientos"."contacto_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_registro_movimientos_creador" ON "registro"."movimientos" USING btree ("tenant_id","creado_por","fecha" DESC NULLS LAST);
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de registro.

select core.aplicar_aislamiento('registro.cuentas', 'completo');
--> statement-breakpoint
create trigger cuentas_actualizado before update on registro.cuentas
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger cuentas_modulo before insert or update or delete on registro.cuentas
  for each row execute function core.exigir_modulo_en_escritura('registro');
--> statement-breakpoint

select core.aplicar_aislamiento('registro.categorias', 'completo');
--> statement-breakpoint
create trigger categorias_actualizado before update on registro.categorias
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger categorias_modulo before insert or update or delete on registro.categorias
  for each row execute function core.exigir_modulo_en_escritura('registro');
--> statement-breakpoint

select core.aplicar_aislamiento('registro.deudas', 'completo');
--> statement-breakpoint
create trigger deudas_actualizado before update on registro.deudas
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger deudas_modulo before insert or update or delete on registro.deudas
  for each row execute function core.exigir_modulo_en_escritura('registro');
--> statement-breakpoint
create trigger deudas_sin_borrado before delete on registro.deudas
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Movimientos: inmutables salvo la anulación (ADR-012).
select core.aplicar_aislamiento('registro.movimientos', 'insercion');
--> statement-breakpoint
create trigger movimientos_modulo before insert or update or delete on registro.movimientos
  for each row execute function core.exigir_modulo_en_escritura('registro');
--> statement-breakpoint
grant update (estado, anulado_en, anulado_por, motivo_anulacion) on registro.movimientos to capaz_app;
