create table public.arteflow_suppliers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  code text not null, trade_name text not null, corporate_name text, document text, contact_name text,
  email text, phone text, address text, default_lead_time_days integer, payment_terms_snapshot text, notes text,
  is_active boolean not null default true, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,code), unique(organization_id,document)
);
create table public.arteflow_purchase_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  request_number text not null, status text not null check(status in('DRAFT','REQUESTED','CONVERTED','CANCELLED')),
  source text not null check(source in('MANUAL','MINIMUM_STOCK','PRODUCTION_SHORTAGE')), production_job_id uuid,
  job_code text, notes text, cancellation_reason text, requested_by uuid not null references auth.users(id),
  requested_by_name text not null, requested_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,request_number),
  foreign key(organization_id,production_job_id) references public.arteflow_production_jobs(organization_id,id)
);
create table public.arteflow_purchase_request_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, purchase_request_id uuid not null,
  inventory_item_id uuid not null, material_sku text not null, material_name text not null, material_unit text not null,
  material_average_cost_cents bigint not null check(material_average_cost_cents between 0 and 9007199254740991),
  requested_quantity_milli bigint not null check(requested_quantity_milli between 1 and 9007199254740991), reason text not null,
  production_job_id uuid, created_at timestamptz not null default now(), unique(organization_id,id),
  foreign key(organization_id,purchase_request_id) references public.arteflow_purchase_requests(organization_id,id),
  foreign key(organization_id,inventory_item_id) references public.arteflow_inventory_items(organization_id,id),
  foreign key(organization_id,production_job_id) references public.arteflow_production_jobs(organization_id,id)
);
create table public.arteflow_purchase_order_sequences (
  organization_id uuid not null references public.organizations(id), prefix text not null check(prefix in('SC','PC','REC')),
  sequence_year integer not null check(sequence_year between 2000 and 9999), next_value bigint not null default 1 check(next_value>0),
  primary key(organization_id,prefix,sequence_year)
);
create table public.arteflow_purchase_orders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  order_number text not null, supplier_id uuid not null, supplier_snapshot jsonb not null, status text not null default 'DRAFT'
    check(status in('DRAFT','ISSUED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  expected_at timestamptz, freight_cents bigint not null default 0 check(freight_cents between 0 and 9007199254740991),
  discount_cents bigint not null default 0 check(discount_cents between 0 and 9007199254740991),
  subtotal_cents bigint not null check(subtotal_cents between 0 and 9007199254740991),
  total_cents bigint not null check(total_cents between 0 and 9007199254740991), notes text, cancellation_reason text,
  issued_at timestamptz, created_by uuid not null references auth.users(id), actor_name text not null,
  version integer not null default 1 check(version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,order_number),
  foreign key(organization_id,supplier_id) references public.arteflow_suppliers(organization_id,id)
);
create table public.arteflow_purchase_order_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, purchase_order_id uuid not null,
  purchase_request_item_id uuid, inventory_item_id uuid not null, material_snapshot jsonb not null,
  ordered_quantity_milli bigint not null check(ordered_quantity_milli between 1 and 9007199254740991),
  received_quantity_milli bigint not null default 0 check(received_quantity_milli>=0 and received_quantity_milli<=ordered_quantity_milli),
  unit text not null, unit_cost_cents bigint not null check(unit_cost_cents between 0 and 9007199254740991),
  total_cost_cents bigint not null check(total_cost_cents between 0 and 9007199254740991), production_job_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id),
  foreign key(organization_id,purchase_order_id) references public.arteflow_purchase_orders(organization_id,id),
  foreign key(organization_id,purchase_request_item_id) references public.arteflow_purchase_request_items(organization_id,id),
  foreign key(organization_id,inventory_item_id) references public.arteflow_inventory_items(organization_id,id),
  foreign key(organization_id,production_job_id) references public.arteflow_production_jobs(organization_id,id)
);
create table public.arteflow_purchase_receipts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, purchase_order_id uuid not null,
  receipt_number text not null, supplier_snapshot jsonb not null, invoice_number text, received_at timestamptz not null default now(),
  received_by uuid not null references auth.users(id), received_by_name text not null, notes text, idempotency_key text not null,
  created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,receipt_number), unique(organization_id,idempotency_key),
  foreign key(organization_id,purchase_order_id) references public.arteflow_purchase_orders(organization_id,id)
);
create table public.arteflow_purchase_receipt_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, purchase_receipt_id uuid not null,
  purchase_order_item_id uuid not null, inventory_item_id uuid not null,
  received_quantity_milli bigint not null check(received_quantity_milli between 1 and 9007199254740991),
  unit_cost_cents bigint not null check(unit_cost_cents between 0 and 9007199254740991),
  total_cost_cents bigint not null check(total_cost_cents between 0 and 9007199254740991), stock_movement_id uuid not null,
  created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,purchase_receipt_id,purchase_order_item_id),
  foreign key(organization_id,purchase_receipt_id) references public.arteflow_purchase_receipts(organization_id,id),
  foreign key(organization_id,purchase_order_item_id) references public.arteflow_purchase_order_items(organization_id,id),
  foreign key(organization_id,inventory_item_id) references public.arteflow_inventory_items(organization_id,id),
  foreign key(organization_id,stock_movement_id) references public.arteflow_inventory_movements(organization_id,id)
);
create table public.arteflow_purchase_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  entity_type text not null check(entity_type in('SUPPLIER','REQUEST','ORDER','RECEIPT')), entity_id uuid not null,
  event_type text not null, description text not null, metadata jsonb, actor_user_id uuid not null references auth.users(id),
  actor_name text not null, created_at timestamptz not null default now(), unique(organization_id,id)
);

