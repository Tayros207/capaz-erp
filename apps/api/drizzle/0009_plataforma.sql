CREATE TABLE "core"."auditoria_plataforma" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor_usuario_id" text NOT NULL,
	"herramienta" text NOT NULL,
	"empresa_id" text,
	"resultado" text NOT NULL,
	"codigo" text,
	"resumen" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auditoria_plataforma_resultado" CHECK ("core"."auditoria_plataforma"."resultado" IN ('ok', 'rechazada'))
);

--> statement-breakpoint
-- ===== Seguridad a mano (drizzle-kit no genera FORCE RLS ni GRANT) =====

-- Auditoría de plataforma (sin tenant_id: no es de ninguna empresa). Solo capaz_sistema; solo inserción.
revoke all on core.auditoria_plataforma from capaz_app, capaz_auth, capaz_sistema;
--> statement-breakpoint
grant select, insert on core.auditoria_plataforma to capaz_sistema;
--> statement-breakpoint
create trigger auditoria_plataforma_solo_insercion before update or delete on core.auditoria_plataforma
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- Empresas vistas desde la plataforma: solo nombre, alta y conteo de miembros (vista del dueño).
create or replace view core.v_empresas_plataforma as
  select o.id as empresa_id, o.name as nombre, o.created_at as alta_en,
         (select count(*) from auth.member m where m.organization_id = o.id)::int as miembros
    from auth.organization o;
--> statement-breakpoint
revoke all on core.v_empresas_plataforma from public;
--> statement-breakpoint
grant select on core.v_empresas_plataforma to capaz_sistema;
--> statement-breakpoint

-- Última actividad por empresa: la plataforma lee solo (tenant_id, creado_en) de la auditoría de empresas.
select core.abrir_a_plataforma('core.auditoria', null, 'tenant_id, creado_en');
