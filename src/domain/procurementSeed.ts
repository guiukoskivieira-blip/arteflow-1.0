import { Supplier } from '../types/procurement';

export function getDemoProcurementSeedData(organizationId: string): {
  suppliers: Supplier[];
} {
  const now = '2026-02-27T08:00:00.000Z';

  const suppliers: Supplier[] = [
    {
      id: 'sup-demo-001',
      organizationId,
      code: 'SUP-001',
      tradeName: 'Suprimentos Gráficos Brasil Ltda',
      corporateName: 'Suprimentos Gráficos Brasil Comércio e Distribuição S/A',
      document: '12.345.678/0001-90',
      contactName: 'Roberto Alcantara',
      email: 'pedidos@suprimentosgraficos.com.br',
      phone: '(11) 3456-7890',
      address: 'Av. Industrial das Artes, 1200 - São Paulo/SP',
      defaultLeadTimeDays: 3,
      paymentTermsSnapshot: '28 dias / Boleto Bancário',
      notes: 'Fornecedor homologado de papéis couché, offset e chapas térmicas.',
      isActive: true,
      dataOrigin: 'demo',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sup-demo-002',
      organizationId,
      code: 'SUP-002',
      tradeName: 'Vinil & Mídia Distribuidora',
      corporateName: 'Vinil e Mídia Impressão Digital EIRELI',
      document: '98.765.432/0001-10',
      contactName: 'Mariana Pontes',
      email: 'vendas@vinilemidia.com.br',
      phone: '(11) 4567-8901',
      address: 'Rua dos Comunicadores, 450 - Guarulhos/SP',
      defaultLeadTimeDays: 2,
      paymentTermsSnapshot: '14 dias / Transferência ou Pix',
      notes: 'Fornecedor homologado de lonas frontlight, vinis adesivos e fitas dupla face industriais.',
      isActive: true,
      dataOrigin: 'demo',
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { suppliers };
}
