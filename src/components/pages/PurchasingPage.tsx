import React from 'react';
import { EmptyModulePlaceholder } from '../common/EmptyModulePlaceholder';
import { useArteFlow } from '../../context/ArteFlowContext';
import { ShoppingBag } from 'lucide-react';

export const PurchasingPage: React.FC = () => {
  const { setActivePage } = useArteFlow();

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <EmptyModulePlaceholder
        title="Gestão de Compras & Fornecedores"
        description="Solicitações de compra originadas de materiais em falta nas OPs e reposições programadas."
        phase="Módulo planejado para a Fase 2"
        icon={ShoppingBag}
        plannedFeatures={[
          'Cotações com múltiplos fornecedores homologados',
          'Aprovação de ordens de compra por alçada',
          'Entrada de nota fiscal eletrônica com conferência de lote',
          'Vinculação de pedidos de compra a OPs bloqueadas por material',
        ]}
        onNavigateToProduction={() => setActivePage('production')}
      />
    </div>
  );
};
