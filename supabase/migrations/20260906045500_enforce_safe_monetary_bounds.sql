-- Migration: enforce safe monetary bounds on inventory and procurement tables and RPCs
-- Ensures 0 <= *_cents <= 9007199254740991 (Number.MAX_SAFE_INTEGER)

-- 1. Constraints on Inventory Tables
alter table public.arteflow_inventory_items
  drop constraint if exists arteflow_inventory_items_average_cost_cents_check;

alter table public.arteflow_inventory_items
  add constraint arteflow_inventory_items_average_cost_cents_check
  check (average_cost_cents >= 0 and average_cost_cents <= 9007199254740991);

alter table public.arteflow_inventory_requirements
  drop constraint if exists arteflow_inventory_requirements_material_average_cost_cents_check;

alter table public.arteflow_inventory_requirements
  add constraint arteflow_inventory_requirements_material_average_cost_cents_check
  check (material_average_cost_cents >= 0 and material_average_cost_cents <= 9007199254740991);

alter table public.arteflow_inventory_movements
  drop constraint if exists arteflow_inventory_movements_unit_cost_cents_check;

alter table public.arteflow_inventory_movements
  add constraint arteflow_inventory_movements_unit_cost_cents_check
  check (unit_cost_cents is null or (unit_cost_cents >= 0 and unit_cost_cents <= 9007199254740991));

alter table public.arteflow_inventory_movements
  drop constraint if exists arteflow_inventory_movements_total_cost_cents_check;

alter table public.arteflow_inventory_movements
  add constraint arteflow_inventory_movements_total_cost_cents_check
  check (total_cost_cents is null or (total_cost_cents >= 0 and total_cost_cents <= 9007199254740991));

-- 2. Endurece RPC arteflow_create_inventory_item
create or replace function public.arteflow_create_inventory_item(
  p_organization_id uuid,p_sku text,p_name text,p_category text,p_unit text,p_initial_stock_milli bigint,
  p_minimum_stock_milli bigint,p_unit_cost_cents bigint default 0,p_supplier_name text default null,p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_actor text; v_total_cost bigint;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if nullif(btrim(p_sku),'') is null or nullif(btrim(p_name),'') is null then raise exception 'INVENTORY_REQUIRED_FIELDS'; end if;
  if p_unit not in ('UNIT','SHEET','METER','SQUARE_METER','LITER','KILOGRAM','ROLL','PACKAGE') then raise exception 'INVALID_INVENTORY_UNIT'; end if;
  if p_initial_stock_milli<0 or p_initial_stock_milli>9007199254740991 or p_minimum_stock_milli<0 or p_minimum_stock_milli>9007199254740991 or p_unit_cost_cents<0 or p_unit_cost_cents>9007199254740991 then
    raise exception 'INVALID_INVENTORY_VALUE';
  end if;
  if p_idempotency_key is not null then select id into v_id from public.arteflow_inventory_items where organization_id=p_organization_id and idempotency_key=p_idempotency_key; if found then return v_id; end if; end if;
  insert into public.arteflow_inventory_items(organization_id,sku,name,category,unit,stock_on_hand_milli,minimum_stock_milli,average_cost_cents,supplier_name,idempotency_key,created_by)
  values(p_organization_id,upper(btrim(p_sku)),btrim(p_name),coalesce(nullif(btrim(p_category),''),'Outros Insumos'),p_unit,p_initial_stock_milli,p_minimum_stock_milli,p_unit_cost_cents,nullif(btrim(p_supplier_name),''),p_idempotency_key,(select auth.uid())) returning id into v_id;
  if p_initial_stock_milli>0 then
    v_actor:=private.arteflow_inventory_actor_name();
    if p_unit_cost_cents>0 then
      v_total_cost:=round(p_initial_stock_milli::numeric*p_unit_cost_cents/1000.0)::bigint;
      if v_total_cost>9007199254740991 then raise exception 'UNSAFE_MONETARY_VALUE'; end if;
    else
      v_total_cost:=null;
    end if;
    insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,unit_cost_cents,total_cost_cents,reason,idempotency_key,created_by,actor_name)
    values(p_organization_id,v_id,'OPENING_BALANCE',p_initial_stock_milli,0,p_initial_stock_milli,nullif(p_unit_cost_cents,0),v_total_cost,'Saldo inicial de cadastro de material',p_idempotency_key,(select auth.uid()),v_actor);
  end if;
  return v_id;
