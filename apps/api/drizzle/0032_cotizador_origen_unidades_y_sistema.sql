ALTER TABLE "cotizador"."configuracion" ADD COLUMN "unidades" text[] DEFAULT '{unidad,ciento,millar,pliego,m2,hora,juego,talonario}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizador"."listas_de_precio" ADD COLUMN "origen_cotizacion_id" uuid;--> statement-breakpoint
ALTER TABLE "cotizador"."listas_de_precio" ADD COLUMN "origen_version" integer;--> statement-breakpoint
ALTER TABLE "cotizador"."listas_de_precio" ADD CONSTRAINT "listas_de_precio_origen_fk" FOREIGN KEY ("tenant_id","origen_cotizacion_id") REFERENCES "cotizador"."cotizaciones"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cotizador_listas_origen" ON "cotizador"."listas_de_precio" USING btree ("tenant_id","origen_cotizacion_id") WHERE "cotizador"."listas_de_precio"."origen_cotizacion_id" is not null;--> statement-breakpoint
ALTER TABLE "cotizador"."configuracion" ADD CONSTRAINT "configuracion_unidades" CHECK (cardinality("cotizador"."configuracion"."unidades") between 1 and 40);--> statement-breakpoint
ALTER TABLE "cotizador"."listas_de_precio" ADD CONSTRAINT "lista_origen" CHECK (("cotizador"."listas_de_precio"."origen_cotizacion_id" is null) = ("cotizador"."listas_de_precio"."origen_version" is null));--> statement-breakpoint
-- ===== A mano =====
-- El grupo de sistema resuelve el token del enlace público leyendo cotizador.enlaces (abierto por columnas en la 0027),
-- pero la 0027 no le dio el uso del esquema: sin esto, «permission denied for schema cotizador». Solo usage, nada más.
grant usage on schema cotizador to capaz_sistema;
