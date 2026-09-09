-- Migration: Preserve approved OrçaGraf financial terms (subtotal, discount, total) in ArteFlow orders
-- Adds subtotal_amount_cents and discount_amount_cents to arteflow_orders
-- Updates arteflow_list_importable_orcagraf_quotes to return financial breakdown fields
-- Updates arteflow_create_order_with_production to read canonical totals from public.quotes for OrçaGraf orders
-- Updates arteflow_get_order_json to return new financial fields
-- Does NOT alter OrçaGraf, Portal, ArteCheck, SSO, or billing
-- Does NOT modify or backfill existing data

-- 1. Add subtotal and discount columns to arteflow_orders
alter table public.arteflow_orders
  add column if not exists subtotal_amount_cents bigint null
    check (subtotal_amount_cents is null or (subtotal_amount_cents >= 0 and subtotal_amount_cents <= 9007199254740991)),
  add column if not exists discount_amount_cents bigint null
    check (discount_amount_cents is null or (discount_amount_cents >= 0 and discount_amount_cents <= 9007199254740991));

-- 2. Update arteflow_list_importable_orcagraf_quotes to include financial breakdown
create or replace function public.arteflow_list_importable_orcagraf_quotes(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if not private.arteflow_has_permission(p_organization_id, 'arteflow.orders.create') then
    raise exception 'ORDER_CREATE_FORBIDDEN' using errcode = '42501';
  end if;

  if not private.arteflow_can_import_orcagraf(p_organization_id) then
    raise exception 'ORCAGRAF_INTEGRATION_NOT_ENTITLED' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id::text,
        'quoteNumber', coalesce(q.quote_number, 'ORC-' || substring(q.id::text, 1, 8)),
        'customerId', q.customer_id,
        'customerName', q.customer_name,
        'customerDocument', q.customer_document,
        'customerEmail', q.customer_email,
        'customerPhone', q.customer_phone,
        'customerContactPerson', q.customer_contact,
        'subtotalAmountCents', q.subtotal_cents,
        'discountType', q.discount_type,
        'discountValue', q.discount_value,
        'discountAppliedCents', q.discount_applied_cents,
        'discountReason', q.discount_reason,
        'totalAmountCents', q.total_cents,
        'deliveryDate', null,
        'productionDays', q.production_days,
        'notes', case
          when q.internal_notes is not null and q.customer_notes is not null then q.customer_notes || E'\n' || q.internal_notes
          else coalesce(q.customer_notes, q.internal_notes)
        end,
        'internalNotes', q.internal_notes,
        'customerNotes', q.customer_notes,
        'sellerId', q.seller_id,
        'sellerName', q.seller_name,
        'sellerCommissionPct', q.commission_rate_percent,
        'sellerCommissionAmountCents', q.commission_amount_cents,
        'approvedAt', q.approved_at,
        'createdAt', q.created_at,
        'itemCount', coalesce(
          (
            select count(*)::int
            from public.quote_items qi_count
            where qi_count.quote_id = q.id
              and qi_count.organization_id = p_organization_id
          ),
          0
        ),
        'items', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', qi.id::text,
                'productId', qi.product_id,
                'productName', qi.product_name,
                'pricingMode', qi.pricing_mode,
                'quantity', qi.quantity,
                'lotSize', qi.lot_size,
                'billedQuantity', qi.billed_quantity,
                'width', case
                  when qi.width_mm is not null then qi.width_mm / 10.0
                  else null
                end,
                'height', case
                  when qi.height_mm is not null then qi.height_mm / 10.0
                  else null
                end,
                'unit', 'cm',
                'widthMm', qi.width_mm,
                'heightMm', qi.height_mm,
                'areaM2', qi.area_m2,
                'linearMeters', qi.linear_meters,
                'unitPriceCents', qi.unit_price_cents,
                'totalPriceCents', qi.total_price_cents,
                'materialName', qi.material_name,
                'technicalNotes', qi.notes,
                'displayOrder', qi.display_order,
                'finishings', coalesce(
                  (
                    select jsonb_agg(qif.name order by qif.display_order, qif.created_at)
                    from public.quote_item_finishings qif
                    where qif.quote_item_id = qi.id
                      and qif.organization_id = p_organization_id
                  ),
                  '[]'::jsonb
                ),
                'finishingsDetails', coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', qif.id::text,
                        'name', qif.name,
                        'unitPriceCents', qif.unit_price_cents,
                        'totalPriceCents', qif.total_price_cents
                      )
                      order by qif.display_order, qif.created_at
                    )
                    from public.quote_item_finishings qif
                    where qif.quote_item_id = qi.id
                      and qif.organization_id = p_organization_id
                  ),
                  '[]'::jsonb
                )
              )
              order by qi.display_order, qi.created_at, qi.id
            )
            from public.quote_items qi
            where qi.quote_id = q.id
              and qi.organization_id = p_organization_id
          ),
          '[]'::jsonb
        )
      )
      order by q.approved_at desc nulls last, q.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.quotes q
  where q.organization_id = p_organization_id
    and q.status = 'approved'
    and q.deleted_at is null
    and not exists (
      select 1
      from public.arteflow_orders ao
      where ao.organization_id = p_organization_id
        and ao.orcagraf_quote_id = q.id::text
    );

  return v_result;
