import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryPage } from '../components/pages/InventoryPage';
import { ProductionListView } from '../components/production/ProductionListView';

const context = vi.hoisted(() => ({ value: {} as any }));

vi.mock('../context/ArteFlowContext', () => ({
  useArteFlow: () => context.value,
}));

const material = {
  id: 'material-1', organizationId: 'org-1', sku: 'TEST-001', name: 'Material visível',
  category: 'Papéis & Cartões', unit: 'UNIT', stockOnHandMilli: 14_000,
  minimumStockMilli: 2_000, averageCostCents: 150, supplierName: '', isActive: true,
  dataOrigin: 'user', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

function inventoryContext(canManage: boolean) {
  return {
    can: (permission: string) => permission === 'arteflow.inventory.manage' && canManage,
    materials: [material], reservations: [],
    materialFilter: { searchQuery: '', category: 'ALL', unit: 'ALL', status: 'ALL', dataOrigin: 'ALL', belowMinimumOnly: false },
    setMaterialFilter: vi.fn(), resetMaterialFilter: vi.fn(),
    setSelectedMaterial: vi.fn(), setIsMaterialDrawerOpen: vi.fn(),
    setIsNewMaterialModalOpen: vi.fn(), setIsReceiptModalOpen: vi.fn(),
    setIsStockAdjustmentModalOpen: vi.fn(), setReceiptTargetMaterial: vi.fn(),
    setAdjustmentTargetMaterial: vi.fn(),
  };
}

describe('hotfix RBAC visual de Estoque e Produção', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mantém Estoque legível e oculta todas as mutações para MEMBER view-only', () => {
    context.value = inventoryContext(false);
    render(<InventoryPage />);

    expect(screen.getByText('Material visível')).toBeInTheDocument();
    expect(screen.getAllByText('14').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Novo Material' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrada' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Registrar Entrada')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Ajustar Saldo')).not.toBeInTheDocument();
  });

  it('preserva os controles de Estoque para OWNER com manage', () => {
    context.value = inventoryContext(true);
    render(<InventoryPage />);
    expect(screen.getByRole('button', { name: 'Novo Material' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrada' })).toBeInTheDocument();
    expect(screen.getByTitle('Registrar Entrada')).toBeInTheDocument();
    expect(screen.getAllByTitle('Ajustar Saldo').length).toBeGreaterThanOrEqual(1);
  });

  it('mantém a OP visível e oculta movimentação para MEMBER sem production.manage', () => {
    context.value = {
      can: () => false, stages: [{ id: 'stage-entry', name: 'Entrada', sequence: 1, color: '#000' }],
      jobs: [{ id: 'job-1', jobCode: 'OP-TEST-001', orderNumber: 'PED-TEST-001', stageId: 'stage-entry',
        customer: { name: 'Cliente demonstrativo' }, productName: 'Produto demonstrativo', quantity: 1, unit: 'un',
        artworkGate: 'APPROVED', materialGate: 'AVAILABLE', financialGate: 'RELEASED', priority: 'MEDIUM',
        sector: 'Impressão', deadlineISO: '2026-12-01T00:00:00.000Z', dataOrigin: 'user' }],
      filter: { searchQuery: '', priority: 'ALL', sector: 'ALL', assignee: 'ALL', deadline: 'ALL', gateStatus: 'ALL', dataOrigin: 'ALL' },
      moveJobNext: vi.fn(), moveJobPrev: vi.fn(), setSelectedJob: vi.fn(), setIsJobDrawerOpen: vi.fn(),
    };
    render(<ProductionListView />);
    expect(screen.getByText('OP-TEST-001')).toBeInTheDocument();
    expect(screen.queryByTitle('Voltar etapa')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Avançar etapa')).not.toBeInTheDocument();
    expect(screen.getByTitle('Ver detalhes')).toBeInTheDocument();
  });
});