exception when unique_violation then raise exception 'INVENTORY_SKU_OR_IDEMPOTENCY_DUPLICATE' using errcode='23505';
end; $$;

-- 3. Endurece RPC arteflow_record_inventory_movement com idempotência canônica
create or replace function public.arteflow_record_inventory_movement(
  p_organization_id uuid,p_item_id uuid,p_type text,p_quantity_milli bigint,p_reason text,
  p_unit_cost_cents bigint default null,p_total_cost_cents bigint default null,p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  item public.arteflow_inventory_items%rowtype;
  delta bigint; new_balance bigint; movement_id uuid; reserved bigint; next_cost bigint; job_id uuid; payload jsonb;
  calc_cost numeric;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_type not in ('RECEIPT','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT','RETURN') or p_quantity_milli<=0 or p_quantity_milli>9007199254740991 or nullif(btrim(p_reason),'') is null then
    raise exception 'INVALID_INVENTORY_MOVEMENT';
  end if;
  if p_unit_cost_cents is not null and (p_unit_cost_cents<0 or p_unit_cost_cents>9007199254740991) then
    raise exception 'INVALID_COST';
  end if;
  if p_total_cost_cents is not null and (p_total_cost_cents<0 or p_total_cost_cents>9007199254740991) then
    raise exception 'INVALID_COST';
  end if;
  if p_idempotency_key is not null then
    payload:=jsonb_build_object('itemId',p_item_id,'type',p_type,'quantityMilli',p_quantity_milli,'reason',btrim(p_reason),'unitCostCents',p_unit_cost_cents,'totalCostCents',p_total_cost_cents);
    movement_id:=private.arteflow_idempotency_replay(p_organization_id,p_idempotency_key,'inventory.record_movement',payload);
    if movement_id is not null then return movement_id; end if;
  end if;
  select * into item from public.arteflow_inventory_items where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  delta:=case when p_type='NEGATIVE_ADJUSTMENT' then -p_quantity_milli else p_quantity_milli end; new_balance:=item.stock_on_hand_milli+delta;
  if new_balance>9007199254740991 then raise exception 'INVENTORY_OVERFLOW'; end if;
  select coalesce(sum(reserved_quantity_milli),0) into reserved from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=p_item_id and status='ACTIVE';
  if new_balance<0 or new_balance<reserved then raise exception 'INSUFFICIENT_STOCK' using errcode='P0001'; end if;
  next_cost:=item.average_cost_cents;
  if p_type='RECEIPT' and p_unit_cost_cents is not null then
    if new_balance=0 then
      next_cost:=p_unit_cost_cents;
    else
      calc_cost:=round((item.stock_on_hand_milli::numeric*item.average_cost_cents + coalesce(p_total_cost_cents::numeric*1000,p_quantity_milli::numeric*p_unit_cost_cents))/new_balance::numeric);
      if calc_cost>9007199254740991 or calc_cost<0 then raise exception 'UNSAFE_MONETARY_VALUE'; end if;
      next_cost:=calc_cost::bigint;
    end if;
  end if;
  update public.arteflow_inventory_items set stock_on_hand_milli=new_balance,average_cost_cents=next_cost,updated_at=now() where id=item.id;
  insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,unit_cost_cents,total_cost_cents,reason,idempotency_key,created_by,actor_name)
  values(p_organization_id,p_item_id,p_type,p_quantity_milli,item.stock_on_hand_milli,new_balance,p_unit_cost_cents,p_total_cost_cents,btrim(p_reason),p_idempotency_key,(select auth.uid()),private.arteflow_inventory_actor_name()) returning id into movement_id;
  for job_id in select distinct production_job_id from public.arteflow_inventory_requirements where organization_id=p_organization_id and inventory_item_id=p_item_id loop perform private.arteflow_refresh_material_gate(p_organization_id,job_id); end loop;
  if p_idempotency_key is not null then perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'inventory.record_movement',payload,movement_id); end if;
  return movement_id;
