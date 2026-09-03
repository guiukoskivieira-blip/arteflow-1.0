create schema if not exists private;

create table public.arteflow_order_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence_year integer not null check (sequence_year between 2000 and 9999),
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, sequence_year)
);

create table public.arteflow_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_number text not null,
  origin text not null check (origin in ('MANUAL', 'ORCAGRAF')),
  status text not null check (status in ('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED')),
  customer_snapshot_id text not null,
  customer_name text not null check (length(btrim(customer_name)) > 0),
  customer_document text,
  customer_email text,
  customer_phone text,
  customer_contact_person text,
  total_amount_cents bigint not null check (total_amount_cents >= 0 and total_amount_cents <= 9007199254740991),
  notes text,
  delivery_date timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  data_origin text not null default 'user' check (data_origin in ('demo', 'user')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint arteflow_orders_org_id_unique unique (organization_id, id),
  constraint arteflow_orders_org_number_unique unique (organization_id, order_number)
);

create table public.arteflow_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  position integer not null check (position > 0),
  product_name text not null check (length(btrim(product_name)) > 0),
  category text,
  sector text not null check (length(btrim(sector)) > 0),
  dimension_width numeric,
  dimension_height numeric,
  dimension_unit text check (dimension_unit is null or dimension_unit in ('mm', 'cm', 'm')),
  quantity numeric not null check (quantity > 0),
  unit text not null check (length(btrim(unit)) > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0 and unit_price_cents <= 9007199254740991),
  total_price_cents bigint not null check (total_price_cents >= 0 and total_price_cents <= 9007199254740991),
  finishings text[] not null default '{}',
  technical_notes text,
  generated_job_id text,
  data_origin text not null default 'user' check (data_origin in ('demo', 'user')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint arteflow_order_items_org_order_position_unique unique (organization_id, order_id, position),
  constraint arteflow_order_items_order_tenant_fk
    foreign key (organization_id, order_id)
    references public.arteflow_orders(organization_id, id)
    on delete cascade,
  constraint arteflow_order_items_dimensions_check check (
    (dimension_width is null and dimension_height is null and dimension_unit is null)
    or
    (dimension_width > 0 and dimension_height > 0 and dimension_unit is not null)
  )
);

create index arteflow_orders_org_created_idx
  on public.arteflow_orders (organization_id, created_at desc);
create index arteflow_orders_org_status_idx
  on public.arteflow_orders (organization_id, status);
create index arteflow_order_items_org_order_idx
  on public.arteflow_order_items (organization_id, order_id);

alter table public.arteflow_order_sequences enable row level security;
alter table public.arteflow_orders enable row level security;
alter table public.arteflow_order_items enable row level security;

create or replace function private.arteflow_can_access_product(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.organizations o
      join public.organization_members om
        on om.organization_id = o.id
       and om.user_id = (select auth.uid())
       and om.is_active = true
       and om.is_locked = false
      join public.organization_member_product_access pa
        on pa.organization_id = o.id
       and pa.user_id = (select auth.uid())
       and pa.product_key = 'arteflow'
       and pa.is_enabled = true
      where o.id = p_organization_id
        and o.is_active = true
        and o.deleted_at is null
    )
    and (
      exists (
        select 1
        from public.prexyon_subscriptions s
        join public.prexyon_plan_products pp on pp.plan_id = s.plan_id
        where s.organization_id = p_organization_id
          and pp.product_code = 'arteflow'
          and (
            (s.status in ('active', 'trialing') and s.current_period_end > timezone('utc', now()))
            or (s.status = 'canceled' and s.current_period_end > timezone('utc', now()))
          )
      )
      or exists (
        select 1
        from public.prexyon_homologation_entitlements he
        where he.organization_id = p_organization_id
          and he.product_code = 'arteflow'
          and he.expires_at > timezone('utc', now())
          and he.revoked_at is null
      )
    );
$$;

create or replace function private.arteflow_has_permission(
  p_organization_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.arteflow_can_access_product(p_organization_id)
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = (select auth.uid())
        and om.is_active = true
        and om.is_locked = false
        and (
          om.role = 'owner'::public.user_role
          or (
            not exists (
              select 1
              from public.prexyon_user_permission_overrides denial
              join public.prexyon_permission_definitions denial_definition
                on denial_definition.id = denial.permission_definition_id
              where denial.organization_id = p_organization_id
                and denial.user_id = (select auth.uid())
                and denial.effect = 'deny'
                and denial_definition.product_code = 'arteflow'
                and denial_definition.permission_key = p_permission_key
            )
            and (
              exists (
                select 1
                from public.prexyon_user_permission_overrides allowance
                join public.prexyon_permission_definitions allowance_definition
                  on allowance_definition.id = allowance.permission_definition_id
                where allowance.organization_id = p_organization_id
                  and allowance.user_id = (select auth.uid())
                  and allowance.effect = 'allow'
                  and allowance_definition.product_code = 'arteflow'
                  and allowance_definition.permission_key = p_permission_key
              )
              or exists (
                select 1
                from public.prexyon_user_product_roles assignment
                join public.prexyon_roles role_definition
                  on role_definition.id = assignment.role_id
                 and role_definition.product_code = 'arteflow'
                join public.prexyon_role_permissions role_permission
                  on role_permission.role_id = assignment.role_id
                join public.prexyon_permission_definitions definition
                  on definition.id = role_permission.permission_definition_id
                 and definition.product_code = 'arteflow'
                where assignment.organization_id = p_organization_id
                  and assignment.user_id = (select auth.uid())
                  and assignment.product_code = 'arteflow'
                  and definition.permission_key = p_permission_key
              )
            )
          )
        )
    );
