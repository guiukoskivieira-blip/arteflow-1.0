-- Migration: enforce strict safe quantity milli bounds across inventory, procurement and production
-- Ensures 0 <= *_quantity_milli <= 9007199254740991 (Number.MAX_SAFE_INTEGER)

-- 1. Constraints nas tabelas de Inventário / Estoque
alter table public.arteflow_inventory_items
  drop constraint if exists arteflow_inventory_items_stock_on_hand_milli_check;

alter table public.arteflow_inventory_items
  add constraint arteflow_inventory_items_stock_on_hand_milli_check
  check (stock_on_hand_milli >= 0 and stock_on_hand_milli <= 9007199254740991);

alter table public.arteflow_inventory_items
  drop constraint if exists arteflow_inventory_items_minimum_stock_milli_check;

alter table public.arteflow_inventory_items
  add constraint arteflow_inventory_items_minimum_stock_milli_check
  check (minimum_stock_milli >= 0 and minimum_stock_milli <= 9007199254740991);

alter table public.arteflow_inventory_requirements
  drop constraint if exists arteflow_inventory_requirements_required_quantity_milli_check;

alter table public.arteflow_inventory_requirements
  add constraint arteflow_inventory_requirements_required_quantity_milli_check
  check (required_quantity_milli > 0 and required_quantity_milli <= 9007199254740991);

alter table public.arteflow_inventory_reservations
  drop constraint if exists arteflow_inventory_reservations_reserved_quantity_milli_check;

alter table public.arteflow_inventory_reservations
  add constraint arteflow_inventory_reservations_reserved_quantity_milli_check
  check (reserved_quantity_milli > 0 and reserved_quantity_milli <= 9007199254740991);

alter table public.arteflow_inventory_movements
  drop constraint if exists arteflow_inventory_movements_quantity_milli_check;

alter table public.arteflow_inventory_movements
  add constraint arteflow_inventory_movements_quantity_milli_check
  check (quantity_milli > 0 and quantity_milli <= 9007199254740991);

alter table public.arteflow_inventory_movements
  drop constraint if exists arteflow_inventory_movements_previous_balance_milli_check;

alter table public.arteflow_inventory_movements
  add constraint arteflow_inventory_movements_previous_balance_milli_check
  check (previous_balance_milli >= 0 and previous_balance_milli <= 9007199254740991);

alter table public.arteflow_inventory_movements
  drop constraint if exists arteflow_inventory_movements_resulting_balance_milli_check;

alter table public.arteflow_inventory_movements
  add constraint arteflow_inventory_movements_resulting_balance_milli_check
  check (resulting_balance_milli >= 0 and resulting_balance_milli <= 9007199254740991);

