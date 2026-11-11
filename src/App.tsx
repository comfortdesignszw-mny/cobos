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
import { Lock } from 'lucide-react';

const MainContent: React.FC<{
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}> = ({ onOpenTerms, onOpenPrivacy }) => {
  const { activeTab, currentUser, setIsAuthModalOpen } = useApp();

  return (
    <main className="flex-1 flex flex-col justify-between overflow-y-auto h-[calc(100vh-57px)]">
      {!currentUser && (
        <div className="mx-3 mt-3 sm:mx-6 sm:mt-4 p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-800/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-700/60 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white">Unauthenticated Session</span>
              <p className="text-[11px] text-slate-400">
                Please verify credentials to authorize sales, bookkeeping, and cloud database persistence.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="py-1.5 px-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-md active:scale-95 cursor-pointer"
          >
            Login to COBOS
          </button>
        </div>
      )}
      <div className="p-3 sm:p-6 flex-1 pb-4">
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
      {/* Footer rendered inside main scroll container with generous bottom padding so it scrolls past mobile bottom bar */}
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
        <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
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
