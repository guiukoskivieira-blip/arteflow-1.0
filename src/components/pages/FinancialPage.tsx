import React from 'react';
import { EmptyModulePlaceholder } from '../common/EmptyModulePlaceholder';
import { useArteFlow } from '../../context/ArteFlowContext';
import { DollarSign } from 'lucide-react';

export const FinancialPage: React.FC = () => {
  const { setActivePage } = useArteFlow();

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <EmptyModulePlaceholder
        title="Financeiro Operacional"
        description="Contas a receber, confirmação de sinal, fluxo de caixa operacional e liberação de gates de produção."
        phase="Módulo planejado para a Fase 2"
        icon={DollarSign}
        plannedFeatures={[
          'Contas a receber por parcelas e faturamentos',
          'Liberação automática do Gate Financeiro após confirmação de Pix/TED/Boleto',
          'Gestão de inadimplência e alertas de bloqueio de entrega',
          'Conciliação bancária por extrato OFX',
        ]}
        onNavigateToProduction={() => setActivePage('production')}
      />
    </div>
  );
};
