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
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessGate } from './components/auth/AccessGate';
import type { ArteFlowPermission } from './auth/permissions';

const PAGE_PERMISSIONS: Record<string, ArteFlowPermission> = {
  overview: 'arteflow.view',
  orders: 'arteflow.orders.view',
  production: 'arteflow.production.view',
  inventory: 'arteflow.inventory.view',
  purchasing: 'arteflow.procurement.view',
  financial: 'arteflow.finance.view',
  dispatch: 'arteflow.production.view',
  settings: 'arteflow.settings.manage',
};

const MainContent: React.FC = () => {
  const { activePage } = useArteFlow();
  const { can } = useAuth();

  if (!can(PAGE_PERMISSIONS[activePage])) {
    return (
      <div className="m-auto max-w-lg p-8 text-center">
        <h2 className="text-lg font-bold text-slate-900">Módulo não autorizado</h2>
        <p className="mt-2 text-sm text-slate-600">Sua permissão Prexyon não libera este módulo.</p>
      </div>
    );
  }

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

const AuthorizedApp: React.FC = () => {
  const { tenant, mode } = useAuth();
  if (!tenant) return null;

  return (
    <ArteFlowProvider
      identity={{ organization: tenant.organization, currentUser: tenant.identity }}
      allowDemoData={mode === 'standalone'}
    >
      <AppLayout>
        <MainContent />
      </AppLayout>
    </ArteFlowProvider>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AccessGate>
        <AuthorizedApp />
      </AccessGate>
    </AuthProvider>
  );
}

export default App;