end;
$$;

revoke all on function public.arteflow_list_importable_orcagraf_quotes(uuid) from public, anon;
grant execute on function public.arteflow_list_importable_orcagraf_quotes(uuid) to authenticated;

-- 3. Update arteflow_get_order_json to return subtotal and discount fields
create or replace function public.arteflow_get_order_json(
  p_order_id uuid,
  p_organization_id uuid
)
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
    'subtotalAmountCents', o.subtotal_amount_cents,
    'discountAmountCents', o.discount_amount_cents,
    'totalAmountCents', o.total_amount_cents,
    'status', o.status,
    'notes', o.notes,
    'orcagrafQuoteId', o.orcagraf_quote_id,
    'sellerId', o.seller_id,
    'sellerName', o.seller_name,
    'sellerCommissionPct', o.commission_rate_percent,
    'sellerCommissionAmountCents', o.commission_amount_cents,
    'deliveryDateISO', o.delivery_date,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'dataOrigin', o.data_origin
  )
  from public.arteflow_orders o
  where o.id = p_order_id and o.organization_id = p_organization_id;
$$;

-- 4. Updated atomic order creation: for OrçaGraf orders, use canonical quote totals server-side
create or replace function public.arteflow_create_order_with_production(
  p_organization_id uuid,
  p_origin text,
  p_customer jsonb,
  p_items jsonb,
  p_notes text,
  p_delivery_date timestamptz,
  p_orcagraf_quote_id text default null,
  p_seller_id uuid default null,
  p_seller_name text default null,
  p_commission_rate_percent numeric default null,
  p_commission_amount_cents bigint default null
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
  v_subtotal bigint := null;
  v_discount bigint := null;
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
  v_clean_quote_id text;
  v_default_stage_id text;
  v_seller_name text;
  v_comm_rate numeric;
  v_comm_amount bigint;
  v_payable_id uuid;
  v_quote_uuid uuid;
  v_quote_total bigint;
  v_quote_subtotal bigint;
  v_quote_discount bigint;
  v_quote_comm_rate numeric;
  v_quote_comm_amount bigint;
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

  v_clean_quote_id := nullif(btrim(p_orcagraf_quote_id), '');

  -- For OrçaGraf orders: validate and read canonical financial terms from public.quotes
  if p_origin = 'ORCAGRAF' and v_clean_quote_id is not null then
    begin
      v_quote_uuid := v_clean_quote_id::uuid;
    exception when others then
      raise exception 'INVALID_ORCAGRAF_QUOTE_ID' using errcode = '22023';
    end;

    select q.total_cents, q.subtotal_cents, q.discount_applied_cents,
           q.commission_rate_percent, q.commission_amount_cents
    into v_quote_total, v_quote_subtotal, v_quote_discount,
         v_quote_comm_rate, v_quote_comm_amount
    from public.quotes q
    where q.id = v_quote_uuid
      and q.organization_id = p_organization_id
      and q.status = 'approved'
      and q.deleted_at is null;

    if not found then
      raise exception 'ORCAGRAF_QUOTE_NOT_FOUND_OR_NOT_APPROVED' using errcode = '22023';
    end if;
  end if;

  -- Validação de vendedor (se fornecido seller_id, deve ser membro ativo da organização)
  if p_seller_id is not null then
    if not exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = p_seller_id
        and om.is_active = true
    ) then
      raise exception 'INVALID_SELLER_MEMBER' using errcode = '22023';
    end if;
  end if;

  v_seller_name := nullif(btrim(p_seller_name), '');

  -- Validação de percentual de comissão
  if p_commission_rate_percent is not null then
    if p_commission_rate_percent <= 0 or p_commission_rate_percent > 100 then
      raise exception 'INVALID_COMMISSION_PERCENT' using errcode = '22023';
    end if;
    v_comm_rate := p_commission_rate_percent;
  else
    v_comm_rate := null;
  end if;

  perform private.arteflow_seed_production_stages(p_organization_id);

  -- Resolve default active stage for the organization
  select id
  into v_default_stage_id
  from public.arteflow_production_stages
  where organization_id = p_organization_id
    and is_active = true
  order by
    case when is_initial = true then 0 else 1 end,
    sequence asc
  limit 1;

  if v_default_stage_id is null then
    raise exception 'Nenhuma etapa de produção ativa está configurada para esta organização.' using errcode = 'P0001';
  end if;

  select coalesce(raw_user_meta_data->>'name', email, 'Usuário')
  into v_actor_name
  from auth.users
  where id = v_user_id;

  -- Validação de todos os itens e cálculo seguro do total derivado dos itens
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

    v_stage_id := nullif(btrim(v_item ->> 'initialStageId'), '');
    if v_stage_id is not null then
      if not exists (
        select 1
        from public.arteflow_production_stages s
        where s.organization_id = p_organization_id
          and s.id = v_stage_id
          and s.is_active = true
      ) then
        raise exception 'INVALID_STAGE' using errcode = '22023';
      end if;
    end if;

    v_priority := coalesce(nullif(btrim(v_item ->> 'priority'), ''), 'MEDIUM');
    if v_priority not in ('LOW', 'MEDIUM', 'HIGH', 'URGENT') then
      raise exception 'INVALID_PRIORITY' using errcode = '22023';
    end if;
  end loop;

  -- For OrçaGraf orders: use canonical totals from the approved quote (server-side authoritative)
  -- For manual orders: v_total from items is authoritative, subtotal/discount stay NULL
  if p_origin = 'ORCAGRAF' and v_quote_total is not null then
    v_subtotal := v_quote_subtotal;
    v_discount := v_quote_discount;
    v_total := v_quote_total;

    -- Use canonical commission from the quote when available
    if v_quote_comm_amount is not null then
      v_comm_amount := v_quote_comm_amount;
    end if;
    if v_quote_comm_rate is not null then
      v_comm_rate := v_quote_comm_rate;
    end if;
  end if;

  -- Determinação do valor de comissão (quando não já definido pelo quote canônico)
  if v_comm_amount is null then
    if p_origin = 'ORCAGRAF' and p_commission_amount_cents is not null then
      if p_commission_amount_cents < 0 or p_commission_amount_cents > 9007199254740991 then
        raise exception 'INVALID_COMMISSION_AMOUNT' using errcode = '22023';
      end if;
      v_comm_amount := p_commission_amount_cents;
    elsif v_comm_rate is not null and v_total > 0 then
      v_comm_amount := round((v_total * v_comm_rate) / 100.0)::bigint;
    else
      v_comm_amount := null;
    end if;
  end if;

  -- 1. Sequência e criação do Pedido
  insert into public.arteflow_order_sequences (organization_id, sequence_year, next_value)
  values (p_organization_id, v_year, 2)
  on conflict (organization_id, sequence_year)
  do update set next_value = public.arteflow_order_sequences.next_value + 1,
                updated_at = timezone('utc', now())
  returning next_value - 1 into v_sequence;

  v_order_number := 'PED-' || v_year::text || '-' || lpad(v_sequence::text, 4, '0');

  begin
    insert into public.arteflow_orders (
      organization_id, order_number, origin, status,
      customer_snapshot_id, customer_name, customer_document, customer_email,
      customer_phone, customer_contact_person,
      subtotal_amount_cents, discount_amount_cents, total_amount_cents,
      notes, orcagraf_quote_id, seller_id, seller_name, commission_rate_percent,
      commission_amount_cents, delivery_date, created_by, updated_by, data_origin
    ) values (
      p_organization_id, v_order_number, p_origin, 'IN_PRODUCTION',
      coalesce(nullif(p_customer ->> 'id', ''), gen_random_uuid()::text),
      btrim(p_customer ->> 'name'), nullif(btrim(p_customer ->> 'document'), ''),
      nullif(btrim(p_customer ->> 'email'), ''), nullif(btrim(p_customer ->> 'phone'), ''),
      nullif(btrim(p_customer ->> 'contactPerson'), ''),
      v_subtotal, v_discount, v_total,
      nullif(btrim(p_notes), ''),
      v_clean_quote_id, p_seller_id, v_seller_name, v_comm_rate,
      v_comm_amount, p_delivery_date, v_user_id, v_user_id, 'user'
    ) returning id into v_order_id;
  exception
    when unique_violation then
      if v_clean_quote_id is not null then
        raise exception 'ORCAGRAF_QUOTE_ALREADY_IMPORTED' using errcode = '23505';
      else
        raise;
      end if;
  end;

  -- 2. Criação atômica de Conta a Pagar de comissão (quando aplicável)
  if v_comm_amount is not null and v_comm_amount > 0 and v_seller_name is not null then
    insert into public.arteflow_financial_payables (
      organization_id,
      order_id,
      commission_seller_id,
      purchase_order_id,
      purchase_order_number,
      supplier_id,
      supplier_name,
      description,
      amount_cents,
      paid_amount_cents,
      due_date,
      status,
      created_by
    ) values (
      p_organization_id,
      v_order_id,
      p_seller_id,
      null,
      null,
      null,
      v_seller_name,
      'Comissão de venda — Pedido ' || v_order_number,
      v_comm_amount,
      0,
      coalesce(p_delivery_date::date, current_date),
      'OPEN',
      v_user_id
    ) returning id into v_payable_id;

    insert into public.arteflow_financial_events (
      organization_id,
      entity_type,
      entity_id,
      event_type,
      description,
      metadata,
      actor_user_id,
      actor_name
    ) values (
      p_organization_id,
      'PAYABLE',
      v_payable_id,
      'PAYABLE_CREATED',
      'Conta a pagar criada para comissão do Pedido ' || v_order_number,
      jsonb_build_object(
        'orderId', v_order_id,
        'orderNumber', v_order_number,
        'commissionSellerId', p_seller_id,
        'sellerName', v_seller_name,
        'commissionAmountCents', v_comm_amount
      ),
      v_user_id,
      coalesce(v_actor_name, 'Sistema')
    );
  end if;

  -- 3. Itens do Pedido + Criação atômica das Ordens de Produção e Eventos
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
    v_stage_id := coalesce(nullif(btrim(v_item ->> 'initialStageId'), ''), v_default_stage_id);
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

revoke all on function public.arteflow_create_order_with_production(uuid, text, jsonb, jsonb, text, timestamptz, text, uuid, text, numeric, bigint) from public, anon;
grant execute on function public.arteflow_create_order_with_production(uuid, text, jsonb, jsonb, text, timestamptz, text, uuid, text, numeric, bigint) to authenticated;
