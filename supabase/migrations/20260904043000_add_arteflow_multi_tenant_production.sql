-- ArteFlow Stage 4: tenant-safe production persistence linked to real orders.

create table public.arteflow_production_stages (
  id text not null,
  organization_id uuid not null references public.organizations(id),
  name text not null,
  description text not null default '',
  sequence integer not null check (sequence > 0),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_initial boolean not null default false,
  is_final boolean not null default false,
  is_terminal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, sequence)
);

alter table public.arteflow_order_items
  add constraint arteflow_order_items_org_id_unique unique (organization_id, id);

create table public.arteflow_production_job_sequences (
  organization_id uuid not null references public.organizations(id),
  sequence_year integer not null check (sequence_year between 2000 and 9999),
  last_value integer not null check (last_value > 0),
  primary key (organization_id, sequence_year)
);

create table public.arteflow_production_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null,
  order_item_id uuid not null,
  job_code text not null,
  current_stage_id text not null,
  artwork_gate text not null default 'NOT_RECEIVED' check (artwork_gate in ('NOT_RECEIVED','PENDING_REVIEW','APPROVED','REJECTED')),
  material_gate text not null default 'NOT_CHECKED' check (material_gate in ('NOT_CHECKED','AVAILABLE','RESERVED','MISSING')),
  financial_gate text not null default 'PAYMENT_PENDING' check (financial_gate in ('RELEASED','DEPOSIT_PENDING','PAYMENT_PENDING','BLOCKED')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  assigned_user_id uuid null references auth.users(id),
  assigned_user_name text null,
  assigned_user_email text null,
  deadline_at timestamptz not null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arteflow_production_jobs_order_fk foreign key (organization_id, order_id)
    references public.arteflow_orders(organization_id, id),
  constraint arteflow_production_jobs_item_fk foreign key (organization_id, order_item_id)
    references public.arteflow_order_items(organization_id, id),
  constraint arteflow_production_jobs_stage_fk foreign key (organization_id, current_stage_id)
    references public.arteflow_production_stages(organization_id, id),
  unique (organization_id, order_item_id),
  unique (organization_id, job_code),
  unique (organization_id, id)
);

create table public.arteflow_production_job_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  actor_name text not null,
  event_type text not null check (event_type in (
    'JOB_CREATED','STAGE_CHANGED','ARTWORK_GATE_CHANGED','MATERIAL_GATE_CHANGED',
    'FINANCIAL_GATE_CHANGED','ASSIGNEE_CHANGED','DEADLINE_CHANGED','PRIORITY_CHANGED','NOTE_ADDED'
  )),
  from_value text null,
  to_value text null,
  from_stage_id text null,
  to_stage_id text null,
  method text null check (method is null or method in ('BUTTON','DRAG_DROP','KEYBOARD')),
  description text not null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint arteflow_production_events_job_fk foreign key (organization_id, job_id)
    references public.arteflow_production_jobs(organization_id, id)
);

create index arteflow_production_jobs_org_stage_idx on public.arteflow_production_jobs(organization_id, current_stage_id);
create index arteflow_production_jobs_org_order_idx on public.arteflow_production_jobs(organization_id, order_id);
create index arteflow_production_jobs_org_deadline_idx on public.arteflow_production_jobs(organization_id, deadline_at);
create index arteflow_production_jobs_assignee_idx on public.arteflow_production_jobs(assigned_user_id) where assigned_user_id is not null;
create index arteflow_production_jobs_created_by_idx on public.arteflow_production_jobs(created_by);
create index arteflow_production_events_org_job_created_idx on public.arteflow_production_job_events(organization_id, job_id, created_at);
create index arteflow_production_events_actor_idx on public.arteflow_production_job_events(actor_user_id);

alter table public.arteflow_production_stages enable row level security;
alter table public.arteflow_production_job_sequences enable row level security;
alter table public.arteflow_production_jobs enable row level security;
alter table public.arteflow_production_job_events enable row level security;

create policy arteflow_production_stages_select on public.arteflow_production_stages for select to authenticated
using (private.arteflow_has_permission(organization_id, 'arteflow.production.view'));
create policy arteflow_production_jobs_select on public.arteflow_production_jobs for select to authenticated
using (private.arteflow_has_permission(organization_id, 'arteflow.production.view'));
create policy arteflow_production_events_select on public.arteflow_production_job_events for select to authenticated
using (private.arteflow_has_permission(organization_id, 'arteflow.production.view'));
create policy arteflow_production_sequences_deny_all on public.arteflow_production_job_sequences as restrictive for all to authenticated
using (false) with check (false);

revoke all on public.arteflow_production_stages from public, anon;
revoke all on public.arteflow_production_job_sequences from public, anon, authenticated;
revoke all on public.arteflow_production_jobs from public, anon;
revoke all on public.arteflow_production_job_events from public, anon;
grant select on public.arteflow_production_stages, public.arteflow_production_jobs, public.arteflow_production_job_events to authenticated;

