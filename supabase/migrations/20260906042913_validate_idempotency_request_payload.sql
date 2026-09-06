-- E9-02: bind every idempotency key to one operation and one canonical payload.
create table private.arteflow_idempotency_requests (
  organization_id uuid not null references public.organizations(id),
  idempotency_key text not null,
  operation text not null,
  canonical_payload jsonb not null,
  result_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, idempotency_key),
  constraint arteflow_idempotency_key_nonempty check (btrim(idempotency_key) <> ''),
  constraint arteflow_idempotency_operation_nonempty check (btrim(operation) <> '')
);

alter table private.arteflow_idempotency_requests enable row level security;
revoke all on table private.arteflow_idempotency_requests from public, anon, authenticated;

insert into private.arteflow_idempotency_requests
  (organization_id, idempotency_key, operation, canonical_payload, result_id, created_at)
select organization_id, idempotency_key,
  case when receivable_id is not null then 'finance.settle_receivable' else 'finance.settle_payable' end,
  jsonb_build_object(
    'targetId', coalesce(receivable_id, payable_id),
    'amountCents', amount_cents,
    'settledAt', settled_at,
    'method', method,
    'notes', notes
  ),
  id, created_at
from public.arteflow_financial_settlements
on conflict (organization_id, idempotency_key) do nothing;

insert into private.arteflow_idempotency_requests
  (organization_id, idempotency_key, operation, canonical_payload, result_id, created_at)
select organization_id, idempotency_key,
  case movement_type
    when 'CONSUMPTION' then 'inventory.consume'
    when 'REVERSAL' then 'inventory.reverse'
    when 'OPENING_BALANCE' then 'inventory.create_item'
    else 'inventory.record_movement'
  end,
  case movement_type
    when 'CONSUMPTION' then jsonb_build_object('reservationId', reservation_id)
    when 'REVERSAL' then jsonb_build_object('movementId', reversal_of_id, 'reason', reason)
    else jsonb_build_object(
      'itemId', inventory_item_id,
      'type', movement_type,
      'quantityMilli', quantity_milli,
      'reason', reason,
      'unitCostCents', unit_cost_cents,
      'totalCostCents', total_cost_cents
    )
  end,
  id, created_at
from public.arteflow_inventory_movements
where idempotency_key is not null
on conflict (organization_id, idempotency_key) do nothing;

insert into private.arteflow_idempotency_requests
  (organization_id, idempotency_key, operation, canonical_payload, result_id, created_at)
select receipt.organization_id, receipt.idempotency_key, 'procurement.receive_purchase_order',
  jsonb_build_object(
    'orderId', receipt.purchase_order_id,
    'items', coalesce(items.payload, '[]'::jsonb),
    'invoiceNumber', receipt.invoice_number,
    'notes', receipt.notes
  ),
  receipt.id, receipt.created_at
from public.arteflow_purchase_receipts receipt
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'purchaseOrderItemId', item.purchase_order_item_id,
      'quantityMilli', item.received_quantity_milli,
      'unitCostCents', item.unit_cost_cents
    ) order by item.purchase_order_item_id
  ) payload
  from public.arteflow_purchase_receipt_items item
  where item.organization_id = receipt.organization_id
    and item.purchase_receipt_id = receipt.id
) items on true
on conflict (organization_id, idempotency_key) do nothing;

create or replace function private.arteflow_idempotency_replay(
  p_organization_id uuid,
  p_idempotency_key text,
  p_operation text,
  p_canonical_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing private.arteflow_idempotency_requests%rowtype;
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0)
  );

  select * into existing
  from private.arteflow_idempotency_requests request
  where request.organization_id = p_organization_id
    and request.idempotency_key = p_idempotency_key;

  if found then
    if existing.operation is distinct from p_operation
      or existing.canonical_payload is distinct from p_canonical_payload then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    return existing.result_id;
  end if;

  return null;
end;
$$;