end $$;

-- 4. Endurece RPC arteflow_receive_purchase_order com verificações estritas
create or replace function public.arteflow_receive_purchase_order(
  p_organization_id uuid,p_order_id uuid,p_items jsonb,p_invoice_number text,p_notes text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  purchase_order public.arteflow_purchase_orders%rowtype; receipt_id uuid; receipt_number text; input_item jsonb;
  order_item public.arteflow_purchase_order_items%rowtype; quantity bigint; unit_cost bigint; line_total bigint; movement_id uuid; next_status text;
  canonical_items jsonb; payload jsonb;
begin
  perform private.arteflow_require_procurement(p_organization_id,true);
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'PURCHASE_RECEIPT_ITEMS_REQUIRED'; end if;
  select jsonb_agg(jsonb_build_object(
    'purchaseOrderItemId',(entry->>'purchaseOrderItemId')::uuid,
    'quantityMilli',(entry->>'quantityMilli')::bigint,
    'unitCostCents',coalesce((entry->>'unitCostCents')::bigint, canonical_order_item.unit_cost_cents)
  ) order by (entry->>'purchaseOrderItemId')::uuid) into canonical_items
  from jsonb_array_elements(p_items) entry
  left join public.arteflow_purchase_order_items canonical_order_item
    on canonical_order_item.organization_id=p_organization_id
   and canonical_order_item.purchase_order_id=p_order_id
   and canonical_order_item.id=(entry->>'purchaseOrderItemId')::uuid;
  payload:=jsonb_build_object('orderId',p_order_id,'items',canonical_items,'invoiceNumber',nullif(btrim(p_invoice_number),''),'notes',nullif(btrim(p_notes),''));
  receipt_id:=private.arteflow_idempotency_replay(p_organization_id,p_idempotency_key,'procurement.receive_purchase_order',payload);
  if receipt_id is not null then return receipt_id; end if;
  select * into purchase_order from public.arteflow_purchase_orders where organization_id=p_organization_id and id=p_order_id for update;
  if not found or purchase_order.status not in('ISSUED','PARTIALLY_RECEIVED') then raise exception 'PURCHASE_ORDER_NOT_RECEIVABLE'; end if;
  receipt_number:=private.arteflow_next_purchase_number(p_organization_id,'REC');
  insert into public.arteflow_purchase_receipts(organization_id,purchase_order_id,receipt_number,supplier_snapshot,invoice_number,received_by,received_by_name,notes,idempotency_key)
  values(p_organization_id,p_order_id,receipt_number,purchase_order.supplier_snapshot,nullif(btrim(p_invoice_number),''),(select auth.uid()),private.arteflow_procurement_actor_name(),nullif(btrim(p_notes),''),p_idempotency_key) returning id into receipt_id;
  for input_item in select value from jsonb_array_elements(p_items) loop
    quantity:=(input_item->>'quantityMilli')::bigint;
    select * into order_item from public.arteflow_purchase_order_items where organization_id=p_organization_id and id=(input_item->>'purchaseOrderItemId')::uuid and purchase_order_id=p_order_id for update;
    if not found then raise exception 'PURCHASE_ORDER_ITEM_NOT_FOUND'; end if;
    if quantity<=0 or quantity>9007199254740991 or quantity>order_item.ordered_quantity_milli-order_item.received_quantity_milli then raise exception 'ORDER_RECEIPT_EXCEEDS_REMAINING'; end if;
    unit_cost:=coalesce((input_item->>'unitCostCents')::bigint,order_item.unit_cost_cents);
    if unit_cost<0 or unit_cost>9007199254740991 then raise exception 'INVALID_COST'; end if;
    line_total:=round(quantity::numeric*unit_cost/1000)::bigint;
    if line_total>9007199254740991 then raise exception 'UNSAFE_MONETARY_VALUE'; end if;
    movement_id:=public.arteflow_record_inventory_movement(p_organization_id,order_item.inventory_item_id,'RECEIPT',quantity,'Recebimento do pedido '||purchase_order.order_number,unit_cost,line_total,p_idempotency_key||':'||order_item.id);
    update public.arteflow_inventory_movements set purchase_order_id=p_order_id,purchase_receipt_id=receipt_id,purchase_order_item_id=order_item.id where organization_id=p_organization_id and id=movement_id;
    insert into public.arteflow_purchase_receipt_items(organization_id,purchase_receipt_id,purchase_order_item_id,inventory_item_id,received_quantity_milli,unit_cost_cents,total_cost_cents,stock_movement_id)
    values(p_organization_id,receipt_id,order_item.id,order_item.inventory_item_id,quantity,unit_cost,line_total,movement_id);
    update public.arteflow_purchase_order_items set received_quantity_milli=received_quantity_milli+quantity,updated_at=now() where id=order_item.id;
  end loop;
  select case when bool_and(received_quantity_milli=ordered_quantity_milli) then 'RECEIVED' else 'PARTIALLY_RECEIVED' end into next_status from public.arteflow_purchase_order_items where organization_id=p_organization_id and purchase_order_id=p_order_id;
  update public.arteflow_purchase_orders set status=next_status,version=version+1,updated_at=now() where id=p_order_id;
  insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,metadata,actor_user_id,actor_name)
  values(p_organization_id,'RECEIPT',receipt_id,case when next_status='RECEIVED' then 'GOODS_RECEIVED' else 'ORDER_STATUS_CHANGED' end,'Recebimento '||receipt_number||' registrado',jsonb_build_object('orderId',p_order_id,'status',next_status),(select auth.uid()),private.arteflow_procurement_actor_name());
  perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'procurement.receive_purchase_order',payload,receipt_id);
  return receipt_id;
