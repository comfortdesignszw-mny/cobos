import React, { useState, useEffect } from 'react';
import { ClerkProvider, useUser, useClerk } from '@clerk/clerk-react';
import { useApp } from '../../context/AppContext';
import { AuthService } from '../../services/authService';
import type { User } from '../../types';
import { KeyRound, Check, X, ExternalLink } from 'lucide-react';

const CLERK_KEY_STORAGE = 'cobos_clerk_publishable_key';

// Syncs Clerk's user object into COBOS's local Dexie state
const ClerkUserSynchronizer: React.FC = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { setCurrentUser, triggerRefresh } = useApp();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress || '';
      const primaryPhone = user.primaryPhoneNumber?.phoneNumber || '';
      const fullName = user.fullName || user.firstName || 'Clerk User';

      const cobosUser: User = {
        id: 'clerk_' + user.id,
        name: fullName,
        email: primaryEmail || (primaryPhone ? `${primaryPhone.replace(/\D/g, '')}@cobos.zw` : 'user@cobos.zw'),
        phone: primaryPhone || undefined,
        role: (user.publicMetadata?.role as any) || 'owner',
        organisationId: 'org_default',
        authProvider: user.externalAccounts?.some((a) => a.provider === 'google')
          ? 'clerk_google'
          : primaryPhone
          ? 'clerk_phone'
          : 'clerk_email',
        avatarUrl: user.imageUrl,
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
  const [storedKey, setStoredKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CLERK_KEY_STORAGE) || '';
    }
    return '';
  });

  const activeKey = (envKey && envKey.trim().startsWith('pk_')) ? envKey.trim() : storedKey.trim();
  const isKeyValid = activeKey.startsWith('pk_test_') || activeKey.startsWith('pk_live_');

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [inputKey, setInputKey] = useState(activeKey);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputKey.trim();
    if (!clean.startsWith('pk_test_') && !clean.startsWith('pk_live_')) {
      setStatusMsg('Key must begin with pk_test_ or pk_live_');
      return;
    }

    localStorage.setItem(CLERK_KEY_STORAGE, clean);
    setStoredKey(clean);
    setStatusMsg('Clerk Key configured! Connecting...');
    setTimeout(() => {
      setShowKeyModal(false);
      setStatusMsg(null);
      window.location.reload();
    }, 1000);
  };

  const handleClearKey = () => {
    localStorage.removeItem(CLERK_KEY_STORAGE);
    setStoredKey('');
    setInputKey('');
    setShowKeyModal(false);
    window.location.reload();
  };

  // If a valid Clerk publishable key is present, wrap with real ClerkProvider
  if (isKeyValid) {
    return (
      <ClerkProvider publishableKey={activeKey}>
        <ClerkUserSynchronizer />
        {children}
        <KeyManagerModal
          isOpen={showKeyModal}
          onClose={() => setShowKeyModal(false)}
          activeKey={activeKey}
          inputKey={inputKey}
          setInputKey={setInputKey}
          handleSaveKey={handleSaveKey}
          handleClearKey={handleClearKey}
          statusMsg={statusMsg}
        />
      </ClerkProvider>
    );
  }

  // Graceful fallback when no key is set yet or in offline PWA cold-start
  return (
    <>
      {children}
      <KeyManagerModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        activeKey={activeKey}
        inputKey={inputKey}
        setInputKey={setInputKey}
        handleSaveKey={handleSaveKey}
        handleClearKey={handleClearKey}
        statusMsg={statusMsg}
      />
    </>
  );
};

interface KeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeKey: string;
  inputKey: string;
  setInputKey: (k: string) => void;
  handleSaveKey: (e: React.FormEvent) => void;
  handleClearKey: () => void;
  statusMsg: string | null;
}

export const KeyManagerModal: React.FC<KeyManagerModalProps> = ({
  isOpen,
  onClose,
  activeKey,
  inputKey,
  setInputKey,
  handleSaveKey,
  handleClearKey,
  statusMsg,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Configure Clerk API Key</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-300 leading-relaxed">
          Insert your fresh <strong>Clerk Publishable Key</strong> (e.g. from your Clerk Dashboard for application <code className="text-cyan-400 font-mono">app_3Lw5CSsIIK9QoN3objUAu5AehH5</code>).
        </p>

        <form onSubmit={handleSaveKey} className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Publishable Key (pk_test_... or pk_live_...)
            </label>
            <input
              type="text"
              required
              placeholder="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300">
              {statusMsg}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {activeKey ? (
              <button
                type="button"
                onClick={handleClearKey}
                className="text-rose-400 hover:underline text-xs"
              >
                Remove Custom Key
              </button>
            ) : <span />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition"
              >
                Connect Key
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
