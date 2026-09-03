create or replace function private.arteflow_has_permission(
  p_organization_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.arteflow_can_access_product(p_organization_id)
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = (select auth.uid())
        and om.is_active = true
        and om.is_locked = false
        and (
          om.role = 'owner'::public.user_role
          or exists (
            select 1
            from public.product_permissions permission
            where permission.organization_id = p_organization_id
              and permission.user_id = (select auth.uid())
              and permission.product_key = 'arteflow'
              and permission.permission_key = p_permission_key
              and permission.is_granted = true
          )
          or (
            not exists (
              select 1
              from public.prexyon_user_permission_overrides denial
              join public.prexyon_permission_definitions denial_definition
                on denial_definition.id = denial.permission_definition_id
              where denial.organization_id = p_organization_id
                and denial.user_id = (select auth.uid())
                and denial.effect = 'deny'
                and denial_definition.product_code = 'arteflow'
                and denial_definition.permission_key = p_permission_key
            )
            and (
              exists (
                select 1
                from public.prexyon_user_permission_overrides allowance
                join public.prexyon_permission_definitions allowance_definition
                  on allowance_definition.id = allowance.permission_definition_id
                where allowance.organization_id = p_organization_id
                  and allowance.user_id = (select auth.uid())
                  and allowance.effect = 'allow'
                  and allowance_definition.product_code = 'arteflow'
                  and allowance_definition.permission_key = p_permission_key
              )
              or exists (
                select 1
                from public.prexyon_user_product_roles assignment
                join public.prexyon_roles role_definition
                  on role_definition.id = assignment.role_id
                 and role_definition.product_code = 'arteflow'
                join public.prexyon_role_permissions role_permission
                  on role_permission.role_id = assignment.role_id
                join public.prexyon_permission_definitions definition
                  on definition.id = role_permission.permission_definition_id
                 and definition.product_code = 'arteflow'
                where assignment.organization_id = p_organization_id
                  and assignment.user_id = (select auth.uid())
                  and assignment.product_code = 'arteflow'
                  and definition.permission_key = p_permission_key
              )
            )
          )
        )
    );
$$;

revoke all on function private.arteflow_has_permission(uuid, text) from public, anon;
grant execute on function private.arteflow_has_permission(uuid, text) to authenticated;
