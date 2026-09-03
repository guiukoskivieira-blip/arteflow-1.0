import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { Header } from './Header';
import { PrexyonBar } from './PrexyonBar';
import { NewOrderModal } from '../orders/NewOrderModal';
import { OrderDetailsModal } from '../orders/OrderDetailsModal';
import { ProductionJobDrawer } from '../production/ProductionJobDrawer';
import { NewMaterialModal } from '../inventory/NewMaterialModal';
import { ReceiptModal } from '../inventory/ReceiptModal';
import { StockAdjustmentModal } from '../inventory/StockAdjustmentModal';
import { MaterialDetailsDrawer } from '../inventory/MaterialDetailsDrawer';
import { useArteFlow } from '../../context/ArteFlowContext';
import { CheckCircle2, X } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { feedbackNotification, clearFeedbackNotification } = useArteFlow();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#f4f7fb] text-slate-900 font-sans relative">
      <PrexyonBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Drawer */}
        <MobileDrawer />

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />

        {/* Global Feedback Banner / Toast */}
        {feedbackNotification && (
          <div
            role="status"
            aria-live="polite"
            data-testid="feedback-notification"
            className="bg-emerald-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs font-medium z-30 transition-all"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
              <div>
                <span className="font-bold">{feedbackNotification.title}: </span>
                <span>{feedbackNotification.message}</span>
              </div>
            </div>
            <button
              onClick={clearFeedbackNotification}
              className="p-1 hover:bg-emerald-700 rounded text-emerald-100 hover:text-white"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

          <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.055),transparent_31%),#f4f7fb]">
            {children}
          </main>
        </div>
      </div>

      {/* Global Modals & Drawers accessible from all pages */}
      <NewOrderModal />
      <OrderDetailsModal />
      <ProductionJobDrawer />
      <NewMaterialModal />
      <ReceiptModal />
      <StockAdjustmentModal />
      <MaterialDetailsDrawer />
    </div>
  );
};
