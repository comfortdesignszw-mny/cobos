import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, initializeDatabase, DEFAULT_BUSINESS_PROFILE } from '../db/cobosDb';
import { syncEngine } from '../services/syncEngine';
import { AuthService, SUPER_ADMIN_EMAIL } from '../services/authService';
import type { BusinessProfile, CurrencyCode, UserRole, User, Sale } from '../types';

export const ANONYMOUS_GUEST_USER: User = {
  id: 'usr_unauthenticated',
  name: 'Unauthenticated User',
  email: 'unauthenticated@cobos.zw',
  role: 'cashier',
  organisationId: 'org_default',
};

export interface AppContextType {
  profile: BusinessProfile;
  updateProfile: (updated: Partial<BusinessProfile>) => Promise<void>;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  activeUser: User;
  isAuthenticated: boolean;
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
  isSuperAdmin: boolean;
  hasPermission: (permission: 'view_profit' | 'reverse_tx' | 'manage_settings' | 'manage_inventory' | 'pos_sale' | 'view_reports' | 'upgrade_subscriptions' | 'manage_all_companies') => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [currentUser, setCurrentUser] = useState<User | null>(AuthService.getActiveSessionUser());
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

  const isAuthenticated = currentUser !== null;
  const activeRole: UserRole = currentUser ? currentUser.role : 'cashier';
  const isSuperAdmin = currentUser !== null && (currentUser.role === 'super_admin' || currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
  const activeUser: User = currentUser || ANONYMOUS_GUEST_USER;

  const setActiveRole = (role: UserRole) => {
    if (!currentUser) return;
    // Only super_admin can change role arbitrarily for testing
    if (!isSuperAdmin && role === 'super_admin') return;
    const updatedUser: User = { ...currentUser, role };
    setCurrentUser(updatedUser);
    AuthService.setActiveSessionUser(updatedUser);
    triggerRefresh();
  };

  const signOut = () => {
    AuthService.clearSession();
    setCurrentUser(null);
    setIsAuthModalOpen(false);
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

  // Fine-Grained Role-Based Access Control (RBAC) & Row-Level Security checks
  const hasPermission = (permission: 'view_profit' | 'reverse_tx' | 'manage_settings' | 'manage_inventory' | 'pos_sale' | 'view_reports' | 'upgrade_subscriptions' | 'manage_all_companies') => {
    if (!currentUser) {
      return false; // Authentication required for operational activities
    }
    if (isSuperAdmin) return true; // Super admin has overall omni-permissions

    switch (permission) {
      case 'upgrade_subscriptions':
      case 'manage_all_companies':
        return isSuperAdmin;
      case 'view_profit':
        return ['super_admin', 'owner', 'manager', 'accountant'].includes(activeRole);
      case 'reverse_tx':
        // Cashiers CANNOT reverse or cancel any sale without manager/admin approval
        return ['super_admin', 'owner', 'manager'].includes(activeRole);
      case 'manage_settings':
        return ['super_admin', 'owner', 'manager'].includes(activeRole);
      case 'manage_inventory':
        return ['super_admin', 'owner', 'manager', 'inventory_manager', 'cashier'].includes(activeRole);
      case 'pos_sale':
        return ['super_admin', 'owner', 'manager', 'cashier'].includes(activeRole);
      case 'view_reports':
        return ['super_admin', 'owner', 'manager', 'accountant'].includes(activeRole);
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
        activeUser,
        isAuthenticated,
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
        isSuperAdmin,
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
