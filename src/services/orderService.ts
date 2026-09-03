import {
  Order,
  OrderItem,
  ProductionJob,
  CustomerSnapshot,
  OrderOrigin,
  Priority,
  DataOrigin,
  ProductionEvent,
} from '../types/domain';
import { IOrderRepository, IProductionJobRepository, IProductionEventRepository } from '../types/repository';
import { calculateOrderTotalCents } from '../domain/money';

export interface CreateManualOrderItemInput {
  productName: string;
  category?: string;
  sector: string;
  width?: number;
  height?: number;
  unit: 'mm' | 'cm' | 'm';
  quantity: number;
  quantityUnit?: string;
  unitPriceCents: number;
  finishings: string[];
  technicalNotes?: string;
  priority?: Priority;
  initialStageId?: string;
}

export interface CreateManualOrderInput {
  organizationId: string;
  origin?: OrderOrigin;
  customer: Omit<CustomerSnapshot, 'id'> & { id?: string };
  items: CreateManualOrderItemInput[];
  notes?: string;
  deliveryDateISO: string;
  authorId?: string;
  authorName?: string;
  dataOrigin?: DataOrigin;
}

export class OrderService {
  constructor(
    private orderRepo: IOrderRepository,
    private jobRepo: IProductionJobRepository,
    private eventRepo: IProductionEventRepository
  ) {}

  private generateId(prefix: string): string {
    const random = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}-${random}`;
  }

  private formatSequentialCode(prefix: string, count: number): string {
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  async createManualOrder(input: CreateManualOrderInput): Promise<{ order: Order; jobs: ProductionJob[] }> {
    const {
      organizationId,
      origin = 'MANUAL',
      customer,
      items: itemInputs,
      notes,
      deliveryDateISO,
      authorId = 'user-current',
      authorName = 'Operador',
      dataOrigin = 'user',
    } = input;

    if (!itemInputs || itemInputs.length === 0) {
      throw new Error('O pedido deve conter pelo menos um item.');
    }

    if (!customer.name.trim()) {
      throw new Error('O nome do cliente é obrigatório.');
    }

    const existingOrders = await this.orderRepo.list(organizationId);
    const existingJobs = await this.jobRepo.list(organizationId);

    const orderId = this.generateId('order');
    const orderNumber = this.formatSequentialCode('PED', existingOrders.length);
    const customerSnapshot: CustomerSnapshot = {
      id: customer.id || this.generateId('cust'),
      name: customer.name.trim(),
      document: customer.document?.trim() || undefined,
      email: customer.email?.trim() || undefined,
      phone: customer.phone?.trim() || undefined,
      contactPerson: customer.contactPerson?.trim() || undefined,
    };

    const nowISO = new Date().toISOString();
    const createdItems: OrderItem[] = [];
    const createdJobs: ProductionJob[] = [];
    const initialEvents: ProductionEvent[] = [];

    let jobCount = existingJobs.length;

    for (const itemInput of itemInputs) {
      const itemId = this.generateId('item');
      const jobId = this.generateId('job');
      const jobCode = this.formatSequentialCode('OP', jobCount);
      jobCount++;

      const itemTotalCents = Math.round(itemInput.quantity * itemInput.unitPriceCents);

      const orderItem: OrderItem = {
        id: itemId,
        orderId,
        productName: itemInput.productName.trim(),
        category: itemInput.category?.trim() || undefined,
        sector: itemInput.sector || 'Impressão Digital',
        dimensions:
          itemInput.width && itemInput.height
            ? {
                width: itemInput.width,
                height: itemInput.height,
                unit: itemInput.unit || 'cm',
              }
            : undefined,
        quantity: itemInput.quantity,
        unit: itemInput.quantityUnit || 'un',
        unitPriceCents: Math.round(itemInput.unitPriceCents),
        totalPriceCents: itemTotalCents,
        finishings: itemInput.finishings || [],
        technicalNotes: itemInput.technicalNotes?.trim() || undefined,
        generatedJobId: jobId,
        dataOrigin,
      };

      createdItems.push(orderItem);

      // Gera a Ordem de Produção independente
      const productionJob: ProductionJob = {
        id: jobId,
        jobCode,
        orderId,
        orderNumber,
        orderItemId: itemId,
        organizationId,
        customer: customerSnapshot,
        productName: orderItem.productName,
        dimensions: orderItem.dimensions,
        quantity: orderItem.quantity,
        unit: orderItem.unit,
        finishings: orderItem.finishings,
        technicalNotes: orderItem.technicalNotes,
        stageId: itemInput.initialStageId || 'stage-entry',
        artworkGate: 'NOT_RECEIVED',
        materialGate: 'NOT_CHECKED',
        financialGate: 'PAYMENT_PENDING',
        priority: itemInput.priority || 'MEDIUM',
        sector: orderItem.sector,
        assignee: null,
        deadlineISO: deliveryDateISO || nowISO,
        createdAt: nowISO,
        updatedAt: nowISO,
        dataOrigin,
      };

      createdJobs.push(productionJob);

      // Log inicial append-only
      initialEvents.push({
        id: this.generateId('evt'),
        jobId,
        organizationId,
        eventType: 'JOB_CREATED',
        toValue: productionJob.stageId,
        description: `Ordem de Produção criada a partir do item "${orderItem.productName}" do Pedido ${orderNumber}`,
        authorId,
        authorName,
        timestamp: nowISO,
        dataOrigin,
      });
    }

    const totalAmountCents = calculateOrderTotalCents(createdItems);

    const order: Order = {
      id: orderId,
      orderNumber,
      organizationId,
      origin,
      customer: customerSnapshot,
      items: createdItems,
      totalAmountCents,
      status: 'IN_PRODUCTION',
      notes: notes?.trim() || undefined,
      deliveryDateISO: deliveryDateISO || nowISO,
      createdAt: nowISO,
      updatedAt: nowISO,
      dataOrigin,
    };

    // Salva no repositório
    const savedOrder = await this.orderRepo.save(organizationId, order);
    const savedItemByGeneratedJobId = new Map(
      savedOrder.items.filter(item => item.generatedJobId).map(item => [item.generatedJobId, item])
    );
    const linkedJobs = createdJobs.map(job => {
      const savedItem = savedItemByGeneratedJobId.get(job.id);
      return {
        ...job,
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        orderItemId: savedItem?.id ?? job.orderItemId,
      };
    });
    const linkedEvents = initialEvents.map(event => ({
      ...event,
      description: event.description.replace(orderNumber, savedOrder.orderNumber),
    }));
    await this.jobRepo.saveMany(organizationId, linkedJobs);
    await this.eventRepo.appendMany(organizationId, linkedEvents);

    return { order: savedOrder, jobs: linkedJobs };
  }
}
