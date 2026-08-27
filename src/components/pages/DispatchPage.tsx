import React from 'react';
import { EmptyModulePlaceholder } from '../common/EmptyModulePlaceholder';
import { useArteFlow } from '../../context/ArteFlowContext';
import { Truck } from 'lucide-react';

export const DispatchPage: React.FC = () => {
  const { setActivePage } = useArteFlow();

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <EmptyModulePlaceholder
        title="Expedição & Logística de Entrega"
        description="Roteirização de frotas de entrega, retirada no balcão, etiquetas de despacho e conferência de volumes."
        phase="Módulo planejado para a Fase 2"
        icon={Truck}
        plannedFeatures={[
          'Geração de etiquetas térmicas de volume com QR Code da OP',
          'Controle de balcão com assinatura digital de retirada',
          'Roteirização de veículos de entrega própria',
          'Integração com transportadoras e Correios via rastreamento',
        ]}
        onNavigateToProduction={() => setActivePage('production')}
      />
    </div>
  );
};
