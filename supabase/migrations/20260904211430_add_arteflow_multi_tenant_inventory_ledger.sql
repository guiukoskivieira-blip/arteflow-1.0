create table public.arteflow_inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sku text not null,
  name text not null,
  category text not null,
  unit text not null check (unit in ('UNIT','SHEET','METER','SQUARE_METER','LITER','KILOGRAM','ROLL','PACKAGE')),
  stock_on_hand_milli bigint not null default 0 check (stock_on_hand_milli >= 0),
  minimum_stock_milli bigint not null default 0 check (minimum_stock_milli >= 0),
  average_cost_cents bigint not null default 0 check (average_cost_cents >= 0),
  supplier_name text,
  idempotency_key text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  unique (organization_id, idempotency_key),
  unique (organization_id, id)
);

create table public.arteflow_inventory_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  production_job_id uuid not null,
  inventory_item_id uuid not null,
  required_quantity_milli bigint not null check (required_quantity_milli > 0),
  material_sku text not null,
  material_name text not null,
  material_unit text not null,
  material_average_cost_cents bigint not null check (material_average_cost_cents >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint arteflow_inventory_requirements_job_fk foreign key (organization_id, production_job_id)
    references public.arteflow_production_jobs(organization_id, id),
  constraint arteflow_inventory_requirements_item_fk foreign key (organization_id, inventory_item_id)
    references public.arteflow_inventory_items(organization_id, id),
  unique (organization_id, id)
);

create table public.arteflow_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  production_job_id uuid not null,
  requirement_id uuid not null,
  inventory_item_id uuid not null,
  reserved_quantity_milli bigint not null check (reserved_quantity_milli > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED','CONSUMED')),
  idempotency_key text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  consumed_at timestamptz,
  constraint arteflow_inventory_reservations_job_fk foreign key (organization_id, production_job_id)
    references public.arteflow_production_jobs(organization_id, id),
  constraint arteflow_inventory_reservations_requirement_fk foreign key (organization_id, requirement_id)
    references public.arteflow_inventory_requirements(organization_id, id),
  constraint arteflow_inventory_reservations_item_fk foreign key (organization_id, inventory_item_id)
    references public.arteflow_inventory_items(organization_id, id),
  unique (organization_id, id),
  unique (organization_id, idempotency_key)
);

create table public.arteflow_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  inventory_item_id uuid not null,
  movement_type text not null check (movement_type in ('OPENING_BALANCE','RECEIPT','CONSUMPTION','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT','RETURN','REVERSAL')),
  quantity_milli bigint not null check (quantity_milli > 0),
  previous_balance_milli bigint not null check (previous_balance_milli >= 0),
  resulting_balance_milli bigint not null check (resulting_balance_milli >= 0),
  unit_cost_cents bigint check (unit_cost_cents is null or unit_cost_cents >= 0),
  total_cost_cents bigint check (total_cost_cents is null or total_cost_cents >= 0),
  production_job_id uuid,
  reservation_id uuid,
  reversal_of_id uuid,
  reason text not null check (btrim(reason) <> ''),
  idempotency_key text,
  created_by uuid not null references auth.users(id),
  actor_name text not null,
  created_at timestamptz not null default now(),
  constraint arteflow_inventory_movements_item_fk foreign key (organization_id, inventory_item_id)
    references public.arteflow_inventory_items(organization_id, id),
  constraint arteflow_inventory_movements_job_fk foreign key (organization_id, production_job_id)
    references public.arteflow_production_jobs(organization_id, id),
  constraint arteflow_inventory_movements_reservation_fk foreign key (organization_id, reservation_id)
    references public.arteflow_inventory_reservations(organization_id, id),
  constraint arteflow_inventory_movements_reversal_fk foreign key (reversal_of_id)
    references public.arteflow_inventory_movements(id),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  unique (reversal_of_id)
);

