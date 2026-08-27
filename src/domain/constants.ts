import { WorkflowStage, ArtworkGate, MaterialGate, FinancialGate, Priority } from '../types/domain';

export const DEFAULT_ORGANIZATION_ID = 'org-demo-grafica';

export const INITIAL_WORKFLOW_STAGES: Omit<WorkflowStage, 'organizationId'>[] = [
  {
    id: 'stage-entry',
    name: 'Entrada',
    description: 'Pedido recebido e triado para produção',
    sequence: 1,
    color: '#64748b', // Slate
    isInitial: true,
    dataOrigin: 'demo',
  },
  {
    id: 'stage-awaiting-file',
    name: 'Aguardando arquivo',
    description: 'Aguardando envio do arquivo final pelo cliente',
    sequence: 2,
    color: '#f59e0b', // Amber
    dataOrigin: 'demo',
  },
  {
    id: 'stage-prepress',
    name: 'Pré-impressão',
    description: 'Fechamento de arquivo, imposição e RIP',
    sequence: 3,
    color: '#0284c7', // Sky blue
    dataOrigin: 'demo',
  },
  {
    id: 'stage-awaiting-approval',
    name: 'Aguardando aprovação',
    description: 'Prova digital enviada para aprovação do cliente',
    sequence: 4,
    color: '#8b5cf6', // Violet
    dataOrigin: 'demo',
  },
  {
    id: 'stage-awaiting-material',
    name: 'Aguardando material',
    description: 'Aguardando chegada ou separação de substratos e insumos',
    sequence: 5,
    color: '#d97706', // Amber dark
    dataOrigin: 'demo',
  },
  {
    id: 'stage-scheduled',
    name: 'Programado',
    description: 'Na fila de máquinas ou mesas de corte',
    sequence: 6,
    color: '#3b82f6', // Blue
    dataOrigin: 'demo',
  },
  {
    id: 'stage-in-production',
    name: 'Em produção',
    description: 'Em processo de impressão / confecção',
    sequence: 7,
    color: '#0d9488', // Teal
    dataOrigin: 'demo',
  },
  {
    id: 'stage-finishing',
    name: 'Acabamento',
    description: 'Corte, refile, ilhós, laminação ou solda',
    sequence: 8,
    color: '#0891b2', // Cyan
    dataOrigin: 'demo',
  },
  {
    id: 'stage-quality-control',
    name: 'Controle de qualidade',
    description: 'Conferência técnica dimensional e cromática',
    sequence: 9,
    color: '#4f46e5', // Indigo
    dataOrigin: 'demo',
  },
  {
    id: 'stage-ready',
    name: 'Pronto',
    description: 'Embalado e pronto para expedição ou retirada',
    sequence: 10,
    color: '#10b981', // Emerald
    isFinal: true,
    dataOrigin: 'demo',
  },
  {
    id: 'stage-delivered',
    name: 'Entregue',
    description: 'Entregue ou despachado ao cliente',
    sequence: 11,
    color: '#059669', // Dark emerald
    isTerminal: true,
    dataOrigin: 'demo',
  },
];

export const ARTWORK_GATE_CONFIG: Record<
  ArtworkGate,
  { label: string; bgClass: string; textClass: string; borderClass: string; isBlocking: boolean }
> = {
  NOT_RECEIVED: {
    label: 'Não recebida',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    isBlocking: false,
  },
  PENDING_REVIEW: {
    label: 'Em análise',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    isBlocking: false,
  },
  APPROVED: {
    label: 'Aprovada',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    isBlocking: false,
  },
  REJECTED: {
    label: 'Reprovada',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    isBlocking: true,
  },
};

export const MATERIAL_GATE_CONFIG: Record<
  MaterialGate,
  { label: string; bgClass: string; textClass: string; borderClass: string; isBlocking: boolean }
> = {
  NOT_CHECKED: {
    label: 'Não verificado',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-200',
    isBlocking: false,
  },
  AVAILABLE: {
    label: 'Disponível',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    isBlocking: false,
  },
  RESERVED: {
    label: 'Reservado',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-200',
    isBlocking: false,
  },
  MISSING: {
    label: 'Em falta',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    isBlocking: true,
  },
};

export const FINANCIAL_GATE_CONFIG: Record<
  FinancialGate,
  { label: string; bgClass: string; textClass: string; borderClass: string; isBlocking: boolean }
> = {
  RELEASED: {
    label: 'Liberado',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    isBlocking: false,
  },
  DEPOSIT_PENDING: {
    label: 'Sinal pendente',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    isBlocking: false,
  },
  PAYMENT_PENDING: {
    label: 'Pagamento pendente',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    isBlocking: false,
  },
  BLOCKED: {
    label: 'Bloqueado',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    isBlocking: true,
  },
};

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; bgClass: string; textClass: string; borderClass: string; dotClass: string }
> = {
  LOW: {
    label: 'Baixa',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    dotClass: 'bg-slate-400',
  },
  MEDIUM: {
    label: 'Média',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    dotClass: 'bg-blue-500',
  },
  HIGH: {
    label: 'Alta',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    dotClass: 'bg-amber-500',
  },
  URGENT: {
    label: 'Urgente',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    dotClass: 'bg-red-600',
  },
};

export const SECTORS = [
  'Pré-Impressão & Design',
  'Impressão Digital',
  'Comunicação Visual',
  'Impressão Offset',
  'Acabamento Gráfico',
  'Serralheria & Estrutura',
  'Expedição',
];

export const DEMO_USERS = [
  {
    id: 'user-demo-1',
    name: 'Carlos Oliveira',
    email: 'carlos.operador@arteflow.demo',
    role: 'OPERADOR' as const,
    organizationId: DEFAULT_ORGANIZATION_ID,
  },
  {
    id: 'user-demo-2',
    name: 'Mariana Souza',
    email: 'mariana.designer@arteflow.demo',
    role: 'DESIGNER' as const,
    organizationId: DEFAULT_ORGANIZATION_ID,
  },
  {
    id: 'user-demo-3',
    name: 'Roberto Mendes',
    email: 'roberto.producao@arteflow.demo',
    role: 'PRODUCAO' as const,
    organizationId: DEFAULT_ORGANIZATION_ID,
  },
];
