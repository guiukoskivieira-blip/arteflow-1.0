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
} from '../types/domain';
import { DEMO_USERS } from '../domain/constants';
import { getDemoSeedData, DEMO_ORGANIZATION, getInitialStages } from '../domain/seed';
import { storageKeys, CURRENT_SEED_VERSION, SeedState } from '../repositories/storageKeys';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageStageRepository } from '../repositories/localStorageStageRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { OrderService, CreateManualOrderInput } from '../services/orderService';
import { JobService } from '../services/jobService';

export type AppPage =
  | 'overview'
  | 'orders'
  | 'production'
  | 'inventory'
  | 'purchasing'
  | 'financial'
  | 'dispatch'
  | 'team'
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
  filter: ProductionJobFilter;
  setFilter: (updater: Partial<ProductionJobFilter> | ((prev: ProductionJobFilter) => ProductionJobFilter)) => void;
  resetFilter: () => void;
  selectedJob: ProductionJob | null;
  setSelectedJob: (job: ProductionJob | null) => void;
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  isNewOrderModalOpen: boolean;
  setIsNewOrderModalOpen: (open: boolean) => void;
  isJobDrawerOpen: boolean;
  setIsJobDrawerOpen: (open: boolean) => void;
  isOrderDetailsModalOpen: boolean;
  setIsOrderDetailsModalOpen: (open: boolean) => void;
  viewMode: 'kanban' | 'list';
  setViewMode: (mode: 'kanban' | 'list') => void;
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
  feedbackNotification: FeedbackNotification | null;
  setFeedbackNotification: (notification: FeedbackNotification | null) => void;
  clearFeedbackNotification: () => void;

  // Actions
  createManualOrder: (input: Omit<CreateManualOrderInput, 'organizationId' | 'authorId' | 'authorName'>) => Promise<Order>;
  moveJobStage: (jobId: string, targetStageId: string) => Promise<void>;
  moveJobNext: (jobId: string) => Promise<void>;
  moveJobPrev: (jobId: string) => Promise<void>;
  updateArtworkGate: (jobId: string, gate: ArtworkGate, note?: string) => Promise<void>;
  updateMaterialGate: (jobId: string, gate: MaterialGate, note?: string) => Promise<void>;
  updateFinancialGate: (jobId: string, gate: FinancialGate, note?: string) => Promise<void>;
  updateJobAssignee: (jobId: string, assignee: { id: string; name: string; email?: string } | null) => Promise<void>;
  updateJobPriority: (jobId: string, priority: Priority) => Promise<void>;
  updateJobDeadline: (jobId: string, deadlineISO: string) => Promise<void>;
  addJobNote: (jobId: string, note: string) => Promise<void>;
  getJobEvents: (jobId: string) => Promise<ProductionEvent[]>;
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

const ArteFlowContext = createContext<ArteFlowContextType | undefined>(undefined);