alter table public.arteflow_inventory_movements add column purchase_order_id uuid;
alter table public.arteflow_inventory_movements add column purchase_receipt_id uuid;
alter table public.arteflow_inventory_movements add column purchase_order_item_id uuid;
alter table public.arteflow_inventory_movements add constraint arteflow_inventory_movements_purchase_order_fk foreign key(organization_id,purchase_order_id) references public.arteflow_purchase_orders(organization_id,id);
alter table public.arteflow_inventory_movements add constraint arteflow_inventory_movements_purchase_receipt_fk foreign key(organization_id,purchase_receipt_id) references public.arteflow_purchase_receipts(organization_id,id);
alter table public.arteflow_inventory_movements add constraint arteflow_inventory_movements_purchase_order_item_fk foreign key(organization_id,purchase_order_item_id) references public.arteflow_purchase_order_items(organization_id,id);

create index arteflow_suppliers_org_active_idx on public.arteflow_suppliers(organization_id,is_active);
create index arteflow_purchase_requests_org_status_idx on public.arteflow_purchase_requests(organization_id,status);
create index arteflow_purchase_request_items_request_idx on public.arteflow_purchase_request_items(organization_id,purchase_request_id);
create index arteflow_purchase_orders_org_status_idx on public.arteflow_purchase_orders(organization_id,status,created_at desc);
create index arteflow_purchase_orders_supplier_idx on public.arteflow_purchase_orders(organization_id,supplier_id);
create index arteflow_purchase_order_items_order_idx on public.arteflow_purchase_order_items(organization_id,purchase_order_id);
create index arteflow_purchase_receipts_order_idx on public.arteflow_purchase_receipts(organization_id,purchase_order_id);
create index arteflow_purchase_receipt_items_receipt_idx on public.arteflow_purchase_receipt_items(organization_id,purchase_receipt_id);
create index arteflow_purchase_events_entity_idx on public.arteflow_purchase_events(organization_id,entity_type,entity_id,created_at);

