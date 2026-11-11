import React, { useEffect } from 'react';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { useApp } from '../../context/AppContext';
import { AuthService, SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME } from '../../services/authService';
import type { User } from '../../types';

// Syncs Clerk's user object into COBOS's local Dexie state
const ClerkUserSynchronizer: React.FC = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { setCurrentUser, triggerRefresh } = useApp();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress || '';
      const primaryPhone = user.primaryPhoneNumber?.phoneNumber || '';
      const fullName = user.fullName || user.firstName || 'Staff Member';

      const isSuperAdmin = primaryEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      const cobosUser: User = {
        id: 'clerk_' + user.id,
        name: isSuperAdmin ? SUPER_ADMIN_NAME : fullName,
        email: primaryEmail || (primaryPhone ? `${primaryPhone.replace(/\D/g, '')}@cobos.zw` : 'user@cobos.zw'),
        phone: primaryPhone || undefined,
        role: isSuperAdmin ? 'super_admin' : ((user.publicMetadata?.role as any) || 'cashier'),
        organisationId: isSuperAdmin ? 'org_master' : 'org_default',
        authProvider: user.externalAccounts?.some((a) => a.provider === 'google')
          ? 'clerk_google'
          : primaryPhone
          ? 'clerk_phone'
          : 'clerk_email',
        avatarUrl: user.imageUrl,
        subscriptionPlan: isSuperAdmin ? 'enterprise' : 'standard',
      };

      AuthService.setActiveSessionUser(cobosUser);
      setCurrentUser(cobosUser);
      triggerRefresh();
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
};

export const ClerkAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('cobos_clerk_publishable_key') || '' : '';
  const activeKey = (envKey && envKey.trim().startsWith('pk_')) ? envKey.trim() : storedKey.trim();
  const isKeyValid = activeKey.startsWith('pk_test_') || activeKey.startsWith('pk_live_');

  if (isKeyValid) {
    return (
      <ClerkProvider publishableKey={activeKey}>
        <ClerkUserSynchronizer />
        {children}
      </ClerkProvider>
    );
  }

  // Pure clean fallback without modal or key popups
  return <>{children}</>;
};
