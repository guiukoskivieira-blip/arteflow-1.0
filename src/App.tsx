import React from 'react';
import { ArteFlowProvider, useArteFlow } from './context/ArteFlowContext';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './components/pages/OverviewPage';
import { OrdersPage } from './components/pages/OrdersPage';
import { ProductionPage } from './components/pages/ProductionPage';
import { InventoryPage } from './components/pages/InventoryPage';
import { PurchasingPage } from './components/pages/PurchasingPage';
import { FinancialPage } from './components/pages/FinancialPage';
import { DispatchPage } from './components/pages/DispatchPage';
import { SettingsPage } from './components/pages/SettingsPage';

const MainContent: React.FC = () => {
  const { activePage } = useArteFlow();

  switch (activePage) {
    case 'overview':
      return <OverviewPage />;
    case 'orders':
      return <OrdersPage />;
    case 'production':
      return <ProductionPage />;
    case 'inventory':
      return <InventoryPage />;
    case 'purchasing':
      return <PurchasingPage />;
    case 'financial':
      return <FinancialPage />;
    case 'dispatch':
      return <DispatchPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <OverviewPage />;
  }
};

export function App() {
  return (
    <ArteFlowProvider>
      <AppLayout>
        <MainContent />
      </AppLayout>
    </ArteFlowProvider>
  );
}

export default App;
