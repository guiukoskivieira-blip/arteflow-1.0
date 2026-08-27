import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { LocalStorageMaterialRepository } from '../repositories/localStorageMaterialRepository';
import { LocalStorageRequirementRepository } from '../repositories/localStorageRequirementRepository';
import { LocalStorageReservationRepository } from '../repositories/localStorageReservationRepository';
import { LocalStorageMovementRepository } from '../repositories/localStorageMovementRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageStageRepository } from '../repositories/localStorageStageRepository';
import { storageKeys } from '../repositories/storageKeys';
import { getDemoSeedData, DEMO_ORGANIZATION } from '../domain/seed';
import { ArteFlowProvider, useArteFlow } from '../context/ArteFlowContext';
import { AppLayout } from '../components/layout/AppLayout';
import { InventoryPage } from '../components/pages/InventoryPage';
import { ProductionPage } from '../components/pages/ProductionPage';

const orgId = DEMO_ORGANIZATION.id;

const TestApp: React.FC<{ initialPage?: any }> = ({ initialPage = 'inventory' }) => {
  return (
    <ArteFlowProvider>
      <TestAppContent initialPage={initialPage} />
    </ArteFlowProvider>
  );
};

const TestAppContent: React.FC<{ initialPage?: any }> = ({ initialPage }) => {
  const { activePage, setActivePage } = useArteFlow();

  React.useEffect(() => {
    if (initialPage && activePage !== initialPage) {
      setActivePage(initialPage);
    }
  }, [initialPage, activePage, setActivePage]);

  return (
    <AppLayout>
      {activePage === 'inventory' && <InventoryPage />}
      {activePage === 'production' && <ProductionPage />}
    </AppLayout>
  );
};

