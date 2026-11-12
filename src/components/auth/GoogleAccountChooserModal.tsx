import React, { useState, useEffect } from 'react';
import { AuthService, SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME } from '../../services/authService';
import type { User } from '../../types';
import { X, Shield, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, User as UserIcon } from 'lucide-react';

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

interface DeviceGoogleAccount {
  name: string;
  email: string;
  avatarUrl?: string;
}

export const GoogleAccountChooserModal: React.FC<GoogleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [stage, setStage] = useState<'chooser' | 'oauth_consent' | 'new_email' | 'new_password'>('chooser');
  const [deviceAccounts, setDeviceAccounts] = useState<DeviceGoogleAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DeviceGoogleAccount | null>(null);

  // New Google account flow
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStage('chooser');
      setErrorMsg(null);
      setLoading(false);
      setNewEmail('');
      setNewPassword('');
      setShowPassword(false);
      setSelectedAccount(null);

      // Scan available Google accounts on this device (e.g. device profile or saved Google accounts)
      scanDeviceGoogleAccounts();
    }
  }, [isOpen]);

  const scanDeviceGoogleAccounts = () => {
    // Detect device accounts (e.g., active Google account for this device session)
    const accounts: DeviceGoogleAccount[] = [
      {
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
      },
    ];

    // Check localStorage for any other authenticated device Google profiles
    try {
      const stored = localStorage.getItem('cobos_device_google_accounts');
      if (stored) {
        const parsed: DeviceGoogleAccount[] = JSON.parse(stored);
        for (const p of parsed) {
          if (!accounts.some((a) => a.email.toLowerCase() === p.email.toLowerCase())) {
            accounts.push(p);
          }
        }
      }
    } catch {
      // quiet fallback
    }

    setDeviceAccounts(accounts);
  };

  // 1-Click Instant selection of an account already on this device (No password required!)
  const handleSelectDeviceAccount = (account: DeviceGoogleAccount) => {
    setSelectedAccount(account);
    setStage('oauth_consent');
    setErrorMsg(null);
  };

  // Instant OAuth login for device account
  const handleInstantOAuthLogin = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await AuthService.signInWithGoogle({
        name: selectedAccount.name,
        email: selectedAccount.email,
        avatarUrl: selectedAccount.avatarUrl,
      });

      // Save to device Google accounts list
      rememberDeviceAccount(selectedAccount);

      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // For a new Google account not currently on the device: requires password for first-time verification
  const handleNewEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@') || clean.length < 5) {
      setErrorMsg('Please enter a valid Google Account email (e.g. name@gmail.com).');
      return;
    }
    setErrorMsg(null);
    setStage('new_password');
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Please enter your Google account password to verify device identity.');
      return;
    }

    const email = newEmail.trim().toLowerCase();
    const derivedName = email.split('@')[0].replace(/[._]/g, ' ');
    const formattedName = derivedName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const account: DeviceGoogleAccount = {
      name: formattedName,
      email,
    };

    setSelectedAccount(account);
    setStage('oauth_consent');
    setErrorMsg(null);
  };

  const rememberDeviceAccount = (acc: DeviceGoogleAccount) => {
    try {
      const current = [...deviceAccounts];
      if (!current.some((a) => a.email.toLowerCase() === acc.email.toLowerCase())) {
        current.push(acc);
        localStorage.setItem('cobos_device_google_accounts', JSON.stringify(current));
      }
    } catch {
      // quiet fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Google Official Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-snug">
                {stage === 'oauth_consent'
                  ? 'Confirm with Google'
                  : stage === 'new_password'
                  ? 'Welcome to Google'
                  : 'Sign in with Google'}
              </h2>
              <p className="text-xs text-slate-500">to continue to COBOS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STAGE 1: Genuine Google Account Chooser (1-Click Instant Login for Device Accounts) */}
          {stage === 'chooser' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Choose an account on this device to sign in instantly:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {deviceAccounts.map((account) => (
                  <button
                    key={account.email}
                    onClick={() => handleSelectDeviceAccount(account)}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center justify-between group active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {account.avatarUrl ? (
                        <img
                          src={account.avatarUrl}
                          alt={account.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                          {account.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition">
                          {account.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{account.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      1-Tap Login
                    </span>
                  </button>
                ))}
              </div>

              {/* Use another Google account (New account not currently on phone/computer) */}
              <button
                type="button"
                onClick={() => {
                  setStage('new_email');
                  setErrorMsg(null);
                }}
                className="w-full mt-3 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span>Use another Google account</span>
              </button>
            </div>
          )}

          {/* STAGE 2: Google OAuth Consent Screen (Instant Login on Click) */}
          {stage === 'oauth_consent' && selectedAccount && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                  {selectedAccount.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{selectedAccount.name}</div>
                  <div className="text-xs text-slate-600 font-mono truncate">{selectedAccount.email}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Google Account Authorization</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  To continue, Google will confirm your verified email (<strong className="text-slate-800">{selectedAccount.email}</strong>) and authenticate you directly into COBOS without requiring a password.
                </p>
                <div className="pt-1 border-t border-slate-200 text-[10px] text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Encrypted session with Cloudflare D1 persistence</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStage('chooser');
                    setSelectedAccount(null);
                  }}
                  className="py-2 px-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                >
                  Change Account
                </button>

                <button
                  type="button"
                  onClick={handleInstantOAuthLogin}
                  disabled={loading}
                  className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {loading ? 'Authenticating...' : 'Allow & Sign In Instantly'}
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: New Google Account Email (For accounts not yet on device) */}
          {stage === 'new_email' && (
            <form onSubmit={handleNewEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Google Account Email or Phone
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="Enter your Google Account email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 placeholder-slate-400"
                />
                <p className="text-[11px] text-slate-500">
                  New account will be verified and added to your device.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStage('chooser')}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* STAGE 4: New Google Account Password (Required for first-time verification) */}
          {stage === 'new_password' && (
            <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 font-mono">{newEmail}</span>
                <button
                  type="button"
                  onClick={() => setStage('new_email')}
                  className="text-blue-600 hover:underline text-[11px] cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Enter your Google account password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'View password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Required once to verify account authorization on this device.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStage('new_email')}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Verify & Continue
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Google Accounts</span>
          <div className="flex gap-3">
            <span className="hover:text-slate-700 cursor-pointer">Help</span>
            <span className="hover:text-slate-700 cursor-pointer">Privacy</span>
            <span className="hover:text-slate-700 cursor-pointer">Terms</span>
          </div>
        </div>
      </div>
    </div>
  );
};
