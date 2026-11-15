-- 0003 · Funciones de módulos y contratación (ADR-011). Todas corren con los permisos de QUIEN LLAMA
-- (sin security definer) y nacen sin permiso para PUBLIC; cada una recibe su grant explícito.

-- ¿Está activo el módulo para la empresa? Activo, o en prueba sin vencer. Para la empresa de la
-- transacción ve su fila (RLS); para otra empresa devuelve falso. La plataforma la ve entera.
create or replace function core.modulo_activo(p_tenant text, p_modulo text) returns boolean
language sql stable set search_path = core, pg_temp as $$
  select exists (
    select 1 from core.empresa_modulos m
    where m.tenant_id = p_tenant and m.modulo = p_modulo
      and (m.estado = 'activo' or (m.estado = 'prueba' and m.prueba_hasta > now()))
  );
$$;
--> statement-breakpoint

-- Para los disparadores de escritura de registro y cotizador: lanza si el módulo no está activo
-- para la empresa de la transacción (módulo en baja, suspendido o prueba vencida = solo lectura).
create or replace function core.exigir_modulo(p_modulo text) returns void
language plpgsql set search_path = core, pg_temp as $$
declare v_tenant text := nullif(current_setting('app.tenant_id', true), '');
begin
  if v_tenant is null or not core.modulo_activo(v_tenant, p_modulo) then
    raise exception 'El módulo % no está activo para esta empresa', p_modulo using errcode = '42501';
  end if;
end $$;
--> statement-breakpoint

-- Historial automático de cada cambio de contratación.
create or replace function core.empresa_modulos_registrar_evento() returns trigger
language plpgsql set search_path = core, pg_temp as $$
declare v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := case when new.estado = 'prueba' then 'prueba' else 'alta' end;
    insert into core.empresa_modulos_eventos (tenant_id, modulo, evento, estado_anterior, estado_nuevo, motivo, actor)
    values (new.tenant_id, new.modulo, v_evento, null, new.estado, new.motivo, nullif(current_setting('app.actor', true), ''));
  else
    v_evento := case
      when old.estado is not distinct from new.estado then 'cambio'
      when new.estado = 'baja' then 'baja'
      when new.estado = 'suspendido' then 'suspension'
      when new.estado = 'prueba' then 'prueba'
      when old.estado in ('baja', 'suspendido') then 'reactivacion'
      else 'alta' end;
    if old is distinct from new then
      insert into core.empresa_modulos_eventos (tenant_id, modulo, evento, estado_anterior, estado_nuevo, motivo, actor)
      values (new.tenant_id, new.modulo, v_evento, old.estado, new.estado, new.motivo, nullif(current_setting('app.actor', true), ''));
    end if;
  end if;
  return null;
end $$;
--> statement-breakpoint
create trigger empresa_modulos_evento after insert or update on core.empresa_modulos
  for each row execute function core.empresa_modulos_registrar_evento();
--> statement-breakpoint

create or replace function core.activar_modulo(p_tenant text, p_modulo text, p_prueba_dias integer default null, p_actor text default null)
returns void language plpgsql set search_path = core, pg_temp as $$
declare v_dep text;
begin
  if p_prueba_dias is not null and p_prueba_dias <= 0 then
    raise exception 'Los días de prueba deben ser mayores que cero' using errcode = 'P0001';
  end if;
  if not exists (select 1 from core.modulos where codigo = p_modulo and activo) then
    raise exception 'El módulo % no existe o no está disponible', p_modulo using errcode = 'P0001';
  end if;
  for v_dep in select unnest(depende_de) from core.modulos where codigo = p_modulo loop
    if not exists (select 1 from core.empresa_modulos where tenant_id = p_tenant and modulo = v_dep and estado <> 'baja') then
      raise exception 'El módulo % requiere el módulo % activo', p_modulo, v_dep using errcode = 'P0001';
    end if;
  end loop;
  perform set_config('app.actor', coalesce(p_actor, ''), true);
  insert into core.empresa_modulos (tenant_id, modulo, estado, alta_en, prueba_hasta, baja_en, motivo)
  values (p_tenant, p_modulo, case when p_prueba_dias is null then 'activo' else 'prueba' end, now(),
          case when p_prueba_dias is null then null else now() + make_interval(days => p_prueba_dias) end, null, null)
  on conflict (tenant_id, modulo) do update set
    estado = excluded.estado, prueba_hasta = excluded.prueba_hasta, baja_en = null, motivo = null,
    alta_en = case when core.empresa_modulos.estado = 'baja' then now() else core.empresa_modulos.alta_en end;
