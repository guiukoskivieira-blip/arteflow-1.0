-- Migration: fix order production initialization permission (Hotfix P1-01)
-- Replaces arteflow_create_order_with_production to require arteflow.orders.create without demanding arteflow.production.manage during initial order creation.

create or replace function public.arteflow_create_order_with_production(
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
  v_unit_price bigint;
  v_qty numeric;
  v_order_item_id uuid;
  v_job_id uuid;
  v_job_seq integer;
  v_job_code text;
  v_stage_id text;
  v_priority text;
  v_actor_name text;
  v_item_name text;
  v_item_sector text;
  v_item_unit text;
  v_dim_width numeric;
  v_dim_height numeric;
  v_dim_unit text;
  v_finishings text[];
  v_notes_item text;
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

  perform private.arteflow_seed_production_stages(p_organization_id);

  select coalesce(raw_user_meta_data->>'name', email, 'Usuário')
  into v_actor_name
  from auth.users
  where id = v_user_id;

  -- Validação de todos os itens e cálculo seguro do total
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    v_item_name := nullif(btrim(v_item ->> 'productName'), '');
    if v_item_name is null then
      raise exception 'PRODUCT_NAME_REQUIRED' using errcode = '22023';
    end if;

    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    if v_qty <= 0 or v_qty > 9007199254740991 then
      raise exception 'INVALID_ITEM_QUANTITY' using errcode = '22023';
    end if;

    if coalesce((v_item ->> 'unitPriceCents')::numeric, -1) < 0
       or (v_item ->> 'unitPriceCents')::numeric <> trunc((v_item ->> 'unitPriceCents')::numeric)
       or (v_item ->> 'unitPriceCents')::numeric > 9007199254740991 then
      raise exception 'INVALID_ITEM_UNIT_PRICE' using errcode = '22023';
    end if;

    v_unit_price := (v_item ->> 'unitPriceCents')::bigint;
    v_item_total := round(v_qty * v_unit_price)::bigint;
    if v_item_total < 0 or v_item_total > 9007199254740991 or v_total > 9007199254740991 - v_item_total then
      raise exception 'UNSAFE_ORDER_TOTAL' using errcode = '22003';
    end if;
    v_total := v_total + v_item_total;

    v_stage_id := coalesce(nullif(btrim(v_item ->> 'initialStageId'), ''), 'stage-entry');
    if not exists (
      select 1
      from public.arteflow_production_stages s
      where s.organization_id = p_organization_id
        and s.id = v_stage_id
        and s.is_active
    ) then
      raise exception 'INVALID_STAGE';
    end if;

    v_priority := coalesce(nullif(btrim(v_item ->> 'priority'), ''), 'MEDIUM');
    if v_priority not in ('LOW', 'MEDIUM', 'HIGH', 'URGENT') then
      raise exception 'INVALID_PRIORITY';
    end if;
  end loop;

  -- 1. Sequência e criação do Pedido
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

  -- 2. Itens do Pedido + Criação atômica das Ordens de Produção e Eventos
  v_position := 0;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    v_qty := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unitPriceCents')::bigint;
    v_item_total := round(v_qty * v_unit_price)::bigint;
    v_item_name := btrim(v_item ->> 'productName');
    v_item_sector := coalesce(nullif(btrim(v_item ->> 'sector'), ''), 'Impressão Digital');
    v_item_unit := coalesce(nullif(btrim(v_item ->> 'quantityUnit'), ''), nullif(btrim(v_item ->> 'unit'), ''), 'un');
    v_dim_width := nullif(v_item #>> '{dimensions,width}', '')::numeric;
    if v_dim_width is null and nullif(v_item ->> 'width', '') is not null then
      v_dim_width := (v_item ->> 'width')::numeric;
    end if;
    v_dim_height := nullif(v_item #>> '{dimensions,height}', '')::numeric;
    if v_dim_height is null and nullif(v_item ->> 'height', '') is not null then
      v_dim_height := (v_item ->> 'height')::numeric;
    end if;
    v_dim_unit := coalesce(nullif(v_item #>> '{dimensions,unit}', ''), nullif(v_item ->> 'unit', ''));
    if v_dim_unit not in ('mm', 'cm', 'm') then
      v_dim_unit := null;
    end if;
    v_finishings := coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'finishings', '[]'::jsonb))), '{}');
    v_notes_item := coalesce(nullif(btrim(v_item ->> 'technicalNotes'), ''), nullif(btrim(v_item ->> 'notes'), ''));
    v_stage_id := coalesce(nullif(btrim(v_item ->> 'initialStageId'), ''), 'stage-entry');
    v_priority := coalesce(nullif(btrim(v_item ->> 'priority'), ''), 'MEDIUM');

    -- Inserção do Item do Pedido
    insert into public.arteflow_order_items (
      organization_id, order_id, position, product_name, category, sector,
      dimension_width, dimension_height, dimension_unit, quantity, unit,
      unit_price_cents, total_price_cents, finishings, technical_notes,
      generated_job_id, data_origin
    ) values (
      p_organization_id, v_order_id, v_position, v_item_name,
      nullif(btrim(v_item ->> 'category'), ''), v_item_sector,
      v_dim_width, v_dim_height, v_dim_unit,
      v_qty, v_item_unit,
      v_unit_price, v_item_total,
      v_finishings, v_notes_item,
      null, 'user'
    ) returning id into v_order_item_id;

    -- Sequência e criação da OP vinculada
    insert into public.arteflow_production_job_sequences (organization_id, sequence_year, last_value)
    values (p_organization_id, v_year, 1)
    on conflict (organization_id, sequence_year)
    do update set last_value = public.arteflow_production_job_sequences.last_value + 1
    returning last_value into v_job_seq;

    v_job_code := 'OP-' || v_year::text || '-' || lpad(v_job_seq::text, 4, '0');

    insert into public.arteflow_production_jobs (
      organization_id, order_id, order_item_id, job_code,
      current_stage_id, priority, deadline_at, created_by
    ) values (
      p_organization_id, v_order_id, v_order_item_id, v_job_code,
      v_stage_id, v_priority, p_delivery_date, v_user_id
    ) returning id into v_job_id;

    -- Atualiza generated_job_id no item
    update public.arteflow_order_items
    set generated_job_id = v_job_id::text
    where id = v_order_item_id and organization_id = p_organization_id;

    -- Evento inicial da OP
    insert into public.arteflow_production_job_events (
      organization_id, job_id, actor_user_id, actor_name,
      event_type, to_value, to_stage_id, description
    ) values (
      p_organization_id, v_job_id, v_user_id, coalesce(v_actor_name, 'Usuário'),
      'JOB_CREATED', v_stage_id, v_stage_id,
      'Ordem de Produção criada a partir do item "' || v_item_name || '" do Pedido ' || v_order_number
    );
  end loop;

  return public.arteflow_get_order_json(v_order_id, p_organization_id);
end;
$$;

revoke all on function public.arteflow_create_order_with_production(uuid, text, jsonb, jsonb, text, timestamptz) from public, anon;
grant execute on function public.arteflow_create_order_with_production(uuid, text, jsonb, jsonb, text, timestamptz) to authenticated;