$$;

revoke all on function private.arteflow_can_access_product(uuid) from public, anon;
revoke all on function private.arteflow_has_permission(uuid, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.arteflow_can_access_product(uuid) to authenticated;
grant execute on function private.arteflow_has_permission(uuid, text) to authenticated;

create policy arteflow_orders_select
on public.arteflow_orders for select
to authenticated
using ((select private.arteflow_has_permission(organization_id, 'arteflow.orders.view')));

create policy arteflow_orders_insert
on public.arteflow_orders for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select private.arteflow_has_permission(organization_id, 'arteflow.orders.create'))
);

create policy arteflow_orders_update
on public.arteflow_orders for update
to authenticated
using ((select private.arteflow_has_permission(organization_id, 'arteflow.orders.edit')))
with check (
  updated_by = (select auth.uid())
  and (select private.arteflow_has_permission(organization_id, 'arteflow.orders.edit'))
);

create policy arteflow_order_items_select
on public.arteflow_order_items for select
to authenticated
using ((select private.arteflow_has_permission(organization_id, 'arteflow.orders.view')));

create policy arteflow_order_items_insert
on public.arteflow_order_items for insert
to authenticated
with check ((select private.arteflow_has_permission(organization_id, 'arteflow.orders.create')));

create policy arteflow_order_items_update
on public.arteflow_order_items for update
to authenticated
using ((select private.arteflow_has_permission(organization_id, 'arteflow.orders.edit')))
with check ((select private.arteflow_has_permission(organization_id, 'arteflow.orders.edit')));

create or replace function public.arteflow_create_order(
  p_organization_id uuid,
  p_origin text,
  p_customer jsonb,
  p_items jsonb,
  p_notes text,
  p_delivery_date timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_year integer := extract(year from timezone('utc', now()))::integer;
  v_sequence bigint;
  v_order_number text;
  v_order_id uuid;
  v_total bigint := 0;
  v_item jsonb;
  v_item_total bigint;
  v_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if not private.arteflow_has_permission(p_organization_id, 'arteflow.orders.create') then
    raise exception 'ORDER_CREATE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_origin not in ('MANUAL', 'ORCAGRAF') then
    raise exception 'INVALID_ORDER_ORIGIN' using errcode = '22023';
  end if;
  if nullif(btrim(p_customer ->> 'name'), '') is null then
    raise exception 'CUSTOMER_NAME_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_ITEMS_REQUIRED' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    if nullif(btrim(v_item ->> 'productName'), '') is null then
      raise exception 'PRODUCT_NAME_REQUIRED' using errcode = '22023';
    end if;
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0 then
      raise exception 'INVALID_ITEM_QUANTITY' using errcode = '22023';
    end if;
    if coalesce((v_item ->> 'unitPriceCents')::numeric, -1) < 0
       or (v_item ->> 'unitPriceCents')::numeric <> trunc((v_item ->> 'unitPriceCents')::numeric)
       or (v_item ->> 'unitPriceCents')::numeric > 9007199254740991 then
      raise exception 'INVALID_ITEM_UNIT_PRICE' using errcode = '22023';
    end if;
    v_item_total := round((v_item ->> 'quantity')::numeric * (v_item ->> 'unitPriceCents')::numeric)::bigint;
    if v_item_total < 0 or v_item_total > 9007199254740991 or v_total > 9007199254740991 - v_item_total then
      raise exception 'UNSAFE_ORDER_TOTAL' using errcode = '22003';
    end if;
    v_total := v_total + v_item_total;
  end loop;

  insert into public.arteflow_order_sequences (organization_id, sequence_year, next_value)
  values (p_organization_id, v_year, 2)
  on conflict (organization_id, sequence_year)
  do update set next_value = public.arteflow_order_sequences.next_value + 1,
                updated_at = timezone('utc', now())
  returning next_value - 1 into v_sequence;

  v_order_number := 'PED-' || v_year::text || '-' || lpad(v_sequence::text, 4, '0');

  insert into public.arteflow_orders (
    organization_id, order_number, origin, status,
    customer_snapshot_id, customer_name, customer_document, customer_email,
    customer_phone, customer_contact_person, total_amount_cents, notes,
    delivery_date, created_by, updated_by, data_origin
  ) values (
    p_organization_id, v_order_number, p_origin, 'IN_PRODUCTION',
    coalesce(nullif(p_customer ->> 'id', ''), gen_random_uuid()::text),
    btrim(p_customer ->> 'name'), nullif(btrim(p_customer ->> 'document'), ''),
    nullif(btrim(p_customer ->> 'email'), ''), nullif(btrim(p_customer ->> 'phone'), ''),
    nullif(btrim(p_customer ->> 'contactPerson'), ''), v_total, nullif(btrim(p_notes), ''),
    p_delivery_date, v_user_id, v_user_id, 'user'
  ) returning id into v_order_id;

  v_position := 0;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    v_item_total := round((v_item ->> 'quantity')::numeric * (v_item ->> 'unitPriceCents')::numeric)::bigint;
    insert into public.arteflow_order_items (
      organization_id, order_id, position, product_name, category, sector,
      dimension_width, dimension_height, dimension_unit, quantity, unit,
      unit_price_cents, total_price_cents, finishings, technical_notes,
      generated_job_id, data_origin
    ) values (
      p_organization_id, v_order_id, v_position, btrim(v_item ->> 'productName'),
      nullif(btrim(v_item ->> 'category'), ''), coalesce(nullif(btrim(v_item ->> 'sector'), ''), 'Impressão Digital'),
      nullif(v_item #>> '{dimensions,width}', '')::numeric,
      nullif(v_item #>> '{dimensions,height}', '')::numeric,
      nullif(v_item #>> '{dimensions,unit}', ''),
      (v_item ->> 'quantity')::numeric, coalesce(nullif(btrim(v_item ->> 'unit'), ''), 'un'),
      (v_item ->> 'unitPriceCents')::bigint, v_item_total,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'finishings', '[]'::jsonb))), '{}'),
      nullif(btrim(v_item ->> 'technicalNotes'), ''), nullif(v_item ->> 'generatedJobId', ''), 'user'
    );
  end loop;

  return public.arteflow_get_order_json(v_order_id, p_organization_id);
