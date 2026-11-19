CREATE TABLE "registro"."deuda_ajustes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"deuda_id" uuid NOT NULL,
	"monto_centimos" bigint NOT NULL,
	"total_anterior_centimos" bigint NOT NULL,
	"total_nuevo_centimos" bigint NOT NULL,
	"a_favor_centimos" bigint DEFAULT 0 NOT NULL,
	"motivo_codigo" text NOT NULL,
	"motivo_texto" text,
	"origen_ref" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_registro_deuda_ajustes_origen" UNIQUE("tenant_id","origen_ref"),
	CONSTRAINT "ajuste_total_nuevo" CHECK ("registro"."deuda_ajustes"."total_nuevo_centimos" > 0),
	CONSTRAINT "ajuste_monto" CHECK ("registro"."deuda_ajustes"."monto_centimos" = "registro"."deuda_ajustes"."total_nuevo_centimos" - "registro"."deuda_ajustes"."total_anterior_centimos"),
	CONSTRAINT "ajuste_a_favor" CHECK ("registro"."deuda_ajustes"."a_favor_centimos" >= 0),
	CONSTRAINT "ajuste_motivo" CHECK ("registro"."deuda_ajustes"."motivo_codigo" IN ('igv', 'precio_acordado', 'cantidad', 'lineas', 'error_digitacion', 'otro'))
);
--> statement-breakpoint
CREATE TABLE "ordenes"."pedido_versiones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"pedido_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"foto" jsonb NOT NULL,
	"motivo_codigo" text NOT NULL,
	"motivo_texto" text,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedido_version_numero" CHECK ("ordenes"."pedido_versiones"."version" >= 1),
	CONSTRAINT "pedido_version_motivo" CHECK ("ordenes"."pedido_versiones"."motivo_codigo" IN ('igv', 'precio_acordado', 'cantidad', 'lineas', 'error_digitacion', 'otro'))
);
--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" DROP CONSTRAINT "evento_tipo";--> statement-breakpoint
ALTER TABLE "ordenes"."pedidos" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "registro"."deuda_ajustes" ADD CONSTRAINT "deuda_ajustes_deuda_fk" FOREIGN KEY ("tenant_id","deuda_id") REFERENCES "registro"."deudas"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_versiones" ADD CONSTRAINT "pedido_versiones_pedido_fk" FOREIGN KEY ("tenant_id","pedido_id") REFERENCES "ordenes"."pedidos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_registro_deuda_ajustes_deuda" ON "registro"."deuda_ajustes" USING btree ("tenant_id","deuda_id","creado_en" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ordenes_pedido_versiones" ON "ordenes"."pedido_versiones" USING btree ("tenant_id","pedido_id","version");--> statement-breakpoint
CREATE INDEX "idx_ordenes_pedido_eventos_tipo" ON "ordenes"."pedido_eventos" USING btree ("tenant_id","tipo","creado_en" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD CONSTRAINT "evento_tipo" CHECK ("ordenes"."pedido_eventos"."tipo" IN ('creado', 'editado', 'confirmado', 'estado', 'cancelado', 'nota', 'datos_editados', 'corregido', 'guia_emitida', 'guia_anulada'));--> statement-breakpoint
ALTER TABLE "ordenes"."pedidos" ADD CONSTRAINT "pedido_version" CHECK ("ordenes"."pedidos"."version" >= 1);--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- Versiones anteriores de un pedido corregido: solo se agregan (ADR-012). La foto no se reescribe nunca.
select core.aplicar_aislamiento('ordenes.pedido_versiones', 'insercion');
--> statement-breakpoint
create trigger pedido_versiones_modulo before insert or update or delete on ordenes.pedido_versiones
  for each row execute function core.exigir_modulo_en_escritura('ordenes');
--> statement-breakpoint
create trigger pedido_versiones_inmutable before update or delete on ordenes.pedido_versiones
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint
-- Ajustes del total de una deuda: solo se agregan; se corrigen con otro ajuste, nunca editando el anterior.
select core.aplicar_aislamiento('registro.deuda_ajustes', 'insercion');
--> statement-breakpoint
create trigger deuda_ajustes_modulo before insert or update or delete on registro.deuda_ajustes
  for each row execute function core.exigir_modulo_en_escritura('registro');
--> statement-breakpoint
create trigger deuda_ajustes_inmutable before update or delete on registro.deuda_ajustes
  for each row execute function core.rechazar_cambio();