export const ArteFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organization] = useState<Organization>(DEMO_ORGANIZATION);
  const [currentUser, setCurrentUser] = useState<User>(DEMO_USERS[0]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [filter, setFilterState] = useState<ProductionJobFilter>(defaultFilter);
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isJobDrawerOpen, setIsJobDrawerOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activePage, setActivePage] = useState<AppPage>('production');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [feedbackNotification, setFeedbackNotification] = useState<FeedbackNotification | null>(null);

  // Instancia repositórios e serviços
  const orderRepo = useMemo(() => new LocalStorageOrderRepository(), []);
  const jobRepo = useMemo(() => new LocalStorageJobRepository(), []);
  const stageRepo = useMemo(() => new LocalStorageStageRepository(), []);
  const eventRepo = useMemo(() => new LocalStorageEventRepository(), []);

  const orderService = useMemo(
    () => new OrderService(orderRepo, jobRepo, eventRepo),
    [orderRepo, jobRepo, eventRepo]
  );
  const jobService = useMemo(
    () => new JobService(jobRepo, eventRepo),
    [jobRepo, eventRepo]
  );

  const clearFeedbackNotification = useCallback(() => {
    setFeedbackNotification(null);
  }, []);

  const reloadAll = useCallback(async () => {
    const orgId = organization.id;
    const rawVersion = typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(storageKeys.seedVersion(orgId))
      : null;
    const rawState = typeof window !== 'undefined' && window.localStorage
      ? (window.localStorage.getItem(storageKeys.seedState(orgId)) as SeedState | null)
      : null;

    let loadedStages = await stageRepo.list(orgId);
    let loadedOrders = await orderRepo.list(orgId);
    let loadedJobs = await jobRepo.list(orgId);
    let loadedEvents = await eventRepo.listAll(orgId);

    const hasUserData =
      loadedOrders.some((o) => o.dataOrigin === 'user') ||
      loadedJobs.some((j) => j.dataOrigin === 'user');

    // Regra 4: Limpeza intencional preservada
    if (rawState === 'INTENTIONALLY_CLEARED') {
      // Estado limpo intencionalmente: nunca recria demos
      if (loadedStages.length === 0) {
        const initialStages = getInitialStages(orgId);
        await stageRepo.saveMany(orgId, initialStages);
        loadedStages = initialStages;
      }
    } else if (hasUserData) {
      // Regra 3: Estado com dados user (nunca injeta demos, preserva dados user)
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
        window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');
      }
      if (loadedStages.length === 0) {
        const initialStages = getInitialStages(orgId);
        await stageRepo.saveMany(orgId, initialStages);
        loadedStages = initialStages;
      }
    } else if (rawState === 'APPLIED') {
      // Regra 6: Estado já aplicado normalmente (não duplica)
      if (loadedStages.length === 0) {
        const initialStages = getInitialStages(orgId);
        await stageRepo.saveMany(orgId, initialStages);
        loadedStages = initialStages;
      }
    } else if (
      // Regra 2: Estado intermediário defeituoso confirmado (seedVersion === '2', seedState ausente, sem pedidos/OPs)
      (rawVersion === String(CURRENT_SEED_VERSION) && rawState === null && loadedOrders.length === 0 && loadedJobs.length === 0) ||
      // Regra 1: Instalação totalmente nova (sem seedVersion, sem seedState, storage vazio)
      (rawVersion === null && rawState === null && loadedOrders.length === 0 && loadedJobs.length === 0)
    ) {
      // Executa seed demonstrativo inicial
      const seed = getDemoSeedData(orgId);
      await stageRepo.saveMany(orgId, seed.stages);
      for (const ord of seed.orders) {
        await orderRepo.save(orgId, ord);
      }
      await jobRepo.saveMany(orgId, seed.jobs);
      await eventRepo.appendMany(orgId, seed.events);

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
        window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');
      }

      loadedStages = seed.stages;
      loadedOrders = seed.orders;
      loadedJobs = seed.jobs;
      loadedEvents = seed.events;
    }

    setStages(loadedStages);
    setOrders(loadedOrders);
    setJobs(loadedJobs);
    setEvents(loadedEvents);
  }, [organization.id, stageRepo, orderRepo, jobRepo, eventRepo]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Manter selectedJob atualizado se a lista de jobs mudar
  useEffect(() => {
    if (selectedJob) {
      const freshJob = jobs.find((j) => j.id === selectedJob.id);
      if (freshJob) {
        setSelectedJob(freshJob);
      }
    }
  }, [jobs, selectedJob?.id]);

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

  const moveJobStage = useCallback(
    async (jobId: string, targetStageId: string) => {
      await jobService.moveStage(
        organization.id,
        jobId,
        targetStageId,
        stages,
        { id: currentUser.id, name: currentUser.name }
      );
      await reloadAll();
    },
    [jobService, organization.id, stages, currentUser, reloadAll]
  );

  const moveJobNext = useCallback(
    async (jobId: string) => {
      await jobService.moveNextStage(
        organization.id,
        jobId,
        stages,
        { id: currentUser.id, name: currentUser.name }
      );
      await reloadAll();
    },
    [jobService, organization.id, stages, currentUser, reloadAll]
  );

  const moveJobPrev = useCallback(
    async (jobId: string) => {
      await jobService.movePreviousStage(
        organization.id,
        jobId,
        stages,
        { id: currentUser.id, name: currentUser.name }
      );
      await reloadAll();
    },
    [jobService, organization.id, stages, currentUser, reloadAll]
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

  // Regra 5: Restauração explícita: limpa operacionais, recria demos, grava seedVersion e seedState = APPLIED
  const resetDemoEnvironment = useCallback(async () => {
    const orgId = organization.id;
    await orderRepo.clear(orgId);
    await jobRepo.clear(orgId);
    await stageRepo.clear(orgId);
    await eventRepo.clear(orgId);

    const seed = getDemoSeedData(orgId);
    await stageRepo.saveMany(orgId, seed.stages);
    for (const ord of seed.orders) {
      await orderRepo.save(orgId, ord);
    }
    await jobRepo.saveMany(orgId, seed.jobs);
    await eventRepo.appendMany(orgId, seed.events);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
      window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');
    }

    await reloadAll();
  }, [organization.id, orderRepo, jobRepo, stageRepo, eventRepo, reloadAll]);

  const resetToDemoSeed = resetDemoEnvironment;

  // Regra 4: Limpeza operacional intencional: remove operacionais, preserva etapas, grava seedVersion e seedState = INTENTIONALLY_CLEARED
  const clearOperationalData = useCallback(async () => {
    const orgId = organization.id;
    await orderRepo.clear(orgId);
    await jobRepo.clear(orgId);
    await eventRepo.clear(orgId);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKeys.seedVersion(orgId), String(CURRENT_SEED_VERSION));
      window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');
    }

    await reloadAll();
  }, [organization.id, orderRepo, jobRepo, eventRepo, reloadAll]);

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
        filter,
        setFilter,
        resetFilter,
        selectedJob,
        setSelectedJob,
        selectedOrder,
        setSelectedOrder,
        isNewOrderModalOpen,
        setIsNewOrderModalOpen,
        isJobDrawerOpen,
        setIsJobDrawerOpen,
        isOrderDetailsModalOpen,
        setIsOrderDetailsModalOpen,
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