describe('ArteFlow — Hotfix P1.2: Migração e Recuperação do Seed de Estoque (16 Garantias)', () => {
  let materialRepo: LocalStorageMaterialRepository;
  let reqRepo: LocalStorageRequirementRepository;
  let resRepo: LocalStorageReservationRepository;
  let movRepo: LocalStorageMovementRepository;
  let jobRepo: LocalStorageJobRepository;
  let orderRepo: LocalStorageOrderRepository;
  let stageRepo: LocalStorageStageRepository;

  beforeEach(async () => {
    window.localStorage.clear();
    materialRepo = new LocalStorageMaterialRepository();
    reqRepo = new LocalStorageRequirementRepository();
    resRepo = new LocalStorageReservationRepository();
    movRepo = new LocalStorageMovementRepository();
    jobRepo = new LocalStorageJobRepository();
    orderRepo = new LocalStorageOrderRepository();
    stageRepo = new LocalStorageStageRepository();
  });

  // Garantia 1: seedVersion 3 com inventory_seed_state ausente e estoque vazio recupera 5 materiais
  it('1. seedVersion 3 com inventory_seed_state ausente e estoque vazio recupera exatamente 5 materiais', async () => {
    // Simula estado intermediário defeituoso no browser
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '3');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');
    // inventory_seed_state está ausente (null)
    const seed = getDemoSeedData(orgId);
    await stageRepo.saveMany(orgId, seed.stages);
    for (const ord of seed.orders) {
      await orderRepo.save(orgId, ord);
    }
    await jobRepo.saveMany(orgId, seed.jobs);

    expect((await materialRepo.list(orgId)).length).toBe(0);

    // Monta o App
    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const mats = await materialRepo.list(orgId);
    expect(mats.length).toBe(5);
    expect(window.localStorage.getItem(storageKeys.inventorySeedState(orgId))).toBe('APPLIED');
  });

  // Garantia 2: Recuperação cria movimentos RECEIPT correspondentes
  it('2. Recuperação cria movimentos RECEIPT correspondentes para todo saldo físico inicial', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '3');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const movs = await movRepo.listAll(orgId);
    expect(movs.length).toBe(4); // 4 materiais com saldo inicial > 0
    expect(movs.every((m) => m.type === 'RECEIPT')).toBe(true);
    expect(movs.every((m) => m.dataOrigin === 'demo')).toBe(true);
    expect(movs.every((m) => m.organizationId === orgId)).toBe(true);
  });

  // Garantia 3: Recuperação cria requisitos para as duas OPs
  it('3. Recuperação cria requisitos para as duas OPs', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '3');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const reqs = await reqRepo.listAll(orgId);
    expect(reqs.length).toBe(4); // 1 na OP 1 + 3 na OP 2
    expect(reqs.filter((r) => r.productionJobId === 'job-demo-001').length).toBe(1);
    expect(reqs.filter((r) => r.productionJobId === 'job-demo-002').length).toBe(3);
  });

  // Garantia 4: Cartão recebe reserva integral ACTIVE
  it('4. Cartão recebe reserva integral ACTIVE de Papel Couchê', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '3');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const res = await resRepo.listByJobId(orgId, 'job-demo-001');
    expect(res.length).toBe(1);
    expect(res[0].status).toBe('ACTIVE');
    expect(res[0].reservedQuantityMilli).toBe(500000); // 500 folhas
  });

  // Garantia 5: Gate do Cartão vira RESERVED
  it('5. Gate de Material do Cartão vira RESERVED', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '3');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');

    await act(async () => {
      render(<TestApp initialPage="production" />);
    });

    const job1 = await jobRepo.getById(orgId, 'job-demo-001');
    expect(job1?.materialGate).toBe('RESERVED');
  });

  // Garantia 6: Gate do Banner vira MISSING
  it('6. Gate de Material do Banner vira MISSING', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '3');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'APPLIED');

    await act(async () => {
      render(<TestApp initialPage="production" />);
    });

    const job2 = await jobRepo.getById(orgId, 'job-demo-002');
    expect(job2?.materialGate).toBe('MISSING');
  });

  // Garantia 7: Segunda inicialização não duplica materiais
  it('7. Segunda inicialização não duplica materiais', async () => {
    const { unmount } = render(<TestApp initialPage="inventory" />);
    await act(async () => {});
    unmount();

    const count1 = (await materialRepo.list(orgId)).length;

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const count2 = (await materialRepo.list(orgId)).length;
    expect(count2).toBe(count1);
    expect(count2).toBe(5);
  });

  // Garantia 8: Não duplica requisitos
  it('8. Segunda inicialização não duplica requisitos', async () => {
    const { unmount } = render(<TestApp initialPage="inventory" />);
    await act(async () => {});
    unmount();

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const reqs = await reqRepo.listAll(orgId);
    expect(reqs.length).toBe(4);
  });

  // Garantia 9: Não duplica reservas
  it('9. Segunda inicialização não duplica reservas', async () => {
    const { unmount } = render(<TestApp initialPage="inventory" />);
    await act(async () => {});
    unmount();

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const res = await resRepo.listAll(orgId);
    expect(res.length).toBe(1);
  });

  // Garantia 10: Não duplica movimentos
  it('10. Segunda inicialização não duplica movimentos de estoque', async () => {
    const { unmount } = render(<TestApp initialPage="inventory" />);
    await act(async () => {});
    unmount();

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const movs = await movRepo.listAll(orgId);
    expect(movs.length).toBe(4);
  });

  // Garantia 11: Dados user impedem seed de estoque
  it('11. Dados com dataOrigin: "user" impedem injeção de materiais demo', async () => {
    await materialRepo.save(orgId, {
      id: 'mat-custom-01',
      organizationId: orgId,
      sku: 'MAT-CUSTOM-99',
      name: 'Material Customizado Usuário',
      category: 'Especiais',
      unit: 'SHEET',
      stockOnHandMilli: 100000,
      minimumStockMilli: 10000,
      averageCostCents: 100,
      isActive: true,
      dataOrigin: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const mats = await materialRepo.list(orgId);
    expect(mats.length).toBe(1);
    expect(mats[0].sku).toBe('MAT-CUSTOM-99');
    expect(window.localStorage.getItem(storageKeys.inventorySeedState(orgId))).toBe('APPLIED');
  });

  // Garantia 12: INTENTIONALLY_CLEARED permanece vazio
  it('12. INTENTIONALLY_CLEARED permanece vazio sem recriar estoque demo', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '3');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');
    window.localStorage.setItem(storageKeys.inventorySeedState(orgId), 'INTENTIONALLY_CLEARED');

    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const mats = await materialRepo.list(orgId);
    expect(mats.length).toBe(0);
    const movs = await movRepo.listAll(orgId);
    expect(movs.length).toBe(0);
  });

  // Garantia 13: resetDemoEnvironment restaura o estoque
  it('13. resetDemoEnvironment restaura os 5 materiais, requisitos, reservas e movimentos demo', async () => {
    let contextHandle: ReturnType<typeof useArteFlow> | null = null;
    const TestProbe = () => {
      contextHandle = useArteFlow();
      return <div data-testid="probe" />;
    };

    render(
      <ArteFlowProvider>
        <TestProbe />
      </ArteFlowProvider>
    );

    await act(async () => {});

    // Limpa
    await act(async () => {
      await contextHandle?.clearOperationalData();
    });
    expect((await materialRepo.list(orgId)).length).toBe(0);

    // Restaura ambiente demo
    await act(async () => {
      await contextHandle?.resetDemoEnvironment();
    });

    const mats = await materialRepo.list(orgId);
    expect(mats.length).toBe(5);
    const reqs = await reqRepo.listAll(orgId);
    expect(reqs.length).toBe(4);
    const res = await resRepo.listAll(orgId);
    expect(res.length).toBe(1);
    expect(window.localStorage.getItem(storageKeys.inventorySeedState(orgId))).toBe('APPLIED');
  });

  // Garantia 14: Isolamento por organizationId
  it('14. Isolamento estrito de inventory_seed_state por organizationId', () => {
    const orgA = 'org-alpha';
    const orgB = 'org-beta';

    expect(storageKeys.inventorySeedState(orgA)).toBe('arteflow:v1:org-alpha:inventory_seed_state');
    expect(storageKeys.inventorySeedState(orgB)).toBe('arteflow:v1:org-beta:inventory_seed_state');
  });

  // Garantia 15: inventory_seed_state APPLIED com materiais posteriormente removidos não recria automaticamente
  it('15. inventory_seed_state APPLIED com materiais posteriormente removidos não recria automaticamente na recarga', async () => {
    // 1. Inicializa normalmente
    const { unmount } = render(<TestApp initialPage="inventory" />);
    await act(async () => {});
    expect((await materialRepo.list(orgId)).length).toBe(5);
    expect(window.localStorage.getItem(storageKeys.inventorySeedState(orgId))).toBe('APPLIED');
    unmount();

    // 2. Usuário remove manualmente materiais do storage (mas inventorySeedState permanece APPLIED)
    await materialRepo.clear(orgId);
    expect((await materialRepo.list(orgId)).length).toBe(0);

    // 3. Recarrega a aplicação
    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    // Como inventory_seed_state = APPLIED, o seed de estoque não roda novamente
    const matsAfterReload = await materialRepo.list(orgId);
    expect(matsAfterReload.length).toBe(0);
  });

  // Garantia 16: Todos os saldos iniciais possuem histórico de entrada
  it('16. Todos os saldos físicos iniciais possuem histórico correspondente de movimentação RECEIPT', async () => {
    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const mats = await materialRepo.list(orgId);
    const movs = await movRepo.listAll(orgId);

    for (const mat of mats) {
      if (mat.stockOnHandMilli > 0) {
        const matMovs = movs.filter((m) => m.materialId === mat.id);
        expect(matMovs.length).toBeGreaterThanOrEqual(1);
        expect(matMovs[0].type).toBe('RECEIPT');
        expect(matMovs[0].resultingBalanceMilli).toBe(mat.stockOnHandMilli);
      }
    }
  });
});