do $$ declare t text; begin foreach t in array array['arteflow_suppliers','arteflow_purchase_requests','arteflow_purchase_request_items','arteflow_purchase_order_sequences','arteflow_purchase_orders','arteflow_purchase_order_items','arteflow_purchase_receipts','arteflow_purchase_receipt_items','arteflow_purchase_events'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['arteflow_suppliers','arteflow_purchase_requests','arteflow_purchase_request_items','arteflow_purchase_orders','arteflow_purchase_order_items','arteflow_purchase_receipts','arteflow_purchase_receipt_items','arteflow_purchase_events'] loop execute format('create policy %I on public.%I for select to authenticated using (private.arteflow_has_permission(organization_id,''arteflow.procurement.view''))',t||'_select',t); execute format('revoke all on public.%I from public,anon,authenticated',t); execute format('grant select on public.%I to authenticated',t); end loop; end $$;
revoke all on public.arteflow_purchase_order_sequences from public,anon,authenticated;

create or replace function private.arteflow_require_procurement(p_organization_id uuid,p_manage boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin if (select auth.uid()) is null or not private.arteflow_has_permission(p_organization_id,case when p_manage then 'arteflow.procurement.manage' else 'arteflow.procurement.view' end) then raise exception 'PROCUREMENT_%_DENIED',case when p_manage then 'MANAGE' else 'VIEW' end using errcode='42501'; end if; end $$;
revoke all on function private.arteflow_require_procurement(uuid,boolean) from public,anon,authenticated;
create or replace function private.arteflow_procurement_actor_name() returns text language sql stable security definer set search_path='' as $$ select coalesce(u.raw_user_meta_data->>'name',u.email,'Usuário') from auth.users u where u.id=(select auth.uid()) $$;
revoke all on function private.arteflow_procurement_actor_name() from public,anon,authenticated;
create or replace function private.arteflow_next_purchase_number(p_org uuid,p_prefix text) returns text language plpgsql security definer set search_path='' as $$
declare y int:=extract(year from now()); n bigint; begin insert into public.arteflow_purchase_order_sequences(organization_id,prefix,sequence_year,next_value) values(p_org,p_prefix,y,2) on conflict(organization_id,prefix,sequence_year) do update set next_value=public.arteflow_purchase_order_sequences.next_value+1 returning next_value-1 into n; return p_prefix||'-'||y||'-'||lpad(n::text,4,'0'); end $$;
revoke all on function private.arteflow_next_purchase_number(uuid,text) from public,anon,authenticated;

create or replace function public.arteflow_create_supplier(p_organization_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_actor text; begin perform private.arteflow_require_procurement(p_organization_id,true); v_actor:=private.arteflow_procurement_actor_name();
insert into public.arteflow_suppliers(organization_id,code,trade_name,corporate_name,document,contact_name,email,phone,address,default_lead_time_days,payment_terms_snapshot,notes,created_by)
values(p_organization_id,upper(btrim(p_data->>'code')),btrim(p_data->>'tradeName'),nullif(btrim(p_data->>'corporateName'),''),nullif(regexp_replace(p_data->>'document','\D','','g'),''),nullif(btrim(p_data->>'contactName'),''),nullif(btrim(p_data->>'email'),''),nullif(btrim(p_data->>'phone'),''),nullif(btrim(p_data->>'address'),''),(p_data->>'defaultLeadTimeDays')::int,nullif(btrim(p_data->>'paymentTermsSnapshot'),''),nullif(btrim(p_data->>'notes'),''),(select auth.uid())) returning id into v_id;
insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'SUPPLIER',v_id,'SUPPLIER_CREATED','Fornecedor criado',(select auth.uid()),v_actor); return v_id;
exception when unique_violation then raise exception 'SUPPLIER_DUPLICATE' using errcode='23505'; end $$;

create or replace function public.arteflow_update_supplier(p_organization_id uuid,p_supplier_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor text; begin perform private.arteflow_require_procurement(p_organization_id,true); v_actor:=private.arteflow_procurement_actor_name();
update public.arteflow_suppliers s set code=coalesce(upper(nullif(btrim(p_data->>'code'),'')),s.code),trade_name=coalesce(nullif(btrim(p_data->>'tradeName'),''),s.trade_name),corporate_name=case when p_data?'corporateName' then nullif(btrim(p_data->>'corporateName'),'') else s.corporate_name end,document=case when p_data?'document' then nullif(regexp_replace(p_data->>'document','\D','','g'),'') else s.document end,contact_name=case when p_data?'contactName' then nullif(btrim(p_data->>'contactName'),'') else s.contact_name end,email=case when p_data?'email' then nullif(btrim(p_data->>'email'),'') else s.email end,phone=case when p_data?'phone' then nullif(btrim(p_data->>'phone'),'') else s.phone end,address=case when p_data?'address' then nullif(btrim(p_data->>'address'),'') else s.address end,default_lead_time_days=case when p_data?'defaultLeadTimeDays' then (p_data->>'defaultLeadTimeDays')::int else s.default_lead_time_days end,payment_terms_snapshot=case when p_data?'paymentTermsSnapshot' then nullif(btrim(p_data->>'paymentTermsSnapshot'),'') else s.payment_terms_snapshot end,notes=case when p_data?'notes' then nullif(btrim(p_data->>'notes'),'') else s.notes end,updated_at=now() where s.organization_id=p_organization_id and s.id=p_supplier_id;
if not found then raise exception 'SUPPLIER_NOT_FOUND'; end if; insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'SUPPLIER',p_supplier_id,'SUPPLIER_UPDATED','Fornecedor atualizado',(select auth.uid()),v_actor); return p_supplier_id; end $$;

create or replace function public.arteflow_toggle_supplier(p_organization_id uuid,p_supplier_id uuid) returns uuid language plpgsql security definer set search_path='' as $$ begin perform private.arteflow_require_procurement(p_organization_id,true); update public.arteflow_suppliers set is_active=not is_active,updated_at=now() where organization_id=p_organization_id and id=p_supplier_id; if not found then raise exception 'SUPPLIER_NOT_FOUND'; end if; insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'SUPPLIER',p_supplier_id,'SUPPLIER_TOGGLED','Status do fornecedor alterado',(select auth.uid()),private.arteflow_procurement_actor_name()); return p_supplier_id; end $$;

create or replace function public.arteflow_create_purchase_request(p_organization_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_number text; v_item jsonb; v_mat public.arteflow_inventory_items%rowtype; begin perform private.arteflow_require_procurement(p_organization_id,true); if jsonb_array_length(coalesce(p_data->'items','[]'))=0 then raise exception 'PURCHASE_REQUEST_ITEMS_REQUIRED'; end if; v_number:=private.arteflow_next_purchase_number(p_organization_id,'SC');
insert into public.arteflow_purchase_requests(id,organization_id,request_number,status,source,production_job_id,job_code,notes,requested_by,requested_by_name) values(v_id,p_organization_id,v_number,'REQUESTED',p_data->>'source',nullif(p_data->>'productionJobId','')::uuid,nullif(p_data->>'jobCode',''),nullif(btrim(p_data->>'notes'),''),(select auth.uid()),private.arteflow_procurement_actor_name());
for v_item in select value from jsonb_array_elements(p_data->'items') loop select * into v_mat from public.arteflow_inventory_items where organization_id=p_organization_id and id=(v_item->>'materialId')::uuid and is_active; if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if; insert into public.arteflow_purchase_request_items(organization_id,purchase_request_id,inventory_item_id,material_sku,material_name,material_unit,material_average_cost_cents,requested_quantity_milli,reason,production_job_id) values(p_organization_id,v_id,v_mat.id,v_mat.sku,v_mat.name,v_mat.unit,v_mat.average_cost_cents,(v_item->>'requestedQuantityMilli')::bigint,coalesce(nullif(btrim(v_item->>'reason'),''),'Necessidade de compra'),coalesce(nullif(v_item->>'productionJobId','')::uuid,nullif(p_data->>'productionJobId','')::uuid)); end loop;
insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'REQUEST',v_id,'REQUEST_CREATED','Solicitação '||v_number||' criada',(select auth.uid()),private.arteflow_procurement_actor_name()); return v_id; end $$;

create or replace function public.arteflow_cancel_purchase_request(p_organization_id uuid,p_request_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$ begin perform private.arteflow_require_procurement(p_organization_id,true); if nullif(btrim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if; update public.arteflow_purchase_requests set status='CANCELLED',cancellation_reason=btrim(p_reason),updated_at=now() where organization_id=p_organization_id and id=p_request_id and status in('DRAFT','REQUESTED'); if not found then raise exception 'PURCHASE_REQUEST_NOT_CANCELLABLE'; end if; insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'REQUEST',p_request_id,'REQUEST_CANCELLED','Solicitação cancelada: '||btrim(p_reason),(select auth.uid()),private.arteflow_procurement_actor_name()); return p_request_id; end $$;

create or replace function public.arteflow_create_purchase_order(p_organization_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_number text; v_supplier public.arteflow_suppliers%rowtype; v_item jsonb; v_mat public.arteflow_inventory_items%rowtype; v_subtotal bigint:=0; v_total bigint; v_line bigint; v_qty bigint; v_cost bigint; v_req text; begin perform private.arteflow_require_procurement(p_organization_id,true); select * into v_supplier from public.arteflow_suppliers where organization_id=p_organization_id and id=(p_data->>'supplierId')::uuid and is_active; if not found then raise exception 'SUPPLIER_NOT_FOUND_OR_INACTIVE'; end if; if jsonb_array_length(coalesce(p_data->'items','[]'))=0 then raise exception 'PURCHASE_ORDER_ITEMS_REQUIRED'; end if; v_number:=private.arteflow_next_purchase_number(p_organization_id,'PC');
for v_item in select value from jsonb_array_elements(p_data->'items') loop v_qty:=(v_item->>'orderedQuantityMilli')::bigint; v_cost:=(v_item->>'unitCostCents')::bigint; if v_qty<=0 or v_cost<0 then raise exception 'INVALID_PURCHASE_ORDER_VALUE'; end if; select * into v_mat from public.arteflow_inventory_items where organization_id=p_organization_id and id=(v_item->>'materialId')::uuid and is_active; if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if; v_line:=round(v_qty::numeric*v_cost/1000)::bigint; if v_line>9007199254740991 then raise exception 'UNSAFE_MONETARY_VALUE'; end if; v_subtotal:=v_subtotal+v_line; end loop;
v_total:=v_subtotal+coalesce((p_data->>'freightCents')::bigint,0)-coalesce((p_data->>'discountCents')::bigint,0); if v_total<0 or v_total>9007199254740991 then raise exception 'INVALID_PURCHASE_ORDER_TOTAL'; end if;
insert into public.arteflow_purchase_orders(id,organization_id,order_number,supplier_id,supplier_snapshot,expected_at,freight_cents,discount_cents,subtotal_cents,total_cents,notes,created_by,actor_name) values(v_id,p_organization_id,v_number,v_supplier.id,jsonb_build_object('id',v_supplier.id,'code',v_supplier.code,'tradeName',v_supplier.trade_name,'corporateName',v_supplier.corporate_name,'document',v_supplier.document,'contactName',v_supplier.contact_name,'email',v_supplier.email,'phone',v_supplier.phone),nullif(p_data->>'expectedAt','')::timestamptz,coalesce((p_data->>'freightCents')::bigint,0),coalesce((p_data->>'discountCents')::bigint,0),v_subtotal,v_total,nullif(btrim(p_data->>'notes'),''),(select auth.uid()),private.arteflow_procurement_actor_name());
for v_item in select value from jsonb_array_elements(p_data->'items') loop select * into v_mat from public.arteflow_inventory_items where organization_id=p_organization_id and id=(v_item->>'materialId')::uuid; v_qty:=(v_item->>'orderedQuantityMilli')::bigint; v_cost:=(v_item->>'unitCostCents')::bigint; insert into public.arteflow_purchase_order_items(organization_id,purchase_order_id,purchase_request_item_id,inventory_item_id,material_snapshot,ordered_quantity_milli,unit,unit_cost_cents,total_cost_cents,production_job_id) values(p_organization_id,v_id,nullif(v_item->>'purchaseRequestItemId','')::uuid,v_mat.id,jsonb_build_object('sku',v_mat.sku,'name',v_mat.name,'unit',v_mat.unit,'averageCostCents',v_mat.average_cost_cents),v_qty,v_mat.unit,v_cost,round(v_qty::numeric*v_cost/1000)::bigint,nullif(v_item->>'productionJobId','')::uuid); end loop;
for v_req in select jsonb_array_elements_text(coalesce(p_data->'purchaseRequestIds','[]')) loop update public.arteflow_purchase_requests set status='CONVERTED',updated_at=now() where organization_id=p_organization_id and id=v_req::uuid and status='REQUESTED'; end loop;
insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'ORDER',v_id,'ORDER_CREATED','Pedido '||v_number||' criado',(select auth.uid()),private.arteflow_procurement_actor_name()); return v_id; end $$;

create or replace function public.arteflow_issue_purchase_order(p_organization_id uuid,p_order_id uuid,p_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$ begin perform private.arteflow_require_procurement(p_organization_id,true); update public.arteflow_purchase_orders set status='ISSUED',issued_at=now(),version=version+1,updated_at=now() where organization_id=p_organization_id and id=p_order_id and status='DRAFT' and (p_expected_version is null or version=p_expected_version); if not found then raise exception 'PURCHASE_ORDER_NOT_ISSUABLE_OR_VERSION_CONFLICT'; end if; insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'ORDER',p_order_id,'ORDER_ISSUED','Pedido emitido',(select auth.uid()),private.arteflow_procurement_actor_name()); return p_order_id; end $$;
create or replace function public.arteflow_cancel_purchase_order(p_organization_id uuid,p_order_id uuid,p_reason text,p_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$ begin perform private.arteflow_require_procurement(p_organization_id,true); if nullif(btrim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if; update public.arteflow_purchase_orders set status='CANCELLED',cancellation_reason=btrim(p_reason),version=version+1,updated_at=now() where organization_id=p_organization_id and id=p_order_id and status in('DRAFT','ISSUED') and (p_expected_version is null or version=p_expected_version); if not found then raise exception 'PURCHASE_ORDER_NOT_CANCELLABLE'; end if; insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,actor_user_id,actor_name) values(p_organization_id,'ORDER',p_order_id,'ORDER_CANCELLED','Pedido cancelado: '||btrim(p_reason),(select auth.uid()),private.arteflow_procurement_actor_name()); return p_order_id; end $$;

create or replace function public.arteflow_receive_purchase_order(p_organization_id uuid,p_order_id uuid,p_items jsonb,p_invoice_number text,p_notes text,p_idempotency_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_order public.arteflow_purchase_orders%rowtype; v_receipt uuid; v_number text; v_item jsonb; v_oi public.arteflow_purchase_order_items%rowtype; v_qty bigint; v_cost bigint; v_move uuid; v_status text; begin perform private.arteflow_require_procurement(p_organization_id,true); if nullif(btrim(p_idempotency_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if; select id into v_receipt from public.arteflow_purchase_receipts where organization_id=p_organization_id and idempotency_key=p_idempotency_key; if found then return v_receipt; end if;
select * into v_order from public.arteflow_purchase_orders where organization_id=p_organization_id and id=p_order_id for update; if not found or v_order.status not in('ISSUED','PARTIALLY_RECEIVED') then raise exception 'PURCHASE_ORDER_NOT_RECEIVABLE'; end if; if jsonb_array_length(coalesce(p_items,'[]'))=0 then raise exception 'PURCHASE_RECEIPT_ITEMS_REQUIRED'; end if; v_number:=private.arteflow_next_purchase_number(p_organization_id,'REC'); insert into public.arteflow_purchase_receipts(organization_id,purchase_order_id,receipt_number,supplier_snapshot,invoice_number,received_by,received_by_name,notes,idempotency_key) values(p_organization_id,p_order_id,v_number,v_order.supplier_snapshot,nullif(btrim(p_invoice_number),''),(select auth.uid()),private.arteflow_procurement_actor_name(),nullif(btrim(p_notes),''),p_idempotency_key) returning id into v_receipt;
for v_item in select value from jsonb_array_elements(p_items) loop v_qty:=(v_item->>'quantityMilli')::bigint; select * into v_oi from public.arteflow_purchase_order_items where organization_id=p_organization_id and id=(v_item->>'purchaseOrderItemId')::uuid and purchase_order_id=p_order_id for update; if not found then raise exception 'PURCHASE_ORDER_ITEM_NOT_FOUND'; end if; if v_qty<=0 or v_qty>v_oi.ordered_quantity_milli-v_oi.received_quantity_milli then raise exception 'ORDER_RECEIPT_EXCEEDS_REMAINING'; end if; v_cost:=coalesce((v_item->>'unitCostCents')::bigint,v_oi.unit_cost_cents); if v_cost<0 then raise exception 'INVALID_COST'; end if;
v_move:=public.arteflow_record_inventory_movement(p_organization_id,v_oi.inventory_item_id,'RECEIPT',v_qty,'Recebimento do pedido '||v_order.order_number,v_cost,round(v_qty::numeric*v_cost/1000)::bigint,p_idempotency_key||':'||v_oi.id);
update public.arteflow_inventory_movements set purchase_order_id=p_order_id,purchase_receipt_id=v_receipt,purchase_order_item_id=v_oi.id where organization_id=p_organization_id and id=v_move;
insert into public.arteflow_purchase_receipt_items(organization_id,purchase_receipt_id,purchase_order_item_id,inventory_item_id,received_quantity_milli,unit_cost_cents,total_cost_cents,stock_movement_id) values(p_organization_id,v_receipt,v_oi.id,v_oi.inventory_item_id,v_qty,v_cost,round(v_qty::numeric*v_cost/1000)::bigint,v_move); update public.arteflow_purchase_order_items set received_quantity_milli=received_quantity_milli+v_qty,updated_at=now() where id=v_oi.id; end loop;
select case when bool_and(received_quantity_milli=ordered_quantity_milli) then 'RECEIVED' else 'PARTIALLY_RECEIVED' end into v_status from public.arteflow_purchase_order_items where organization_id=p_organization_id and purchase_order_id=p_order_id; update public.arteflow_purchase_orders set status=v_status,version=version+1,updated_at=now() where id=p_order_id; insert into public.arteflow_purchase_events(organization_id,entity_type,entity_id,event_type,description,metadata,actor_user_id,actor_name) values(p_organization_id,'RECEIPT',v_receipt,case when v_status='RECEIVED' then 'GOODS_RECEIVED' else 'ORDER_STATUS_CHANGED' end,'Recebimento '||v_number||' registrado',jsonb_build_object('orderId',p_order_id,'status',v_status),(select auth.uid()),private.arteflow_procurement_actor_name()); return v_receipt;
exception when unique_violation then select id into v_receipt from public.arteflow_purchase_receipts where organization_id=p_organization_id and idempotency_key=p_idempotency_key; if found then return v_receipt; end if; raise; end $$;

do $$ declare f record; begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'arteflow_%purchase%' or (n.nspname='public' and p.proname like 'arteflow_%supplier%') loop execute 'revoke all on function '||f.sig||' from public,anon'; execute 'grant execute on function '||f.sig||' to authenticated'; end loop; end $$;
