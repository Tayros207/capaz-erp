CREATE TABLE "registro"."cierres" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"saldos" jsonb NOT NULL,
	"notas" text,
	"cerrado_por" text NOT NULL,
	"cerrado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registro_cierres_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "registro_cierres_semana" UNIQUE("tenant_id","desde","hasta"),
	CONSTRAINT "cierre_semana" CHECK ("registro"."cierres"."hasta" = "registro"."cierres"."desde" + 5 and extract(isodow from "registro"."cierres"."desde") = 1),
	CONSTRAINT "cierre_saldos" CHECK (jsonb_typeof("registro"."cierres"."saldos") = 'array'),
	CONSTRAINT "cierre_notas" CHECK ("registro"."cierres"."notas" is null or length("registro"."cierres"."notas") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD COLUMN "monto_minimo_centimos" bigint;--> statement-breakpoint
CREATE INDEX "idx_registro_cierres_cerrado" ON "registro"."cierres" USING btree ("tenant_id","cerrado_en" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_monto_minimo" CHECK ("core"."empresa_config"."monto_minimo_centimos" is null or "core"."empresa_config"."monto_minimo_centimos" between 0 and 10000000);--> statement-breakpoint
-- ===== Seguridad a mano =====
select core.aplicar_aislamiento('registro.cierres', 'insercion');
--> statement-breakpoint
create trigger cierres_modulo before insert or update or delete on registro.cierres
  for each row execute function core.exigir_modulo_en_escritura('registro');
--> statement-breakpoint
create trigger cierres_inmutable before update or delete on registro.cierres
  for each row execute function core.rechazar_cambio();
