CREATE TABLE "core"."empresa_ficha" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"contacto_nombre" text,
	"contacto_telefono" text,
	"contacto_correo" text,
	"ruc" text,
	"estado_comercial" text DEFAULT 'prospecto' NOT NULL,
	"responsable" text,
	"nota" text,
	"enlace_crm" text,
	"direccion" text,
	"ciudad" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" text NOT NULL,
	CONSTRAINT "empresa_ficha_ruc" CHECK ("core"."empresa_ficha"."ruc" is null or "core"."empresa_ficha"."ruc" ~ '^[0-9]{11}$'),
	CONSTRAINT "empresa_ficha_estado" CHECK ("core"."empresa_ficha"."estado_comercial" IN ('prospecto', 'prueba', 'cliente', 'en_riesgo', 'perdido')),
	CONSTRAINT "empresa_ficha_enlace" CHECK ("core"."empresa_ficha"."enlace_crm" is null or (length("core"."empresa_ficha"."enlace_crm") <= 500 and "core"."empresa_ficha"."enlace_crm" like 'https://%')),
	CONSTRAINT "empresa_ficha_largos" CHECK (length("core"."empresa_ficha"."contacto_nombre") <= 200 and length("core"."empresa_ficha"."contacto_telefono") <= 50 and length("core"."empresa_ficha"."contacto_correo") <= 200 and length("core"."empresa_ficha"."responsable") <= 200 and length("core"."empresa_ficha"."nota") <= 4000 and length("core"."empresa_ficha"."direccion") <= 300 and length("core"."empresa_ficha"."ciudad") <= 100)
);
--> statement-breakpoint
ALTER TABLE "core"."empresa_cuenta" ADD COLUMN "max_usuarios" integer;--> statement-breakpoint
ALTER TABLE "core"."empresa_cuenta" ADD CONSTRAINT "empresa_cuenta_max_usuarios" CHECK ("core"."empresa_cuenta"."max_usuarios" is null or "core"."empresa_cuenta"."max_usuarios" > 0);--> statement-breakpoint
-- ===== A mano: disparador y seguridad =====
-- Ficha comercial de Datayros sobre cada empresa: SOLO plataforma. La empresa no la ve ni la toca.

create trigger empresa_ficha_actualizado before update on core.empresa_ficha
  for each row execute function core.tocar_actualizado_en();
--> statement-breakpoint

-- La RLS por empresa es obligatoria en toda tabla con tenant_id (prueba de catálogo); luego se le quita todo a capaz_app.
select core.aplicar_aislamiento('core.empresa_ficha', 'lectura');
--> statement-breakpoint
revoke all on core.empresa_ficha from capaz_app;
--> statement-breakpoint
-- capaz_sistema: leer, crear, y editar solo las columnas editables (no tenant_id ni actualizado_en). Sin delete.
select core.abrir_a_plataforma('core.empresa_ficha', 'insert');
--> statement-breakpoint
grant update (contacto_nombre, contacto_telefono, contacto_correo, ruc, estado_comercial, responsable, nota, enlace_crm, direccion, ciudad, actualizado_por)
  on core.empresa_ficha to capaz_sistema;
