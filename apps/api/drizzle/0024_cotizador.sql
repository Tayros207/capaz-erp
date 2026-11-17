-- El esquema cotizador ya existe (0000); aquí solo van sus tablas.
CREATE TABLE "cotizador"."ajustes_de_cliente" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"porcentaje" numeric(7, 3) NOT NULL,
	"nota" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_cotizador_ajustes_cliente" UNIQUE("tenant_id","cliente_id"),
	CONSTRAINT "ajuste_porcentaje" CHECK ("cotizador"."ajustes_de_cliente"."porcentaje" > -100 and "cotizador"."ajustes_de_cliente"."porcentaje" <= 500 and "cotizador"."ajustes_de_cliente"."porcentaje" <> 0)
);
--> statement-breakpoint
CREATE TABLE "cotizador"."configuracion" (
	"tenant_id" text NOT NULL,
	"utilidad_pct" numeric(7, 3) DEFAULT '35' NOT NULL,
	"utilidad_base" text DEFAULT 'venta' NOT NULL,
	"umbral_verde_pct" numeric(7, 3) DEFAULT '30' NOT NULL,
	"umbral_minimo_pct" numeric(7, 3) DEFAULT '15' NOT NULL,
	"redondeo_comercial" text DEFAULT 'ninguno' NOT NULL,
	"igv_porcentaje" smallint DEFAULT 18 NOT NULL,
	"condiciones" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mensaje_whatsapp" text,
	"actualizado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "configuracion_pkey" PRIMARY KEY("tenant_id"),
	CONSTRAINT "configuracion_utilidad_pct" CHECK ("cotizador"."configuracion"."utilidad_pct" >= 0),
	CONSTRAINT "configuracion_utilidad_base" CHECK ("cotizador"."configuracion"."utilidad_base" IN ('venta', 'costo')),
	CONSTRAINT "configuracion_umbral_minimo" CHECK ("cotizador"."configuracion"."umbral_minimo_pct" >= 0),
	CONSTRAINT "configuracion_redondeo" CHECK ("cotizador"."configuracion"."redondeo_comercial" IN ('ninguno', '1', '5', '10')),
	CONSTRAINT "configuracion_igv" CHECK ("cotizador"."configuracion"."igv_porcentaje" between 0 and 100),
	CONSTRAINT "configuracion_umbrales" CHECK ("cotizador"."configuracion"."umbral_minimo_pct" < "cotizador"."configuracion"."umbral_verde_pct"),
	CONSTRAINT "configuracion_utilidad" CHECK ("cotizador"."configuracion"."utilidad_base" = 'costo' or "cotizador"."configuracion"."utilidad_pct" < 100)
);
--> statement-breakpoint
CREATE TABLE "cotizador"."cotizaciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer,
	"anio" integer,
	"cliente_id" uuid,
	"cliente_nombre" text,
	"titulo" text NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"version_actual" integer DEFAULT 1 NOT NULL,
	"valida_hasta" date,
	"notas" text,
	"lineas_aceptadas" jsonb,
	"total_aceptado_centimos" bigint,
	"aceptada_en" timestamp with time zone,
	"motivo_rechazo" text,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"motivo_anulacion" text,
	"datos_extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_cotizaciones_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "cotizacion_numeracion" CHECK (("cotizador"."cotizaciones"."numero" is null) = ("cotizador"."cotizaciones"."anio" is null)),
	CONSTRAINT "cotizacion_estado" CHECK ("cotizador"."cotizaciones"."estado" IN ('borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada')),
	CONSTRAINT "cotizacion_version_actual" CHECK ("cotizador"."cotizaciones"."version_actual" >= 1),
	CONSTRAINT "cotizacion_total_aceptado" CHECK ("cotizador"."cotizaciones"."total_aceptado_centimos" is null or "cotizador"."cotizaciones"."total_aceptado_centimos" >= 0),
	CONSTRAINT "cotizacion_aceptacion" CHECK ("cotizador"."cotizaciones"."estado" <> 'aceptada' or "cotizador"."cotizaciones"."aceptada_en" is not null),
	CONSTRAINT "cotizacion_anulacion" CHECK (("cotizador"."cotizaciones"."estado" = 'anulada') = ("cotizador"."cotizaciones"."anulado_en" is not null)),
	CONSTRAINT "cotizacion_estado_numero" CHECK ("cotizador"."cotizaciones"."estado" in ('borrador', 'anulada') or "cotizador"."cotizaciones"."numero" is not null),
	CONSTRAINT "cotizacion_estado_cliente" CHECK ("cotizador"."cotizaciones"."estado" in ('borrador', 'anulada') or "cotizador"."cotizaciones"."cliente_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "cotizador"."eventos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"cotizacion_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"tipo" text NOT NULL,
	"motivo" text,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"usuario_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_version" CHECK ("cotizador"."eventos"."version" >= 1),
	CONSTRAINT "evento_tipo" CHECK ("cotizador"."eventos"."tipo" IN ('creada', 'editada', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada', 'nueva_version'))
);
--> statement-breakpoint
CREATE TABLE "cotizador"."listas_de_precio" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"producto_id" uuid,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"p100_centimos" bigint NOT NULL,
	"p1000_centimos" bigint NOT NULL,
	"p5000_centimos" bigint NOT NULL,
	"modo_intermedio" text DEFAULT 'curva' NOT NULL,
	"precio_minimo_centimos" bigint,
	"a_confirmado" boolean DEFAULT false NOT NULL,
	"precios_fijados_en" timestamp with time zone DEFAULT now() NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_listas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "lista_p100" CHECK ("cotizador"."listas_de_precio"."p100_centimos" > 0),
	CONSTRAINT "lista_modo_intermedio" CHECK ("cotizador"."listas_de_precio"."modo_intermedio" IN ('curva', 'escalon')),
	CONSTRAINT "lista_precio_minimo" CHECK ("cotizador"."listas_de_precio"."precio_minimo_centimos" is null or "cotizador"."listas_de_precio"."precio_minimo_centimos" > 0),
	CONSTRAINT "lista_invariante_b" CHECK ("cotizador"."listas_de_precio"."p100_centimos" < "cotizador"."listas_de_precio"."p1000_centimos" and "cotizador"."listas_de_precio"."p1000_centimos" < "cotizador"."listas_de_precio"."p5000_centimos")
);
--> statement-breakpoint
CREATE TABLE "cotizador"."version_lineas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"producto_id" uuid,
	"lista_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"precio_unitario_milesimas" bigint NOT NULL,
	"importe_centimos" bigint NOT NULL,
	"igv_centimos" bigint NOT NULL,
	"total_centimos" bigint NOT NULL,
	"origen_precio" text DEFAULT 'manual' NOT NULL,
	"detalle" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_version_lineas_posicion" UNIQUE("tenant_id","version_id","posicion"),
	CONSTRAINT "linea_posicion" CHECK ("cotizador"."version_lineas"."posicion" >= 0),
	CONSTRAINT "linea_cantidad" CHECK ("cotizador"."version_lineas"."cantidad_milesimas" > 0),
	CONSTRAINT "linea_precio_unitario" CHECK ("cotizador"."version_lineas"."precio_unitario_milesimas" >= 0),
	CONSTRAINT "linea_importe" CHECK ("cotizador"."version_lineas"."importe_centimos" >= 0),
	CONSTRAINT "linea_igv" CHECK ("cotizador"."version_lineas"."igv_centimos" >= 0),
	CONSTRAINT "linea_total" CHECK ("cotizador"."version_lineas"."total_centimos" = "cotizador"."version_lineas"."importe_centimos" + "cotizador"."version_lineas"."igv_centimos"),
	CONSTRAINT "linea_origen_precio" CHECK ("cotizador"."version_lineas"."origen_precio" IN ('lista', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "cotizador"."versiones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"cotizacion_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"modo" text DEFAULT 'rapida' NOT NULL,
	"con_opciones" boolean DEFAULT false NOT NULL,
	"igv_porcentaje" smallint DEFAULT 18 NOT NULL,
	"subtotal_centimos" bigint DEFAULT 0 NOT NULL,
	"igv_centimos" bigint DEFAULT 0 NOT NULL,
	"total_centimos" bigint DEFAULT 0 NOT NULL,
	"costo_centimos" bigint,
	"margen_pct" numeric(7, 3),
	"motivo_margen_bajo" text,
	"condiciones" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observaciones" text,
	"entrada" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resultado" jsonb,
	"emitida_en" timestamp with time zone,
	"emitida_por" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_versiones_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "cotizador_versiones_numero" UNIQUE("tenant_id","cotizacion_id","version"),
	CONSTRAINT "version_numero" CHECK ("cotizador"."versiones"."version" >= 1),
	CONSTRAINT "version_modo" CHECK ("cotizador"."versiones"."modo" IN ('rapida', 'cuadro')),
	CONSTRAINT "version_igv_porcentaje" CHECK ("cotizador"."versiones"."igv_porcentaje" between 0 and 100),
	CONSTRAINT "version_subtotal" CHECK ("cotizador"."versiones"."subtotal_centimos" >= 0),
	CONSTRAINT "version_igv" CHECK ("cotizador"."versiones"."igv_centimos" >= 0),
	CONSTRAINT "version_total" CHECK ("cotizador"."versiones"."total_centimos" = "cotizador"."versiones"."subtotal_centimos" + "cotizador"."versiones"."igv_centimos"),
	CONSTRAINT "version_costo" CHECK ("cotizador"."versiones"."costo_centimos" is null or "cotizador"."versiones"."costo_centimos" >= 0),
	CONSTRAINT "version_emision" CHECK (("cotizador"."versiones"."emitida_en" is null) = ("cotizador"."versiones"."emitida_por" is null))
);
--> statement-breakpoint
ALTER TABLE "cotizador"."ajustes_de_cliente" ADD CONSTRAINT "ajustes_de_cliente_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."eventos" ADD CONSTRAINT "eventos_cotizacion_fk" FOREIGN KEY ("tenant_id","cotizacion_id") REFERENCES "cotizador"."cotizaciones"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."listas_de_precio" ADD CONSTRAINT "listas_de_precio_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."version_lineas" ADD CONSTRAINT "version_lineas_version_fk" FOREIGN KEY ("tenant_id","version_id") REFERENCES "cotizador"."versiones"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."version_lineas" ADD CONSTRAINT "version_lineas_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."version_lineas" ADD CONSTRAINT "version_lineas_lista_fk" FOREIGN KEY ("tenant_id","lista_id") REFERENCES "cotizador"."listas_de_precio"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."versiones" ADD CONSTRAINT "versiones_cotizacion_fk" FOREIGN KEY ("tenant_id","cotizacion_id") REFERENCES "cotizador"."cotizaciones"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cotizador_cotizaciones_numero" ON "cotizador"."cotizaciones" USING btree ("tenant_id","anio","numero") WHERE "cotizador"."cotizaciones"."numero" is not null;--> statement-breakpoint
CREATE INDEX "idx_cotizador_cotizaciones_estado" ON "cotizador"."cotizaciones" USING btree ("tenant_id","estado","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cotizador_cotizaciones_cliente" ON "cotizador"."cotizaciones" USING btree ("tenant_id","cliente_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cotizador_cotizaciones_creador" ON "cotizador"."cotizaciones" USING btree ("tenant_id","creado_por","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cotizador_eventos_cotizacion" ON "cotizador"."eventos" USING btree ("tenant_id","cotizacion_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cotizador_listas_nombre" ON "cotizador"."listas_de_precio" USING btree ("tenant_id","nombre_normalizado") WHERE "cotizador"."listas_de_precio"."archivado_en" is null;--> statement-breakpoint
CREATE INDEX "idx_cotizador_listas_producto" ON "cotizador"."listas_de_precio" USING btree ("tenant_id","producto_id") WHERE "cotizador"."listas_de_precio"."producto_id" is not null;
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de cotizador.

select core.aplicar_aislamiento('cotizador.configuracion', 'completo');
--> statement-breakpoint
create trigger configuracion_actualizado before update on cotizador.configuracion
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger configuracion_modulo before insert or update or delete on cotizador.configuracion
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.listas_de_precio', 'completo');
--> statement-breakpoint
create trigger listas_de_precio_actualizado before update on cotizador.listas_de_precio
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger listas_de_precio_modulo before insert or update or delete on cotizador.listas_de_precio
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.ajustes_de_cliente', 'completo');
--> statement-breakpoint
create trigger ajustes_de_cliente_actualizado before update on cotizador.ajustes_de_cliente
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger ajustes_de_cliente_modulo before insert or update or delete on cotizador.ajustes_de_cliente
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.cotizaciones', 'completo');
--> statement-breakpoint
create trigger cotizaciones_actualizado before update on cotizador.cotizaciones
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger cotizaciones_modulo before insert or update or delete on cotizador.cotizaciones
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint
create trigger cotizaciones_sin_borrado before delete on cotizador.cotizaciones
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.versiones', 'completo');
--> statement-breakpoint
create trigger versiones_modulo before insert or update or delete on cotizador.versiones
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.version_lineas', 'completo');
--> statement-breakpoint
create trigger version_lineas_modulo before insert or update or delete on cotizador.version_lineas
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.eventos', 'insercion');
--> statement-breakpoint
create trigger eventos_modulo before insert or update or delete on cotizador.eventos
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint
create trigger eventos_inmutable before update or delete on cotizador.eventos
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Una versión emitida no se toca: ni ella ni sus líneas. Sin security definer (regla 18).
create or replace function cotizador.proteger_version_emitida() returns trigger
language plpgsql set search_path = cotizador, pg_temp as $$
begin
  if old.emitida_en is not null then
    raise exception 'Una versión emitida no se modifica ni se borra.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
--> statement-breakpoint
create trigger versiones_inmutable before update or delete on cotizador.versiones
  for each row execute function cotizador.proteger_version_emitida();
--> statement-breakpoint
create or replace function cotizador.proteger_lineas_emitidas() returns trigger
language plpgsql set search_path = cotizador, pg_temp as $$
declare
  emitida boolean;
begin
  if tg_op <> 'INSERT' then
    select v.emitida_en is not null into emitida from cotizador.versiones v
      where v.tenant_id = old.tenant_id and v.id = old.version_id;
    if emitida then
      raise exception 'Las líneas de una versión emitida no se modifican.' using errcode = '42501';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select v.emitida_en is not null into emitida from cotizador.versiones v
      where v.tenant_id = new.tenant_id and v.id = new.version_id;
    if emitida then
      raise exception 'Las líneas de una versión emitida no se modifican.' using errcode = '42501';
    end if;
    return new;
  end if;
  return old;
end $$;
--> statement-breakpoint
create trigger version_lineas_inmutables before insert or update or delete on cotizador.version_lineas
  for each row execute function cotizador.proteger_lineas_emitidas();
