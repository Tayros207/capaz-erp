-- ============================================================================
-- 005 · Proformas con detalle de lineas + categorias contables
-- ============================================================================
-- ADITIVA POR CONTRATO: solo create table / add column / create view nuevas.
-- No toca ninguna tabla, vista, funcion ni policy existente. Si esta migracion
-- se revierte (ver 005_rollback.sql), la app vuelve a comportarse igual que
-- antes sin perder un solo dato previo.
--
-- Decisiones de dinero:
--   · Totales en centimos (bigint), igual que el resto del esquema.
--   · Precio unitario en MILESIMAS de sol: en imprenta el unitario tiene 3-4
--     decimales ("500 tarjetas a S/0.365") y redondearlo a centimos descuadra
--     el subtotal frente a lo que realmente se cobra.
--     subtotal_centimos = round(cantidad * precio_unitario_milesimas / 10)
--   · Subtotal/IGV/total se GUARDAN, no se derivan al vuelo: un documento ya
--     emitido no puede cambiar porque despues se cambie la tasa de IGV.
-- ============================================================================

-- ========== CATALOGO DE CATEGORIAS ==========
-- Cerrado a proposito (check, no texto libre): categorias libres producen
-- "papel", "papeles" y "Papel" como tres cosas distintas y los reportes dejan
-- de cuadrar. Se sigue el mismo patron text+check que ya usan tipo y estado.

create or replace function public.categorias_validas()
returns text[]
language sql
immutable
as $$
  select array[
    -- Egresos
    'materia_prima', 'insumos', 'acabados_terceros', 'mano_obra', 'maquinaria',
    'servicios', 'local', 'transporte', 'impuestos', 'otros_egresos',
    -- Ingresos
    'impresion_offset', 'impresion_digital', 'gran_formato', 'acabados',
    'diseno', 'otros_ingresos'
  ]::text[];
$$;

-- Columna nullable: null = "sin clasificar". Asi TODO el codigo actual que
-- inserta transacciones sigue funcionando sin tocar una sola linea.
alter table public.transacciones
  add column if not exists categoria text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transacciones_categoria_check'
  ) then
    alter table public.transacciones
      add constraint transacciones_categoria_check
      check (categoria is null or categoria = any (public.categorias_validas()));
  end if;
end $$;

create index if not exists idx_tx_user_categoria
  on public.transacciones(user_id, categoria)
  where categoria is not null;

-- Memoria por contacto: que categoria se le suele asignar a cada proveedor /
-- cliente. Alimenta la sugerencia automatica y mejora con el uso.
create index if not exists idx_tx_contacto_categoria
  on public.transacciones(user_id, contacto_id, categoria)
  where contacto_id is not null and categoria is not null;

-- ========== CONTADOR DE CORRELATIVOS ==========
-- Numeracion PRO-2026-0007 reservada de forma atomica. Un upsert con
-- "on conflict do update ... returning" bloquea la fila durante la operacion,
-- asi que dos proformas simultaneas nunca reciben el mismo numero.
create table if not exists public.proforma_contadores (
  user_id uuid not null references auth.users(id) on delete cascade,
  anio int not null,
  ultimo_numero int not null default 0,
  primary key (user_id, anio)
);

-- ========== PROFORMAS (cabecera) ==========
create table if not exists public.proformas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  anio int not null,
  numero int not null,

  contacto_id uuid references public.contactos(id),
  -- Congelado al emitir: si despues renombras al contacto, la proforma que ya
  -- enviaste no puede cambiar de destinatario.
  contacto_nombre text not null,

  descripcion text,

  subtotal_centimos bigint not null check (subtotal_centimos > 0),
  igv_porcentaje int not null default 0 check (igv_porcentaje between 0 and 100),
  igv_centimos bigint not null default 0 check (igv_centimos >= 0),
  total_centimos bigint not null check (total_centimos > 0),

  validez_dias int not null default 15 check (validez_dias > 0),
  fecha date not null default (now() at time zone 'America/Lima')::date,

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),

  -- Si se convirtio en orden de trabajo, apunta a la transaccion creada.
  transaccion_id uuid references public.transacciones(id),

  client_request_id uuid not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (user_id, client_request_id),
  unique (user_id, anio, numero)
);

create index if not exists idx_proformas_user_estado
  on public.proformas(user_id, estado)
  where deleted_at is null;

create index if not exists idx_proformas_user_fecha
  on public.proformas(user_id, fecha desc);

drop trigger if exists proformas_updated_at on public.proformas;
create trigger proformas_updated_at
  before update on public.proformas
  for each row execute function public.set_updated_at();

-- ========== PROFORMA ITEMS (lineas de detalle) ==========
create table if not exists public.proforma_items (
  id uuid primary key default gen_random_uuid(),
  proforma_id uuid not null references public.proformas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  orden int not null default 0,
  descripcion text not null,
  cantidad numeric(12, 3) not null check (cantidad > 0),
  unidad text,
  -- Milesimas de sol. S/ 0.365 = 365.
  precio_unitario_milesimas bigint not null check (precio_unitario_milesimas > 0),
  subtotal_centimos bigint not null check (subtotal_centimos >= 0),

  created_at timestamptz not null default now()
);