-- 2. Endurece RPCs de Requisitos e Reservas de Estoque
create or replace function public.arteflow_add_inventory_requirement(
  p_organization_id uuid,p_job_id uuid,p_item_id uuid,p_quantity_milli bigint
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_item public.arteflow_inventory_items%rowtype; v_id uuid;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_quantity_milli<=0 or p_quantity_milli>9007199254740991 then raise exception 'INVALID_QUANTITY'; end if;
  if not exists(select 1 from public.arteflow_production_jobs where organization_id=p_organization_id and id=p_job_id) then raise exception 'PRODUCTION_JOB_NOT_FOUND'; end if;
  select * into v_item from public.arteflow_inventory_items where organization_id=p_organization_id and id=p_item_id;
  if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  insert into public.arteflow_inventory_requirements(organization_id,production_job_id,inventory_item_id,required_quantity_milli,material_sku,material_name,material_unit,material_average_cost_cents,created_by)
  values(p_organization_id,p_job_id,p_item_id,p_quantity_milli,v_item.sku,v_item.name,v_item.unit,v_item.average_cost_cents,(select auth.uid())) returning id into v_id;
  perform private.arteflow_refresh_material_gate(p_organization_id,p_job_id);
  return v_id;
end; $$;

create or replace function public.arteflow_reserve_inventory(
  p_organization_id uuid,p_requirement_id uuid,p_quantity_milli bigint,p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_req public.arteflow_inventory_requirements%rowtype;
  v_item public.arteflow_inventory_items%rowtype;
  v_reserved bigint; v_fulfilled bigint; v_id uuid;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_quantity_milli<=0 or p_quantity_milli>9007199254740991 then raise exception 'INVALID_QUANTITY'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.arteflow_inventory_reservations
    where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
    if found then return v_id; end if;
  end if;
  select * into v_req from public.arteflow_inventory_requirements where organization_id=p_organization_id and id=p_requirement_id;
  if not found then raise exception 'INVENTORY_REQUIREMENT_NOT_FOUND'; end if;
  select * into v_item from public.arteflow_inventory_items where organization_id=p_organization_id and id=v_req.inventory_item_id for update;
  if not found or not v_item.is_active then raise exception 'INVENTORY_ITEM_UNAVAILABLE'; end if;
  select coalesce(sum(reserved_quantity_milli),0) into v_reserved from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=v_item.id and status='ACTIVE';
  select coalesce(sum(reserved_quantity_milli),0) into v_fulfilled from public.arteflow_inventory_reservations where organization_id=p_organization_id and requirement_id=v_req.id and status in ('ACTIVE','CONSUMED');
  if p_quantity_milli>v_req.required_quantity_milli-v_fulfilled then raise exception 'REQUIREMENT_EXCEEDED'; end if;
  if p_quantity_milli>v_item.stock_on_hand_milli-v_reserved then raise exception 'INSUFFICIENT_STOCK' using errcode='P0001'; end if;
  insert into public.arteflow_inventory_reservations(organization_id,production_job_id,requirement_id,inventory_item_id,reserved_quantity_milli,idempotency_key,created_by)
  values(p_organization_id,v_req.production_job_id,v_req.id,v_item.id,p_quantity_milli,p_idempotency_key,(select auth.uid())) returning id into v_id;
  perform private.arteflow_refresh_material_gate(p_organization_id,v_req.production_job_id);
  return v_id;
end; $$;

-- 3. Endurece RPC de Solicitação de Compras
create or replace function public.arteflow_create_purchase_request(
  p_organization_id uuid,p_data jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid:=gen_random_uuid(); v_number text; v_item jsonb;
  v_mat public.arteflow_inventory_items%rowtype; v_qty bigint;
begin
  perform private.arteflow_require_procurement(p_organization_id,true);
  if jsonb_array_length(coalesce(p_data->'items','[]'))=0 then raise exception 'PURCHASE_REQUEST_ITEMS_REQUIRED'; end if;
  v_number:=private.arteflow_next_purchase_number(p_organization_id,'SC');
  insert into public.arteflow_purchase_requests(id,organization_id,request_number,status,source,production_job_id,job_code,notes,requested_by,requested_by_name)
  values(v_id,p_organization_id,v_number,'REQUESTED',p_data->>'source',nullif(p_data->>'productionJobId','')::uuid,nullif(p_data->>'jobCode',''),nullif(btrim(p_data->>'notes'),''),(select auth.uid()),private.arteflow_procurement_actor_name());
  for v_item in select value from jsonb_array_elements(p_data->'items') loop
    v_qty:=(v_item->>'requestedQuantityMilli')::bigint;
    if v_qty<=0 or v_qty>9007199254740991 then raise exception 'INVALID_QUANTITY'; end if;
    select * into v_mat from public.arteflow_inventory_items where organization_id=p_organization_id and id=(v_item->>'materialId')::uuid and is_active;
    if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
    insert into public.arteflow_purchase_request_items(organization_id,purchase_request_id,inventory_item_id,material_sku,material_name,material_unit,material_average_cost_cents,requested_quantity_milli,reason,production_job_id)
    values(p_organization_id,v_id,v_mat.id,v_mat.sku,v_mat.name,v_mat.unit,v_mat.average_cost_cents,v_qty,coalesce(nullif(btrim(v_item->>'reason'),''),'Necessidade de compra'),coalesce(nullif(v_item->>'productionJobId','')::uuid,nullif(p_data->>'productionJobId','')::uuid));
  end loop;
  insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name)
  values(p_organization_id,'REQUEST',v_id,'REQUEST_CREATED','Solicitação '||v_number||' criada',(select auth.uid()),private.arteflow_procurement_actor_name());
  return v_id;
end $$;
