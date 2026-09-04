/**
 * ArteFlow — Domínio e Tipos Estritos (Fase 1 e Fase 2A)
 * Gestão de Produção para Gráficas e Comunicação Visual
 */

export type DataOrigin = 'demo' | 'user';

export type OrderOrigin = 'MANUAL' | 'ORCAGRAF';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

export type ArtworkGate = 'NOT_RECEIVED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export type MaterialGate = 'NOT_CHECKED' | 'AVAILABLE' | 'RESERVED' | 'MISSING';

export type FinancialGate = 'RELEASED' | 'DEPOSIT_PENDING' | 'PAYMENT_PENDING' | 'BLOCKED';

export type EventType =
  | 'JOB_CREATED'
  | 'STAGE_CHANGED'
  | 'ARTWORK_GATE_CHANGED'
  | 'MATERIAL_GATE_CHANGED'
  | 'FINANCIAL_GATE_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'DEADLINE_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'NOTE_ADDED'
  | 'REQUIREMENT_ADDED'
  | 'MATERIAL_RESERVED'
  | 'RESERVATION_RELEASED'
  | 'MATERIAL_CONSUMED';

export interface Organization {
  id: string;
  name: string;
  document?: string;
  segment: 'GRAFICA_RAPIDA' | 'COMUNICACAO_VISUAL' | 'GRAFICA_OFFSET' | 'GERAL';
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OPERADOR' | 'DESIGNER' | 'PRODUCAO' | 'GERENTE' | 'ADMIN';
  avatarColor?: string;
  organizationId: string;
}

export interface CustomerSnapshot {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
}

export interface OrderItemDimensions {
  width: number;
  height: number;
  unit: 'mm' | 'cm' | 'm';
}

export interface OrderItem {
  id: string;
  orderId: string;
  productName: string;
  category?: string;
  sector: string;
  dimensions?: OrderItemDimensions;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  totalPriceCents: number;
  finishings: string[];
  technicalNotes?: string;
  generatedJobId?: string;
  dataOrigin: DataOrigin;
}

export interface Order {
  id: string;
  orderNumber: string;
  organizationId: string;
  origin: OrderOrigin;
  customer: CustomerSnapshot;
  items: OrderItem[];
  totalAmountCents: number;
  status: OrderStatus;
  notes?: string;
  deliveryDateISO: string;
  createdAt: string;
  updatedAt: string;
  dataOrigin: DataOrigin;
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  sequence: number;
  color: string;
  isInitial?: boolean;
  isFinal?: boolean;
  isTerminal?: boolean;
  organizationId: string;
  dataOrigin: DataOrigin;
}

export interface ProductionJob {
  id: string;
  jobCode: string;
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  organizationId: string;
  customer: CustomerSnapshot;
  productName: string;
  dimensions?: OrderItemDimensions;
  quantity: number;
  unit: string;
  finishings: string[];
  technicalNotes?: string;
  stageId: string;
  artworkGate: ArtworkGate;
  materialGate: MaterialGate;
  financialGate: FinancialGate;
  priority: Priority;
  sector: string;
  assignee: {
    id: string;
    name: string;
    email?: string;
  } | null;
  deadlineISO: string;
  createdAt: string;
  updatedAt: string;
  /** Optimistic concurrency token supplied by PostgreSQL in connected mode. */
  version?: number;
  dataOrigin: DataOrigin;
}

export interface ProductionEvent {
  id: string;
  jobId: string;
  organizationId: string;
  eventType: EventType;
  fromValue?: string;
  toValue?: string;
  stageFromId?: string;
  stageToId?: string;
  method?: 'BUTTON' | 'DRAG_DROP' | 'KEYBOARD';
  description: string;
  reason?: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  dataOrigin?: DataOrigin;
}

export interface ProductionJobFilter {
  searchQuery: string;
  stageId: string;
  priority: string;
  sector: string;
  assigneeId: string;
  deadlineRange: 'ALL' | 'OVERDUE' | 'TODAY' | 'THIS_WEEK' | 'FUTURE';
  gateStatus: 'ALL' | 'BLOCKED' | 'ARTWORK_PENDING' | 'MATERIAL_MISSING' | 'FINANCIAL_BLOCKED' | 'ALL_RELEASED';
  dataOrigin: 'ALL' | 'demo' | 'user';
}

// Re-exportações de tipos do módulo de inventário (Fase 2A)
export * from './inventory';
