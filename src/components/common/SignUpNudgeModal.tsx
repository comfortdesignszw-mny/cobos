import React from 'react';
import { X, Sparkles, ShieldCheck, Zap, Database, CheckCircle2, Lock } from 'lucide-react';
import { GUEST_MAX_DAILY_TRANSACTIONS, GUEST_MAX_INVENTORY_ITEMS } from '../../services/guestLimitService';

interface SignUpNudgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignUp: () => void;
  reason?: 'limit_transactions' | 'limit_inventory' | 'periodic' | null;
  currentCount?: number;
}

export const SignUpNudgeModal: React.FC<SignUpNudgeModalProps> = ({
  isOpen,
  onClose,
  onOpenSignUp,
  reason,
  currentCount,
}) => {
  if (!isOpen) return null;

  const isHardLimit = reason === 'limit_transactions' || reason === 'limit_inventory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl p-6 text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                COBOS Business Tier
              </span>
              <h3 className="text-base font-bold text-white leading-snug">
                Sign up to access seamless transactions
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason Alert if hit limit */}
        {reason === 'limit_transactions' && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Daily Guest Limit Reached ({currentCount ?? GUEST_MAX_DAILY_TRANSACTIONS}/{GUEST_MAX_DAILY_TRANSACTIONS}):</span>
              <p className="text-[11px] text-amber-300 mt-0.5">
                Guests can record up to 20 transactions per day. Sign up or log in to unlock unlimited transactions immediately.
              </p>
            </div>
          </div>
        )}

        {reason === 'limit_inventory' && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Inventory Limit Reached ({currentCount ?? GUEST_MAX_INVENTORY_ITEMS}/{GUEST_MAX_INVENTORY_ITEMS} Products):</span>
              <p className="text-[11px] text-amber-300 mt-0.5">
                Guests can track up to 20 inventory products. Sign up or log in to add unlimited products and services.
              </p>
            </div>
          </div>
        )}

        {/* Benefits list */}
        <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-2 text-xs">
          <p className="text-slate-300 font-semibold text-[11px]">
            Why create your free COBOS account today?
          </p>
          <ul className="space-y-1.5 text-slate-400 text-[11px]">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span><strong>Unlimited daily transactions</strong> across POS & Bookkeeping</span>
            </li>
            <li className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span><strong>Cloudflare D1 Cloud Sync</strong> — access your data on any phone or PC</span>
            </li>
            <li className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span><strong>Unlimited inventory stock</strong> with barcodes and image compression</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span><strong>Role-based access</strong> with automated receipts & financial statements</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSignUp();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Sign Up / Log In to COBOS</span>
          </button>

          {!isHardLimit && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              Continue Guest Browsing
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
