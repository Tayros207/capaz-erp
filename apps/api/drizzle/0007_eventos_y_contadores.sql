CREATE TABLE "core"."contadores" (
	"tenant_id" text NOT NULL,
	"clave" text NOT NULL,
	"serie" text DEFAULT '' NOT NULL,
	"anio" integer NOT NULL,
	"ultimo" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "contadores_tenant_id_clave_serie_anio_pk" PRIMARY KEY("tenant_id","clave","serie","anio")
);
--> statement-breakpoint
CREATE TABLE "core"."eventos_procesados" (
	"tenant_id" text NOT NULL,
	"evento_id" uuid NOT NULL,
	"consumidor" text NOT NULL,
	"procesado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_procesados_tenant_id_evento_id_consumidor_pk" PRIMARY KEY("tenant_id","evento_id","consumidor")
);
--> statement-breakpoint
CREATE TABLE "core"."eventos_salida" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"tipo" text NOT NULL,
	"carga" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"disponible_en" timestamp with time zone DEFAULT now() NOT NULL,
	"procesado_en" timestamp with time zone,
	"intentos" integer DEFAULT 0 NOT NULL,
	"ultimo_error" text,
	"fallido_en" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_eventos_salida_pendientes" ON "core"."eventos_salida" USING btree ("tenant_id","disponible_en") WHERE "core"."eventos_salida"."procesado_en" is null and "core"."eventos_salida"."fallido_en" is null;
--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====

-- Bandeja de salida: la empresa inserta (en su transacción) y lee; el relevo de la plataforma ve
-- solo metadatos (NUNCA `carga`), actualiza el estado de entrega y purga.
select core.aplicar_aislamiento('core.eventos_salida', 'insercion');
--> statement-breakpoint
select core.abrir_a_plataforma('core.eventos_salida', 'delete',
  'id, tenant_id, tipo, creado_en, disponible_en, procesado_en, intentos, fallido_en');
--> statement-breakpoint
grant update (disponible_en, procesado_en, intentos, ultimo_error, fallido_en) on core.eventos_salida to capaz_sistema;
--> statement-breakpoint

-- Eventos procesados: la empresa inserta; la plataforma purga (delete, leyendo solo tenant_id y procesado_en).
select core.aplicar_aislamiento('core.eventos_procesados', 'insercion');
--> statement-breakpoint
select core.abrir_a_plataforma('core.eventos_procesados', 'delete', 'tenant_id, procesado_en');
--> statement-breakpoint

-- Correlativos: solo la empresa.
select core.aplicar_aislamiento('core.contadores', 'completo');