create or replace function private.arteflow_idempotency_complete(
  p_organization_id uuid,
  p_idempotency_key text,
  p_operation text,
  p_canonical_payload jsonb,
  p_result_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.arteflow_idempotency_requests
    (organization_id, idempotency_key, operation, canonical_payload, result_id)
  values
    (p_organization_id, p_idempotency_key, p_operation, p_canonical_payload, p_result_id);
$$;

revoke all on function private.arteflow_idempotency_replay(uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function private.arteflow_idempotency_complete(uuid,text,text,jsonb,uuid) from public, anon, authenticated;

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

create or replace function public.arteflow_record_inventory_movement(
  p_organization_id uuid,p_item_id uuid,p_type text,p_quantity_milli bigint,p_reason text,
  p_unit_cost_cents bigint default null,p_total_cost_cents bigint default null,p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  item public.arteflow_inventory_items%rowtype;
  delta bigint; new_balance bigint; movement_id uuid; reserved bigint; next_cost bigint; job_id uuid; payload jsonb;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_type not in ('RECEIPT','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT','RETURN') or p_quantity_milli<=0 or nullif(btrim(p_reason),'') is null then raise exception 'INVALID_INVENTORY_MOVEMENT'; end if;
  if p_idempotency_key is not null then
    payload:=jsonb_build_object('itemId',p_item_id,'type',p_type,'quantityMilli',p_quantity_milli,'reason',btrim(p_reason),'unitCostCents',p_unit_cost_cents,'totalCostCents',p_total_cost_cents);
    movement_id:=private.arteflow_idempotency_replay(p_organization_id,p_idempotency_key,'inventory.record_movement',payload);
    if movement_id is not null then return movement_id; end if;
  end if;
  select * into item from public.arteflow_inventory_items where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  delta:=case when p_type='NEGATIVE_ADJUSTMENT' then -p_quantity_milli else p_quantity_milli end; new_balance:=item.stock_on_hand_milli+delta;
  select coalesce(sum(reserved_quantity_milli),0) into reserved from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=p_item_id and status='ACTIVE';
  if new_balance<0 or new_balance<reserved then raise exception 'INSUFFICIENT_STOCK' using errcode='P0001'; end if;
  next_cost:=item.average_cost_cents;
  if p_type='RECEIPT' and p_unit_cost_cents is not null then
    if p_unit_cost_cents<0 then raise exception 'INVALID_COST'; end if;
    next_cost:=case when new_balance=0 then p_unit_cost_cents else round((item.stock_on_hand_milli::numeric*item.average_cost_cents + coalesce(p_total_cost_cents::numeric*1000,p_quantity_milli::numeric*p_unit_cost_cents))/new_balance::numeric)::bigint end;
  end if;
  update public.arteflow_inventory_items set stock_on_hand_milli=new_balance,average_cost_cents=next_cost,updated_at=now() where id=item.id;
  insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,unit_cost_cents,total_cost_cents,reason,idempotency_key,created_by,actor_name)
  values(p_organization_id,p_item_id,p_type,p_quantity_milli,item.stock_on_hand_milli,new_balance,p_unit_cost_cents,p_total_cost_cents,btrim(p_reason),p_idempotency_key,(select auth.uid()),private.arteflow_inventory_actor_name()) returning id into movement_id;
  for job_id in select distinct production_job_id from public.arteflow_inventory_requirements where organization_id=p_organization_id and inventory_item_id=p_item_id loop perform private.arteflow_refresh_material_gate(p_organization_id,job_id); end loop;
  if p_idempotency_key is not null then perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'inventory.record_movement',payload,movement_id); end if;
  return movement_id;
end $$;

create or replace function public.arteflow_consume_inventory(p_organization_id uuid,p_reservation_id uuid,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare reservation public.arteflow_inventory_reservations%rowtype; item public.arteflow_inventory_items%rowtype; movement_id uuid; active_quantity bigint; payload jsonb;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_idempotency_key is not null then
    payload:=jsonb_build_object('reservationId',p_reservation_id);
    movement_id:=private.arteflow_idempotency_replay(p_organization_id,p_idempotency_key,'inventory.consume',payload);
    if movement_id is not null then return movement_id; end if;
  end if;
  select * into reservation from public.arteflow_inventory_reservations where organization_id=p_organization_id and id=p_reservation_id for update;
  if not found then raise exception 'INVENTORY_RESERVATION_NOT_FOUND'; end if;
  if reservation.status<>'ACTIVE' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  select * into item from public.arteflow_inventory_items where organization_id=p_organization_id and id=reservation.inventory_item_id for update;
  select coalesce(sum(reserved_quantity_milli),0) into active_quantity from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=item.id and status='ACTIVE';
  if item.stock_on_hand_milli<reservation.reserved_quantity_milli or active_quantity>item.stock_on_hand_milli then raise exception 'INSUFFICIENT_STOCK' using errcode='P0001'; end if;
  update public.arteflow_inventory_items set stock_on_hand_milli=stock_on_hand_milli-reservation.reserved_quantity_milli,updated_at=now() where id=item.id;
  update public.arteflow_inventory_reservations set status='CONSUMED',consumed_at=now(),updated_at=now() where id=reservation.id;
  insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,production_job_id,reservation_id,reason,idempotency_key,created_by,actor_name)
  values(p_organization_id,item.id,'CONSUMPTION',reservation.reserved_quantity_milli,item.stock_on_hand_milli,item.stock_on_hand_milli-reservation.reserved_quantity_milli,reservation.production_job_id,reservation.id,'Consumo para produção da OP vinculada ('||reservation.production_job_id||')',p_idempotency_key,(select auth.uid()),private.arteflow_inventory_actor_name()) returning id into movement_id;
  perform private.arteflow_refresh_material_gate(p_organization_id,reservation.production_job_id);
  if p_idempotency_key is not null then perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'inventory.consume',payload,movement_id); end if;
  return movement_id;
end $$;