end $$;
--> statement-breakpoint

create or replace function core.suspender_modulo(p_tenant text, p_modulo text, p_motivo text default null, p_actor text default null)
returns void language plpgsql set search_path = core, pg_temp as $$
begin
  perform set_config('app.actor', coalesce(p_actor, ''), true);
  update core.empresa_modulos set estado = 'suspendido', prueba_hasta = null, motivo = p_motivo
   where tenant_id = p_tenant and modulo = p_modulo and estado in ('prueba', 'activo');
  if not found then
    raise exception 'La empresa % no tiene el módulo % activo o en prueba', p_tenant, p_modulo using errcode = 'P0001';
  end if;
end $$;
--> statement-breakpoint

create or replace function core.dar_baja_modulo(p_tenant text, p_modulo text, p_motivo text default null, p_actor text default null)
returns void language plpgsql set search_path = core, pg_temp as $$
declare v_dependiente text;
begin
  select m.codigo into v_dependiente
    from core.modulos m join core.empresa_modulos e on e.modulo = m.codigo and e.tenant_id = p_tenant and e.estado <> 'baja'
   where p_modulo = any (m.depende_de) limit 1;
  if v_dependiente is not null then
    raise exception 'No se puede dar de baja %: el módulo % depende de él', p_modulo, v_dependiente using errcode = 'P0001';
  end if;
  perform set_config('app.actor', coalesce(p_actor, ''), true);
  update core.empresa_modulos set estado = 'baja', baja_en = now(), prueba_hasta = null, motivo = p_motivo
   where tenant_id = p_tenant and modulo = p_modulo and estado <> 'baja';
  if not found then
    raise exception 'La empresa % no tiene el módulo % contratado o ya está en baja', p_tenant, p_modulo using errcode = 'P0001';
  end if;
end $$;
--> statement-breakpoint

create or replace function core.reactivar_modulo(p_tenant text, p_modulo text, p_actor text default null)
returns void language plpgsql set search_path = core, pg_temp as $$
declare v_dep text;
begin
  for v_dep in select unnest(depende_de) from core.modulos where codigo = p_modulo loop
    if not exists (select 1 from core.empresa_modulos where tenant_id = p_tenant and modulo = v_dep and estado = 'activo') then
      raise exception 'El módulo % requiere el módulo % activo', p_modulo, v_dep using errcode = 'P0001';
    end if;
  end loop;
  perform set_config('app.actor', coalesce(p_actor, ''), true);
  update core.empresa_modulos set estado = 'activo', baja_en = null, prueba_hasta = null, motivo = null
   where tenant_id = p_tenant and modulo = p_modulo and estado in ('baja', 'suspendido');
  if not found then
    raise exception 'La empresa % no tiene el módulo % en baja o suspendido', p_tenant, p_modulo using errcode = 'P0001';
  end if;
end $$;
--> statement-breakpoint

grant execute on function core.modulo_activo(text, text) to capaz_app, capaz_sistema;
--> statement-breakpoint
grant execute on function core.exigir_modulo(text) to capaz_app;
--> statement-breakpoint
-- Cambiar la contratación es solo de la plataforma: capaz_app NO puede ejecutarlas.
grant execute on function
  core.activar_modulo(text, text, integer, text),
  core.suspender_modulo(text, text, text, text),
  core.dar_baja_modulo(text, text, text, text),
  core.reactivar_modulo(text, text, text)
to capaz_sistema;