create index arteflow_inventory_items_org_active_idx on public.arteflow_inventory_items(organization_id, is_active);
create index arteflow_inventory_requirements_job_idx on public.arteflow_inventory_requirements(organization_id, production_job_id);
create index arteflow_inventory_requirements_item_idx on public.arteflow_inventory_requirements(organization_id, inventory_item_id);
create index arteflow_inventory_reservations_job_idx on public.arteflow_inventory_reservations(organization_id, production_job_id);
create index arteflow_inventory_reservations_item_status_idx on public.arteflow_inventory_reservations(organization_id, inventory_item_id, status);
create index arteflow_inventory_movements_item_created_idx on public.arteflow_inventory_movements(organization_id, inventory_item_id, created_at desc);
create index arteflow_inventory_items_created_by_idx on public.arteflow_inventory_items(created_by);
create index arteflow_inventory_movements_created_by_idx on public.arteflow_inventory_movements(created_by);

alter table public.arteflow_inventory_items enable row level security;
alter table public.arteflow_inventory_requirements enable row level security;
alter table public.arteflow_inventory_reservations enable row level security;
alter table public.arteflow_inventory_movements enable row level security;

create policy arteflow_inventory_items_select on public.arteflow_inventory_items for select to authenticated
using (private.arteflow_has_permission(organization_id, 'arteflow.inventory.view'));
create policy arteflow_inventory_requirements_select on public.arteflow_inventory_requirements for select to authenticated
using (private.arteflow_has_permission(organization_id, 'arteflow.inventory.view'));
create policy arteflow_inventory_reservations_select on public.arteflow_inventory_reservations for select to authenticated
using (private.arteflow_has_permission(organization_id, 'arteflow.inventory.view'));
create policy arteflow_inventory_movements_select on public.arteflow_inventory_movements for select to authenticated
using (private.arteflow_has_permission(organization_id, 'arteflow.inventory.view'));

revoke all on public.arteflow_inventory_items, public.arteflow_inventory_requirements,
  public.arteflow_inventory_reservations, public.arteflow_inventory_movements from public, anon;
grant select on public.arteflow_inventory_items, public.arteflow_inventory_requirements,
  public.arteflow_inventory_reservations, public.arteflow_inventory_movements to authenticated;

create or replace function private.arteflow_inventory_actor_name()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(u.raw_user_meta_data->>'name', u.email, 'Usuário') from auth.users u where u.id=(select auth.uid());
$$;
revoke all on function private.arteflow_inventory_actor_name() from public, anon, authenticated;

