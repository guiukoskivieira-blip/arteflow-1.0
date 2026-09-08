-- Migration: fix OrçaGraf quote import RPC to query canonical tables (public.quotes, public.quote_items, public.quote_item_finishings)
-- Replaces previous placeholder RPC with real multi-tenant OrçaGraf schema queries

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

  -- Consulta apenas orçamentos em estado APROVADO ('approved') que não foram excluídos e ainda não foram importados para o ArteFlow nesta organização
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id::text,
        'quoteNumber', coalesce(q.quote_number, 'ORC-' || substring(q.id::text, 1, 8)),
        'customerId', q.customer_id,
        'customerName', q.customer_name,
        'customerDocument', q.customer_document,
        'customerEmail', q.customer_email,
        'customerPhone', q.customer_phone,
        'customerContactPerson', q.customer_contact,
        'totalAmountCents', q.total_cents,
        'deliveryDate', null,
        'productionDays', q.production_days,
        'notes', case
          when q.internal_notes is not null and q.customer_notes is not null then q.customer_notes || E'\n' || q.internal_notes
          else coalesce(q.customer_notes, q.internal_notes)
        end,
        'internalNotes', q.internal_notes,
        'customerNotes', q.customer_notes,
        'sellerId', q.seller_id,
        'sellerName', q.seller_name,
        'sellerCommissionPct', q.commission_rate_percent,
        'sellerCommissionAmountCents', q.commission_amount_cents,
        'approvedAt', q.approved_at,
        'createdAt', q.created_at,
        'itemCount', coalesce(
          (
            select count(*)::int
            from public.quote_items qi_count
            where qi_count.quote_id = q.id
              and qi_count.organization_id = p_organization_id
          ),
          0
        ),
        'items', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', qi.id::text,
                'productId', qi.product_id,
                'productName', qi.product_name,
                'pricingMode', qi.pricing_mode,
                'quantity', qi.quantity,
                'lotSize', qi.lot_size,
                'billedQuantity', qi.billed_quantity,
                'width', case
                  when qi.width_mm is not null then qi.width_mm / 10.0
                  else null
                end,
                'height', case
                  when qi.height_mm is not null then qi.height_mm / 10.0
                  else null
                end,
                'unit', 'cm',
                'widthMm', qi.width_mm,
                'heightMm', qi.height_mm,
                'areaM2', qi.area_m2,
                'linearMeters', qi.linear_meters,
                'unitPriceCents', qi.unit_price_cents,
                'totalPriceCents', qi.total_price_cents,
                'materialName', qi.material_name,
                'technicalNotes', qi.notes,
                'displayOrder', qi.display_order,
                'finishings', coalesce(
                  (
                    select jsonb_agg(qif.name order by qif.display_order, qif.created_at)
                    from public.quote_item_finishings qif
                    where qif.quote_item_id = qi.id
                      and qif.organization_id = p_organization_id
                  ),
                  '[]'::jsonb
                ),
                'finishingsDetails', coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', qif.id::text,
                        'name', qif.name,
                        'unitPriceCents', qif.unit_price_cents,
                        'totalPriceCents', qif.total_price_cents
                      )
                      order by qif.display_order, qif.created_at
                    )
                    from public.quote_item_finishings qif
                    where qif.quote_item_id = qi.id
                      and qif.organization_id = p_organization_id
                  ),
                  '[]'::jsonb
                )
              )
              order by qi.display_order, qi.created_at, qi.id
            )
            from public.quote_items qi
            where qi.quote_id = q.id
              and qi.organization_id = p_organization_id
          ),
          '[]'::jsonb
        )
      )
      order by q.approved_at desc nulls last, q.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.quotes q
  where q.organization_id = p_organization_id
    and q.status = 'approved'
    and q.deleted_at is null
    and not exists (
      select 1
      from public.arteflow_orders ao
      where ao.organization_id = p_organization_id
        and ao.orcagraf_quote_id = q.id::text
    );

  return v_result;
end;
$$;

revoke all on function public.arteflow_list_importable_orcagraf_quotes(uuid) from public, anon;
grant execute on function public.arteflow_list_importable_orcagraf_quotes(uuid) to authenticated;