end $$;

-- 5. Endurece RPC arteflow_create_purchase_order
create or replace function public.arteflow_create_purchase_order(p_organization_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid:=gen_random_uuid(); v_number text; v_supplier public.arteflow_suppliers%rowtype; v_item jsonb;
  v_mat public.arteflow_inventory_items%rowtype; v_subtotal bigint:=0; v_total bigint; v_line bigint;
  v_qty bigint; v_cost bigint; v_req text; v_freight bigint; v_discount bigint;
begin
  perform private.arteflow_require_procurement(p_organization_id,true);
  select * into v_supplier from public.arteflow_suppliers where organization_id=p_organization_id and id=(p_data->>'supplierId')::uuid and is_active;
  if not found then raise exception 'SUPPLIER_NOT_FOUND_OR_INACTIVE'; end if;
  if jsonb_array_length(coalesce(p_data->'items','[]'))=0 then raise exception 'PURCHASE_ORDER_ITEMS_REQUIRED'; end if;
  v_freight:=coalesce((p_data->>'freightCents')::bigint,0);
  v_discount:=coalesce((p_data->>'discountCents')::bigint,0);
  if v_freight<0 or v_freight>9007199254740991 or v_discount<0 or v_discount>9007199254740991 then
    raise exception 'INVALID_MONETARY_BOUNDS';
  end if;
  v_number:=private.arteflow_next_purchase_number(p_organization_id,'PC');
  for v_item in select value from jsonb_array_elements(p_data->'items') loop
    v_qty:=(v_item->>'orderedQuantityMilli')::bigint;
    v_cost:=(v_item->>'unitCostCents')::bigint;
    if v_qty<=0 or v_qty>9007199254740991 or v_cost<0 or v_cost>9007199254740991 then raise exception 'INVALID_PURCHASE_ORDER_VALUE'; end if;
    select * into v_mat from public.arteflow_inventory_items where organization_id=p_organization_id and id=(v_item->>'materialId')::uuid and is_active;
    if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
    v_line:=round(v_qty::numeric*v_cost/1000)::bigint;
    if v_line>9007199254740991 then raise exception 'UNSAFE_MONETARY_VALUE'; end if;
    if v_subtotal+v_line>9007199254740991 then raise exception 'UNSAFE_MONETARY_VALUE'; end if;
    v_subtotal:=v_subtotal+v_line;
  end loop;
  if v_subtotal+v_freight>9007199254740991 then raise exception 'UNSAFE_MONETARY_VALUE'; end if;
  v_total:=v_subtotal+v_freight-v_discount;
  if v_total<0 or v_total>9007199254740991 then raise exception 'INVALID_PURCHASE_ORDER_TOTAL'; end if;
  insert into public.arteflow_purchase_orders(id,organization_id,order_number,supplier_id,supplier_snapshot,expected_at,freight_cents,discount_cents,subtotal_cents,total_cents,notes,created_by,actor_name)
  values(v_id,p_organization_id,v_number,v_supplier.id,jsonb_build_object('id',v_supplier.id,'code',v_supplier.code,'tradeName',v_supplier.trade_name,'corporateName',v_supplier.corporate_name,'document',v_supplier.document,'contactName',v_supplier.contact_name,'email',v_supplier.email,'phone',v_supplier.phone),nullif(p_data->>'expectedAt','')::timestamptz,v_freight,v_discount,v_subtotal,v_total,nullif(btrim(p_data->>'notes'),''),(select auth.uid()),private.arteflow_procurement_actor_name());
  for v_item in select value from jsonb_array_elements(p_data->'items') loop
    select * into v_mat from public.arteflow_inventory_items where organization_id=p_organization_id and id=(v_item->>'materialId')::uuid;
    v_qty:=(v_item->>'orderedQuantityMilli')::bigint;
    v_cost:=(v_item->>'unitCostCents')::bigint;
    v_line:=round(v_qty::numeric*v_cost/1000)::bigint;
    insert into public.arteflow_purchase_order_items(organization_id,purchase_order_id,purchase_request_item_id,inventory_item_id,material_snapshot,ordered_quantity_milli,unit,unit_cost_cents,total_cost_cents,production_job_id)
    values(p_organization_id,v_id,nullif(v_item->>'purchaseRequestItemId','')::uuid,v_mat.id,jsonb_build_object('sku',v_mat.sku,'name',v_mat.name,'unit',v_mat.unit,'averageCostCents',v_mat.average_cost_cents),v_qty,v_mat.unit,v_cost,v_line,nullif(v_item->>'productionJobId','')::uuid);
  end loop;
  for v_req in select jsonb_array_elements_text(coalesce(p_data->'purchaseRequestIds','[]')) loop
    update public.arteflow_purchase_requests set status='CONVERTED',updated_at=now() where organization_id=p_organization_id and id=v_req::uuid and status='REQUESTED';
  end loop;
  insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name)
  values(p_organization_id,'ORDER',v_id,'ORDER_CREATED','Pedido '||v_number||' criado',(select auth.uid()),private.arteflow_procurement_actor_name());
  return v_id;
