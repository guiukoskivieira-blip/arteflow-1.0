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
import { DEMO_USERS } from '../domain/constants';
import { getDemoSeedData, DEMO_ORGANIZATION, getInitialStages } from '../domain/seed';
import { storageKeys, CURRENT_SEED_VERSION, SeedState, InventorySeedState } from '../repositories/storageKeys';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageStageRepository } from '../repositories/localStorageStageRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { LocalStorageMaterialRepository } from '../repositories/localStorageMaterialRepository';
import { LocalStorageRequirementRepository } from '../repositories/localStorageRequirementRepository';
import { LocalStorageReservationRepository } from '../repositories/localStorageReservationRepository';
import { LocalStorageMovementRepository } from '../repositories/localStorageMovementRepository';
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

  const [filter, setFilterState] = useState<ProductionJobFilter>(defaultFilter);
  const [materialFilter, setMaterialFilterState] = useState<MaterialFilter>(defaultMaterialFilter);

  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<InventoryMaterial | null>(null);

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isJobDrawerOpen, setIsJobDrawerOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);

  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isStockAdjustmentModalOpen, setIsStockAdjustmentModalOpen] = useState(false);
  const [isMaterialDrawerOpen, setIsMaterialDrawerOpen] = useState(false);
  const [receiptTargetMaterial, setReceiptTargetMaterial] = useState<InventoryMaterial | null>(null);
  const [adjustmentTargetMaterial, setAdjustmentTargetMaterial] = useState<InventoryMaterial | null>(null);

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activePage, setActivePage] = useState<AppPage>('production');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [feedbackNotification, setFeedbackNotification] = useState<FeedbackNotification | null>(null);

  // Instancia repositórios e serviços
  const orderRepo = useMemo(() => new LocalStorageOrderRepository(), []);
  const jobRepo = useMemo(() => new LocalStorageJobRepository(), []);
  const stageRepo = useMemo(() => new LocalStorageStageRepository(), []);
  const eventRepo = useMemo(() => new LocalStorageEventRepository(), []);
  const materialRepo = useMemo(() => new LocalStorageMaterialRepository(), []);
  const requirementRepo = useMemo(() => new LocalStorageRequirementRepository(), []);
  const reservationRepo = useMemo(() => new LocalStorageReservationRepository(), []);
  const movementRepo = useMemo(() => new LocalStorageMovementRepository(), []);

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

    let loadedStages = await stageRepo.list(orgId);
    let loadedOrders = await orderRepo.list(orgId);
    let loadedJobs = await jobRepo.list(orgId);
    let loadedEvents = await eventRepo.listAll(orgId);
    let loadedMaterials = await materialRepo.list(orgId);
    let loadedReqs = await requirementRepo.listAll(orgId);
    let loadedRes = await reservationRepo.listAll(orgId);
    let loadedMovs = await movementRepo.listAll(orgId);

    const hasUserOrdersOrJobs =
      loadedOrders.some((o) => o.dataOrigin === 'user') ||
      loadedJobs.some((j) => j.dataOrigin === 'user');
    const hasUserMaterials = loadedMaterials.some((m) => m.dataOrigin === 'user');
    const hasUserData = hasUserOrdersOrJobs || hasUserMaterials;

    // 1. Limpeza intencional preservada
    if (rawState === 'INTENTIONALLY_CLEARED' || rawInvState === 'INTENTIONALLY_CLEARED') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
        window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');
        window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'INTENTIONALLY_CLEARED');
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
  ]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Manter selectedJob e selectedMaterial atualizados
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

        const targetStage = stages.find((s) => s.id === input.targetStageId);
        setFeedbackNotification({
          type: 'success',
          title: 'Etapa Atualizada',
          message: `OP ${updated.jobCode} movida para "${targetStage?.name || input.targetStageId}".`,
        });

        return updated;
      } catch (err: any) {
        setFeedbackNotification({
          type: 'error',
          title: 'Movimentação Não Permitida',
          message: err?.message || 'Não foi possível mover a OP.',
        });
        throw err;
      }
    },
    [jobService, organization.id, currentUser, stages, reloadAll]
  );

  const canJobTransitionTo = useCallback(
    (job: ProductionJob, targetStageId: string) => {
      const hasReqs = requirements.some((r) => r.productionJobId === job.id);
      return canTransitionStage(job, targetStageId, stages, hasReqs);
    },
    [stages, requirements]
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
      if (currentIndex < 0 || currentIndex >= sortedStages.length - 1) return;
      const nextStage = sortedStages[currentIndex + 1];
      await transitionProductionJobStage({
        productionJobId: jobId,
        targetStageId: nextStage.id,
        method: 'BUTTON',
      });
    },
    [jobs, stages, transitionProductionJobStage]
  );

  const moveJobPrev = useCallback(
    async (jobId: string, reversionReason?: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
      const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);
      if (currentIndex <= 0) return;
      const prevStage = sortedStages[currentIndex - 1];
      await transitionProductionJobStage({
        productionJobId: jobId,
        targetStageId: prevStage.id,
        method: 'BUTTON',
        reversionReason,
      });
    },
    [jobs, stages, transitionProductionJobStage]
  );

  const updateArtworkGate = useCallback(
    async (jobId: string, gate: ArtworkGate, note?: string) => {
      await jobService.updateArtworkGate(
        organization.id,
        jobId,
        gate,
        { id: currentUser.id, name: currentUser.name },
        note
      );
      await reloadAll();
    },
    [jobService, organization.id, currentUser, reloadAll]
  );

  const updateMaterialGate = useCallback(
    async (jobId: string, gate: MaterialGate, note?: string) => {
      await jobService.updateMaterialGate(
        organization.id,
        jobId,
        gate,
        { id: currentUser.id, name: currentUser.name },
        note
      );
      await reloadAll();
    },
    [jobService, organization.id, currentUser, reloadAll]
  );

  const updateFinancialGate = useCallback(
    async (jobId: string, gate: FinancialGate, note?: string) => {
      await jobService.updateFinancialGate(
        organization.id,
        jobId,
        gate,
        { id: currentUser.id, name: currentUser.name },
        note
      );
      await reloadAll();
    },
    [jobService, organization.id, currentUser, reloadAll]
  );

  const updateJobAssignee = useCallback(
    async (jobId: string, assignee: { id: string; name: string; email?: string } | null) => {
      await jobService.updateAssignee(
        organization.id,
        jobId,
        assignee,
        { id: currentUser.id, name: currentUser.name }
      );
      await reloadAll();
    },
    [jobService, organization.id, currentUser, reloadAll]
  );

  const updateJobPriority = useCallback(
    async (jobId: string, priority: Priority) => {
      await jobService.updatePriority(
        organization.id,
        jobId,
        priority,
        { id: currentUser.id, name: currentUser.name }
      );
      await reloadAll();
    },
    [jobService, organization.id, currentUser, reloadAll]
  );

  const updateJobDeadline = useCallback(
    async (jobId: string, deadlineISO: string) => {
      await jobService.updateDeadline(
        organization.id,
        jobId,
        deadlineISO,
        { id: currentUser.id, name: currentUser.name }
      );
      await reloadAll();
    },
    [jobService, organization.id, currentUser, reloadAll]
  );

  const addJobNote = useCallback(
    async (jobId: string, note: string) => {
      await jobService.addNote(
        organization.id,
        jobId,
        note,
        { id: currentUser.id, name: currentUser.name }
      );
      await reloadAll();
    },
    [jobService, organization.id, currentUser, reloadAll]
  );

  const getJobEvents = useCallback(
    async (jobId: string) => {
      return eventRepo.listByJobId(organization.id, jobId);
    },
    [eventRepo, organization.id]
  );

  // Ações de Estoque e Materiais (Fase 2A)
  const createMaterial = useCallback(
    async (input: Omit<CreateMaterialInput, 'userId' | 'userName'>) => {
      const res = await inventoryService.createMaterial(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();

      setFeedbackNotification({
        type: 'success',
        title: 'Material Cadastrado',
        message: `Material ${res.material.name} (SKU: ${res.material.sku}) cadastrado com sucesso.`,
      });

      return res.material;
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const updateMaterial = useCallback(
    async (materialId: string, input: UpdateMaterialInput) => {
      const res = await inventoryService.updateMaterial(organization.id, materialId, input);
      await reloadAll();

      setFeedbackNotification({
        type: 'success',
        title: 'Material Atualizado',
        message: `Dados do material ${res.name} atualizados com sucesso.`,
      });

      return res;
    },
    [inventoryService, organization.id, reloadAll]
  );

  const recordReceipt = useCallback(
    async (input: Omit<RecordReceiptInput, 'userId' | 'userName'>) => {
      const res = await inventoryService.recordReceipt(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();

      setFeedbackNotification({
        type: 'success',
        title: 'Entrada Registrada',
        message: `Entrada de ${input.quantityMilli / 1000} ${res.material.unit} registrada para ${res.material.name}.`,
      });
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const adjustStock = useCallback(
    async (input: Omit<AdjustStockInput, 'userId' | 'userName'>) => {
      const res = await inventoryService.adjustStock(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();

      setFeedbackNotification({
        type: 'success',
        title: 'Ajuste de Estoque Realizado',
        message: `Ajuste de ${input.quantityMilli / 1000} ${res.material.unit} efetuado para ${res.material.name}.`,
      });
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const addJobRequirement = useCallback(
    async (input: Omit<AddRequirementInput, 'userId' | 'userName'>) => {
      const res = await inventoryService.addRequirement(organization.id, {
        ...input,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      await reloadAll();

      setFeedbackNotification({
        type: 'success',
        title: 'Requisito Adicionado',
        message: `Requisito de ${res.materialSnapshot.name} vinculado à OP com sucesso.`,
      });

      return res;
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
        title: 'Reserva Realizada',
        message: `Reserva de ${input.quantityMilli / 1000} efetuada com sucesso para a OP.`,
      });

      return res;
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const releaseReservation = useCallback(
    async (reservationId: string) => {
      const res = await inventoryService.releaseReservation(organization.id, reservationId, {
        id: currentUser.id,
        name: currentUser.name,
      });
      await reloadAll();

      setFeedbackNotification({
        type: 'info',
        title: 'Reserva Liberada',
        message: `Reserva de material liberada com sucesso. Disponibilidade restaurada.`,
      });

      return res;
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const consumeReservation = useCallback(
    async (reservationId: string) => {
      await inventoryService.consumeReservation(organization.id, reservationId, {
        id: currentUser.id,
        name: currentUser.name,
      });
      await reloadAll();

      setFeedbackNotification({
        type: 'success',
        title: 'Material Consumido',
        message: `Consumo de material efetivado com sucesso para a OP. Saldo físico baixado.`,
      });
    },
    [inventoryService, organization.id, currentUser, reloadAll]
  );

  const getMaterialAvailability = useCallback(
    async (materialId: string) => {
      return inventoryService.getMaterialAvailability(organization.id, materialId);
    },
    [inventoryService, organization.id]
  );

  const getMaterialMovements = useCallback(
    async (materialId: string) => {
      return movementRepo.listByMaterialId(organization.id, materialId);
    },
    [movementRepo, organization.id]
  );

  const getMaterialReservations = useCallback(
    async (materialId: string) => {
      return reservationRepo.listByMaterialId(organization.id, materialId);
    },
    [reservationRepo, organization.id]
  );

  const getJobRequirements = useCallback(
    async (jobId: string) => {
      return requirementRepo.listByJobId(organization.id, jobId);
    },
    [requirementRepo, organization.id]
  );

  const getJobReservations = useCallback(
    async (jobId: string) => {
      return reservationRepo.listByJobId(organization.id, jobId);
    },
    [reservationRepo, organization.id]
  );

  // Restauração explícita do ambiente demonstrativo
  const resetDemoEnvironment = useCallback(async () => {
    const orgId = organization.id;
    await orderRepo.clear(orgId);
    await jobRepo.clear(orgId);
    await stageRepo.clear(orgId);
    await eventRepo.clear(orgId);
    await materialRepo.clear(orgId);
    await requirementRepo.clear(orgId);
    await reservationRepo.clear(orgId);
    await movementRepo.clear(orgId);

    const seed = getDemoSeedData(orgId);
    await stageRepo.saveMany(orgId, seed.stages);
    for (const ord of seed.orders) {
      await orderRepo.save(orgId, ord);
    }
    await jobRepo.saveMany(orgId, seed.jobs);
    await eventRepo.appendMany(orgId, seed.events);
    await materialRepo.saveMany(orgId, seed.materials);
    await requirementRepo.saveMany(orgId, seed.requirements);
    await reservationRepo.saveMany(orgId, seed.reservations);
    await movementRepo.appendMany(orgId, seed.movements);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
      window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');
      window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'APPLIED');
    }

    await reloadAll();
  }, [
    organization.id,
    orderRepo,
    jobRepo,
    stageRepo,
    eventRepo,
    materialRepo,
    requirementRepo,
    reservationRepo,
    movementRepo,
    reloadAll,
  ]);

  const resetToDemoSeed = resetDemoEnvironment;

  // Limpeza intencional dos dados operacionais
  const clearOperationalData = useCallback(async () => {
    const orgId = organization.id;
    await orderRepo.clear(orgId);
    await jobRepo.clear(orgId);
    await eventRepo.clear(orgId);
    await materialRepo.clear(orgId);
    await requirementRepo.clear(orgId);
    await reservationRepo.clear(orgId);
    await movementRepo.clear(orgId);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
      window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');
      window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'INTENTIONALLY_CLEARED');
    }

    await reloadAll();
  }, [
    organization.id,
    orderRepo,
    jobRepo,
    eventRepo,
    materialRepo,
    requirementRepo,
    reservationRepo,
    movementRepo,
    reloadAll,
  ]);

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