create or replace function public.arteflow_reverse_inventory_movement(p_organization_id uuid,p_movement_id uuid,p_reason text,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare original public.arteflow_inventory_movements%rowtype; item public.arteflow_inventory_items%rowtype; delta bigint; new_balance bigint; movement_id uuid; payload jsonb;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if nullif(btrim(p_reason),'') is null then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
  if p_idempotency_key is not null then
    payload:=jsonb_build_object('movementId',p_movement_id,'reason',btrim(p_reason));
    movement_id:=private.arteflow_idempotency_replay(p_organization_id,p_idempotency_key,'inventory.reverse',payload);
    if movement_id is not null then return movement_id; end if;
  end if;
  select * into original from public.arteflow_inventory_movements where organization_id=p_organization_id and id=p_movement_id;
  if not found or original.movement_type='REVERSAL' then raise exception 'MOVEMENT_NOT_REVERSIBLE'; end if;
  if exists(select 1 from public.arteflow_inventory_movements where reversal_of_id=original.id) then raise exception 'MOVEMENT_ALREADY_REVERSED'; end if;
  select * into item from public.arteflow_inventory_items where organization_id=p_organization_id and id=original.inventory_item_id for update;
  delta:=case when original.resulting_balance_milli>original.previous_balance_milli then -original.quantity_milli else original.quantity_milli end; new_balance:=item.stock_on_hand_milli+delta;
  if new_balance<0 or new_balance<coalesce((select sum(reserved_quantity_milli) from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=item.id and status='ACTIVE'),0) then raise exception 'INSUFFICIENT_STOCK'; end if;
  update public.arteflow_inventory_items set stock_on_hand_milli=new_balance,updated_at=now() where id=item.id;
  insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,reversal_of_id,reason,idempotency_key,created_by,actor_name)
  values(p_organization_id,item.id,'REVERSAL',original.quantity_milli,item.stock_on_hand_milli,new_balance,original.id,btrim(p_reason),p_idempotency_key,(select auth.uid()),private.arteflow_inventory_actor_name()) returning id into movement_id;
  if p_idempotency_key is not null then perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'inventory.reverse',payload,movement_id); end if;
  return movement_id;
end $$;

create or replace function public.arteflow_receive_purchase_order(
  p_organization_id uuid,p_order_id uuid,p_items jsonb,p_invoice_number text,p_notes text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  purchase_order public.arteflow_purchase_orders%rowtype; receipt_id uuid; receipt_number text; input_item jsonb;
  order_item public.arteflow_purchase_order_items%rowtype; quantity bigint; unit_cost bigint; movement_id uuid; next_status text;
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
    if quantity<=0 or quantity>order_item.ordered_quantity_milli-order_item.received_quantity_milli then raise exception 'ORDER_RECEIPT_EXCEEDS_REMAINING'; end if;
    unit_cost:=coalesce((input_item->>'unitCostCents')::bigint,order_item.unit_cost_cents);
    if unit_cost<0 then raise exception 'INVALID_COST'; end if;
    movement_id:=public.arteflow_record_inventory_movement(p_organization_id,order_item.inventory_item_id,'RECEIPT',quantity,'Recebimento do pedido '||purchase_order.order_number,unit_cost,round(quantity::numeric*unit_cost/1000)::bigint,p_idempotency_key||':'||order_item.id);
    update public.arteflow_inventory_movements set purchase_order_id=p_order_id,purchase_receipt_id=receipt_id,purchase_order_item_id=order_item.id where organization_id=p_organization_id and id=movement_id;
    insert into public.arteflow_purchase_receipt_items(organization_id,purchase_receipt_id,purchase_order_item_id,inventory_item_id,received_quantity_milli,unit_cost_cents,total_cost_cents,stock_movement_id)
    values(p_organization_id,receipt_id,order_item.id,order_item.inventory_item_id,quantity,unit_cost,round(quantity::numeric*unit_cost/1000)::bigint,movement_id);
    update public.arteflow_purchase_order_items set received_quantity_milli=received_quantity_milli+quantity,updated_at=now() where id=order_item.id;
  end loop;
  select case when bool_and(received_quantity_milli=ordered_quantity_milli) then 'RECEIVED' else 'PARTIALLY_RECEIVED' end into next_status from public.arteflow_purchase_order_items where organization_id=p_organization_id and purchase_order_id=p_order_id;
  update public.arteflow_purchase_orders set status=next_status,version=version+1,updated_at=now() where id=p_order_id;
  insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,metadata,actor_user_id,actor_name)
  values(p_organization_id,'RECEIPT',receipt_id,case when next_status='RECEIVED' then 'GOODS_RECEIVED' else 'ORDER_STATUS_CHANGED' end,'Recebimento '||receipt_number||' registrado',jsonb_build_object('orderId',p_order_id,'status',next_status),(select auth.uid()),private.arteflow_procurement_actor_name());
  perform private.arteflow_idempotency_complete(p_organization_id,p_idempotency_key,'procurement.receive_purchase_order',payload,receipt_id);
  return receipt_id;
end $$;
