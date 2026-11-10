import React from 'react';
import { useApp } from '../../context/AppContext';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const { syncState, triggerSync } = useApp();
  const { isOnline, isSyncing, pendingCount, syncError } = syncState;

  if (isOnline && pendingCount === 0 && !isSyncing && !syncError) {
    return null;
  }

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 z-40 flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 text-xs shadow-2xl transition-all">
      {!isOnline ? (
        <>
          <div className="flex h-2.5 w-2.5 relative items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </div>
          <WifiOff className="w-4 h-4 text-amber-400" />
          <span className="font-medium text-amber-300">
            Offline Mode — Saving 100% locally to IndexedDB
          </span>
          {pendingCount > 0 && (
            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
              {pendingCount} queued
            </span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
          <span className="font-medium text-cyan-300">
            Syncing {pendingCount} transactions to Cloudflare D1...
          </span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span className="font-medium text-slate-200">
            {pendingCount} offline transaction{pendingCount > 1 ? 's' : ''} ready to sync
          </span>
          <button
            onClick={triggerSync}
            className="ml-1 rounded-md bg-cyan-500 px-2 py-0.5 text-[11px] font-semibold text-slate-950 hover:bg-cyan-400 transition"
          >
            Sync Now
          </button>
        </>
      ) : syncError ? (
        <>
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span className="font-medium text-rose-300">
            Sync retry required: {syncError}
          </span>
          <button
            onClick={triggerSync}
            className="ml-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700 transition"
          >
            Retry
          </button>
        </>
      ) : null}
    </div>
  );
};
