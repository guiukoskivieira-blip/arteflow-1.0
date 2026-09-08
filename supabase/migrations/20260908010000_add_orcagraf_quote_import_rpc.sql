-- Migration: add OrçaGraf approved quote import RPC and quote duplicate tracking (P2-01)
-- Requires dual entitlement ('orcagraf' AND 'arteflow') + dual product access + RBAC 'arteflow.orders.create'

-- 1. Coluna de rastreamento de duplicidade de orçamento OrçaGraf
alter table public.arteflow_orders
  add column if not exists orcagraf_quote_id text;

create unique index if not exists arteflow_orders_org_orcagraf_quote_uidx
  on public.arteflow_orders (organization_id, orcagraf_quote_id)
  where orcagraf_quote_id is not null;

-- 2. Função segura para checar duplo entitlement, duplo acesso a produtos e permissão RBAC OrçaGraf
create or replace function private.arteflow_can_import_orcagraf(p_organization_id uuid)
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
      -- product_access individual ArteFlow
      join public.organization_member_product_access pa_af
        on pa_af.organization_id = o.id
       and pa_af.user_id = (select auth.uid())
       and pa_af.product_key = 'arteflow'
       and pa_af.is_enabled = true
      -- product_access individual OrçaGraf
      join public.organization_member_product_access pa_og
        on pa_og.organization_id = o.id
       and pa_og.user_id = (select auth.uid())
       and pa_og.product_key = 'orcagraf'
       and pa_og.is_enabled = true
      where o.id = p_organization_id
        and o.is_active = true
        and o.deleted_at is null
        and (
          -- Owner possui bypass canônico de role (mas respeita entitlement, product_access e tenant acima)
          om.role = 'owner'::public.user_role
          or (
            -- Não ter explicit deny para quotes.view no OrçaGraf
            not exists (
              select 1
              from public.prexyon_user_permission_overrides denial
              join public.prexyon_permission_definitions denial_def
                on denial_def.id = denial.permission_definition_id
              where denial.organization_id = p_organization_id
                and denial.user_id = (select auth.uid())
                and denial.effect = 'deny'
                and denial_def.product_code = 'orcagraf'
                and denial_def.permission_key in ('orcagraf.quotes.view', 'quotes.view')
            )
            and (
              -- Permissão direta legada / product_permissions
              exists (
                select 1
                from public.product_permissions perm
                where perm.organization_id = p_organization_id
                  and perm.user_id = (select auth.uid())
                  and perm.product_key = 'orcagraf'
                  and perm.permission_key in ('orcagraf.quotes.view', 'quotes.view')
                  and perm.is_granted = true
              )
              -- Override allow no RBAC Prexyon
              or exists (
                select 1
                from public.prexyon_user_permission_overrides allowance
                join public.prexyon_permission_definitions allowance_def
                  on allowance_def.id = allowance.permission_definition_id
                where allowance.organization_id = p_organization_id
                  and allowance.user_id = (select auth.uid())
                  and allowance.effect = 'allow'
                  and allowance_def.product_code = 'orcagraf'
                  and allowance_def.permission_key in ('orcagraf.quotes.view', 'quotes.view')
              )
              -- Role assignment no produto OrçaGraf
              or exists (
                select 1
                from public.prexyon_user_product_roles assignment
                join public.prexyon_roles role_def
                  on role_def.id = assignment.role_id
                 and role_def.product_code = 'orcagraf'
                join public.prexyon_role_permissions role_perm
                  on role_perm.role_id = assignment.role_id
                join public.prexyon_permission_definitions def
                  on def.id = role_perm.permission_definition_id
                 and def.product_code = 'orcagraf'
                where assignment.organization_id = p_organization_id
                  and assignment.user_id = (select auth.uid())
                  and assignment.product_code = 'orcagraf'
                  and def.permission_key in ('orcagraf.quotes.view', 'quotes.view')
              )
            )
          )
        )
    )
    -- Entitlement efetivo ArteFlow
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
    )
    -- Entitlement efetivo OrçaGraf
    and (
      exists (
        select 1
        from public.prexyon_subscriptions s
        join public.prexyon_plan_products pp on pp.plan_id = s.plan_id
        where s.organization_id = p_organization_id
          and pp.product_code = 'orcagraf'
          and (
            (s.status in ('active', 'trialing') and s.current_period_end > timezone('utc', now()))
            or (s.status = 'canceled' and s.current_period_end > timezone('utc', now()))
          )
      )
      or exists (
        select 1
        from public.prexyon_homologation_entitlements he
        where he.organization_id = p_organization_id
          and he.product_code = 'orcagraf'
          and he.expires_at > timezone('utc', now())
          and he.revoked_at is null
      )
    );
$$;

revoke all on function private.arteflow_can_import_orcagraf(uuid) from public, anon;
grant execute on function private.arteflow_can_import_orcagraf(uuid) to authenticated;

-- 3. RPC para listar orçamentos importáveis do OrçaGraf
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

  -- Consulta apenas orçamentos em estado APROVADO que ainda não foram importados para o ArteFlow nesta organização
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id::text,
        'quoteNumber', coalesce(q.quote_number, 'ORC-' || substring(q.id::text, 1, 8)),
        'customerName', q.customer_name,
        'customerDocument', q.customer_document,
        'customerEmail', q.customer_email,
        'customerPhone', q.customer_phone,
        'customerContactPerson', q.customer_contact_person,
        'totalAmountCents', q.total_amount_cents,
        'deliveryDate', q.delivery_date,
        'notes', q.notes,
        'sellerName', q.seller_name,
        'sellerCommissionPct', q.seller_commission_pct,
        'approvedAt', q.approved_at,
        'itemCount', coalesce(jsonb_array_length(q.items), 0),
        'items', q.items
      ) order by q.approved_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.orcagraf_quotes q
  where q.organization_id = p_organization_id
    and q.status in ('APPROVED', 'APROVADO')
    and not exists (
      select 1
      from public.arteflow_orders o
      where o.organization_id = p_organization_id
        and o.orcagraf_quote_id = q.id::text
    );

  return v_result;
end;
$$;

revoke all on function public.arteflow_list_importable_orcagraf_quotes(uuid) from public, anon;
grant execute on function public.arteflow_list_importable_orcagraf_quotes(uuid) to authenticated;
