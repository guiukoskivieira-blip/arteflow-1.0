create or replace function public.arteflow_update_production_job(
  p_organization_id uuid, p_job_id uuid, p_expected_version integer, p_field text, p_value text, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_job public.arteflow_production_jobs%rowtype;
  v_old text; v_type text; v_actor text; v_assignee uuid;
  v_assignee_name text; v_assignee_email text;
begin
  if (select auth.uid()) is null or not private.arteflow_can_manage_production(p_organization_id) then
    raise exception 'PRODUCTION_MANAGE_DENIED' using errcode='42501';
  end if;
  select * into v_job from public.arteflow_production_jobs
    where organization_id=p_organization_id and id=p_job_id for update;
  if not found then raise exception 'PRODUCTION_JOB_NOT_FOUND'; end if;
  if v_job.version<>p_expected_version then raise exception 'PRODUCTION_CONFLICT' using errcode='40001'; end if;

  if p_field='artwork_gate' then
    v_old:=v_job.artwork_gate; v_type:='ARTWORK_GATE_CHANGED';
    if p_value not in ('NOT_RECEIVED','PENDING_REVIEW','APPROVED','REJECTED') then raise exception 'INVALID_GATE'; end if;
    update public.arteflow_production_jobs set artwork_gate=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='material_gate' then
    v_old:=v_job.material_gate; v_type:='MATERIAL_GATE_CHANGED';
    if p_value not in ('NOT_CHECKED','AVAILABLE','RESERVED','MISSING') then raise exception 'INVALID_GATE'; end if;
    update public.arteflow_production_jobs set material_gate=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='financial_gate' then
    v_old:=v_job.financial_gate; v_type:='FINANCIAL_GATE_CHANGED';
    if p_value not in ('RELEASED','DEPOSIT_PENDING','PAYMENT_PENDING','BLOCKED') then raise exception 'INVALID_GATE'; end if;
    update public.arteflow_production_jobs set financial_gate=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='priority' then
    v_old:=v_job.priority; v_type:='PRIORITY_CHANGED';
    if p_value not in ('LOW','MEDIUM','HIGH','URGENT') then raise exception 'INVALID_PRIORITY'; end if;
    update public.arteflow_production_jobs set priority=p_value,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='deadline' then
    v_old:=v_job.deadline_at::text; v_type:='DEADLINE_CHANGED';
    update public.arteflow_production_jobs set deadline_at=p_value::timestamptz,version=version+1,updated_at=now() where id=p_job_id;
  elsif p_field='assignee' then
    v_old:=coalesce(v_job.assigned_user_name,'Não atribuído'); v_type:='ASSIGNEE_CHANGED';
    v_assignee:=nullif(p_value,'')::uuid;
    if v_assignee is null then
      p_value:='Não atribuído';
      update public.arteflow_production_jobs set assigned_user_id=null,assigned_user_name=null,
        assigned_user_email=null,version=version+1,updated_at=now() where id=p_job_id;
    else
      if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id
        and m.user_id=v_assignee and m.is_active and not m.is_locked) then raise exception 'INVALID_ASSIGNEE'; end if;
      select coalesce(u.raw_user_meta_data->>'name',u.email),u.email
        into v_assignee_name,v_assignee_email from auth.users u where u.id=v_assignee;
      p_value:=v_assignee_name;
      update public.arteflow_production_jobs set assigned_user_id=v_assignee,assigned_user_name=v_assignee_name,
        assigned_user_email=v_assignee_email,version=version+1,updated_at=now() where id=p_job_id;
    end if;
  else raise exception 'INVALID_PRODUCTION_FIELD'; end if;

  select coalesce(raw_user_meta_data->>'name',email,'Usuário') into v_actor
    from auth.users where id=(select auth.uid());
  insert into public.arteflow_production_job_events
    (organization_id,job_id,actor_user_id,actor_name,event_type,from_value,to_value,description,metadata)
  values(p_organization_id,p_job_id,(select auth.uid()),v_actor,v_type,v_old,p_value,
    replace(initcap(replace(p_field,'_',' ')),'Gate','gate')||' alterado de "'||coalesce(v_old,'')||'" para "'||coalesce(p_value,'')||'"'||
      case when nullif(btrim(p_note),'') is null then '' else ' — '||btrim(p_note) end,
    jsonb_build_object('field',p_field));
  return p_job_id;
end; $$;

revoke all on function public.arteflow_update_production_job(uuid,uuid,integer,text,text,text) from public, anon;
grant execute on function public.arteflow_update_production_job(uuid,uuid,integer,text,text,text) to authenticated;