end $$;

-- 6. Endurece RPCs financeiras arteflow_create_receivable, arteflow_create_payable, arteflow_settle_receivable e arteflow_settle_payable
create or replace function public.arteflow_create_receivable(p_organization_id uuid,p_description text,p_amount_cents bigint,p_due_date date,p_customer_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
  perform private.arteflow_require_finance(p_organization_id,true);
  if p_amount_cents<=0 or p_amount_cents>9007199254740991 then raise exception 'INVALID_MONETARY_BOUNDS'; end if;
  insert into public.arteflow_financial_receivables(organization_id,customer_name,description,amount_cents,due_date,created_by)
  values(p_organization_id,btrim(p_customer_name),btrim(p_description),p_amount_cents,p_due_date,(select auth.uid())) returning id into v;
  insert into public.arteflow_financial_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name)
  values(p_organization_id,'RECEIVABLE',v,'RECEIVABLE_CREATED','Conta a receber criada',(select auth.uid()),private.arteflow_finance_actor_name());
  return v;
end $$;

create or replace function public.arteflow_create_payable(p_organization_id uuid,p_description text,p_amount_cents bigint,p_due_date date,p_supplier_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
  perform private.arteflow_require_finance(p_organization_id,true);
  if p_amount_cents<=0 or p_amount_cents>9007199254740991 then raise exception 'INVALID_MONETARY_BOUNDS'; end if;
  insert into public.arteflow_financial_payables(organization_id,supplier_name,description,amount_cents,due_date,created_by)
  values(p_organization_id,btrim(p_supplier_name),btrim(p_description),p_amount_cents,p_due_date,(select auth.uid())) returning id into v;
  insert into public.arteflow_financial_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name)
  values(p_organization_id,'PAYABLE',v,'PAYABLE_CREATED','Conta a pagar criada',(select auth.uid()),private.arteflow_finance_actor_name());
  return v;
