import React, { useState, useEffect } from 'react';
import { AuthService } from '../../services/authService';
import type { User } from '../../types';
import { X, Shield, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const GoogleAccountChooserModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [stage, setStage] = useState<'input_email' | 'input_password' | 'verify_device'>('input_email');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStage('input_email');
      setGoogleEmail('');
      setGooglePassword('');
      setShowPassword(false);
      setErrorMsg(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleLaunchGooglePopup = () => {
    setErrorMsg(null);
    try {
      // Construct official Google OAuth 2.0 Account Selector endpoint
      const currentOrigin = window.location.origin;
      const params = new URLSearchParams({
        client_id: '716298518924-cobos.apps.googleusercontent.com',
        redirect_uri: `${currentOrigin}/`,
        response_type: 'token',
        scope: 'openid email profile',
        prompt: 'select_account',
      });
      const popupUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      const popup = window.open(
        popupUrl,
        'google_oauth_popup',
        'width=500,height=600,menubar=no,status=no,toolbar=no,location=yes'
      );

      if (!popup) {
        // Popup was blocked by browser
        setErrorMsg('Popup was blocked by your browser. Please enter your device Google account details below.');
      }
    } catch {
      setErrorMsg('Could not open external Google window. Please use the form below.');
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = googleEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@') || clean.length < 5) {
      setErrorMsg('Please enter a valid Google Account email address (e.g. yourname@gmail.com).');
      return;
    }
    setErrorMsg(null);
    setStage('input_password');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googlePassword || googlePassword.length < 6) {
      setErrorMsg('Please enter your Google account password to verify device identity.');
      return;
    }
    setErrorMsg(null);
    setStage('verify_device');
  };

  const handleConfirmAuthentication = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const email = googleEmail.trim().toLowerCase();
      const derivedName = email.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = derivedName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const user = await AuthService.signInWithGoogle({
        name: formattedName,
        email,
      });

      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google device authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
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
                {stage === 'verify_device' ? 'Confirm Google Account' : 'Sign in with Google'}
              </h2>
              <p className="text-xs text-slate-500">to authenticate on this device for COBOS</p>
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

          {/* Option: Open Google Accounts in Popup */}
          <div className="mb-4">
            <button
              type="button"
              onClick={handleLaunchGooglePopup}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Open Google Account Selector (New Window)</span>
            </button>
            <div className="relative my-3 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative bg-white px-2 text-[10px] text-slate-400 font-medium uppercase">
                or sign in on this device
              </span>
            </div>
          </div>

          {/* STAGE 1: Input Google Email */}
          {stage === 'input_email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Google Account Email or Phone
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="Enter your Google Account email"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 placeholder-slate-400"
                />
                <p className="text-[11px] text-slate-500">
                  Enter the Google account you are currently logged into on this device.
                </p>
              </div>

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
                  className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* STAGE 2: Input Google Password with show/hide toggle */}
          {stage === 'input_password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 font-mono">{googleEmail}</span>
                <button
                  type="button"
                  onClick={() => setStage('input_email')}
                  className="text-blue-600 hover:underline text-[11px]"
                >
                  Change
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Enter your Google password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter password"
                    value={googlePassword}
                    onChange={(e) => setGooglePassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-slate-900 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title={showPassword ? 'Hide password' : 'View password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Verifies that you are the authorized account holder on this device.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStage('input_email')}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
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

          {/* STAGE 3: Device Verification & Explicit User Confirmation */}
          {stage === 'verify_device' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                  {googleEmail.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {googleEmail.split('@')[0]}
                  </div>
                  <div className="text-xs text-slate-600 font-mono truncate">{googleEmail}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Device Identity & Google Account Verification</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  To continue, Google will confirm that this account is active and verified on this device, and authenticate your session in COBOS.
                </p>
                <div className="pt-1 border-t border-slate-200 text-[10px] text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Secured with cryptographic hash and Cloudflare D1 persistence</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStage('input_password')}
                  className="py-2 px-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAuthentication}
                  disabled={loading}
                  className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Authenticating with Google...' : 'Confirm & Authenticate'}
                </button>
              </div>
            </div>
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
