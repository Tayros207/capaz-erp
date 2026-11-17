CREATE SCHEMA "produccion";
--> statement-breakpoint
CREATE TABLE "produccion"."orden_eventos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"orden_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado_anterior" text,
	"estado_nuevo" text NOT NULL,
	"nota" text,
	"usuario_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orden_evento_tipo" CHECK ("produccion"."orden_eventos"."tipo" IN ('creada', 'editada', 'estado', 'anulada'))
);
--> statement-breakpoint
CREATE TABLE "produccion"."ordenes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"numero" integer NOT NULL,
	"anio" integer NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"fecha" date NOT NULL,
	"entrega_el" date,
	"cliente_id" uuid,
	"producto_id" uuid,
	"descripcion" text NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"cantidad_milesimas" bigint NOT NULL,
	"total_centimos" bigint DEFAULT 0 NOT NULL,
	"adelanto_centimos" bigint DEFAULT 0 NOT NULL,
	"notas" text,
	"entregado_en" timestamp with time zone,
	"anulado_en" timestamp with time zone,
	"anulado_por" text,
	"motivo_anulacion" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produccion_ordenes_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "orden_estado" CHECK ("produccion"."ordenes"."estado" IN ('pendiente', 'en_proceso', 'listo', 'entregado', 'anulada')),
	CONSTRAINT "orden_cantidad" CHECK ("produccion"."ordenes"."cantidad_milesimas" > 0),
	CONSTRAINT "orden_montos" CHECK ("produccion"."ordenes"."total_centimos" >= 0 and "produccion"."ordenes"."adelanto_centimos" >= 0 and "produccion"."ordenes"."adelanto_centimos" <= "produccion"."ordenes"."total_centimos"),
	CONSTRAINT "orden_adelanto_con_cliente" CHECK ("produccion"."ordenes"."adelanto_centimos" = 0 or "produccion"."ordenes"."cliente_id" is not null),
	CONSTRAINT "orden_fechas" CHECK ("produccion"."ordenes"."entrega_el" is null or "produccion"."ordenes"."entrega_el" >= "produccion"."ordenes"."fecha"),
	CONSTRAINT "orden_entrega" CHECK (("produccion"."ordenes"."estado" = 'entregado') = ("produccion"."ordenes"."entregado_en" is not null)),
	CONSTRAINT "orden_anulacion" CHECK (("produccion"."ordenes"."estado" = 'anulada') = ("produccion"."ordenes"."anulado_en" is not null))
);
--> statement-breakpoint
ALTER TABLE "produccion"."orden_eventos" ADD CONSTRAINT "orden_eventos_orden_fk" FOREIGN KEY ("tenant_id","orden_id") REFERENCES "produccion"."ordenes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" ADD CONSTRAINT "ordenes_cliente_fk" FOREIGN KEY ("tenant_id","cliente_id") REFERENCES "core"."clientes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produccion"."ordenes" ADD CONSTRAINT "ordenes_producto_fk" FOREIGN KEY ("tenant_id","producto_id") REFERENCES "core"."productos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_produccion_orden_eventos_orden" ON "produccion"."orden_eventos" USING btree ("tenant_id","orden_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_produccion_ordenes_numero" ON "produccion"."ordenes" USING btree ("tenant_id","anio","numero");--> statement-breakpoint
CREATE INDEX "idx_produccion_ordenes_estado" ON "produccion"."ordenes" USING btree ("tenant_id","estado","fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_produccion_ordenes_cliente" ON "produccion"."ordenes" USING btree ("tenant_id","cliente_id","fecha" DESC NULLS LAST) WHERE "produccion"."ordenes"."cliente_id" is not null;
--> statement-breakpoint
grant usage on schema produccion to capaz_app;
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema no recibe nada en las tablas de producción.

select core.aplicar_aislamiento('produccion.ordenes', 'completo');
--> statement-breakpoint
create trigger ordenes_actualizado before update on produccion.ordenes
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger ordenes_modulo before insert or update or delete on produccion.ordenes
  for each row execute function core.exigir_modulo_en_escritura('produccion');
--> statement-breakpoint
create trigger ordenes_sin_borrado before delete on produccion.ordenes
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
-- El historial solo se agrega (ADR-012).
select core.aplicar_aislamiento('produccion.orden_eventos', 'insercion');
--> statement-breakpoint
create trigger orden_eventos_modulo before insert or update or delete on produccion.orden_eventos
  for each row execute function core.exigir_modulo_en_escritura('produccion');
--> statement-breakpoint
create trigger orden_eventos_inmutable before update or delete on produccion.orden_eventos
  for each row execute function core.rechazar_cambio();