end $$;

create or replace function public.arteflow_settle_receivable(
  p_organization_id uuid, p_receivable_id uuid, p_amount_cents bigint,
  p_settled_at timestamptz, p_method text, p_notes text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  account public.arteflow_financial_receivables%rowtype;
  settlement_id uuid;
  next_status text;
  actor text;
  job record;
  payload jsonb;
begin
  perform private.arteflow_require_finance(p_organization_id,true);
  if p_amount_cents<=0 or p_amount_cents>9007199254740991 then raise exception 'INVALID_MONETARY_BOUNDS'; end if;
  payload := jsonb_build_object('targetId',p_receivable_id,'amountCents',p_amount_cents,'settledAt',p_settled_at,'method',p_method,'notes',nullif(btrim(p_notes),''));
  settlement_id := private.arteflow_idempotency_replay(p_organization_id,p_idempotency_key,'finance.settle_receivable',payload);
  if settlement_id is not null then return settlement_id; end if;

  select * into account from public.arteflow_financial_receivables
  where organization_id=p_organization_id and id=p_receivable_id for update;
  if not found then raise exception 'RECEIVABLE_NOT_FOUND'; end if;
  if account.status='CANCELED' then raise exception 'TITLE_CANCELED'; end if;
  if p_amount_cents<=0 or p_amount_cents>account.amount_cents-account.paid_amount_cents then raise exception 'PAYMENT_EXCEEDS_REMAINING'; end if;
  next_status:=case when account.paid_amount_cents+p_amount_cents=account.amount_cents then 'PAID' else 'PARTIALLY_PAID' end;
  actor:=private.arteflow_finance_actor_name();
  insert into public.arteflow_financial_settlements(organization_id,receivable_id,amount_cents,settled_at,method,notes,idempotency_key,created_by,actor_name)
  values(p_organization_id,account.id,p_amount_cents,p_settled_at,p_method,nullif(btrim(p_notes),''),p_idempotency_key,(select auth.uid()),actor)
  returning id into settlement_id;
  update public.arteflow_financial_receivables set paid_amount_cents=paid_amount_cents+p_amount_cents,status=next_status,version=version+1,updated_at=now() where id=account.id;
  insert into public.arteflow_financial_events(organization_id,entity_type,entity_id,event_type,description,metadata,actor_user_id,actor_name)
  values(p_organization_id,'RECEIVABLE',account.id,case when next_status='PAID' then 'TITLE_PAID' else 'PARTIAL_SETTLEMENT' end,'Baixa registrada',jsonb_build_object('settlementId',settlement_id,'amountCents',p_amount_cents),(select auth.uid()),actor);
  for job in select id,financial_gate from public.arteflow_production_jobs where organization_id=p_organization_id and order_id=account.order_id for update loop
    update public.arteflow_production_jobs set financial_gate=case when next_status='PAID' then 'RELEASED' else 'PAYMENT_PENDING' end,version=version+1,updated_at=now() where id=job.id;
    insert into public.arteflow_production_job_events(organization_id,job_id,actor_user_id,actor_name,event_type,from_value,to_value,description)
    values(p_organization_id,job.id,(select auth.uid()),actor,'FINANCIAL_GATE_CHANGED',job.financial_gate,case when next_status='PAID' then 'RELEASED' else 'PAYMENT_PENDING' end,'Gate financeiro atualizado pela baixa');
  end loop;
  perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'finance.settle_receivable',payload,settlement_id);
  return settlement_id;
