import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem } from '../types/domain';
import type { IOrderRepository } from '../types/repository';

interface OrderItemRow {
  id: string;
  order_id: string;
  product_name: string;
  category: string | null;
  sector: string;
  dimension_width: number | string | null;
  dimension_height: number | string | null;
  dimension_unit: 'mm' | 'cm' | 'm' | null;
  quantity: number | string;
  unit: string;
  unit_price_cents: number | string;
  total_price_cents: number | string;
  finishings: string[];
  technical_notes: string | null;
  generated_job_id: string | null;
  data_origin: 'demo' | 'user';
  position: number;
}

interface OrderRow {
  id: string;
  organization_id: string;
  order_number: string;
  origin: Order['origin'];
  status: Order['status'];
  customer_snapshot_id: string;
  customer_name: string;
  customer_document: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_contact_person: string | null;
  total_amount_cents: number | string;
  notes: string | null;
  delivery_date: string;
  created_at: string;
  updated_at: string;
  data_origin: 'demo' | 'user';
  arteflow_order_items: OrderItemRow[];
}

const ORDER_SELECT = `
  id, organization_id, order_number, origin, status,
  customer_snapshot_id, customer_name, customer_document, customer_email,
  customer_phone, customer_contact_person, total_amount_cents, notes,
  delivery_date, created_at, updated_at, data_origin,
  arteflow_order_items (
    id, order_id, product_name, category, sector,
    dimension_width, dimension_height, dimension_unit,
    quantity, unit, unit_price_cents, total_price_cents,
    finishings, technical_notes, generated_job_id, data_origin, position
  )
`;

function safeInteger(value: number | string, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Valor monetário inseguro recebido em ${field}.`);
  return parsed;
}

function mapItem(row: OrderItemRow): OrderItem {
  const width = row.dimension_width === null ? null : Number(row.dimension_width);
  const height = row.dimension_height === null ? null : Number(row.dimension_height);
  return {
    id: row.id,
    orderId: row.order_id,
    productName: row.product_name,
    category: row.category ?? undefined,
    sector: row.sector,
    dimensions: width !== null && height !== null && row.dimension_unit
      ? { width, height, unit: row.dimension_unit }
      : undefined,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPriceCents: safeInteger(row.unit_price_cents, 'unit_price_cents'),
    totalPriceCents: safeInteger(row.total_price_cents, 'total_price_cents'),
    finishings: row.finishings ?? [],
    technicalNotes: row.technical_notes ?? undefined,
    generatedJobId: row.generated_job_id ?? undefined,
    dataOrigin: row.data_origin,
  };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    organizationId: row.organization_id,
    origin: row.origin,
    customer: {
      id: row.customer_snapshot_id,
      name: row.customer_name,
      document: row.customer_document ?? undefined,
      email: row.customer_email ?? undefined,
      phone: row.customer_phone ?? undefined,
      contactPerson: row.customer_contact_person ?? undefined,
    },
    items: [...(row.arteflow_order_items ?? [])].sort((a, b) => a.position - b.position).map(mapItem),
    totalAmountCents: safeInteger(row.total_amount_cents, 'total_amount_cents'),
    status: row.status,
    notes: row.notes ?? undefined,
    deliveryDateISO: row.delivery_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataOrigin: row.data_origin,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class SupabaseOrderRepository implements IOrderRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getById(organizationId: string, id: string): Promise<Order | null> {
    if (!isUuid(id)) return null;
    const { data, error } = await this.supabase
      .from('arteflow_orders')
      .select(ORDER_SELECT)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Não foi possível carregar o pedido: ${error.message}`);
    return data ? mapOrder(data as unknown as OrderRow) : null;
  }

  async getByOrderNumber(organizationId: string, orderNumber: string): Promise<Order | null> {
    const { data, error } = await this.supabase
      .from('arteflow_orders')
      .select(ORDER_SELECT)
      .eq('organization_id', organizationId)
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (error) throw new Error(`Não foi possível carregar o pedido: ${error.message}`);
    return data ? mapOrder(data as unknown as OrderRow) : null;
  }

  async list(organizationId: string): Promise<Order[]> {
    const { data, error } = await this.supabase
      .from('arteflow_orders')
      .select(ORDER_SELECT)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Não foi possível carregar os pedidos: ${error.message}`);
    return (data ?? []).map(row => mapOrder(row as unknown as OrderRow));
  }

  async save(organizationId: string, order: Order): Promise<Order> {
    if (order.organizationId !== organizationId) throw new Error('CROSS_TENANT_ORDER_WRITE');

    if (isUuid(order.id)) {
      const { data, error } = await this.supabase.rpc('arteflow_update_order', {
        p_organization_id: organizationId,
        p_order_id: order.id,
        p_status: order.status,
        p_notes: order.notes ?? null,
        p_delivery_date: order.deliveryDateISO,
      });
      if (error) throw new Error(`Não foi possível atualizar o pedido: ${error.message}`);
      return data as Order;
    }

    const { data, error } = await this.supabase.rpc('arteflow_create_order', {
      p_organization_id: organizationId,
      p_origin: order.origin,
      p_customer: order.customer,
      p_items: order.items,
      p_notes: order.notes ?? null,
      p_delivery_date: order.deliveryDateISO,
    });
    if (error) throw new Error(`Não foi possível criar o pedido: ${error.message}`);
    return data as Order;
  }

  async delete(_organizationId: string, _id: string): Promise<boolean> {
    throw new Error('A exclusão de pedidos não está habilitada no modo conectado.');
  }

  async clear(_organizationId: string): Promise<void> {
    throw new Error('A limpeza de pedidos não está habilitada no modo conectado.');
  }
}
