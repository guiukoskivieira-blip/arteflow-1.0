import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Organization,
  User,
  Order,
  ProductionJob,
  WorkflowStage,
  ProductionEvent,
  ProductionJobFilter,
  ArtworkGate,
  MaterialGate,
  FinancialGate,
  Priority,
  InventoryMaterial,
  ProductionMaterialRequirement,
  StockReservation,
  StockMovement,
  MaterialFilter,
} from '../types/domain';
import {
  Supplier,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  ProcurementEvent,
  ProcurementSuggestion,
  PurchaseRequestSource,
} from '../types/procurement';
import { DEMO_USERS } from '../domain/constants';
import { getDemoSeedData, DEMO_ORGANIZATION, getInitialStages } from '../domain/seed';
import { getDemoProcurementSeedData } from '../domain/procurementSeed';
import {
  storageKeys,
  CURRENT_SEED_VERSION,
  SeedState,
  InventorySeedState,
  ProcurementSeedState,
} from '../repositories/storageKeys';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageStageRepository } from '../repositories/localStorageStageRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { LocalStorageMaterialRepository } from '../repositories/localStorageMaterialRepository';
import { LocalStorageRequirementRepository } from '../repositories/localStorageRequirementRepository';
import { LocalStorageReservationRepository } from '../repositories/localStorageReservationRepository';
import { LocalStorageMovementRepository } from '../repositories/localStorageMovementRepository';
import {
  LocalStorageSupplierRepository,
  LocalStoragePurchaseRequestRepository,
  LocalStoragePurchaseRequestItemRepository,
  LocalStoragePurchaseOrderRepository,
  LocalStoragePurchaseOrderItemRepository,
  LocalStorageGoodsReceiptRepository,
  LocalStorageGoodsReceiptItemRepository,
  LocalStorageProcurementEventRepository,
  LocalStorageProcurementSequenceRepository,
} from '../repositories/localStorageProcurementRepositories';
import { OrderService, CreateManualOrderInput } from '../services/orderService';
import {
  JobService,
  TransitionProductionJobStageInput,
  canTransitionStage,
  TransitionCheckResult,
} from '../services/jobService';
import {
  InventoryService,
  CreateMaterialInput,
  UpdateMaterialInput,
  RecordReceiptInput,
  AdjustStockInput,
  AddRequirementInput,
  ReserveRequirementInput,
} from '../services/inventoryService';
import {
  ProcurementService,
  CreateSupplierInput,
  UpdateSupplierInput,
  CreatePurchaseRequestInput,
  CreatePurchaseOrderInput,
  RecordGoodsReceiptInput,
} from '../services/procurementService';
import { computeProcurementSuggestions } from '../services/procurementSuggestionService';

export type AppPage =
  | 'overview'
  | 'orders'
  | 'production'
  | 'inventory'
  | 'purchasing'
  | 'financial'
  | 'dispatch'
  | 'settings';

export interface FeedbackNotification {
  type: 'success' | 'info' | 'error';
  title: string;
  message: string;
}

export interface PrefillRequestItemData {
  materialId: string;
  requestedQuantityMilli?: number;
  reason?: string;
  productionJobId?: string;
  source?: PurchaseRequestSource;
}