create index if not exists idx_proforma_items_proforma
  on public.proforma_items(proforma_id, orden);

-- ========== VISTA: RESUMEN POR CATEGORIA ==========
-- security_invoker = true es OBLIGATORIO. Sin el, la vista corre con permisos
-- del owner y el RLS de transacciones no aplica: cualquier usuario logueado
-- podria leer el desglose de gastos de los demas negocios via PostgREST.
create or replace view public.v_resumen_categoria
with (security_invoker = true) as
select
  t.user_id,
  t.tipo,
  coalesce(t.categoria, 'sin_categoria') as categoria,
  date_trunc('month', t.fecha)::date      as mes,
  count(*)                                as movimientos,
  sum(t.monto_centimos)                   as total_centimos
from public.transacciones t
where t.estado = 'activa' and t.deleted_at is null
group by t.user_id, t.tipo, coalesce(t.categoria, 'sin_categoria'), date_trunc('month', t.fecha);

-- ========== RPC: CREAR PROFORMA (atomica) ==========
-- Reserva el correlativo, inserta la cabecera y sus lineas en UNA transaccion.
-- Los importes se recalculan aqui: nunca se confia en el total que manda el
-- navegador.
create or replace function public.crear_proforma(
  p_client_request_id uuid,
  p_contacto_nombre text,
  p_items jsonb,
  p_contacto_id uuid default null,
  p_descripcion text default null,
  p_validez_dias int default 15,
  p_igv_porcentaje int default 0,
  p_fecha date default (now() at time zone 'America/Lima')::date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_anio int;
  v_numero int;
  v_proforma_id uuid;
  v_subtotal bigint := 0;
  v_igv bigint;
  v_item jsonb;
  v_sub bigint;
  v_orden int := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Idempotencia: si ya se creo con este client_request_id, devolver la misma.
  select id into v_proforma_id
  from public.proformas
  where user_id = v_user_id and client_request_id = p_client_request_id;
  if v_proforma_id is not null then
    return v_proforma_id;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La proforma necesita al menos una linea';
  end if;

  if coalesce(trim(p_contacto_nombre), '') = '' then
    raise exception 'La proforma necesita un cliente';
  end if;

  v_anio := extract(year from p_fecha)::int;

  -- Reserva atomica del correlativo.
  insert into public.proforma_contadores as c (user_id, anio, ultimo_numero)
  values (v_user_id, v_anio, 1)
  on conflict (user_id, anio)
  do update set ultimo_numero = c.ultimo_numero + 1
  returning c.ultimo_numero into v_numero;

  -- Suma de lineas (fuente de verdad del total).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_sub := round(
      (v_item->>'cantidad')::numeric * (v_item->>'precio_unitario_milesimas')::numeric / 10
    )::bigint;
    v_subtotal := v_subtotal + v_sub;
  end loop;

  if v_subtotal <= 0 then
    raise exception 'El total de la proforma debe ser mayor a cero';
  end if;

  v_igv := round(v_subtotal * coalesce(p_igv_porcentaje, 0)::numeric / 100)::bigint;

  insert into public.proformas (
    user_id, anio, numero, contacto_id, contacto_nombre, descripcion,
    subtotal_centimos, igv_porcentaje, igv_centimos, total_centimos,
    validez_dias, fecha, client_request_id
  ) values (
    v_user_id, v_anio, v_numero, p_contacto_id, trim(p_contacto_nombre), p_descripcion,
    v_subtotal, coalesce(p_igv_porcentaje, 0), v_igv, v_subtotal + v_igv,
    coalesce(p_validez_dias, 15), p_fecha, p_client_request_id
  )
  returning id into v_proforma_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_sub := round(
      (v_item->>'cantidad')::numeric * (v_item->>'precio_unitario_milesimas')::numeric / 10
    )::bigint;

    insert into public.proforma_items (
      proforma_id, user_id, orden, descripcion, cantidad, unidad,
      precio_unitario_milesimas, subtotal_centimos
    ) values (
      v_proforma_id, v_user_id, v_orden,
      coalesce(nullif(trim(v_item->>'descripcion'), ''), 'Servicio de imprenta'),
      (v_item->>'cantidad')::numeric,
      nullif(trim(coalesce(v_item->>'unidad', '')), ''),
      (v_item->>'precio_unitario_milesimas')::bigint,
      v_sub
    );
    v_orden := v_orden + 1;
  end loop;

  return v_proforma_id;
end;
$$;

-- Normalizacion de nombre igual a la del cliente (lower, trim, sin tildes).
-- Se define antes de la RPC que la usa y sin depender de la extension unaccent.
create or replace function public.unaccent_simple(p text)
returns text
language sql
immutable
as $$
  select translate(
    p,
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  );
$$;

-- ========== RPC: CONVERTIR PROFORMA EN ORDEN DE TRABAJO (atomica) ==========
-- Crea la transaccion y marca la proforma como aceptada en una sola operacion.
-- Si algo falla, no queda ni transaccion huerfana ni proforma mal marcada.
create or replace function public.convertir_proforma_en_orden(
  p_proforma_id uuid,
  p_client_request_id uuid,
  p_categoria text default null,
  p_adelanto_centimos bigint default null,
  p_adelanto_client_request_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_proforma public.proformas%rowtype;
  v_contacto_id uuid;
  v_tx_id uuid;
  v_norm text;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_proforma
  from public.proformas
  where id = p_proforma_id and user_id = v_user_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Proforma no encontrada';
  end if;

  -- Idempotencia: si ya se convirtio, devolver la transaccion existente.
  if v_proforma.transaccion_id is not null then
    return v_proforma.transaccion_id;
  end if;

  if p_adelanto_centimos is not null
     and p_adelanto_centimos >= v_proforma.total_centimos then
    raise exception 'El adelanto debe ser menor al total';
  end if;

  -- Reusar el contacto de la proforma, o buscarlo/crearlo por nombre.
  v_contacto_id := v_proforma.contacto_id;
  if v_contacto_id is null then
    v_norm := lower(trim(unaccent_simple(v_proforma.contacto_nombre)));

    select id into v_contacto_id
    from public.contactos
    where user_id = v_user_id and nombre_normalizado = v_norm and deleted_at is null;

    if v_contacto_id is null then
      insert into public.contactos (user_id, nombre, nombre_normalizado, tipo)
      values (v_user_id, trim(v_proforma.contacto_nombre), v_norm, 'cliente')
      returning id into v_contacto_id;
    end if;
  end if;

  insert into public.transacciones (
    user_id, contacto_id, tipo, monto_centimos, descripcion, fecha,
    categoria, client_request_id
  ) values (
    v_user_id, v_contacto_id, 'ingreso', v_proforma.total_centimos,
    coalesce(v_proforma.descripcion, 'Proforma ' || v_proforma.anio || '-' || v_proforma.numero),
    (now() at time zone 'America/Lima')::date,
    p_categoria, p_client_request_id
  )
  returning id into v_tx_id;

  if p_adelanto_centimos is not null and p_adelanto_centimos > 0 then
    insert into public.abonos (user_id, transaccion_id, monto_centimos, client_request_id)
    values (
      v_user_id, v_tx_id, p_adelanto_centimos,
      coalesce(p_adelanto_client_request_id, gen_random_uuid())
    );
  end if;

  update public.proformas
  set estado = 'aceptada', transaccion_id = v_tx_id
  where id = p_proforma_id;

  return v_tx_id;
end;
$$;

-- ========== RLS ==========
alter table public.proformas enable row level security;
alter table public.proforma_items enable row level security;
alter table public.proforma_contadores enable row level security;

drop policy if exists own_rows on public.proformas;
create policy own_rows on public.proformas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_rows on public.proforma_items;
create policy own_rows on public.proforma_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_rows on public.proforma_contadores;
create policy own_rows on public.proforma_contadores
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ========== GRANTS ==========
-- OJO: 003_grants.sql dejo un `alter default privileges ... to anon`, asi que
-- toda tabla nueva de este schema nace con permisos para anon sin pedirlos.
-- Verificado contra Postgres 17: las tablas de abajo aparecian con SELECT,
-- INSERT, UPDATE y DELETE para anon apenas creadas. El RLS igual bloquea las
-- filas (anon no tiene auth.uid()), pero el permiso no deberia estar ahi.
--
-- Se revoca solo sobre los objetos que crea ESTA migracion. Corregir el
-- default privileges global afecta a todo el esquema y va en su propia
-- entrega, por acuerdo explicito.
revoke all on public.proformas from anon;
revoke all on public.proforma_items from anon;
revoke all on public.proforma_contadores from anon;
revoke all on public.v_resumen_categoria from anon;
revoke all on function public.crear_proforma(uuid, text, jsonb, uuid, text, int, int, date) from anon;
revoke all on function public.convertir_proforma_en_orden(uuid, uuid, text, bigint, uuid) from anon;

grant select, insert, update, delete on public.proformas to authenticated;
grant select, insert, update, delete on public.proforma_items to authenticated;
grant select, insert, update on public.proforma_contadores to authenticated;
grant select on public.v_resumen_categoria to authenticated;

grant execute on function public.categorias_validas() to authenticated;
grant execute on function public.unaccent_simple(text) to authenticated;
grant execute on function public.crear_proforma(uuid, text, jsonb, uuid, text, int, int, date) to authenticated;
grant execute on function public.convertir_proforma_en_orden(uuid, uuid, text, bigint, uuid) to authenticated;
