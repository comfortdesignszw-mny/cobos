/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ClerkAuthProvider } from './components/auth/ClerkAuthProvider';
import { Header } from './components/common/Header';
import { Navigation } from './components/common/Navigation';
import { Footer } from './components/common/Footer';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { ReceiptModal } from './components/common/ReceiptModal';
import { JournalViewModal } from './components/accounting/JournalViewModal';
import { AuthModal } from './components/auth/AuthModal';
import { LegalModal } from './components/common/LegalModal';

import { DashboardModule } from './components/modules/DashboardModule';
import { POSModule } from './components/modules/POSModule';
import { BookkeepingModule } from './components/modules/BookkeepingModule';
import { InventoryModule } from './components/modules/InventoryModule';
import { CustomerReceivablesModule } from './components/modules/CustomerReceivablesModule';
import { SupplierPayablesModule } from './components/modules/SupplierPayablesModule';
import { CashFlowModule } from './components/modules/CashFlowModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { SettingsModule } from './components/modules/SettingsModule';

const MainContent: React.FC<{
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}> = ({ onOpenTerms, onOpenPrivacy }) => {
  const { activeTab } = useApp();

  return (
    <main className="flex-1 flex flex-col justify-between overflow-y-auto min-h-screen">
      <div className="p-3 sm:p-6 flex-1">
        {activeTab === 'dashboard' && <DashboardModule />}
        {activeTab === 'pos' && <POSModule />}
        {activeTab === 'transactions' && <BookkeepingModule />}
        {activeTab === 'inventory' && <InventoryModule />}
        {activeTab === 'customers' && <CustomerReceivablesModule />}
        {activeTab === 'suppliers' && <SupplierPayablesModule />}
        {activeTab === 'cashflow' && <CashFlowModule />}
        {activeTab === 'reports' && <ReportsModule />}
        {activeTab === 'settings' && <SettingsModule />}
      </div>
      <Footer onOpenTerms={onOpenTerms} onOpenPrivacy={onOpenPrivacy} />
    </main>
  );
};

const AuthModalContainer: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen } = useApp();
  return <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />;
};

export default function App() {
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  return (
    <AppProvider>
      <ClerkAuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
          <Header />
          <div className="flex-1 flex overflow-hidden">
            <Navigation />
            <MainContent
              onOpenTerms={() => setLegalModalType('terms')}
              onOpenPrivacy={() => setLegalModalType('privacy')}
            />
          </div>
          <ReceiptModal />
          <JournalViewModal />
          <OfflineIndicator />
          <AuthModalContainer />
          <LegalModal
            type={legalModalType}
            onClose={() => setLegalModalType(null)}
          />
        </div>
      </ClerkAuthProvider>
    </AppProvider>
  );
}