create or replace function private.arteflow_seed_production_stages(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.arteflow_production_stages
    (id, organization_id, name, description, sequence, color, is_initial, is_final, is_terminal)
  values
    ('stage-entry',p_organization_id,'Entrada','Pedido recebido e triado para produção',1,'#64748b',true,false,false),
    ('stage-awaiting-file',p_organization_id,'Aguardando arquivo','Aguardando envio do arquivo final pelo cliente',2,'#f59e0b',false,false,false),
    ('stage-prepress',p_organization_id,'Pré-impressão','Fechamento de arquivo, imposição e RIP',3,'#0284c7',false,false,false),
    ('stage-awaiting-approval',p_organization_id,'Aguardando aprovação','Prova digital enviada para aprovação do cliente',4,'#8b5cf6',false,false,false),
    ('stage-awaiting-material',p_organization_id,'Aguardando material','Aguardando chegada ou separação de substratos e insumos',5,'#d97706',false,false,false),
    ('stage-scheduled',p_organization_id,'Programado','Na fila de máquinas ou mesas de corte',6,'#3b82f6',false,false,false),
    ('stage-in-production',p_organization_id,'Em produção','Em processo de impressão / confecção',7,'#0d9488',false,false,false),
    ('stage-finishing',p_organization_id,'Acabamento','Corte, refile, ilhós, laminação ou solda',8,'#0891b2',false,false,false),
    ('stage-quality-control',p_organization_id,'Controle de qualidade','Conferência técnica dimensional e cromática',9,'#4f46e5',false,false,false),
    ('stage-ready',p_organization_id,'Pronto','Embalado e pronto para expedição ou retirada',10,'#10b981',false,true,false),
    ('stage-delivered',p_organization_id,'Entregue','Entregue ou despachado ao cliente',11,'#059669',false,false,true)
  on conflict (organization_id, id) do nothing;
end; $$;
revoke all on function private.arteflow_seed_production_stages(uuid) from public, anon, authenticated;

create or replace function private.arteflow_can_manage_production(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.arteflow_has_permission(p_organization_id,'arteflow.production.manage')
    or private.arteflow_has_permission(p_organization_id,'arteflow.production.move_stages')
    or private.arteflow_has_permission(p_organization_id,'arteflow.production.reassign');
$$;
revoke all on function private.arteflow_can_manage_production(uuid) from public, anon, authenticated;

create or replace function public.arteflow_get_production_stages(p_organization_id uuid)
returns setof public.arteflow_production_stages language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.arteflow_has_permission(p_organization_id, 'arteflow.production.view') then
    raise exception 'PRODUCTION_VIEW_DENIED' using errcode='42501';
  end if;
  perform private.arteflow_seed_production_stages(p_organization_id);
  return query select * from public.arteflow_production_stages s
    where s.organization_id=p_organization_id and s.is_active order by s.sequence;
end; $$;

create or replace function public.arteflow_create_production_job(
  p_organization_id uuid, p_order_id uuid, p_order_item_id uuid,
  p_initial_stage_id text default 'stage-entry', p_priority text default 'MEDIUM', p_deadline_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_year integer := extract(year from now())::integer; v_seq integer;
begin
  if (select auth.uid()) is null or not private.arteflow_can_manage_production(p_organization_id) then
    raise exception 'PRODUCTION_MANAGE_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.arteflow_order_items i where i.organization_id=p_organization_id and i.order_id=p_order_id and i.id=p_order_item_id) then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;
  if p_priority not in ('LOW','MEDIUM','HIGH','URGENT') then raise exception 'INVALID_PRIORITY'; end if;
  perform private.arteflow_seed_production_stages(p_organization_id);
  if not exists(select 1 from public.arteflow_production_stages s where s.organization_id=p_organization_id and s.id=p_initial_stage_id and s.is_active) then
    raise exception 'INVALID_STAGE';
  end if;
  insert into public.arteflow_production_job_sequences(organization_id,sequence_year,last_value)
  values(p_organization_id,v_year,1)
  on conflict(organization_id,sequence_year) do update set last_value=public.arteflow_production_job_sequences.last_value+1
  returning last_value into v_seq;
  v_code := 'OP-'||v_year||'-'||lpad(v_seq::text,4,'0');
  insert into public.arteflow_production_jobs
    (organization_id,order_id,order_item_id,job_code,current_stage_id,priority,deadline_at,created_by)
  values(p_organization_id,p_order_id,p_order_item_id,v_code,p_initial_stage_id,p_priority,p_deadline_at,(select auth.uid())) returning id into v_id;
  insert into public.arteflow_production_job_events
    (organization_id,job_id,actor_user_id,actor_name,event_type,to_value,to_stage_id,description)
  select p_organization_id,v_id,(select auth.uid()),coalesce(u.raw_user_meta_data->>'name',u.email,'Usuário'),'JOB_CREATED',p_initial_stage_id,p_initial_stage_id,
    'Ordem de Produção criada a partir do item "'||i.product_name||'" do Pedido '||o.order_number
  from public.arteflow_order_items i join public.arteflow_orders o on o.organization_id=i.organization_id and o.id=i.order_id
  join auth.users u on u.id=(select auth.uid()) where i.id=p_order_item_id and i.organization_id=p_organization_id;
  return v_id;
exception when unique_violation then
  raise exception 'PRODUCTION_JOB_ALREADY_EXISTS' using errcode='23505';
end; $$;

create or replace function public.arteflow_move_production_job(
  p_organization_id uuid, p_job_id uuid, p_target_stage_id text, p_expected_version integer,
  p_method text default 'BUTTON', p_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_job public.arteflow_production_jobs%rowtype; v_from_name text; v_to_name text; v_from_seq int; v_to_seq int; v_actor text;
begin
  if (select auth.uid()) is null or not private.arteflow_can_manage_production(p_organization_id) then raise exception 'PRODUCTION_MANAGE_DENIED' using errcode='42501'; end if;
  if p_method not in ('BUTTON','DRAG_DROP','KEYBOARD') then raise exception 'INVALID_METHOD'; end if;
  select * into v_job from public.arteflow_production_jobs where organization_id=p_organization_id and id=p_job_id for update;
  if not found then raise exception 'PRODUCTION_JOB_NOT_FOUND'; end if;
  if v_job.version <> p_expected_version then raise exception 'PRODUCTION_CONFLICT' using errcode='40001'; end if;
  select name,sequence into v_from_name,v_from_seq from public.arteflow_production_stages where organization_id=p_organization_id and id=v_job.current_stage_id;
  select name,sequence into v_to_name,v_to_seq from public.arteflow_production_stages where organization_id=p_organization_id and id=p_target_stage_id and is_active;
  if v_to_seq is null then raise exception 'INVALID_STAGE'; end if;
  if abs(v_to_seq-v_from_seq)<>1 then raise exception 'INVALID_STAGE_TRANSITION'; end if;
  if v_job.current_stage_id='stage-delivered' and p_target_stage_id='stage-ready' and nullif(btrim(p_reason),'') is null then raise exception 'REVERSION_REASON_REQUIRED'; end if;
  if v_to_seq>=6 and (v_job.artwork_gate<>'APPROVED' or v_job.material_gate='MISSING' or v_job.financial_gate<>'RELEASED') then raise exception 'PRODUCTION_GATES_BLOCKED'; end if;
  select coalesce(raw_user_meta_data->>'name',email,'Usuário') into v_actor from auth.users where id=(select auth.uid());
  update public.arteflow_production_jobs set current_stage_id=p_target_stage_id,version=version+1,updated_at=now() where id=v_job.id;
  insert into public.arteflow_production_job_events(organization_id,job_id,actor_user_id,actor_name,event_type,from_value,to_value,from_stage_id,to_stage_id,method,reason,description)
  values(p_organization_id,v_job.id,(select auth.uid()),v_actor,'STAGE_CHANGED',v_from_name,v_to_name,v_job.current_stage_id,p_target_stage_id,p_method,nullif(btrim(p_reason),''),
    'Etapa alterada de "'||v_from_name||'" para "'||v_to_name||'"');
  return v_job.id;
end; $$;

create or replace function public.arteflow_update_production_job(
  p_organization_id uuid, p_job_id uuid, p_expected_version integer, p_field text, p_value text, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_job public.arteflow_production_jobs%rowtype; v_old text; v_type text; v_actor text; v_assignee uuid;
begin
  if (select auth.uid()) is null or not private.arteflow_can_manage_production(p_organization_id) then raise exception 'PRODUCTION_MANAGE_DENIED' using errcode='42501'; end if;
  select * into v_job from public.arteflow_production_jobs where organization_id=p_organization_id and id=p_job_id for update;
  if not found then raise exception 'PRODUCTION_JOB_NOT_FOUND'; end if;
  if v_job.version<>p_expected_version then raise exception 'PRODUCTION_CONFLICT' using errcode='40001'; end if;
  if p_field='artwork_gate' then v_old:=v_job.artwork_gate; v_type:='ARTWORK_GATE_CHANGED'; if p_value not in ('NOT_RECEIVED','PENDING_REVIEW','APPROVED','REJECTED') then raise exception 'INVALID_GATE'; end if; update public.arteflow_production_jobs set artwork_gate=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='material_gate' then v_old:=v_job.material_gate; v_type:='MATERIAL_GATE_CHANGED'; if p_value not in ('NOT_CHECKED','AVAILABLE','RESERVED','MISSING') then raise exception 'INVALID_GATE'; end if; update public.arteflow_production_jobs set material_gate=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='financial_gate' then v_old:=v_job.financial_gate; v_type:='FINANCIAL_GATE_CHANGED'; if p_value not in ('RELEASED','DEPOSIT_PENDING','PAYMENT_PENDING','BLOCKED') then raise exception 'INVALID_GATE'; end if; update public.arteflow_production_jobs set financial_gate=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='priority' then v_old:=v_job.priority; v_type:='PRIORITY_CHANGED'; if p_value not in ('LOW','MEDIUM','HIGH','URGENT') then raise exception 'INVALID_PRIORITY'; end if; update public.arteflow_production_jobs set priority=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='deadline' then v_old:=v_job.deadline_at::text; v_type:='DEADLINE_CHANGED'; update public.arteflow_production_jobs set deadline_at=p_value::timestamptz,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='assignee' then
    v_old:=coalesce(v_job.assigned_user_name,'Não atribuído'); v_type:='ASSIGNEE_CHANGED'; v_assignee:=nullif(p_value,'')::uuid;
    if v_assignee is not null and not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_assignee and m.is_active and not m.is_locked) then raise exception 'INVALID_ASSIGNEE'; end if;
    update public.arteflow_production_jobs j set assigned_user_id=v_assignee,
      assigned_user_name=case when v_assignee is null then null else coalesce(u.raw_user_meta_data->>'name',u.email) end,
      assigned_user_email=case when v_assignee is null then null else u.email end,version=j.version+1,updated_at=now()
    from auth.users u where j.id=p_job_id and (v_assignee is null or u.id=v_assignee);
    if v_assignee is null then update public.arteflow_production_jobs set assigned_user_id=null,assigned_user_name=null,assigned_user_email=null,version=version+1,updated_at=now() where id=p_job_id; end if;
    select coalesce(assigned_user_name,'Não atribuído') into p_value from public.arteflow_production_jobs where id=p_job_id;
  else raise exception 'INVALID_PRODUCTION_FIELD'; end if;
  select coalesce(raw_user_meta_data->>'name',email,'Usuário') into v_actor from auth.users where id=(select auth.uid());
  insert into public.arteflow_production_job_events(organization_id,job_id,actor_user_id,actor_name,event_type,from_value,to_value,description,metadata)
  values(p_organization_id,p_job_id,(select auth.uid()),v_actor,v_type,v_old,p_value,
    replace(initcap(replace(p_field,'_',' ')),'Gate','gate')||' alterado de "'||coalesce(v_old,'')||'" para "'||coalesce(p_value,'')||'"'||case when nullif(btrim(p_note),'') is null then '' else ' — '||btrim(p_note) end,
    jsonb_build_object('field',p_field));
  return p_job_id;
end; $$;

create or replace function public.arteflow_add_production_note(p_organization_id uuid,p_job_id uuid,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_actor text;
begin
  if (select auth.uid()) is null or not private.arteflow_can_manage_production(p_organization_id) then raise exception 'PRODUCTION_MANAGE_DENIED' using errcode='42501'; end if;
  if nullif(btrim(p_note),'') is null then raise exception 'NOTE_REQUIRED'; end if;
  if not exists(select 1 from public.arteflow_production_jobs where organization_id=p_organization_id and id=p_job_id) then raise exception 'PRODUCTION_JOB_NOT_FOUND'; end if;
  select coalesce(raw_user_meta_data->>'name',email,'Usuário') into v_actor from auth.users where id=(select auth.uid());
  insert into public.arteflow_production_job_events(organization_id,job_id,actor_user_id,actor_name,event_type,description)
  values(p_organization_id,p_job_id,(select auth.uid()),v_actor,'NOTE_ADDED',btrim(p_note)) returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.arteflow_get_production_stages(uuid) from public, anon;
revoke all on function public.arteflow_create_production_job(uuid,uuid,uuid,text,text,timestamptz) from public, anon;
revoke all on function public.arteflow_move_production_job(uuid,uuid,text,integer,text,text) from public, anon;
revoke all on function public.arteflow_update_production_job(uuid,uuid,integer,text,text,text) from public, anon;
revoke all on function public.arteflow_add_production_note(uuid,uuid,text) from public, anon;
grant execute on function public.arteflow_get_production_stages(uuid) to authenticated;
grant execute on function public.arteflow_create_production_job(uuid,uuid,uuid,text,text,timestamptz) to authenticated;
grant execute on function public.arteflow_move_production_job(uuid,uuid,text,integer,text,text) to authenticated;
grant execute on function public.arteflow_update_production_job(uuid,uuid,integer,text,text,text) to authenticated;
grant execute on function public.arteflow_add_production_note(uuid,uuid,text) to authenticated;