end;
$$;

create or replace function public.arteflow_get_order_json(p_order_id uuid, p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'organizationId', o.organization_id,
    'origin', o.origin,
    'customer', jsonb_strip_nulls(jsonb_build_object(
      'id', o.customer_snapshot_id, 'name', o.customer_name,
      'document', o.customer_document, 'email', o.customer_email,
      'phone', o.customer_phone, 'contactPerson', o.customer_contact_person
    )),
    'items', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', i.id, 'orderId', i.order_id, 'productName', i.product_name,
        'category', i.category, 'sector', i.sector,
        'dimensions', case when i.dimension_width is null then null else jsonb_build_object(
          'width', i.dimension_width, 'height', i.dimension_height, 'unit', i.dimension_unit
        ) end,
        'quantity', i.quantity, 'unit', i.unit,
        'unitPriceCents', i.unit_price_cents, 'totalPriceCents', i.total_price_cents,
        'finishings', to_jsonb(i.finishings), 'technicalNotes', i.technical_notes,
        'generatedJobId', i.generated_job_id, 'dataOrigin', i.data_origin
      )) order by i.position)
      from public.arteflow_order_items i
      where i.order_id = o.id and i.organization_id = o.organization_id
    ), '[]'::jsonb),
    'totalAmountCents', o.total_amount_cents,
    'status', o.status,
    'notes', o.notes,
    'deliveryDateISO', o.delivery_date,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'dataOrigin', o.data_origin
  )
  from public.arteflow_orders o
  where o.id = p_order_id and o.organization_id = p_organization_id;
$$;

create or replace function public.arteflow_update_order(
  p_organization_id uuid,
  p_order_id uuid,
  p_status text,
  p_notes text,
  p_delivery_date timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if not private.arteflow_has_permission(p_organization_id, 'arteflow.orders.edit') then
    raise exception 'ORDER_EDIT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_status not in ('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED') then
    raise exception 'INVALID_ORDER_STATUS' using errcode = '22023';
  end if;

  update public.arteflow_orders
  set status = p_status,
      notes = nullif(btrim(p_notes), ''),
      delivery_date = p_delivery_date,
      updated_by = auth.uid(),
      updated_at = timezone('utc', now())
  where id = p_order_id and organization_id = p_organization_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return public.arteflow_get_order_json(p_order_id, p_organization_id);
end;
$$;

revoke all on table public.arteflow_order_sequences from public, anon, authenticated;
revoke all on table public.arteflow_orders from public, anon, authenticated;
revoke all on table public.arteflow_order_items from public, anon, authenticated;
grant select on table public.arteflow_orders, public.arteflow_order_items to authenticated;

revoke all on function public.arteflow_get_order_json(uuid, uuid) from public, anon;
revoke all on function public.arteflow_create_order(uuid, text, jsonb, jsonb, text, timestamptz) from public, anon;
revoke all on function public.arteflow_update_order(uuid, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.arteflow_get_order_json(uuid, uuid) to authenticated;
grant execute on function public.arteflow_create_order(uuid, text, jsonb, jsonb, text, timestamptz) to authenticated;
grant execute on function public.arteflow_update_order(uuid, uuid, text, text, timestamptz) to authenticated;
