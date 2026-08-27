import React from 'react';
import { EmptyModulePlaceholder } from '../common/EmptyModulePlaceholder';
import { useArteFlow } from '../../context/ArteFlowContext';
import { Package } from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { setActivePage } = useArteFlow();

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <EmptyModulePlaceholder
        title="Estoque de Materiais & Insumos"
        description="Controle de bobinas, substratos rígidos, tintas, lonas, adesivos e chapas com baixa automática por OP."
        phase="Módulo planejado para a Fase 2"
        icon={Package}
        plannedFeatures={[
          'Cadastro de matérias-primas por lote, metragem e peso',
          'Reserva automática de insumos ao criar Ordens de Produção',
          'Alerta de estoque mínimo com disparador para compras',
          'Rastreabilidade de lote por OP concluída',
          'Integração direta com o Gate de Material da Produção',
        ]}
        onNavigateToProduction={() => setActivePage('production')}
      />
    </div>
  );
};