create or replace function private.arteflow_require_inventory(p_organization_id uuid, p_manage boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.arteflow_has_permission(
    p_organization_id, case when p_manage then 'arteflow.inventory.manage' else 'arteflow.inventory.view' end
  ) then raise exception 'INVENTORY_%_DENIED', case when p_manage then 'MANAGE' else 'VIEW' end using errcode='42501'; end if;
end; $$;
revoke all on function private.arteflow_require_inventory(uuid,boolean) from public, anon, authenticated;

create or replace function private.arteflow_refresh_material_gate(p_organization_id uuid, p_job_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_gate text; v_old text; v_actor text;
begin
  select case
    when not exists(select 1 from public.arteflow_inventory_requirements q where q.organization_id=p_organization_id and q.production_job_id=p_job_id) then 'NOT_CHECKED'
    when not exists(
      select 1 from public.arteflow_inventory_requirements q
      where q.organization_id=p_organization_id and q.production_job_id=p_job_id
      and coalesce((select sum(r.reserved_quantity_milli) from public.arteflow_inventory_reservations r
        where r.organization_id=q.organization_id and r.requirement_id=q.id and r.status in ('ACTIVE','CONSUMED')),0) < q.required_quantity_milli
    ) then 'RESERVED'
    when exists(
      select 1 from public.arteflow_inventory_requirements q join public.arteflow_inventory_items i on i.id=q.inventory_item_id and i.organization_id=q.organization_id
      where q.organization_id=p_organization_id and q.production_job_id=p_job_id and (
        not i.is_active or i.stock_on_hand_milli - coalesce((select sum(r.reserved_quantity_milli) from public.arteflow_inventory_reservations r
          where r.organization_id=i.organization_id and r.inventory_item_id=i.id and r.status='ACTIVE'),0) <
        q.required_quantity_milli - coalesce((select sum(r2.reserved_quantity_milli) from public.arteflow_inventory_reservations r2
          where r2.organization_id=q.organization_id and r2.requirement_id=q.id and r2.status in ('ACTIVE','CONSUMED')),0)
      )
    ) then 'MISSING' else 'AVAILABLE' end into v_gate;
  select material_gate into v_old from public.arteflow_production_jobs where organization_id=p_organization_id and id=p_job_id for update;
  if found and v_old<>v_gate then
    update public.arteflow_production_jobs set material_gate=v_gate,version=version+1,updated_at=now() where organization_id=p_organization_id and id=p_job_id;
    v_actor:=coalesce(private.arteflow_inventory_actor_name(),'ArteFlow Engine');
    insert into public.arteflow_production_job_events(organization_id,job_id,actor_user_id,actor_name,event_type,from_value,to_value,description,metadata)
    values(p_organization_id,p_job_id,(select auth.uid()),v_actor,'MATERIAL_GATE_CHANGED',v_old,v_gate,'Gate de Material atualizado automaticamente para '||v_gate,jsonb_build_object('source','inventory'));
  end if;
end; $$;
revoke all on function private.arteflow_refresh_material_gate(uuid,uuid) from public, anon, authenticated;

create or replace function public.arteflow_create_inventory_item(
  p_organization_id uuid,p_sku text,p_name text,p_category text,p_unit text,p_initial_stock_milli bigint,
  p_minimum_stock_milli bigint,p_unit_cost_cents bigint default 0,p_supplier_name text default null,p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_actor text;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if nullif(btrim(p_sku),'') is null or nullif(btrim(p_name),'') is null then raise exception 'INVENTORY_REQUIRED_FIELDS'; end if;
  if p_unit not in ('UNIT','SHEET','METER','SQUARE_METER','LITER','KILOGRAM','ROLL','PACKAGE') then raise exception 'INVALID_INVENTORY_UNIT'; end if;
  if p_initial_stock_milli<0 or p_minimum_stock_milli<0 or p_unit_cost_cents<0 then raise exception 'INVALID_INVENTORY_VALUE'; end if;
  if p_idempotency_key is not null then select id into v_id from public.arteflow_inventory_items where organization_id=p_organization_id and idempotency_key=p_idempotency_key; if found then return v_id; end if; end if;
  insert into public.arteflow_inventory_items(organization_id,sku,name,category,unit,stock_on_hand_milli,minimum_stock_milli,average_cost_cents,supplier_name,idempotency_key,created_by)
  values(p_organization_id,upper(btrim(p_sku)),btrim(p_name),coalesce(nullif(btrim(p_category),''),'Outros Insumos'),p_unit,p_initial_stock_milli,p_minimum_stock_milli,p_unit_cost_cents,nullif(btrim(p_supplier_name),''),p_idempotency_key,(select auth.uid())) returning id into v_id;
  if p_initial_stock_milli>0 then
    v_actor:=private.arteflow_inventory_actor_name();
    insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,unit_cost_cents,total_cost_cents,reason,idempotency_key,created_by,actor_name)
    values(p_organization_id,v_id,'OPENING_BALANCE',p_initial_stock_milli,0,p_initial_stock_milli,nullif(p_unit_cost_cents,0),case when p_unit_cost_cents>0 then round(p_initial_stock_milli*p_unit_cost_cents/1000.0)::bigint end,'Saldo inicial de cadastro de material',p_idempotency_key,(select auth.uid()),v_actor);
  end if;
  return v_id;
exception when unique_violation then raise exception 'INVENTORY_SKU_OR_IDEMPOTENCY_DUPLICATE' using errcode='23505';
end; $$;

create or replace function public.arteflow_update_inventory_item(p_organization_id uuid,p_item_id uuid,p_sku text,p_name text,p_category text,p_unit text,p_minimum_stock_milli bigint,p_supplier_name text,p_is_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_minimum_stock_milli<0 then raise exception 'INVALID_INVENTORY_VALUE'; end if;
  update public.arteflow_inventory_items set sku=upper(btrim(p_sku)),name=btrim(p_name),category=btrim(p_category),unit=p_unit,minimum_stock_milli=p_minimum_stock_milli,supplier_name=nullif(btrim(p_supplier_name),''),is_active=p_is_active,updated_at=now()
  where organization_id=p_organization_id and id=p_item_id;
  if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if; return p_item_id;
exception when unique_violation then raise exception 'INVENTORY_SKU_DUPLICATE' using errcode='23505'; end; $$;

create or replace function public.arteflow_record_inventory_movement(p_organization_id uuid,p_item_id uuid,p_type text,p_quantity_milli bigint,p_reason text,p_unit_cost_cents bigint default null,p_total_cost_cents bigint default null,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_item public.arteflow_inventory_items%rowtype; v_delta bigint; v_new bigint; v_id uuid; v_reserved bigint; v_cost bigint; v_job uuid;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_type not in ('RECEIPT','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT','RETURN') or p_quantity_milli<=0 or nullif(btrim(p_reason),'') is null then raise exception 'INVALID_INVENTORY_MOVEMENT'; end if;
  if p_idempotency_key is not null then select id into v_id from public.arteflow_inventory_movements where organization_id=p_organization_id and idempotency_key=p_idempotency_key; if found then return v_id; end if; end if;
  select * into v_item from public.arteflow_inventory_items where organization_id=p_organization_id and id=p_item_id for update;
  if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  v_delta:=case when p_type='NEGATIVE_ADJUSTMENT' then -p_quantity_milli else p_quantity_milli end; v_new:=v_item.stock_on_hand_milli+v_delta;
  select coalesce(sum(reserved_quantity_milli),0) into v_reserved from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=p_item_id and status='ACTIVE';
  if v_new<0 or v_new<v_reserved then raise exception 'INSUFFICIENT_STOCK' using errcode='P0001'; end if;
  v_cost:=v_item.average_cost_cents;
  if p_type='RECEIPT' and p_unit_cost_cents is not null then
    if p_unit_cost_cents<0 then raise exception 'INVALID_COST'; end if;
    v_cost:=case when v_new=0 then p_unit_cost_cents else round((v_item.stock_on_hand_milli::numeric*v_item.average_cost_cents + coalesce(p_total_cost_cents::numeric*1000,p_quantity_milli::numeric*p_unit_cost_cents))/v_new::numeric)::bigint end;
  end if;
  update public.arteflow_inventory_items set stock_on_hand_milli=v_new,average_cost_cents=v_cost,updated_at=now() where id=v_item.id;
  insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,unit_cost_cents,total_cost_cents,reason,idempotency_key,created_by,actor_name)
  values(p_organization_id,p_item_id,p_type,p_quantity_milli,v_item.stock_on_hand_milli,v_new,p_unit_cost_cents,p_total_cost_cents,btrim(p_reason),p_idempotency_key,(select auth.uid()),private.arteflow_inventory_actor_name()) returning id into v_id;
  for v_job in select distinct production_job_id from public.arteflow_inventory_requirements where organization_id=p_organization_id and inventory_item_id=p_item_id loop perform private.arteflow_refresh_material_gate(p_organization_id,v_job); end loop;
  return v_id;
end; $$;

create or replace function public.arteflow_add_inventory_requirement(p_organization_id uuid,p_job_id uuid,p_item_id uuid,p_quantity_milli bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_item public.arteflow_inventory_items%rowtype; v_id uuid;
begin
  perform private.arteflow_require_inventory(p_organization_id,true); if p_quantity_milli<=0 then raise exception 'INVALID_QUANTITY'; end if;
  if not exists(select 1 from public.arteflow_production_jobs where organization_id=p_organization_id and id=p_job_id) then raise exception 'PRODUCTION_JOB_NOT_FOUND'; end if;
  select * into v_item from public.arteflow_inventory_items where organization_id=p_organization_id and id=p_item_id; if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  insert into public.arteflow_inventory_requirements(organization_id,production_job_id,inventory_item_id,required_quantity_milli,material_sku,material_name,material_unit,material_average_cost_cents,created_by)
  values(p_organization_id,p_job_id,p_item_id,p_quantity_milli,v_item.sku,v_item.name,v_item.unit,v_item.average_cost_cents,(select auth.uid())) returning id into v_id;
  perform private.arteflow_refresh_material_gate(p_organization_id,p_job_id); return v_id;
end; $$;

create or replace function public.arteflow_reserve_inventory(p_organization_id uuid,p_requirement_id uuid,p_quantity_milli bigint,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_req public.arteflow_inventory_requirements%rowtype; v_item public.arteflow_inventory_items%rowtype; v_reserved bigint; v_fulfilled bigint; v_id uuid;
begin
  perform private.arteflow_require_inventory(p_organization_id,true); if p_quantity_milli<=0 then raise exception 'INVALID_QUANTITY'; end if;
  if p_idempotency_key is not null then select id into v_id from public.arteflow_inventory_reservations where organization_id=p_organization_id and idempotency_key=p_idempotency_key; if found then return v_id; end if; end if;
  select * into v_req from public.arteflow_inventory_requirements where organization_id=p_organization_id and id=p_requirement_id; if not found then raise exception 'INVENTORY_REQUIREMENT_NOT_FOUND'; end if;
  select * into v_item from public.arteflow_inventory_items where organization_id=p_organization_id and id=v_req.inventory_item_id for update; if not found or not v_item.is_active then raise exception 'INVENTORY_ITEM_UNAVAILABLE'; end if;
  select coalesce(sum(reserved_quantity_milli),0) into v_reserved from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=v_item.id and status='ACTIVE';
  select coalesce(sum(reserved_quantity_milli),0) into v_fulfilled from public.arteflow_inventory_reservations where organization_id=p_organization_id and requirement_id=v_req.id and status in ('ACTIVE','CONSUMED');
  if p_quantity_milli>v_req.required_quantity_milli-v_fulfilled then raise exception 'REQUIREMENT_EXCEEDED'; end if;
  if p_quantity_milli>v_item.stock_on_hand_milli-v_reserved then raise exception 'INSUFFICIENT_STOCK' using errcode='P0001'; end if;
  insert into public.arteflow_inventory_reservations(organization_id,production_job_id,requirement_id,inventory_item_id,reserved_quantity_milli,idempotency_key,created_by)
  values(p_organization_id,v_req.production_job_id,v_req.id,v_item.id,p_quantity_milli,p_idempotency_key,(select auth.uid())) returning id into v_id;
  perform private.arteflow_refresh_material_gate(p_organization_id,v_req.production_job_id); return v_id;
end; $$;

create or replace function public.arteflow_release_inventory_reservation(p_organization_id uuid,p_reservation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_res public.arteflow_inventory_reservations%rowtype;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  select * into v_res from public.arteflow_inventory_reservations where organization_id=p_organization_id and id=p_reservation_id for update;
  if not found then raise exception 'INVENTORY_RESERVATION_NOT_FOUND'; end if; if v_res.status<>'ACTIVE' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  update public.arteflow_inventory_reservations set status='RELEASED',released_at=now(),updated_at=now() where id=v_res.id;
  perform private.arteflow_refresh_material_gate(p_organization_id,v_res.production_job_id); return v_res.id;
end; $$;

create or replace function public.arteflow_consume_inventory(p_organization_id uuid,p_reservation_id uuid,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_res public.arteflow_inventory_reservations%rowtype; v_item public.arteflow_inventory_items%rowtype; v_id uuid; v_active bigint;
begin
  perform private.arteflow_require_inventory(p_organization_id,true);
  if p_idempotency_key is not null then select id into v_id from public.arteflow_inventory_movements where organization_id=p_organization_id and idempotency_key=p_idempotency_key; if found then return v_id; end if; end if;
  select * into v_res from public.arteflow_inventory_reservations where organization_id=p_organization_id and id=p_reservation_id for update; if not found then raise exception 'INVENTORY_RESERVATION_NOT_FOUND'; end if; if v_res.status<>'ACTIVE' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  select * into v_item from public.arteflow_inventory_items where organization_id=p_organization_id and id=v_res.inventory_item_id for update;
  select coalesce(sum(reserved_quantity_milli),0) into v_active from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=v_item.id and status='ACTIVE';
  if v_item.stock_on_hand_milli<v_res.reserved_quantity_milli or v_active>v_item.stock_on_hand_milli then raise exception 'INSUFFICIENT_STOCK' using errcode='P0001'; end if;
  update public.arteflow_inventory_items set stock_on_hand_milli=stock_on_hand_milli-v_res.reserved_quantity_milli,updated_at=now() where id=v_item.id;
  update public.arteflow_inventory_reservations set status='CONSUMED',consumed_at=now(),updated_at=now() where id=v_res.id;
  insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,production_job_id,reservation_id,reason,idempotency_key,created_by,actor_name)
  values(p_organization_id,v_item.id,'CONSUMPTION',v_res.reserved_quantity_milli,v_item.stock_on_hand_milli,v_item.stock_on_hand_milli-v_res.reserved_quantity_milli,v_res.production_job_id,v_res.id,'Consumo para produção da OP vinculada ('||v_res.production_job_id||')',p_idempotency_key,(select auth.uid()),private.arteflow_inventory_actor_name()) returning id into v_id;
  perform private.arteflow_refresh_material_gate(p_organization_id,v_res.production_job_id); return v_id;
end; $$;

create or replace function public.arteflow_reverse_inventory_movement(p_organization_id uuid,p_movement_id uuid,p_reason text,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_mov public.arteflow_inventory_movements%rowtype; v_item public.arteflow_inventory_items%rowtype; v_delta bigint; v_new bigint; v_id uuid;
begin
  perform private.arteflow_require_inventory(p_organization_id,true); if nullif(btrim(p_reason),'') is null then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
  select * into v_mov from public.arteflow_inventory_movements where organization_id=p_organization_id and id=p_movement_id; if not found or v_mov.movement_type='REVERSAL' then raise exception 'MOVEMENT_NOT_REVERSIBLE'; end if;
  if exists(select 1 from public.arteflow_inventory_movements where reversal_of_id=v_mov.id) then raise exception 'MOVEMENT_ALREADY_REVERSED'; end if;
  select * into v_item from public.arteflow_inventory_items where organization_id=p_organization_id and id=v_mov.inventory_item_id for update;
  v_delta:=case when v_mov.resulting_balance_milli>v_mov.previous_balance_milli then -v_mov.quantity_milli else v_mov.quantity_milli end; v_new:=v_item.stock_on_hand_milli+v_delta;
  if v_new<0 or v_new<coalesce((select sum(reserved_quantity_milli) from public.arteflow_inventory_reservations where organization_id=p_organization_id and inventory_item_id=v_item.id and status='ACTIVE'),0) then raise exception 'INSUFFICIENT_STOCK'; end if;
  update public.arteflow_inventory_items set stock_on_hand_milli=v_new,updated_at=now() where id=v_item.id;
  insert into public.arteflow_inventory_movements(organization_id,inventory_item_id,movement_type,quantity_milli,previous_balance_milli,resulting_balance_milli,reversal_of_id,reason,idempotency_key,created_by,actor_name)
  values(p_organization_id,v_item.id,'REVERSAL',v_mov.quantity_milli,v_item.stock_on_hand_milli,v_new,v_mov.id,btrim(p_reason),p_idempotency_key,(select auth.uid()),private.arteflow_inventory_actor_name()) returning id into v_id; return v_id;
end; $$;

revoke all on function public.arteflow_create_inventory_item(uuid,text,text,text,text,bigint,bigint,bigint,text,text) from public, anon;
revoke all on function public.arteflow_update_inventory_item(uuid,uuid,text,text,text,text,bigint,text,boolean) from public, anon;
revoke all on function public.arteflow_record_inventory_movement(uuid,uuid,text,bigint,text,bigint,bigint,text) from public, anon;
revoke all on function public.arteflow_add_inventory_requirement(uuid,uuid,uuid,bigint) from public, anon;
revoke all on function public.arteflow_reserve_inventory(uuid,uuid,bigint,text) from public, anon;
revoke all on function public.arteflow_release_inventory_reservation(uuid,uuid) from public, anon;
revoke all on function public.arteflow_consume_inventory(uuid,uuid,text) from public, anon;
revoke all on function public.arteflow_reverse_inventory_movement(uuid,uuid,text,text) from public, anon;
grant execute on function public.arteflow_create_inventory_item(uuid,text,text,text,text,bigint,bigint,bigint,text,text) to authenticated;
grant execute on function public.arteflow_update_inventory_item(uuid,uuid,text,text,text,text,bigint,text,boolean) to authenticated;
grant execute on function public.arteflow_record_inventory_movement(uuid,uuid,text,bigint,text,bigint,bigint,text) to authenticated;
grant execute on function public.arteflow_add_inventory_requirement(uuid,uuid,uuid,bigint) to authenticated;
grant execute on function public.arteflow_reserve_inventory(uuid,uuid,bigint,text) to authenticated;
grant execute on function public.arteflow_release_inventory_reservation(uuid,uuid) to authenticated;
grant execute on function public.arteflow_consume_inventory(uuid,uuid,text) to authenticated;
grant execute on function public.arteflow_reverse_inventory_movement(uuid,uuid,text,text) to authenticated;
