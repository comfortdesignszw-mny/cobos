/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ClerkAuthProvider } from './components/auth/ClerkAuthProvider';
import { Header } from './components/common/Header';
import { Navigation } from './components/common/Navigation';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { ReceiptModal } from './components/common/ReceiptModal';
import { JournalViewModal } from './components/accounting/JournalViewModal';
import { AuthModal } from './components/auth/AuthModal';

import { DashboardModule } from './components/modules/DashboardModule';
import { POSModule } from './components/modules/POSModule';
import { BookkeepingModule } from './components/modules/BookkeepingModule';
import { InventoryModule } from './components/modules/InventoryModule';
import { CustomerReceivablesModule } from './components/modules/CustomerReceivablesModule';
import { SupplierPayablesModule } from './components/modules/SupplierPayablesModule';
import { CashFlowModule } from './components/modules/CashFlowModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { SettingsModule } from './components/modules/SettingsModule';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <main className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-screen">
      {activeTab === 'dashboard' && <DashboardModule />}
      {activeTab === 'pos' && <POSModule />}
      {activeTab === 'transactions' && <BookkeepingModule />}
      {activeTab === 'inventory' && <InventoryModule />}
      {activeTab === 'customers' && <CustomerReceivablesModule />}
      {activeTab === 'suppliers' && <SupplierPayablesModule />}
      {activeTab === 'cashflow' && <CashFlowModule />}
      {activeTab === 'reports' && <ReportsModule />}
      {activeTab === 'settings' && <SettingsModule />}
    </main>
  );
};

const AuthModalContainer: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen } = useApp();
  return <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />;
};

export default function App() {
  return (
    <AppProvider>
      <ClerkAuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
          <Header />
          <div className="flex-1 flex overflow-hidden">
            <Navigation />
            <MainContent />
          </div>
          <ReceiptModal />
          <JournalViewModal />
          <OfflineIndicator />
          <AuthModalContainer />
        </div>
      </ClerkAuthProvider>
    </AppProvider>
  );
}
