insert into public.arteflow_financial_events
  (organization_id, entity_type, entity_id, event_type, description, actor_user_id, actor_name)
select r.organization_id, 'RECEIVABLE', r.id, 'RECEIVABLE_CREATED',
       'Conta criada para ' || coalesce(r.order_number, r.description), r.created_by, 'Sistema'
from public.arteflow_financial_receivables r
where not exists (
  select 1 from public.arteflow_financial_events e
  where e.organization_id = r.organization_id and e.entity_type = 'RECEIVABLE'
    and e.entity_id = r.id and e.event_type = 'RECEIVABLE_CREATED'
);

insert into public.arteflow_financial_events
  (organization_id, entity_type, entity_id, event_type, description, actor_user_id, actor_name)
select p.organization_id, 'PAYABLE', p.id, 'PAYABLE_CREATED',
       'Conta criada para ' || coalesce(p.purchase_order_number, p.description), p.created_by, 'Sistema'
from public.arteflow_financial_payables p
where not exists (
  select 1 from public.arteflow_financial_events e
  where e.organization_id = p.organization_id and e.entity_type = 'PAYABLE'
    and e.entity_id = p.id and e.event_type = 'PAYABLE_CREATED'
);
