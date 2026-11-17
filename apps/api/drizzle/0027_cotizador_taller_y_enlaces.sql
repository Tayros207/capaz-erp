CREATE TABLE "cotizador"."enlaces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"cotizacion_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"token_hash" text NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"revocado_en" timestamp with time zone,
	"vistas" integer DEFAULT 0 NOT NULL,
	"ultima_vista_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_enlaces_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "uq_cotizador_enlaces_token" UNIQUE("token_hash"),
	CONSTRAINT "enlace_version" CHECK ("cotizador"."enlaces"."version" >= 1),
	CONSTRAINT "enlace_vistas" CHECK ("cotizador"."enlaces"."vistas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cotizador"."formatos_pliego" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"ancho_cm" numeric(7, 2) NOT NULL,
	"alto_cm" numeric(7, 2) NOT NULL,
	"tipo" text NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_formatos_pliego_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "formato_tipo" CHECK ("cotizador"."formatos_pliego"."tipo" IN ('madre', 'maquina')),
	CONSTRAINT "formato_medidas" CHECK ("cotizador"."formatos_pliego"."ancho_cm" > 0 and "cotizador"."formatos_pliego"."alto_cm" > 0)
);
--> statement-breakpoint
CREATE TABLE "cotizador"."items_del_cuadro" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"factor" text NOT NULL,
	"despues_de" text NOT NULL,
	"posicion" integer NOT NULL,
	"fija" boolean DEFAULT false NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_items_del_cuadro_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "item_factor" CHECK ("cotizador"."items_del_cuadro"."factor" IN ('material', 'impresion', 'planchas', 'diseno', 'acabado', 'indirectos')),
	CONSTRAINT "item_despues_de" CHECK ("cotizador"."items_del_cuadro"."despues_de" IN ('material', 'impresion', 'planchas', 'diseno', 'acabado', 'indirectos')),
	CONSTRAINT "item_posicion" CHECK ("cotizador"."items_del_cuadro"."posicion" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cotizador"."maquinas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"formato_max_ancho_cm" numeric(7, 2) NOT NULL,
	"formato_max_alto_cm" numeric(7, 2) NOT NULL,
	"pinza_cm" numeric(7, 2) NOT NULL,
	"sangrado_cm" numeric(7, 2) NOT NULL,
	"calle_cm" numeric(7, 2) NOT NULL,
	"etapas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_maquinas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "maquina_medidas" CHECK ("cotizador"."maquinas"."formato_max_ancho_cm" >= 0 and "cotizador"."maquinas"."formato_max_alto_cm" >= 0 and "cotizador"."maquinas"."pinza_cm" >= 0 and "cotizador"."maquinas"."sangrado_cm" >= 0 and "cotizador"."maquinas"."calle_cm" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cotizador"."tarifas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"factor" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_normalizado" text NOT NULL,
	"unidad" text NOT NULL,
	"costo_unitario" numeric(14, 4) NOT NULL,
	"escala_por_defecto" text NOT NULL,
	"formato_id" uuid,
	"articulo_id" uuid,
	"archivado_en" timestamp with time zone,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizador_tarifas_empresa_id" UNIQUE("tenant_id","id"),
	CONSTRAINT "tarifa_factor" CHECK ("cotizador"."tarifas"."factor" IN ('material', 'impresion', 'planchas', 'diseno', 'acabado', 'indirectos')),
	CONSTRAINT "tarifa_escala" CHECK ("cotizador"."tarifas"."escala_por_defecto" IN ('fija', 'por_pliego', 'por_unidad')),
	CONSTRAINT "tarifa_costo" CHECK ("cotizador"."tarifas"."costo_unitario" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cotizador"."eventos" DROP CONSTRAINT "evento_tipo";--> statement-breakpoint
ALTER TABLE "cotizador"."eventos" ALTER COLUMN "usuario_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizador"."eventos" ADD COLUMN "canal" text DEFAULT 'ui' NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizador"."enlaces" ADD CONSTRAINT "enlaces_cotizacion_fk" FOREIGN KEY ("tenant_id","cotizacion_id") REFERENCES "cotizador"."cotizaciones"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizador"."tarifas" ADD CONSTRAINT "tarifas_formato_fk" FOREIGN KEY ("tenant_id","formato_id") REFERENCES "cotizador"."formatos_pliego"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cotizador_enlaces_cotizacion" ON "cotizador"."enlaces" USING btree ("tenant_id","cotizacion_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cotizador_formatos_nombre" ON "cotizador"."formatos_pliego" USING btree ("tenant_id","nombre_normalizado") WHERE "cotizador"."formatos_pliego"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cotizador_items_nombre" ON "cotizador"."items_del_cuadro" USING btree ("tenant_id","nombre_normalizado") WHERE "cotizador"."items_del_cuadro"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cotizador_maquinas_nombre" ON "cotizador"."maquinas" USING btree ("tenant_id","nombre_normalizado") WHERE "cotizador"."maquinas"."archivado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cotizador_tarifas_nombre" ON "cotizador"."tarifas" USING btree ("tenant_id","nombre_normalizado") WHERE "cotizador"."tarifas"."archivado_en" is null;--> statement-breakpoint
CREATE INDEX "idx_cotizador_tarifas_formato" ON "cotizador"."tarifas" USING btree ("tenant_id","formato_id") WHERE "cotizador"."tarifas"."formato_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cotizador_listas_producto" ON "cotizador"."listas_de_precio" USING btree ("tenant_id","producto_id") WHERE "cotizador"."listas_de_precio"."archivado_en" is null and "cotizador"."listas_de_precio"."producto_id" is not null;--> statement-breakpoint
ALTER TABLE "cotizador"."eventos" ADD CONSTRAINT "evento_canal" CHECK ("cotizador"."eventos"."canal" IN ('ui', 'enlace', 'sistema'));--> statement-breakpoint
ALTER TABLE "cotizador"."eventos" ADD CONSTRAINT "evento_tipo" CHECK ("cotizador"."eventos"."tipo" IN ('creada', 'editada', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada', 'nueva_version', 'vista', 'enlace_generado', 'enlace_revocado'));
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====
-- capaz_sistema solo lee cotizador.enlaces (resolver el token sin sesión); en lo demás no recibe nada.

select core.aplicar_aislamiento('cotizador.formatos_pliego', 'completo');
--> statement-breakpoint
create trigger formatos_pliego_actualizado before update on cotizador.formatos_pliego
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger formatos_pliego_modulo before insert or update or delete on cotizador.formatos_pliego
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.maquinas', 'completo');
--> statement-breakpoint
create trigger maquinas_actualizado before update on cotizador.maquinas
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger maquinas_modulo before insert or update or delete on cotizador.maquinas
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.tarifas', 'completo');
--> statement-breakpoint
create trigger tarifas_actualizado before update on cotizador.tarifas
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger tarifas_modulo before insert or update or delete on cotizador.tarifas
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.items_del_cuadro', 'completo');
--> statement-breakpoint
create trigger items_del_cuadro_actualizado before update on cotizador.items_del_cuadro
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger items_del_cuadro_modulo before insert or update or delete on cotizador.items_del_cuadro
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

select core.aplicar_aislamiento('cotizador.enlaces', 'completo');
--> statement-breakpoint
create trigger enlaces_actualizado before update on cotizador.enlaces
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint
create trigger enlaces_modulo before insert or update or delete on cotizador.enlaces
  for each row execute function core.exigir_modulo_en_escritura('cotizador');
--> statement-breakpoint

-- Solo estas columnas, solo lectura (mismo patrón que core.claves_api en 0010).
select core.abrir_a_plataforma('cotizador.enlaces', null, 'token_hash, tenant_id, cotizacion_id, version, vence_en, revocado_en');
