-- 0000 · Cimientos de seguridad (ADR-011, ADR-012). Corre con `capaz_owner` (sin superusuario).
-- Los roles ya existen (scripts/preparar-base.ts); aquí se reparten esquemas, funciones y permisos.

create schema if not exists core;
--> statement-breakpoint
create schema if not exists auth;
--> statement-breakpoint
create schema if not exists registro;
--> statement-breakpoint
create schema if not exists cotizador;
--> statement-breakpoint
create extension if not exists pg_trgm;
--> statement-breakpoint

-- Toda función nueva nace sin permiso para PUBLIC: cada una necesita su grant explícito.
alter default privileges for role capaz_owner revoke execute on functions from public;
--> statement-breakpoint
revoke all on schema public from public;
--> statement-breakpoint

-- Quién entra a qué esquema. `auth` es solo de la librería de autenticación.
grant usage on schema core, registro, cotizador to capaz_app;
--> statement-breakpoint
grant usage on schema auth to capaz_auth;
--> statement-breakpoint
grant usage on schema core to capaz_sistema;
--> statement-breakpoint

-- Aislamiento por empresa. modo: 'completo' (leer y escribir), 'lectura', 'insercion' (leer e insertar).
-- La política NO lleva cláusula TO: vale para todos los roles, incluido el dueño (RLS forzada).
create or replace function core.aplicar_aislamiento(tabla regclass, modo text default 'completo')
returns void language plpgsql as $$
begin
  if modo not in ('completo', 'lectura', 'insercion') then
    raise exception 'Modo de aislamiento desconocido: %', modo;
  end if;
  execute format('alter table %s enable row level security', tabla);
  execute format('alter table %s force row level security', tabla);
  execute format('drop policy if exists aislamiento on %s', tabla);
  execute format($p$create policy aislamiento on %s
      using      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''))$p$, tabla);
  execute format('revoke all on %s from capaz_app', tabla);
  execute format('grant %s on %s to capaz_app',
    case modo when 'completo' then 'select, insert, update, delete'
              when 'lectura'  then 'select'
              else 'select, insert' end, tabla);
end $$;
--> statement-breakpoint

-- Abre una tabla a la plataforma (capaz_sistema), que cruza empresas. Sin columnas_lectura lee
-- todo; con ellas, solo esas columnas (así el relevo de eventos no ve la carga de negocio).
create or replace function core.abrir_a_plataforma(
  tabla regclass, escritura text default null, columnas_lectura text default null)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists plataforma on %s', tabla);
  execute format('create policy plataforma on %s to capaz_sistema using (true) with check (true)', tabla);
  execute format('revoke all on %s from capaz_sistema', tabla);
  if columnas_lectura is null then
    execute format('grant select on %s to capaz_sistema', tabla);
  else
    execute format('grant select (%s) on %s to capaz_sistema', columnas_lectura, tabla);
  end if;
  if escritura is not null then
    execute format('grant %s on %s to capaz_sistema', escritura, tabla);
  end if;
end $$;
--> statement-breakpoint

-- `actualizado_en` automático (disparador reutilizable por cualquier tabla).
create or replace function core.tocar_actualizado_en() returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;
--> statement-breakpoint

-- Solo inserción: para auditoría e historiales.
create or replace function core.rechazar_cambio() returns trigger language plpgsql as $$
begin
  raise exception 'La tabla % es de solo inserción.', tg_table_name using errcode = '42501';
end $$;
