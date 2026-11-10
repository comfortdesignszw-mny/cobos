import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AuthService, normalizePhoneToCobosEmail, SEED_USERS } from '../../services/authService';
import type { UserRole } from '../../types';
import { X, Lock, Mail, Phone, User, Check, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentUser, triggerRefresh } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [method, setMethod] = useState<'phone' | 'email'>('phone');

  // Form Fields
  const [identifier, setIdentifier] = useState(''); // phone or email
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real-time preview of phone conversion to @cobos.zw email
  const phoneConversion = method === 'phone' && identifier.trim()
    ? normalizePhoneToCobosEmail(identifier)
    : null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Please enter both identifier and password.');
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
      setErrorMsg(err.message || 'Failed to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !identifier.trim() || !password.trim()) {
      setErrorMsg('Please complete all required fields.');
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
      setErrorMsg(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await AuthService.signInWithGoogle();
      setCurrentUser(user);
      triggerRefresh();
      onClose();
    } catch (err: any) {
      setErrorMsg('Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = async (seedUser: typeof SEED_USERS[0]) => {
    AuthService.setActiveSessionUser(seedUser);
    setCurrentUser(seedUser);
    triggerRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {mode === 'signin' ? 'Sign In to COBOS' : 'Create Business Account'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure Clerk & Offline Multi-User Authentication
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google 1-Tap Social Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-3 transition active:scale-[0.99]"
        >
          {/* Official Google G SVG */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            or use credentials
          </span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3 text-xs">
          {/* Method Selector: Phone vs Email */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
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
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Tendai Moyo"
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
                placeholder={method === 'phone' ? 'e.g. 077 212 3456 or +263...' : 'name@example.com'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            {/* Live Phone Conversion Preview */}
            {phoneConversion && phoneConversion.isPhone && (
              <div className="mt-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between font-mono">
                <span className="text-slate-400">Database ID:</span>
                <span className="font-semibold text-cyan-400">{phoneConversion.email}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Account Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-hidden"
              >
                <option value="owner">Owner / Administrator (Full Access)</option>
                <option value="manager">Branch Manager</option>
                <option value="accountant">Accountant</option>
                <option value="cashier">Salesperson / Cashier</option>
                <option value="inventory_manager">Inventory Manager</option>
              </select>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition active:scale-[0.99]"
          >
            {loading ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center text-xs text-slate-400 pt-1">
          {mode === 'signin' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className="text-cyan-400 hover:underline font-semibold"
              >
                Sign Up
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
                className="text-cyan-400 hover:underline font-semibold"
              >
                Sign In
              </button>
            </span>
          )}
        </div>

        {/* Fast Account Switcher for Team Testing */}
        <div className="pt-3 border-t border-slate-800/80">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-2">
            Quick Switch Demo Staff Profiles:
          </span>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            {SEED_USERS.slice(0, 3).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleQuickSwitch(u)}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-left transition truncate"
              >
                <div className="font-semibold text-white truncate">{u.name.split(' ')[0]}</div>
                <div className="text-[9px] text-cyan-400 uppercase truncate">{u.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
