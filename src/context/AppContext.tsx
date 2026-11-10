import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, initializeDatabase, DEFAULT_BUSINESS_PROFILE } from '../db/cobosDb';
import { syncEngine } from '../services/syncEngine';
import { AuthService, SEED_USERS } from '../services/authService';
import type { BusinessProfile, CurrencyCode, UserRole, User, Sale } from '../types';

export interface AppContextType {
  profile: BusinessProfile;
  updateProfile: (updated: Partial<BusinessProfile>) => Promise<void>;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  activeUser: User;
  signOut: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  activeCurrency: CurrencyCode;
  setActiveCurrency: (curr: CurrencyCode) => void;
  syncState: {
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    lastSyncedAt: string | null;
    syncError: string | null;
  };
  triggerSync: () => Promise<void>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  refreshKey: number;
  triggerRefresh: () => void;
  receiptModalData: Sale | null;
  setReceiptModalData: (sale: Sale | null) => void;
  journalViewId: string | null;
  setJournalViewId: (id: string | null) => void;
  hasPermission: (permission: 'view_profit' | 'reverse_tx' | 'manage_settings' | 'manage_inventory' | 'pos_sale' | 'view_reports') => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [currentUser, setCurrentUser] = useState<User>(AuthService.getActiveSessionUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>('USD');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [receiptModalData, setReceiptModalData] = useState<Sale | null>(null);
  const [journalViewId, setJournalViewId] = useState<string | null>(null);

  const [syncState, setSyncState] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null as string | null,
    syncError: null as string | null,
  });

  const activeRole = currentUser.role;

  const setActiveRole = (role: UserRole) => {
    const updatedUser: User = { ...currentUser, role };
    setCurrentUser(updatedUser);
    AuthService.setActiveSessionUser(updatedUser);
    triggerRefresh();
  };

  const signOut = () => {
    AuthService.clearSession();
    // Default to a guest cashier or re-open login modal
    const guestUser: User = {
      id: 'usr_guest',
      name: 'Guest Cashier',
      email: 'guest@cobos.zw',
      role: 'cashier',
      organisationId: 'org_default',
    };
    setCurrentUser(guestUser);
    setIsAuthModalOpen(true);
    triggerRefresh();
  };

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Initialize DB and load profile
  useEffect(() => {
    let mounted = true;
    initializeDatabase().then(async () => {
      await AuthService.init();
      const p = await db.businessProfiles.get('org_default');
      if (p && mounted) {
        setProfile(p);
      }
      triggerRefresh();
    });

    const unsubscribe = syncEngine.subscribe((state) => {
      if (mounted) {
        setSyncState(state);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [triggerRefresh]);

  const updateProfile = async (updated: Partial<BusinessProfile>) => {
    const newProfile = { ...profile, ...updated };
    setProfile(newProfile);
    await db.businessProfiles.put(newProfile);
    triggerRefresh();
  };

  const triggerSync = async () => {
    await syncEngine.syncNow();
    triggerRefresh();
  };

  // Role Level Security checks
  const hasPermission = (permission: 'view_profit' | 'reverse_tx' | 'manage_settings' | 'manage_inventory' | 'pos_sale' | 'view_reports') => {
    switch (permission) {
      case 'view_profit':
        return ['owner', 'manager', 'accountant'].includes(activeRole);
      case 'reverse_tx':
        return ['owner', 'accountant'].includes(activeRole);
      case 'manage_settings':
        return ['owner', 'manager'].includes(activeRole);
      case 'manage_inventory':
        return ['owner', 'manager', 'inventory_manager'].includes(activeRole);
      case 'pos_sale':
        return ['owner', 'manager', 'cashier'].includes(activeRole);
      case 'view_reports':
        return ['owner', 'manager', 'accountant'].includes(activeRole);
      default:
        return true;
    }
  };

  return (
    <AppContext.Provider
      value={{
        profile,
        updateProfile,
        currentUser,
        setCurrentUser,
        activeRole,
        setActiveRole,
        activeUser: currentUser,
        signOut,
        isAuthModalOpen,
        setIsAuthModalOpen,
        activeCurrency,
        setActiveCurrency,
        syncState,
        triggerSync,
        activeTab,
        setActiveTab,
        refreshKey,
        triggerRefresh,
        receiptModalData,
        setReceiptModalData,
        journalViewId,
        setJournalViewId,
        hasPermission,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