end $$;

create or replace function public.arteflow_settle_payable(
  p_organization_id uuid, p_payable_id uuid, p_amount_cents bigint,
  p_settled_at timestamptz, p_method text, p_notes text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  account public.arteflow_financial_payables%rowtype;
  settlement_id uuid;
  next_status text;
  payload jsonb;
begin
  perform private.arteflow_require_finance(p_organization_id,true);
  if p_amount_cents<=0 or p_amount_cents>9007199254740991 then raise exception 'INVALID_MONETARY_BOUNDS'; end if;
  payload := jsonb_build_object('targetId',p_payable_id,'amountCents',p_amount_cents,'settledAt',p_settled_at,'method',p_method,'notes',nullif(btrim(p_notes),''));
  settlement_id := private.arteflow_idempotency_replay(p_organization_id,p_idempotency_key,'finance.settle_payable',payload);
  if settlement_id is not null then return settlement_id; end if;
  select * into account from public.arteflow_financial_payables where organization_id=p_organization_id and id=p_payable_id for update;
  if not found then raise exception 'PAYABLE_NOT_FOUND'; end if;
  if account.status='CANCELED' then raise exception 'TITLE_CANCELED'; end if;
  if p_amount_cents<=0 or p_amount_cents>account.amount_cents-account.paid_amount_cents then raise exception 'PAYMENT_EXCEEDS_REMAINING'; end if;
  next_status:=case when account.paid_amount_cents+p_amount_cents=account.amount_cents then 'PAID' else 'PARTIALLY_PAID' end;
  insert into public.arteflow_financial_settlements(organization_id,payable_id,amount_cents,settled_at,method,notes,idempotency_key,created_by,actor_name)
  values(p_organization_id,account.id,p_amount_cents,p_settled_at,p_method,nullif(btrim(p_notes),''),p_idempotency_key,(select auth.uid()),private.arteflow_finance_actor_name()) returning id into settlement_id;
  update public.arteflow_financial_payables set paid_amount_cents=paid_amount_cents+p_amount_cents,status=next_status,version=version+1,updated_at=now() where id=account.id;
  insert into public.arteflow_financial_events(organization_id,entity_type,entity_id,event_type,description,metadata,actor_user_id,actor_name)
  values(p_organization_id,'PAYABLE',account.id,case when next_status='PAID' then 'TITLE_PAID' else 'PARTIAL_SETTLEMENT' end,'Baixa registrada',jsonb_build_object('settlementId',settlement_id,'amountCents',p_amount_cents),(select auth.uid()),private.arteflow_finance_actor_name());
  perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'finance.settle_payable',payload,settlement_id);
  return settlement_id;
end $$;