interface ArteFlowContextType {
  organization: Organization;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  stages: WorkflowStage[];
  orders: Order[];
  jobs: ProductionJob[];
  events: ProductionEvent[];
  materials: InventoryMaterial[];
  requirements: ProductionMaterialRequirement[];
  reservations: StockReservation[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchaseRequests: PurchaseRequest[];
  purchaseRequestItems: PurchaseRequestItem[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrderItems: PurchaseOrderItem[];
  goodsReceipts: GoodsReceipt[];
  goodsReceiptItems: GoodsReceiptItem[];
  procurementEvents: ProcurementEvent[];
  procurementSuggestions: ProcurementSuggestion[];

  filter: ProductionJobFilter;
  setFilter: (updater: Partial<ProductionJobFilter> | ((prev: ProductionJobFilter) => ProductionJobFilter)) => void;
  resetFilter: () => void;
  materialFilter: MaterialFilter;
  setMaterialFilter: (updater: Partial<MaterialFilter> | ((prev: MaterialFilter) => MaterialFilter)) => void;
  resetMaterialFilter: () => void;

  selectedJob: ProductionJob | null;
  setSelectedJob: (job: ProductionJob | null) => void;
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  selectedMaterial: InventoryMaterial | null;
  setSelectedMaterial: (material: InventoryMaterial | null) => void;
  selectedSupplier: Supplier | null;
  setSelectedSupplier: (supplier: Supplier | null) => void;
  selectedPurchaseOrder: PurchaseOrder | null;
  setSelectedPurchaseOrder: (order: PurchaseOrder | null) => void;
  selectedPurchaseRequest: PurchaseRequest | null;
  setSelectedPurchaseRequest: (request: PurchaseRequest | null) => void;

  isNewOrderModalOpen: boolean;
  setIsNewOrderModalOpen: (open: boolean) => void;
  isJobDrawerOpen: boolean;
  setIsJobDrawerOpen: (open: boolean) => void;
  isOrderDetailsModalOpen: boolean;
  setIsOrderDetailsModalOpen: (open: boolean) => void;
  isNewMaterialModalOpen: boolean;
  setIsNewMaterialModalOpen: (open: boolean) => void;
  isReceiptModalOpen: boolean;
  setIsReceiptModalOpen: (open: boolean) => void;
  isStockAdjustmentModalOpen: boolean;
  setIsStockAdjustmentModalOpen: (open: boolean) => void;
  isMaterialDrawerOpen: boolean;
  setIsMaterialDrawerOpen: (open: boolean) => void;
  receiptTargetMaterial: InventoryMaterial | null;
  setReceiptTargetMaterial: (material: InventoryMaterial | null) => void;
  adjustmentTargetMaterial: InventoryMaterial | null;
  setAdjustmentTargetMaterial: (material: InventoryMaterial | null) => void;

  // Modais de Compras (Fase 2B)
  isNewSupplierModalOpen: boolean;
  setIsNewSupplierModalOpen: (open: boolean) => void;
  isEditSupplierModalOpen: boolean;
  setIsEditSupplierModalOpen: (open: boolean) => void;
  isNewRequestModalOpen: boolean;
  setIsNewRequestModalOpen: (open: boolean) => void;
  isNewPurchaseOrderModalOpen: boolean;
  setIsNewPurchaseOrderModalOpen: (open: boolean) => void;
  isPurchaseOrderDetailDrawerOpen: boolean;
  setIsPurchaseOrderDetailDrawerOpen: (open: boolean) => void;
  isRecordReceiptModalOpen: boolean;
  setIsRecordReceiptModalOpen: (open: boolean) => void;
  prefillRequestItem: PrefillRequestItemData | null;
  setPrefillRequestItem: (data: PrefillRequestItemData | null) => void;

  viewMode: 'kanban' | 'list';
  setViewMode: (mode: 'kanban' | 'list') => void;
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
  feedbackNotification: FeedbackNotification | null;
  setFeedbackNotification: (notification: FeedbackNotification | null) => void;
  clearFeedbackNotification: () => void;

  // Actions Pedidos e Produção
  createManualOrder: (input: Omit<CreateManualOrderInput, 'organizationId' | 'authorId' | 'authorName'>) => Promise<Order>;
  transitionProductionJobStage: (input: Omit<TransitionProductionJobStageInput, 'userId' | 'userName'>) => Promise<ProductionJob>;
  canJobTransitionTo: (job: ProductionJob, targetStageId: string) => TransitionCheckResult;
  moveJobStage: (jobId: string, targetStageId: string, reversionReason?: string) => Promise<void>;
  moveJobNext: (jobId: string) => Promise<void>;
  moveJobPrev: (jobId: string, reversionReason?: string) => Promise<void>;
  updateArtworkGate: (jobId: string, gate: ArtworkGate, note?: string) => Promise<void>;
  updateMaterialGate: (jobId: string, gate: MaterialGate, note?: string) => Promise<void>;
  updateFinancialGate: (jobId: string, gate: FinancialGate, note?: string) => Promise<void>;
  updateJobAssignee: (jobId: string, assignee: { id: string; name: string; email?: string } | null) => Promise<void>;
  updateJobPriority: (jobId: string, priority: Priority) => Promise<void>;
  updateJobDeadline: (jobId: string, deadlineISO: string) => Promise<void>;
  addJobNote: (jobId: string, note: string) => Promise<void>;
  getJobEvents: (jobId: string) => Promise<ProductionEvent[]>;

  // Actions Estoque e Materiais (Fase 2A)
  createMaterial: (input: Omit<CreateMaterialInput, 'userId' | 'userName'>) => Promise<InventoryMaterial>;
  updateMaterial: (materialId: string, input: UpdateMaterialInput) => Promise<InventoryMaterial>;
  recordReceipt: (input: Omit<RecordReceiptInput, 'userId' | 'userName'>) => Promise<void>;
  adjustStock: (input: Omit<AdjustStockInput, 'userId' | 'userName'>) => Promise<void>;
  addJobRequirement: (input: Omit<AddRequirementInput, 'userId' | 'userName'>) => Promise<ProductionMaterialRequirement>;
  reserveRequirement: (input: Omit<ReserveRequirementInput, 'userId' | 'userName'>) => Promise<StockReservation>;
  releaseReservation: (reservationId: string) => Promise<StockReservation>;
  consumeReservation: (reservationId: string) => Promise<void>;
  getMaterialAvailability: (materialId: string) => Promise<{ stockOnHandMilli: number; reservedMilli: number; availableMilli: number }>;
  getMaterialMovements: (materialId: string) => Promise<StockMovement[]>;
  getMaterialReservations: (materialId: string) => Promise<StockReservation[]>;
  getJobRequirements: (jobId: string) => Promise<ProductionMaterialRequirement[]>;
  getJobReservations: (jobId: string) => Promise<StockReservation[]>;

  // Actions Compras e Fornecedores (Fase 2B)
  createSupplier: (input: Omit<CreateSupplierInput, 'userId' | 'userName'>) => Promise<Supplier>;
  updateSupplier: (supplierId: string, input: Omit<UpdateSupplierInput, 'userId' | 'userName'>) => Promise<Supplier>;
  toggleSupplierActive: (supplierId: string) => Promise<Supplier>;
  createPurchaseRequest: (input: Omit<CreatePurchaseRequestInput, 'userId' | 'userName'>) => Promise<{ request: PurchaseRequest; items: PurchaseRequestItem[] }>;
  cancelPurchaseRequest: (requestId: string, reason: string) => Promise<PurchaseRequest>;
  createPurchaseOrder: (input: Omit<CreatePurchaseOrderInput, 'userId' | 'userName'>) => Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }>;
  issuePurchaseOrder: (orderId: string) => Promise<PurchaseOrder>;
  cancelPurchaseOrder: (orderId: string, reason: string) => Promise<PurchaseOrder>;
  recordGoodsReceipt: (input: Omit<RecordGoodsReceiptInput, 'userId' | 'userName'>) => Promise<{ receipt: GoodsReceipt; order: PurchaseOrder; receiptItems: GoodsReceiptItem[] }>;
  getPurchaseOrderItems: (orderId: string) => Promise<PurchaseOrderItem[]>;
  getPurchaseOrderReceipts: (orderId: string) => Promise<GoodsReceipt[]>;
  getPurchaseRequestItems: (requestId: string) => Promise<PurchaseRequestItem[]>;
  getProcurementEvents: (entityType: string, entityId: string) => Promise<ProcurementEvent[]>;

  // Ações de Ambiente
  resetDemoEnvironment: () => Promise<void>;
  resetToDemoSeed: () => Promise<void>;
  clearOperationalData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const defaultFilter: ProductionJobFilter = {
  searchQuery: '',
  stageId: 'ALL',
  priority: 'ALL',
  sector: 'ALL',
  assigneeId: 'ALL',
  deadlineRange: 'ALL',
  gateStatus: 'ALL',
  dataOrigin: 'ALL',
};

const defaultMaterialFilter: MaterialFilter = {
  searchQuery: '',
  category: 'ALL',
  unit: 'ALL',
  belowMinimumOnly: false,
  status: 'ALL',
  dataOrigin: 'ALL',
};

const ArteFlowContext = createContext<ArteFlowContextType | undefined>(undefined);

export const ArteFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organization] = useState<Organization>(DEMO_ORGANIZATION);
  const [currentUser, setCurrentUser] = useState<User>(DEMO_USERS[0]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [materials, setMaterials] = useState<InventoryMaterial[]>([]);
  const [requirements, setRequirements] = useState<ProductionMaterialRequirement[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Compras (Fase 2B) State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseRequestItems, setPurchaseRequestItems] = useState<PurchaseRequestItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [goodsReceiptItems, setGoodsReceiptItems] = useState<GoodsReceiptItem[]>([]);
  const [procurementEvents, setProcurementEvents] = useState<ProcurementEvent[]>([]);

  const [filter, setFilterState] = useState<ProductionJobFilter>(defaultFilter);
  const [materialFilter, setMaterialFilterState] = useState<MaterialFilter>(defaultMaterialFilter);

  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<InventoryMaterial | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [selectedPurchaseRequest, setSelectedPurchaseRequest] = useState<PurchaseRequest | null>(null);

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isJobDrawerOpen, setIsJobDrawerOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);

  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isStockAdjustmentModalOpen, setIsStockAdjustmentModalOpen] = useState(false);
  const [isMaterialDrawerOpen, setIsMaterialDrawerOpen] = useState(false);
  const [receiptTargetMaterial, setReceiptTargetMaterial] = useState<InventoryMaterial | null>(null);
  const [adjustmentTargetMaterial, setAdjustmentTargetMaterial] = useState<InventoryMaterial | null>(null);

  // Modais de Compras (Fase 2B)
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [isEditSupplierModalOpen, setIsEditSupplierModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isNewPurchaseOrderModalOpen, setIsNewPurchaseOrderModalOpen] = useState(false);
  const [isPurchaseOrderDetailDrawerOpen, setIsPurchaseOrderDetailDrawerOpen] = useState(false);
  const [isRecordReceiptModalOpen, setIsRecordReceiptModalOpen] = useState(false);
  const [prefillRequestItem, setPrefillRequestItem] = useState<PrefillRequestItemData | null>(null);

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activePage, setActivePage] = useState<AppPage>('production');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [feedbackNotification, setFeedbackNotification] = useState<FeedbackNotification | null>(null);

  // Instancia repositórios
  const orderRepo = useMemo(() => new LocalStorageOrderRepository(), []);
  const jobRepo = useMemo(() => new LocalStorageJobRepository(), []);
  const stageRepo = useMemo(() => new LocalStorageStageRepository(), []);
  const eventRepo = useMemo(() => new LocalStorageEventRepository(), []);
  const materialRepo = useMemo(() => new LocalStorageMaterialRepository(), []);
  const requirementRepo = useMemo(() => new LocalStorageRequirementRepository(), []);
  const reservationRepo = useMemo(() => new LocalStorageReservationRepository(), []);
  const movementRepo = useMemo(() => new LocalStorageMovementRepository(), []);

  // Repositórios de Compras (Fase 2B)
  const supplierRepo = useMemo(() => new LocalStorageSupplierRepository(), []);
  const requestRepo = useMemo(() => new LocalStoragePurchaseRequestRepository(), []);
  const requestItemRepo = useMemo(() => new LocalStoragePurchaseRequestItemRepository(), []);
  const purchaseOrderRepo = useMemo(() => new LocalStoragePurchaseOrderRepository(), []);
  const purchaseOrderItemRepo = useMemo(() => new LocalStoragePurchaseOrderItemRepository(), []);
  const goodsReceiptRepo = useMemo(() => new LocalStorageGoodsReceiptRepository(), []);
  const goodsReceiptItemRepo = useMemo(() => new LocalStorageGoodsReceiptItemRepository(), []);
  const procurementEventRepo = useMemo(() => new LocalStorageProcurementEventRepository(), []);
  const procurementSequenceRepo = useMemo(() => new LocalStorageProcurementSequenceRepository(), []);

  const orderService = useMemo(
    () => new OrderService(orderRepo, jobRepo, eventRepo),
    [orderRepo, jobRepo, eventRepo]
  );
  const jobService = useMemo(
    () => new JobService(jobRepo, eventRepo, requirementRepo),
    [jobRepo, eventRepo, requirementRepo]
  );
  const inventoryService = useMemo(
    () =>
      new InventoryService(
        materialRepo,
        requirementRepo,
        reservationRepo,
        movementRepo,
        jobRepo,
        eventRepo
      ),
    [materialRepo, requirementRepo, reservationRepo, movementRepo, jobRepo, eventRepo]
  );
  const procurementService = useMemo(
    () =>
      new ProcurementService(
        supplierRepo,
        requestRepo,
        requestItemRepo,
        purchaseOrderRepo,
        purchaseOrderItemRepo,
        goodsReceiptRepo,
        goodsReceiptItemRepo,
        procurementEventRepo,
        procurementSequenceRepo,
        materialRepo,
        inventoryService
      ),
    [
      supplierRepo,
      requestRepo,
      requestItemRepo,
      purchaseOrderRepo,
      purchaseOrderItemRepo,
      goodsReceiptRepo,
      goodsReceiptItemRepo,
      procurementEventRepo,
      procurementSequenceRepo,
      materialRepo,
      inventoryService,
    ]
  );

  const clearFeedbackNotification = useCallback(() => {
    setFeedbackNotification(null);
  }, []);

  const reloadAll = useCallback(async () => {
    const orgId = organization.id;
    const rawState = typeof window !== 'undefined' && window.localStorage
      ? (window.localStorage.getItem(storageKeys.seedState(orgId)) as SeedState | null)
      : null;
    const rawInvState = typeof window !== 'undefined' && window.localStorage
      ? (window.localStorage.getItem(storageKeys.inventorySeedState(orgId)) as InventorySeedState | null)
      : null;
    const rawProcState = typeof window !== 'undefined' && window.localStorage
      ? (window.localStorage.getItem(storageKeys.procurementSeedState(orgId)) as ProcurementSeedState | null)
      : null;

    let loadedStages = await stageRepo.list(orgId);
    let loadedOrders = await orderRepo.list(orgId);
    let loadedJobs = await jobRepo.list(orgId);
    let loadedEvents = await eventRepo.listAll(orgId);
    let loadedMaterials = await materialRepo.list(orgId);
    let loadedReqs = await requirementRepo.listAll(orgId);
    let loadedRes = await reservationRepo.listAll(orgId);
    let loadedMovs = await movementRepo.listAll(orgId);

    let loadedSuppliers = await supplierRepo.listAll(orgId);
    let loadedRequests = await requestRepo.listAll(orgId);
    let loadedRequestItems = await requestItemRepo.listAll(orgId);
    let loadedPurchaseOrders = await purchaseOrderRepo.listAll(orgId);
    let loadedPurchaseOrderItems = await purchaseOrderItemRepo.listAll(orgId);
    let loadedReceipts = await goodsReceiptRepo.listAll(orgId);
    let loadedReceiptItems = await goodsReceiptItemRepo.listAll(orgId);
    let loadedProcEvents = await procurementEventRepo.listAll(orgId);

    const hasUserOrdersOrJobs =
      loadedOrders.some((o) => o.dataOrigin === 'user') ||
      loadedJobs.some((j) => j.dataOrigin === 'user');
    const hasUserMaterials = loadedMaterials.some((m) => m.dataOrigin === 'user');
    const hasUserProcurement = loadedSuppliers.some((s) => s.dataOrigin === 'user');
    const hasUserData = hasUserOrdersOrJobs || hasUserMaterials || hasUserProcurement;

    // 1. Limpeza intencional preservada
    if (
      rawState === 'INTENTIONALLY_CLEARED' ||
      rawInvState === 'INTENTIONALLY_CLEARED' ||
      rawProcState === 'INTENTIONALLY_CLEARED'
    ) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
        window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');
        window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'INTENTIONALLY_CLEARED');
        window.localStorage.setItem(storageKeys.procurementSeedState(orgId), 'INTENTIONALLY_CLEARED');
      }
      if (loadedStages.length === 0) {
        const initialStages = getInitialStages(orgId);
        await stageRepo.saveMany(orgId, initialStages);
        loadedStages = initialStages;
      }
    } else if (hasUserData) {
      // 2. Dados de usuário preservados
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
        window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');
        window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'APPLIED');
        window.localStorage.setItem(storageKeys.procurementSeedState(orgId), 'APPLIED');
      }
      if (loadedStages.length === 0) {
        const initialStages = getInitialStages(orgId);
        await stageRepo.saveMany(orgId, initialStages);
        loadedStages = initialStages;
      }
    } else {
      // 3. Aplicação / Recuperação de Seed Demonstrativo
      const seed = getDemoSeedData(orgId);

      // A. Seed de Etapas
      if (loadedStages.length === 0) {
        await stageRepo.saveMany(orgId, seed.stages);
        loadedStages = seed.stages;
      }

      // B. Seed Geral de Pedidos e OPs (se banco geral está vazio)
      if (loadedOrders.length === 0 && loadedJobs.length === 0) {
        for (const ord of seed.orders) {
          await orderRepo.save(orgId, ord);
        }
        await jobRepo.saveMany(orgId, seed.jobs);
        await eventRepo.appendMany(orgId, seed.events);
        loadedOrders = seed.orders;
        loadedJobs = seed.jobs;
        loadedEvents = seed.events;
      }

      // C. Seed do Módulo de Estoque (independente via inventory_seed_state)
      if (rawInvState === null || rawInvState === 'NEVER_APPLIED') {
        if (loadedMaterials.length === 0) {
          await materialRepo.saveMany(orgId, seed.materials);
          await movementRepo.appendMany(orgId, seed.movements);
          await requirementRepo.saveMany(orgId, seed.requirements);
          await reservationRepo.saveMany(orgId, seed.reservations);

          loadedMaterials = seed.materials;
          loadedMovs = seed.movements;
          loadedReqs = seed.requirements;
          loadedRes = seed.reservations;

          // Sincroniza / deriva MaterialGates das OPs demo
          for (const demoJob of seed.jobs) {
            const existingJob = loadedJobs.find((j) => j.id === demoJob.id);
            if (existingJob) {
              existingJob.materialGate = demoJob.materialGate;
              await jobRepo.save(orgId, existingJob);
            }
          }
          loadedJobs = await jobRepo.list(orgId);
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'APPLIED');
        }
      }

      // D. Seed do Módulo de Compras (Fase 2B - Fornecedores Demo)
      if (rawProcState === null || rawProcState === 'NEVER_APPLIED') {
        if (loadedSuppliers.length === 0) {
          const procSeed = getDemoProcurementSeedData(orgId);
          await supplierRepo.saveMany(orgId, procSeed.suppliers);
          loadedSuppliers = procSeed.suppliers;
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKeys.procurementSeedState(orgId), 'APPLIED');
        }
      }

      // Marca seedVersion e seedState global como APPLIED
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
        window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');
      }
    }

    setStages(loadedStages);
    setOrders(loadedOrders);
    setJobs(loadedJobs);
    setEvents(loadedEvents);
    setMaterials(loadedMaterials);
    setRequirements(loadedReqs);
    setReservations(loadedRes);
    setMovements(loadedMovs);
    setSuppliers(loadedSuppliers);
    setPurchaseRequests(loadedRequests);
    setPurchaseRequestItems(loadedRequestItems);
    setPurchaseOrders(loadedPurchaseOrders);
    setPurchaseOrderItems(loadedPurchaseOrderItems);
    setGoodsReceipts(loadedReceipts);
    setGoodsReceiptItems(loadedReceiptItems);
    setProcurementEvents(loadedProcEvents);
  }, [
    organization.id,
    stageRepo,
    orderRepo,
    jobRepo,
    eventRepo,
    materialRepo,
    requirementRepo,
    reservationRepo,
    movementRepo,
    supplierRepo,
    requestRepo,
    requestItemRepo,
    purchaseOrderRepo,
    purchaseOrderItemRepo,
    goodsReceiptRepo,
    goodsReceiptItemRepo,
    procurementEventRepo,
  ]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Manter entidades selecionadas atualizadas
  useEffect(() => {
    if (selectedJob) {
      const freshJob = jobs.find((j) => j.id === selectedJob.id);
      if (freshJob) setSelectedJob(freshJob);
    }
  }, [jobs, selectedJob?.id]);

  useEffect(() => {
    if (selectedMaterial) {
      const freshMat = materials.find((m) => m.id === selectedMaterial.id);
      if (freshMat) setSelectedMaterial(freshMat);
    }
  }, [materials, selectedMaterial?.id]);

  useEffect(() => {
    if (selectedSupplier) {
      const freshSup = suppliers.find((s) => s.id === selectedSupplier.id);
      if (freshSup) setSelectedSupplier(freshSup);
    }
  }, [suppliers, selectedSupplier?.id]);

  useEffect(() => {
    if (selectedPurchaseOrder) {
      const freshPO = purchaseOrders.find((p) => p.id === selectedPurchaseOrder.id);
      if (freshPO) setSelectedPurchaseOrder(freshPO);
    }
  }, [purchaseOrders, selectedPurchaseOrder?.id]);

  useEffect(() => {
    if (selectedPurchaseRequest) {
      const freshPR = purchaseRequests.find((r) => r.id === selectedPurchaseRequest.id);
      if (freshPR) setSelectedPurchaseRequest(freshPR);
    }
  }, [purchaseRequests, selectedPurchaseRequest?.id]);

  // Cálculo reativo das sugestões de compras (Fase 2B)
  const procurementSuggestions = useMemo(() => {
    const openRequestsMap = purchaseRequests.map((req) => ({
      request: req,
      items: purchaseRequestItems.filter((i) => i.purchaseRequestId === req.id),
    }));

    return computeProcurementSuggestions({
      organizationId: organization.id,
      materials,
      requirements,
      reservations,
      jobs,
      openRequests: openRequestsMap,
    });
  }, [organization.id, materials, requirements, reservations, jobs, purchaseRequests, purchaseRequestItems]);

  const setFilter = useCallback(
    (updater: Partial<ProductionJobFilter> | ((prev: ProductionJobFilter) => ProductionJobFilter)) => {
      setFilterState((prev) => {
        if (typeof updater === 'function') {
          return updater(prev);
        }
        return { ...prev, ...updater };
      });
    },
    []
  );

  const resetFilter = useCallback(() => {
    setFilterState(defaultFilter);
  }, []);

  const setMaterialFilter = useCallback(
    (updater: Partial<MaterialFilter> | ((prev: MaterialFilter) => MaterialFilter)) => {
      setMaterialFilterState((prev) => {
        if (typeof updater === 'function') {
          return updater(prev);
        }
        return { ...prev, ...updater };
      });
    },
    []
  );

  const resetMaterialFilter = useCallback(() => {
    setMaterialFilterState(defaultMaterialFilter);
  }, []);

  // ==========================================
  // AÇÕES: PEDIDOS E PRODUÇÃO
  // ==========================================

  const createManualOrder = useCallback(
    async (input: Omit<CreateManualOrderInput, 'organizationId' | 'authorId' | 'authorName'>) => {
      const result = await orderService.createManualOrder({
        ...input,
        organizationId: organization.id,
        authorId: currentUser.id,
        authorName: currentUser.name,
      });
      await reloadAll();

      setFeedbackNotification({
        type: 'success',
        title: 'Pedido e OPs Criados com Sucesso',
        message: `Pedido ${result.order.orderNumber} e ${result.jobs.length} ${
          result.jobs.length === 1 ? 'Ordem de Produção' : 'Ordens de Produção'
        } gerados no fluxo.`,
      });

      return result.order;
    },
    [orderService, organization.id, currentUser, reloadAll]
  );

  const transitionProductionJobStage = useCallback(
    async (input: Omit<TransitionProductionJobStageInput, 'userId' | 'userName'>) => {
      try {
        const updated = await jobService.transitionProductionJobStage(
          organization.id,
          {
            ...input,
            userId: currentUser.id,
            userName: currentUser.name,
          },
          stages
        );
        await reloadAll();
        return updated;
      } catch (err: any) {
        setFeedbackNotification({
          type: 'error',
          title: 'Transição Não Permitida',
          message: err.message || 'Regras operacionais ou de gates impedem esta movimentação.',
        });
        throw err;
      }
    },
    [jobService, organization.id, currentUser, stages, reloadAll]
  );

  const canJobTransitionTo = useCallback(
    (job: ProductionJob, targetStageId: string): TransitionCheckResult => {
      const hasRequirements = requirements.some((r) => r.productionJobId === job.id);
      return canTransitionStage(job, targetStageId, stages, hasRequirements);
    },
    [requirements, stages]
  );

  const moveJobStage = useCallback(
    async (jobId: string, targetStageId: string, reversionReason?: string) => {
      await transitionProductionJobStage({
        productionJobId: jobId,
        targetStageId,
        method: 'BUTTON',
        reversionReason,
      });
    },
    [transitionProductionJobStage]
  );

  const moveJobNext = useCallback(
    async (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
      const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);
      if (currentIndex >= 0 && currentIndex < sortedStages.length - 1) {
        const nextStage = sortedStages[currentIndex + 1];
        await moveJobStage(jobId, nextStage.id);
      }
    },
    [jobs, stages, moveJobStage]
  );

  const moveJobPrev = useCallback(
    async (jobId: string, reversionReason?: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
      const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);
      if (currentIndex > 0) {
        const prevStage = sortedStages[currentIndex - 1];
        await moveJobStage(jobId, prevStage.id, reversionReason);
      }
    },
    [jobs, stages, moveJobStage]
  );

  const updateArtworkGate = useCallback(
    async (jobId: string, gate: ArtworkGate, note?: string) => {
      const job = await jobRepo.getById(organization.id, jobId);
      if (!job) throw new Error('OP não encontrada.');
      const oldGate = job.artworkGate;
      job.artworkGate = gate;
      job.updatedAt = new Date().toISOString();
      await jobRepo.save(organization.id, job);

      await eventRepo.append(organization.id, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId: organization.id,
        eventType: 'ARTWORK_GATE_CHANGED',
        description: `Gate de Arte alterado de ${oldGate} para ${gate}${note ? ` — Nota: ${note}` : ''}`,
        fromValue: oldGate,
        toValue: gate,
        authorId: currentUser.id,
        authorName: currentUser.name,
        timestamp: new Date().toISOString(),
      });

      await reloadAll();
    },
    [jobRepo, eventRepo, organization.id, currentUser, reloadAll]
  );

  const updateMaterialGate = useCallback(
    async (jobId: string, gate: MaterialGate, note?: string) => {
      const job = await jobRepo.getById(organization.id, jobId);
      if (!job) throw new Error('OP não encontrada.');
      const oldGate = job.materialGate;
      job.materialGate = gate;
      job.updatedAt = new Date().toISOString();
      await jobRepo.save(organization.id, job);

      await eventRepo.append(organization.id, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId: organization.id,
        eventType: 'MATERIAL_GATE_CHANGED',
        description: `Gate de Material alterado de ${oldGate} para ${gate}${note ? ` — Nota: ${note}` : ''}`,
        fromValue: oldGate,
        toValue: gate,
        authorId: currentUser.id,
        authorName: currentUser.name,
        timestamp: new Date().toISOString(),
      });

      await reloadAll();
    },
    [jobRepo, eventRepo, organization.id, currentUser, reloadAll]
  );

  const updateFinancialGate = useCallback(
    async (jobId: string, gate: FinancialGate, note?: string) => {
      const job = await jobRepo.getById(organization.id, jobId);
      if (!job) throw new Error('OP não encontrada.');
      const oldGate = job.financialGate;
      job.financialGate = gate;
      job.updatedAt = new Date().toISOString();
      await jobRepo.save(organization.id, job);

      await eventRepo.append(organization.id, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId: organization.id,
        eventType: 'FINANCIAL_GATE_CHANGED',
        description: `Gate Financeiro alterado de ${oldGate} para ${gate}${note ? ` — Nota: ${note}` : ''}`,
        fromValue: oldGate,
        toValue: gate,
        authorId: currentUser.id,
        authorName: currentUser.name,
        timestamp: new Date().toISOString(),
      });

      await reloadAll();
    },
    [jobRepo, eventRepo, organization.id, currentUser, reloadAll]
  );

  const updateJobAssignee = useCallback(
    async (jobId: string, assignee: { id: string; name: string; email?: string } | null) => {
      const job = await jobRepo.getById(organization.id, jobId);
      if (!job) throw new Error('OP não encontrada.');
      job.assignee = assignee ? { ...assignee } : null;
      job.updatedAt = new Date().toISOString();
      await jobRepo.save(organization.id, job);

      await eventRepo.append(organization.id, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId: organization.id,
        eventType: 'NOTE_ADDED',
        description: assignee ? `Responsável atribuído: ${assignee.name}` : 'Responsável desatribuído',
        authorId: currentUser.id,
        authorName: currentUser.name,
        timestamp: new Date().toISOString(),
      });

      await reloadAll();
    },
    [jobRepo, eventRepo, organization.id, currentUser, reloadAll]
  );

  const updateJobPriority = useCallback(
    async (jobId: string, priority: Priority) => {
      const job = await jobRepo.getById(organization.id, jobId);
      if (!job) throw new Error('OP não encontrada.');
      const old = job.priority;
      job.priority = priority;
      job.updatedAt = new Date().toISOString();
      await jobRepo.save(organization.id, job);

      await eventRepo.append(organization.id, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId: organization.id,
        eventType: 'NOTE_ADDED',
        description: `Prioridade alterada de ${old} para ${priority}`,
        authorId: currentUser.id,
        authorName: currentUser.name,
        timestamp: new Date().toISOString(),
      });

      await reloadAll();
    },
    [jobRepo, eventRepo, organization.id, currentUser, reloadAll]
  );

  const updateJobDeadline = useCallback(
    async (jobId: string, deadlineISO: string) => {
      const job = await jobRepo.getById(organization.id, jobId);
      if (!job) throw new Error('OP não encontrada.');
      job.deadlineISO = deadlineISO;
      job.updatedAt = new Date().toISOString();
      await jobRepo.save(organization.id, job);

      await eventRepo.append(organization.id, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId: organization.id,
        eventType: 'NOTE_ADDED',
        description: `Prazo de entrega alterado para ${new Date(deadlineISO).toLocaleDateString('pt-BR')}`,
        authorId: currentUser.id,
        authorName: currentUser.name,
        timestamp: new Date().toISOString(),
      });

      await reloadAll();
    },
    [jobRepo, eventRepo, organization.id, currentUser, reloadAll]
  );

  const addJobNote = useCallback(
    async (jobId: string, note: string) => {
      const job = await jobRepo.getById(organization.id, jobId);
      if (!job) throw new Error('OP não encontrada.');
      job.technicalNotes = job.technicalNotes ? `${job.technicalNotes}\n${note}` : note;
      job.updatedAt = new Date().toISOString();
      await jobRepo.save(organization.id, job);

      await eventRepo.append(organization.id, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId: organization.id,
        eventType: 'NOTE_ADDED',
        description: `Nota adicionada: ${note}`,
        authorId: currentUser.id,
        authorName: currentUser.name,
        timestamp: new Date().toISOString(),
      });

      await reloadAll();
    },
    [jobRepo, eventRepo, organization.id, currentUser, reloadAll]
  );

  const getJobEvents = useCallback(
    async (jobId: string) => {
      return await eventRepo.listByJobId(organization.id, jobId);
    },
    [eventRepo, organization.id]
  );

  // ==========================================
  // AÇÕES: ESTOQUE E MATERIAIS (FASE 2A)
  // ==========================================

  const createMaterial = useCallback(
    async (input: Omit<CreateMaterialInput, 'userId' | 'userName'>) => {
      const result = await inventoryService.createMaterial(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Material Cadastrado',
        message: `Material ${result.material.sku} - ${result.material.name} cadastrado com sucesso.`,
      });
      return result.material;
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const updateMaterial = useCallback(
    async (materialId: string, input: UpdateMaterialInput) => {
      const updated = await inventoryService.updateMaterial(organization.id, materialId, input);
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Material Atualizado',
        message: `Dados do material ${updated.sku} foram atualizados.`,
      });
      return updated;
    },
    [inventoryService, organization.id, reloadAll]
  );

  const recordReceipt = useCallback(
    async (input: Omit<RecordReceiptInput, 'userId' | 'userName'>) => {
      await inventoryService.recordReceipt(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Entrada Registrada',
        message: `Entrada física de ${input.quantityMilli / 1000} unidade(s) registrada no estoque.`,
      });
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const adjustStock = useCallback(
    async (input: Omit<AdjustStockInput, 'userId' | 'userName'>) => {
      await inventoryService.adjustStock(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'info',
        title: 'Ajuste de Estoque Realizado',
        message: `Movimentação de ajuste registrada com sucesso no histórico.`,
      });
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const addJobRequirement = useCallback(
    async (input: Omit<AddRequirementInput, 'userId' | 'userName'>) => {
      const req = await inventoryService.addRequirement(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Requisito de Material Vinculado',
        message: `Necessidade de ${req.requiredQuantityMilli / 1000} ${req.materialSnapshot.unit} vinculada à OP.`,
      });
      return req;
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const reserveRequirement = useCallback(
    async (input: Omit<ReserveRequirementInput, 'userId' | 'userName'>) => {
      const res = await inventoryService.reserveRequirement(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Material Reservado',
        message: `Reserva de ${res.reservedQuantityMilli / 1000} unidade(s) confirmada para produção.`,
      });
      return res;
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const releaseReservation = useCallback(
    async (reservationId: string) => {
      const res = await inventoryService.releaseReservation(
        organization.id,
        reservationId,
        currentUser
      );
      await reloadAll();
      setFeedbackNotification({
        type: 'info',
        title: 'Reserva Liberada',
        message: `Saldo devolvido para a disponibilidade do estoque.`,
      });
      return res;
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const consumeReservation = useCallback(
    async (reservationId: string) => {
      await inventoryService.consumeReservation(organization.id, reservationId, currentUser);
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Material Consumido',
        message: `Baixa física e consumo registrados para a produção da OP.`,
      });
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const getMaterialAvailability = useCallback(
    async (materialId: string) => {
      return await inventoryService.getMaterialAvailability(organization.id, materialId);
    },
    [inventoryService, organization.id]
  );

  const getMaterialMovements = useCallback(
    async (materialId: string) => {
      return await movementRepo.listByMaterialId(organization.id, materialId);
    },
    [movementRepo, organization.id]
  );

  const getMaterialReservations = useCallback(
    async (materialId: string) => {
      return await reservationRepo.listByMaterialId(organization.id, materialId);
    },
    [reservationRepo, organization.id]
  );

  const getJobRequirements = useCallback(
    async (jobId: string) => {
      return await requirementRepo.listByJobId(organization.id, jobId);
    },
    [requirementRepo, organization.id]
  );

  const getJobReservations = useCallback(
    async (jobId: string) => {
      return await reservationRepo.listByJobId(organization.id, jobId);
    },
    [reservationRepo, organization.id]
  );

  // ==========================================
  // AÇÕES: COMPRAS E FORNECEDORES (FASE 2B)
  // ==========================================

  const createSupplier = useCallback(
    async (input: Omit<CreateSupplierInput, 'userId' | 'userName'>) => {
      const sup = await procurementService.createSupplier(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Fornecedor Cadastrado',
        message: `Fornecedor ${sup.code} - ${sup.tradeName} cadastrado com sucesso.`,
      });
      return sup;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const updateSupplier = useCallback(
    async (supplierId: string, input: Omit<UpdateSupplierInput, 'userId' | 'userName'>) => {
      const updated = await procurementService.updateSupplier(organization.id, supplierId, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Fornecedor Atualizado',
        message: `Dados do fornecedor ${updated.tradeName} foram atualizados.`,
      });
      return updated;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const toggleSupplierActive = useCallback(
    async (supplierId: string) => {
      const sup = await procurementService.toggleSupplierActive(
        organization.id,
        supplierId,
        currentUser.id,
        currentUser.name
      );
      await reloadAll();
      setFeedbackNotification({
        type: 'info',
        title: `Fornecedor ${sup.isActive ? 'Ativado' : 'Desativado'}`,
        message: `Status do fornecedor ${sup.tradeName} alterado com sucesso.`,
      });
      return sup;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const createPurchaseRequest = useCallback(
    async (input: Omit<CreatePurchaseRequestInput, 'userId' | 'userName'>) => {
      const result = await procurementService.createPurchaseRequest(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Solicitação de Compra Criada',
        message: `Solicitação ${result.request.requestNumber} registrada com ${result.items.length} item(ns).`,
      });
      return result;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const cancelPurchaseRequest = useCallback(
    async (requestId: string, reason: string) => {
      const req = await procurementService.cancelPurchaseRequest(
        organization.id,
        requestId,
        reason,
        currentUser.id,
        currentUser.name
      );
      await reloadAll();
      setFeedbackNotification({
        type: 'info',
        title: 'Solicitação Cancelada',
        message: `Solicitação ${req.requestNumber} foi cancelada.`,
      });
      return req;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const createPurchaseOrder = useCallback(
    async (input: Omit<CreatePurchaseOrderInput, 'userId' | 'userName'>) => {
      const result = await procurementService.createPurchaseOrder(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Pedido de Compra Criado',
        message: `Pedido ${result.order.orderNumber} criado em Rascunho para ${result.order.supplierSnapshot.tradeName}.`,
      });
      return result;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const issuePurchaseOrder = useCallback(
    async (orderId: string) => {
      const order = await procurementService.issuePurchaseOrder(
        organization.id,
        orderId,
        currentUser.id,
        currentUser.name
      );
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Pedido de Compra Emitido',
        message: `Pedido ${order.orderNumber} emitido com sucesso. Aguardando entrega do fornecedor.`,
      });
      return order;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const cancelPurchaseOrder = useCallback(
    async (orderId: string, reason: string) => {
      const order = await procurementService.cancelPurchaseOrder(
        organization.id,
        orderId,
        reason,
        currentUser.id,
        currentUser.name
      );
      await reloadAll();
      setFeedbackNotification({
        type: 'info',
        title: 'Pedido de Compra Cancelado',
        message: `Pedido ${order.orderNumber} foi cancelado.`,
      });
      return order;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const recordGoodsReceipt = useCallback(
    async (input: Omit<RecordGoodsReceiptInput, 'userId' | 'userName'>) => {
      const result = await procurementService.recordGoodsReceipt(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();
      setFeedbackNotification({
        type: 'success',
        title: 'Recebimento Registrado',
        message: `Recebimento ${result.receipt.receiptNumber} lançado no estoque com sucesso.`,
      });
      return result;
    },
    [procurementService, organization.id, currentUser, reloadAll]
  );

  const getPurchaseOrderItems = useCallback(
    async (orderId: string) => {
      return await purchaseOrderItemRepo.listByOrderId(organization.id, orderId);
    },
    [purchaseOrderItemRepo, organization.id]
  );

  const getPurchaseOrderReceipts = useCallback(
    async (orderId: string) => {
      return await goodsReceiptRepo.listByOrderId(organization.id, orderId);
    },
    [goodsReceiptRepo, organization.id]
  );

  const getPurchaseRequestItems = useCallback(
    async (requestId: string) => {
      return await requestItemRepo.listByRequestId(organization.id, requestId);
    },
    [requestItemRepo, organization.id]
  );

  const getProcurementEvents = useCallback(
    async (entityType: string, entityId: string) => {
      return await procurementEventRepo.listByEntity(organization.id, entityType, entityId);
    },
    [procurementEventRepo, organization.id]
  );

  // ==========================================
  // AMBIENTE & SEED
  // ==========================================

  const resetDemoEnvironment = useCallback(async () => {
    const orgId = organization.id;

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(storageKeys.orders(orgId));
      window.localStorage.removeItem(storageKeys.jobs(orgId));
      window.localStorage.removeItem(storageKeys.events(orgId));
      window.localStorage.removeItem(storageKeys.materials(orgId));
      window.localStorage.removeItem(storageKeys.requirements(orgId));
      window.localStorage.removeItem(storageKeys.reservations(orgId));
      window.localStorage.removeItem(storageKeys.movements(orgId));
      window.localStorage.removeItem(storageKeys.suppliers(orgId));
      window.localStorage.removeItem(storageKeys.purchaseRequests(orgId));
      window.localStorage.removeItem(storageKeys.purchaseRequestItems(orgId));
      window.localStorage.removeItem(storageKeys.purchaseOrders(orgId));
      window.localStorage.removeItem(storageKeys.purchaseOrderItems(orgId));
      window.localStorage.removeItem(storageKeys.goodsReceipts(orgId));
      window.localStorage.removeItem(storageKeys.goodsReceiptItems(orgId));
      window.localStorage.removeItem(storageKeys.procurementEvents(orgId));
      window.localStorage.removeItem(storageKeys.procurementSequences(orgId));
      window.localStorage.removeItem(storageKeys.seedState(orgId));
      window.localStorage.removeItem(storageKeys.inventorySeedState(orgId));
      window.localStorage.removeItem(storageKeys.procurementSeedState(orgId));
      window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
    }

    await reloadAll();
  }, [organization.id, reloadAll]);

  const resetToDemoSeed = resetDemoEnvironment;

  const clearOperationalData = useCallback(async () => {
    const orgId = organization.id;

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(storageKeys.orders(orgId));
      window.localStorage.removeItem(storageKeys.jobs(orgId));
      window.localStorage.removeItem(storageKeys.events(orgId));
      window.localStorage.removeItem(storageKeys.materials(orgId));
      window.localStorage.removeItem(storageKeys.requirements(orgId));
      window.localStorage.removeItem(storageKeys.reservations(orgId));
      window.localStorage.removeItem(storageKeys.movements(orgId));
      window.localStorage.removeItem(storageKeys.suppliers(orgId));
      window.localStorage.removeItem(storageKeys.purchaseRequests(orgId));
      window.localStorage.removeItem(storageKeys.purchaseRequestItems(orgId));
      window.localStorage.removeItem(storageKeys.purchaseOrders(orgId));
      window.localStorage.removeItem(storageKeys.purchaseOrderItems(orgId));
      window.localStorage.removeItem(storageKeys.goodsReceipts(orgId));
      window.localStorage.removeItem(storageKeys.goodsReceiptItems(orgId));
      window.localStorage.removeItem(storageKeys.procurementEvents(orgId));
      window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
      window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');
      window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'INTENTIONALLY_CLEARED');
      window.localStorage.setItem(storageKeys.procurementSeedState(orgId), 'INTENTIONALLY_CLEARED');
    }

    await reloadAll();
  }, [organization.id, reloadAll]);

  const clearAllData = clearOperationalData;

  return (
    <ArteFlowContext.Provider
      value={{
        organization,
        currentUser,
        setCurrentUser,
        stages,
        orders,
        jobs,
        events,
        materials,
        requirements,
        reservations,
        movements,
        suppliers,
        purchaseRequests,
        purchaseRequestItems,
        purchaseOrders,
        purchaseOrderItems,
        goodsReceipts,
        goodsReceiptItems,
        procurementEvents,
        procurementSuggestions,

        filter,
        setFilter,
        resetFilter,
        materialFilter,
        setMaterialFilter,
        resetMaterialFilter,

        selectedJob,
        setSelectedJob,
        selectedOrder,
        setSelectedOrder,
        selectedMaterial,
        setSelectedMaterial,
        selectedSupplier,
        setSelectedSupplier,
        selectedPurchaseOrder,
        setSelectedPurchaseOrder,
        selectedPurchaseRequest,
        setSelectedPurchaseRequest,

        isNewOrderModalOpen,
        setIsNewOrderModalOpen,
        isJobDrawerOpen,
        setIsJobDrawerOpen,
        isOrderDetailsModalOpen,
        setIsOrderDetailsModalOpen,
        isNewMaterialModalOpen,
        setIsNewMaterialModalOpen,
        isReceiptModalOpen,
        setIsReceiptModalOpen,
        isStockAdjustmentModalOpen,
        setIsStockAdjustmentModalOpen,
        isMaterialDrawerOpen,
        setIsMaterialDrawerOpen,
        receiptTargetMaterial,
        setReceiptTargetMaterial,
        adjustmentTargetMaterial,
        setAdjustmentTargetMaterial,

        isNewSupplierModalOpen,
        setIsNewSupplierModalOpen,
        isEditSupplierModalOpen,
        setIsEditSupplierModalOpen,
        isNewRequestModalOpen,
        setIsNewRequestModalOpen,
        isNewPurchaseOrderModalOpen,
        setIsNewPurchaseOrderModalOpen,
        isPurchaseOrderDetailDrawerOpen,
        setIsPurchaseOrderDetailDrawerOpen,
        isRecordReceiptModalOpen,
        setIsRecordReceiptModalOpen,
        prefillRequestItem,
        setPrefillRequestItem,

        viewMode,
        setViewMode,
        activePage,
        setActivePage,
        isMobileDrawerOpen,
        setIsMobileDrawerOpen,
        feedbackNotification,
        setFeedbackNotification,
        clearFeedbackNotification,

        createManualOrder,
        transitionProductionJobStage,
        canJobTransitionTo,
        moveJobStage,
        moveJobNext,
        moveJobPrev,
        updateArtworkGate,
        updateMaterialGate,
        updateFinancialGate,
        updateJobAssignee,
        updateJobPriority,
        updateJobDeadline,
        addJobNote,
        getJobEvents,

        createMaterial,
        updateMaterial,
        recordReceipt,
        adjustStock,
        addJobRequirement,
        reserveRequirement,
        releaseReservation,
        consumeReservation,
        getMaterialAvailability,
        getMaterialMovements,
        getMaterialReservations,
        getJobRequirements,
        getJobReservations,

        createSupplier,
        updateSupplier,
        toggleSupplierActive,
        createPurchaseRequest,
        cancelPurchaseRequest,
        createPurchaseOrder,
        issuePurchaseOrder,
        cancelPurchaseOrder,
        recordGoodsReceipt,
        getPurchaseOrderItems,
        getPurchaseOrderReceipts,
        getPurchaseRequestItems,
        getProcurementEvents,

        resetDemoEnvironment,
        resetToDemoSeed,
        clearOperationalData,
        clearAllData,
        reloadAll,
      }}
    >
      {children}
    </ArteFlowContext.Provider>
  );
};

export const useArteFlow = () => {
  const context = useContext(ArteFlowContext);
  if (!context) {
    throw new Error('useArteFlow deve ser utilizado dentro de um ArteFlowProvider');
  }
  return context;
};
