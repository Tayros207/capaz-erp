CREATE TABLE "core"."empresa_cuenta" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"motivo" text,
	"cambiado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cambiado_por" text,
	CONSTRAINT "empresa_cuenta_estado" CHECK ("core"."empresa_cuenta"."estado" IN ('activa', 'prueba', 'pausada', 'baja'))
);
--> statement-breakpoint
CREATE TABLE "core"."empresa_cuenta_eventos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" text NOT NULL,
	"evento" text NOT NULL,
	"estado_anterior" text,
	"estado_nuevo" text NOT NULL,
	"motivo" text,
	"actor" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuenta_evento_tipo" CHECK ("core"."empresa_cuenta_eventos"."evento" IN ('pausa', 'baja', 'reactivacion', 'alta'))
);
--> statement-breakpoint
CREATE INDEX "idx_cuenta_eventos_empresa" ON "core"."empresa_cuenta_eventos" USING btree ("tenant_id","creado_en" DESC NULLS LAST);
--> statement-breakpoint
-- ===== A mano: disparador, relleno, seguridad, funciones y regla única de escritura =====

-- Historial automático de cada cambio de estado de cuenta (mismo patrón que empresa_modulos).
create or replace function core.empresa_cuenta_registrar_evento() returns trigger
language plpgsql set search_path = core, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into core.empresa_cuenta_eventos (tenant_id, evento, estado_anterior, estado_nuevo, motivo, actor)
    values (new.tenant_id, 'alta', null, new.estado, new.motivo, nullif(current_setting('app.actor', true), ''));
  elsif old.estado is distinct from new.estado then
    insert into core.empresa_cuenta_eventos (tenant_id, evento, estado_anterior, estado_nuevo, motivo, actor)
    values (new.tenant_id,
            case new.estado when 'pausada' then 'pausa' when 'baja' then 'baja' else 'reactivacion' end,
            old.estado, new.estado, new.motivo, nullif(current_setting('app.actor', true), ''));
  end if;
  return null;
end $$;
--> statement-breakpoint
create trigger empresa_cuenta_evento after insert or update on core.empresa_cuenta
  for each row execute function core.empresa_cuenta_registrar_evento();
--> statement-breakpoint

-- Relleno: una fila «activa» por cada empresa existente (antes de activar la RLS, para que el dueño pueda insertar).
insert into core.empresa_cuenta (tenant_id, estado, motivo, cambiado_por)
select id, 'activa', 'Alta inicial', 'migracion' from auth.organization
union
select tenant_id, 'activa', 'Alta inicial', 'migracion' from core.empresa_config
union
select tenant_id, 'activa', 'Alta inicial', 'migracion' from core.empresa_modulos
on conflict (tenant_id) do nothing;
--> statement-breakpoint

-- La empresa solo LEE su estado (para el aviso de solo lectura); la plataforma lo administra.
select core.aplicar_aislamiento('core.empresa_cuenta', 'lectura');
--> statement-breakpoint
select core.abrir_a_plataforma('core.empresa_cuenta', 'insert, update');
--> statement-breakpoint
select core.aplicar_aislamiento('core.empresa_cuenta_eventos', 'lectura');
--> statement-breakpoint
select core.abrir_a_plataforma('core.empresa_cuenta_eventos', 'insert');
--> statement-breakpoint
create trigger empresa_cuenta_eventos_solo_insercion before update or delete on core.empresa_cuenta_eventos
  for each row execute function core.rechazar_cambio();
--> statement-breakpoint

-- El estado de la cuenta manda sobre el del módulo. Único punto donde se aplica (ficha estado de cuenta, regla 2).
-- Sin fila de cuenta (empresa vieja o recién creada) cuenta como activa.
create or replace function core.modulo_activo(p_tenant text, p_modulo text) returns boolean
language sql stable set search_path = core, pg_temp as $$
  select exists (
    select 1 from core.empresa_modulos m
    where m.tenant_id = p_tenant and m.modulo = p_modulo
      and (m.estado = 'activo' or (m.estado = 'prueba' and m.prueba_hasta > now()))
  ) and not exists (
    select 1 from core.empresa_cuenta c
    where c.tenant_id = p_tenant and c.estado not in ('activa', 'prueba')
  );
$$;
--> statement-breakpoint

-- Cambio de estado: idempotente (si ya está en ese estado no hace nada ni duplica eventos). Sin security definer.
create or replace function core.cambiar_estado_cuenta(p_tenant text, p_estado text, p_motivo text, p_actor text)
returns void language plpgsql set search_path = core, pg_temp as $$
begin
  perform set_config('app.actor', coalesce(p_actor, ''), true);
  insert into core.empresa_cuenta (tenant_id) values (p_tenant) on conflict (tenant_id) do nothing;
  update core.empresa_cuenta set estado = p_estado, motivo = p_motivo, cambiado_en = now(), cambiado_por = p_actor
   where tenant_id = p_tenant and estado <> p_estado;
end $$;
--> statement-breakpoint

create or replace function core.pausar_cuenta(p_tenant text, p_motivo text, p_actor text default null)
returns void language plpgsql set search_path = core, pg_temp as $$
begin
  if p_motivo is null or length(btrim(p_motivo)) < 5 then
    raise exception 'El motivo es obligatorio (mínimo 5 caracteres)' using errcode = 'P0001';
  end if;
  perform core.cambiar_estado_cuenta(p_tenant, 'pausada', btrim(p_motivo), p_actor);
end $$;
--> statement-breakpoint

create or replace function core.dar_baja_cuenta(p_tenant text, p_motivo text, p_actor text default null)
returns void language plpgsql set search_path = core, pg_temp as $$
begin
  if p_motivo is null or length(btrim(p_motivo)) < 5 then
    raise exception 'El motivo es obligatorio (mínimo 5 caracteres)' using errcode = 'P0001';
  end if;
  perform core.cambiar_estado_cuenta(p_tenant, 'baja', btrim(p_motivo), p_actor);
end $$;
--> statement-breakpoint

create or replace function core.reactivar_cuenta(p_tenant text, p_motivo text default null, p_actor text default null)
returns void language plpgsql set search_path = core, pg_temp as $$
begin
  perform core.cambiar_estado_cuenta(p_tenant, 'activa', nullif(btrim(coalesce(p_motivo, '')), ''), p_actor);
end $$;
--> statement-breakpoint

-- El auxiliar y las tres funciones: solo la plataforma. capaz_app no puede ejecutarlas.
grant execute on function
  core.cambiar_estado_cuenta(text, text, text, text),
  core.pausar_cuenta(text, text, text),
  core.dar_baja_cuenta(text, text, text),
  core.reactivar_cuenta(text, text, text)
to capaz_sistema;

