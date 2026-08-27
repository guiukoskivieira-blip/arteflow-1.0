import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { Header } from './Header';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900 font-sans">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Drawer */}
      <MobileDrawer />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
};
