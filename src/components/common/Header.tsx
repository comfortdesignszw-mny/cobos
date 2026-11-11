import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  LogOut,
  LogIn,
  ShieldCheck,
  Building,
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
    isSuperAdmin,
  } = useApp();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 sm:px-6 py-3">
      {/* Zone 1: Clean Brand Wordmark with 3D App Icon & Company Logo */}
      <div className="flex items-center gap-3">
        <a href="/" className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2.5">
          {profile.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              className="w-7 h-7 rounded-lg shadow-sm border border-cyan-500/30 object-contain bg-slate-950"
            />
          ) : (
            <img
              src="/pwa-192x192.png"
              alt="COBOS Icon"
              className="w-7 h-7 rounded-lg shadow-sm border border-cyan-500/30 object-cover"
            />
          )}
          <span className="font-mono text-cyan-400 font-black">COBOS</span>
          <span className="text-slate-400 font-normal hidden sm:inline text-xs">
            {profile.name}
          </span>
        </a>
      </div>

      {/* Zone 2: Exchange Rates & Currency Filter */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span>1 USD = {profile.exchangeRates.ZiG.toFixed(1)} ZiG</span>
          <span className="text-slate-700">/</span>
          <span>1 USD = {profile.exchangeRates.ZAR.toFixed(1)} ZAR</span>
        </div>

        {/* Currency Switcher */}
        <div className="relative">
          <button
            onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-750 transition"
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
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-750 transition"
          title="Cloud Sync Status"
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
                {syncState.pendingCount > 0 ? `${syncState.pendingCount} Queued` : 'Cloud Synced'}
              </span>
            </>
          )}
        </button>

        {/* PWA Install */}
        <PWAInstallButton />

        {/* User Account / Login Area */}
        {!currentUser ? (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 px-3.5 py-1.5 text-xs font-bold text-cyan-300 shadow-sm hover:shadow-cyan-500/20 hover:border-cyan-400 hover:text-white transition active:scale-95 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-cyan-400" />
            <span>Login to COBOS</span>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white hover:bg-slate-750 transition"
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-5 h-5 rounded-full object-cover border border-cyan-400"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="font-semibold text-slate-200 truncate max-w-[120px]">
                  {currentUser.name.split(' ')[0]}
                </span>
                <span className="text-[9px] text-cyan-400 uppercase font-mono font-bold">
                  {isSuperAdmin ? 'SUPER ADMIN' : activeRole}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl z-50 text-xs space-y-2.5">
                <div className="pb-2.5 border-b border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span className="truncate">{currentUser.name}</span>
                    {isSuperAdmin && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-950 text-cyan-300 font-bold border border-cyan-700">
                        SUPER ADMIN
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</div>
                  {currentUser.phone && (
                    <div className="text-[10px] text-slate-400 font-mono">Phone: {currentUser.phone}</div>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono">
                    Plan: <span className="text-emerald-400 uppercase font-semibold">{currentUser.subscriptionPlan || 'Enterprise'}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-cyan-400" />
                  <span>Switch / Sign In Staff Account</span>
                </button>

                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
