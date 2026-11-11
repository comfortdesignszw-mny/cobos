import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AuthService, normalizePhoneToCobosEmail, validatePasswordRules } from '../../services/authService';
import type { UserRole, User } from '../../types';
import {
  X,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { LegalModal } from '../common/LegalModal';
import { GoogleAccountChooserModal } from './GoogleAccountChooserModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentUser, triggerRefresh } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [method, setMethod] = useState<'email' | 'phone'>('email');

  // Form Fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals state
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  if (!isOpen) return null;

  // Real-time preview of phone conversion to @cobos.zw email
  const phoneConversion =
    method === 'phone' && identifier.trim() ? normalizePhoneToCobosEmail(identifier) : null;

  // Real-time password validation criteria:
  // Must be more than 8 characters mixed with numbers, letters, and special characters
  const passwordRules = validatePasswordRules(password);
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Please enter your email or phone number.');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await AuthService.signIn(identifier, password);
      setCurrentUser(user);
      triggerRefresh();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !identifier.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }
    if (!passwordRules.isValid) {
      setErrorMsg(passwordRules.errors[0] || 'Password does not meet required security complexity.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMsg('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      if (method === 'phone') {
        const { user } = await AuthService.signUpWithPhone({
          fullName,
          phone: identifier,
          password,
          role,
        });
        setCurrentUser(user);
      } else {
        const user = await AuthService.signUpWithEmail({
          fullName,
          email: identifier,
          password,
          role,
        });
        setCurrentUser(user);
      }
      triggerRefresh();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create business account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (user: User) => {
    setCurrentUser(user);
    triggerRefresh();
    setIsGoogleModalOpen(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-7 text-slate-100 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-400 font-black text-lg tracking-wider">COBOS</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" />
                  <span>Secure Access</span>
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mt-1">
                {mode === 'signin' ? 'Sign in to your COBOS account' : 'Create protected staff account'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Google Social Button: Strictly "Continue with Google" */}
          <button
            type="button"
            onClick={() => setIsGoogleModalOpen(true)}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-3 transition shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>Continue with Google</span>
          </button>

          {/* Clean Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <span className="relative bg-slate-900 px-3 text-[11px] text-slate-400 font-medium">
              or continue with email or phone
            </span>
          </div>

          {/* Credentials Form */}
          <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3.5 text-xs">
            {/* Method Selector: Email vs Phone */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMethod('email');
                  setIdentifier('');
                }}
                className={`flex-1 py-1.5 rounded-lg text-center font-medium transition ${
                  method === 'email'
                    ? 'bg-slate-800 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Email Address
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod('phone');
                  setIdentifier('');
                }}
                className={`flex-1 py-1.5 rounded-lg text-center font-medium transition ${
                  method === 'phone'
                    ? 'bg-slate-800 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Phone Number
              </button>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tinashe Moyo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                {method === 'phone' ? 'Phone Number' : 'Email Address'}
              </label>
              <div className="relative">
                {method === 'phone' ? (
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                ) : (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                )}
                <input
                  type={method === 'phone' ? 'tel' : 'email'}
                  required
                  placeholder={method === 'phone' ? 'e.g. 077 282 4132 or +263...' : 'name@example.com'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              {phoneConversion && phoneConversion.isPhone && (
                <div className="mt-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between font-mono">
                  <span className="text-slate-400">Account ID:</span>
                  <span className="font-semibold text-cyan-400">{phoneConversion.email}</span>
                </div>
              )}
            </div>

            {/* PASSWORD INPUT WITH SHOW/HIDE TOGGLE */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  <span>Password</span>
                </label>
                {mode === 'signup' && (
                  <span className="text-[10px] text-slate-400">
                    &gt; 8 characters (letters, numbers, symbols)
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-cyan-500 placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 transition"
                  title={showPassword ? 'Hide password' : 'View password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Real-time rules checklist on signup */}
              {mode === 'signup' && password.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <div
                    className={`flex items-center gap-1 ${
                      passwordRules.hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span>{passwordRules.hasMinLength ? '✓' : '○'}</span>
                    <span>More than 8 chars (9+)</span>
                  </div>
                  <div
                    className={`flex items-center gap-1 ${
                      passwordRules.hasLetter ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span>{passwordRules.hasLetter ? '✓' : '○'}</span>
                    <span>Includes letters</span>
                  </div>
                  <div
                    className={`flex items-center gap-1 ${
                      passwordRules.hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span>{passwordRules.hasNumber ? '✓' : '○'}</span>
                    <span>Includes numbers</span>
                  </div>
                  <div
                    className={`flex items-center gap-1 ${
                      passwordRules.hasSpecial ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span>{passwordRules.hasSpecial ? '✓' : '○'}</span>
                    <span>Special character (!@#)</span>
                  </div>
                </div>
              )}
            </div>

            {/* CONFIRM PASSWORD INPUT (ON SIGNUP) WITH REAL-TIME MATCH MONITORING */}
            {mode === 'signup' && (
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-950 border text-white text-sm focus:outline-hidden placeholder-slate-500 ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? 'border-emerald-500/80 focus:border-emerald-400'
                          : 'border-rose-500/80 focus:border-rose-400'
                        : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 transition"
                    title={showConfirmPassword ? 'Hide password' : 'View password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Real-time match status */}
                {confirmPassword.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                    {passwordsMatch ? (
                      <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>✓ Passwords match</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-rose-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Passwords do not match yet</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Operational Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-hidden"
                >
                  <option value="cashier">Salesperson / Cashier</option>
                  <option value="manager">Company Admin / Manager</option>
                  <option value="accountant">Accounts Manager</option>
                  <option value="inventory_manager">Inventory Manager</option>
                </select>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && (!passwordRules.isValid || !passwordsMatch))}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-md transition active:scale-[0.99] cursor-pointer"
            >
              {loading
                ? 'Authenticating...'
                : mode === 'signin'
                ? 'Sign In with Password'
                : 'Create Account'}
            </button>
          </form>

          {/* Toggle Sign In / Sign Up */}
          <div className="text-center text-xs text-slate-400 pt-1">
            {mode === 'signin' ? (
              <span>
                Don't have an operational account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                  }}
                  className="text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  Create Account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                  }}
                  className="text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>

          {/* Legal Links in Modal */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-3 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => setLegalModalType('terms')}
              className="hover:text-cyan-400 transition underline underline-offset-2 cursor-pointer"
            >
              Terms of Service
            </button>
            <span className="text-slate-700">•</span>
            <button
              type="button"
              onClick={() => setLegalModalType('privacy')}
              className="hover:text-cyan-400 transition underline underline-offset-2 cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>

      {/* Google Account Chooser & Auth Popup Modal */}
      <GoogleAccountChooserModal
        isOpen={isGoogleModalOpen}
        onClose={() => {
          setIsGoogleModalOpen(false);
          setErrorMsg('Google Sign-In cancelled. Please select or log into a valid Google account to continue.');
        }}
        onSuccess={handleGoogleSuccess}
      />

      <LegalModal
        type={legalModalType}
        onClose={() => setLegalModalType(null)}
      />
    </>
  );
};
