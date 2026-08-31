export type ReceivableStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type PaymentMethod = 'PIX' | 'TRANSFER' | 'CASH' | 'CARD' | 'OTHER';

export interface ReceivableAccount {
  id: string;
  organizationId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalCents: number;
  receivedCents: number;
  dueDateISO: string;
  status: ReceivableStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivablePayment {
  id: string;
  organizationId: string;
  receivableId: string;
  amountCents: number;
  paidAt: string;
  method: PaymentMethod;
  notes?: string;
  idempotencyKey: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface FinancialIndicators {
  totalReceivableCents: number;
  totalReceivedCents: number;
  totalOverdueCents: number;
  openBalanceCents: number;
  pendingCount: number;
}

export interface IReceivableRepository {
  list(organizationId: string): Promise<ReceivableAccount[]>;
  getById(organizationId: string, id: string): Promise<ReceivableAccount | null>;
  getByOrderId(organizationId: string, orderId: string): Promise<ReceivableAccount | null>;
  save(organizationId: string, account: ReceivableAccount): Promise<ReceivableAccount>;
  saveMany(organizationId: string, accounts: ReceivableAccount[]): Promise<ReceivableAccount[]>;
}

export interface IReceivablePaymentRepository {
  list(organizationId: string): Promise<ReceivablePayment[]>;
  listByReceivableId(organizationId: string, receivableId: string): Promise<ReceivablePayment[]>;
  getByIdempotencyKey(organizationId: string, key: string): Promise<ReceivablePayment | null>;
  save(organizationId: string, payment: ReceivablePayment): Promise<ReceivablePayment>;
}
