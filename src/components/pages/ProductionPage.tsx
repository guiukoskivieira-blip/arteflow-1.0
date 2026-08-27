import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { ProductionFilters } from '../production/ProductionFilters';
import { ProductionBoard } from '../production/ProductionBoard';
import { ProductionListView } from '../production/ProductionListView';
import { ProductionJobDrawer } from '../production/ProductionJobDrawer';
import { NewOrderModal } from '../orders/NewOrderModal';

export const ProductionPage: React.FC = () => {
  const { viewMode } = useArteFlow();

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <ProductionFilters />
      {viewMode === 'kanban' ? <ProductionBoard /> : <ProductionListView />}
      <ProductionJobDrawer />
      <NewOrderModal />
    </div>
  );
};
