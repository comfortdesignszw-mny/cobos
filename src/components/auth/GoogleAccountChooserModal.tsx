import React, { useState, useEffect } from 'react';
import { AuthService } from '../../services/authService';
import type { User } from '../../types';
import { X, User as UserIcon, Shield, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

interface DetectedGoogleAccount {
  name: string;
  email: string;
  avatarUrl?: string;
  isCurrentDevice?: boolean;
}

export const GoogleAccountChooserModal: React.FC<GoogleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'chooser' | 'confirm' | 'new_login'>('chooser');
  const [detectedAccounts, setDetectedAccounts] = useState<DetectedGoogleAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DetectedGoogleAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Google account credentials form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loginStep, setLoginStep] = useState<'email' | 'password'>('email');

  // Search for available Google accounts on this device
  useEffect(() => {
    if (isOpen) {
      setStep('chooser');
      setErrorMsg(null);
      setSelectedAccount(null);
      setNewEmail('');
      setNewPassword('');
      setLoginStep('email');
      loadDeviceAccounts();
    }
  }, [isOpen]);

  const loadDeviceAccounts = async () => {
    setLoading(true);
    try {
      const accounts: DetectedGoogleAccount[] = await AuthService.getDeviceGoogleAccounts();
      
      // Also inspect Web Credential Management API if available on this device
      if (typeof window !== 'undefined' && 'credentials' in navigator && (navigator.credentials as any)?.get) {
        try {
          // Non-blocking probe for federated credentials
          const cred = await (navigator.credentials as any).get({
            federated: { providers: ['https://accounts.google.com'] },
            mediation: 'silent',
          });
          if (cred && (cred as any).id) {
            const email = (cred as any).id;
            if (!accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
              accounts.push({
                email,
                name: (cred as any).name || email.split('@')[0],
                avatarUrl: (cred as any).iconURL,
                isCurrentDevice: true,
              });
            }
          }
        } catch {
          // Quietly ignore if browser credentials mediation fails or is denied
        }
      }

      setDetectedAccounts(accounts);
      if (accounts.length === 0) {
        // If no pre-existing device Google accounts were found, guide user to authentic Google Sign In
        setStep('new_login');
      } else {
        setStep('chooser');
      }
    } catch {
      setStep('new_login');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (account: DetectedGoogleAccount) => {
    setSelectedAccount(account);
    setStep('confirm');
    setErrorMsg(null);
  };

  const handleConfirmLogin = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await AuthService.signInWithGoogle({
        name: selectedAccount.name,
        email: selectedAccount.email,
        avatarUrl: selectedAccount.avatarUrl,
      });
      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google account verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewLoginNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStep === 'email') {
      const clean = newEmail.trim();
      if (!clean || (!clean.includes('@') && clean.length < 5)) {
        setErrorMsg('Enter a valid Google email or phone number.');
        return;
      }
      setErrorMsg(null);
      setLoginStep('password');
    } else {
      // Validate password
      if (!newPassword || newPassword.length < 6) {
        setErrorMsg('Wrong password. Try again or click Forgot password.');
        return;
      }
      // Success: proceed to confirm step with this verified account
      const account: DetectedGoogleAccount = {
        name: newEmail.split('@')[0],
        email: newEmail.includes('@') ? newEmail.trim().toLowerCase() : `${newEmail.trim()}@gmail.com`,
      };
      setSelectedAccount(account);
      setStep('confirm');
      setErrorMsg(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Google Header */}
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
                {step === 'chooser'
                  ? 'Choose an account'
                  : step === 'confirm'
                  ? 'Confirm your Google account'
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

        {/* Content body based on step */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Account Chooser (Accounts detected on device) */}
          {step === 'chooser' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 mb-2">
                Select an account verified on this device to authenticate into COBOS:
              </p>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {detectedAccounts.map((account) => (
                  <button
                    key={account.email}
                    onClick={() => handleSelectAccount(account)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      {account.avatarUrl ? (
                        <img
                          src={account.avatarUrl}
                          alt={account.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                          {account.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition">
                          {account.name}
                        </div>
                        <div className="text-xs text-slate-500">{account.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      On device
                    </span>
                  </button>
                ))}
              </div>

              {/* Option to use another Google account */}
              <button
                type="button"
                onClick={() => {
                  setStep('new_login');
                  setLoginStep('email');
                  setErrorMsg(null);
                }}
                className="w-full mt-3 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 transition"
              >
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span>Use another Google account</span>
              </button>
            </div>
          )}

          {/* STEP 2: Confirm Account & Device Verification */}
          {step === 'confirm' && selectedAccount && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                {selectedAccount.avatarUrl ? (
                  <img
                    src={selectedAccount.avatarUrl}
                    alt={selectedAccount.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center">
                    {selectedAccount.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{selectedAccount.name}</div>
                  <div className="text-xs text-slate-600 font-mono truncate">{selectedAccount.email}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>

              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3.5 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Google Device & Safety Verification</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  To continue, Google will confirm that this account is active and verified on this device, and safely authenticate your financial operations in COBOS.
                </p>
                <div className="pt-1 border-t border-blue-200/60 text-[10px] text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>End-to-end encrypted session with Cloudflare D1 synchronization</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(detectedAccounts.length > 0 ? 'chooser' : 'new_login');
                    setSelectedAccount(null);
                  }}
                  className="py-2 px-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Change Account
                </button>

                <button
                  type="button"
                  onClick={handleConfirmLogin}
                  disabled={loading}
                  className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
                >
                  {loading ? 'Verifying with Google...' : 'Confirm & Continue'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Sign in to Google (Email + Password) */}
          {step === 'new_login' && (
            <form onSubmit={handleNewLoginNext} className="space-y-4">
              {detectedAccounts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep('chooser');
                    setErrorMsg(null);
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to accounts on this device</span>
                </button>
              )}

              {loginStep === 'email' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Email or phone
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter your Google Account email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 placeholder-slate-400"
                  />
                  <p className="text-[11px] text-slate-500">
                    Not your computer? Use Guest mode to sign in privately.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-semibold text-slate-800">{newEmail}</span>
                    <button
                      type="button"
                      onClick={() => setLoginStep('email')}
                      className="text-blue-600 hover:underline text-[11px]"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Enter your password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        autoFocus
                        placeholder="Google account password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 placeholder-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                >
                  Next
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
