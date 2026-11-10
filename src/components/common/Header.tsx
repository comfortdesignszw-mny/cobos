import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  User as UserIcon,
  ChevronDown,
  LogOut,
  LogIn,
} from 'lucide-react';
import type { CurrencyCode } from '../../types';

export const Header: React.FC = () => {
  const {
    profile,
    currentUser,
    activeRole,
    activeCurrency,
    setActiveCurrency,
    syncState,
    triggerSync,
    setIsAuthModalOpen,
    signOut,
  } = useApp();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 sm:px-6 py-3">
      {/* Zone 1: Clean Brand Wordmark */}
      <div className="flex items-center gap-3">
        <a href="/" className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2">
          <span className="font-mono text-cyan-400 font-black">COBOS</span>
          <span className="text-slate-400 font-normal hidden sm:inline text-xs">
            {profile.name}
          </span>
        </a>
      </div>

      {/* Zone 2: Exchange Rates & Currency Filter */}
      <div className="flex items-center gap-3">
        {/* Simple Text Rates (No Pill Enclosures) */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span>1 USD = {profile.exchangeRates.ZiG.toFixed(1)} ZiG</span>
          <span className="text-slate-700">/</span>
          <span>1 USD = {profile.exchangeRates.ZAR.toFixed(1)} ZAR</span>
        </div>

        {/* Currency Switcher */}
        <div className="relative">
          <button
            onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-750 transition"
          >
            <span className="text-cyan-400">{activeCurrency}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {currencyDropdownOpen && (
            <div className="absolute right-0 mt-1 w-32 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl z-50 text-xs">
              {(['USD', 'ZiG', 'ZAR'] as CurrencyCode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setActiveCurrency(c);
                    setCurrencyDropdownOpen(false);
                  }}
                  className={`w-full text-left rounded-lg px-2.5 py-1.5 font-medium transition ${
                    activeCurrency === c
                      ? 'bg-cyan-500/15 text-cyan-400 font-bold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Sync Status, Install, User Account */}
      <div className="flex items-center gap-2.5">
        {/* Sync Status Button */}
        <button
          onClick={() => triggerSync()}
          disabled={syncState.isSyncing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-750 transition"
          title="Cloudflare D1 Sync Status"
        >
          {!syncState.isOnline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Offline</span>
            </>
          ) : syncState.isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span className="hidden sm:inline">Syncing</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">
                {syncState.pendingCount > 0 ? `${syncState.pendingCount} Queued` : 'D1 Synced'}
              </span>
            </>
          )}
        </button>

        {/* PWA Install */}
        <PWAInstallButton />

        {/* User Account / Auth Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white hover:bg-slate-750 transition"
          >
            <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span className="font-semibold text-slate-200 truncate max-w-[100px]">
                {currentUser.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                {activeRole}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-slate-700 bg-slate-900 p-2.5 shadow-2xl z-50 text-xs space-y-2">
              <div className="pb-2 border-b border-slate-800 space-y-0.5">
                <div className="font-bold text-white truncate">{currentUser.name}</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</div>
                {currentUser.phone && (
                  <div className="text-[10px] text-slate-400 font-mono">Phone: {currentUser.phone}</div>
                )}
                <div className="text-[10px] text-cyan-400 font-semibold uppercase mt-1">
                  Role: {activeRole}
                </div>
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  setIsAuthModalOpen(true);
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <LogIn className="w-4 h-4 text-cyan-400" />
                <span>Switch / Sign In with Clerk</span>
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-400 hover:bg-rose-950/40 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
