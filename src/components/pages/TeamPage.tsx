import React from 'react';
import { EmptyModulePlaceholder } from '../common/EmptyModulePlaceholder';
import { useArteFlow } from '../../context/ArteFlowContext';
import { Users } from 'lucide-react';

export const TeamPage: React.FC = () => {
  const { setActivePage } = useArteFlow();

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <EmptyModulePlaceholder
        title="Equipe, Setores & Permissões"
        description="Gestão de operadores de máquinas, designers de pré-impressão, líderes de turno e controle de acesso granular."
        phase="Módulo planejado para a Fase 3"
        icon={Users}
        plannedFeatures={[
          'Perfis de acesso por setor operacional (Pré-impressão, Impressão, Acabamento, Expedição)',
          'Apontamento de produtividade e horas por operador de máquina',
          'Gestão de turnos de trabalho e escalas de produção',
          'Autenticação centralizada futura via Portal Prexyon',
        ]}
        onNavigateToProduction={() => setActivePage('production')}
      />
    </div>
  );
};
