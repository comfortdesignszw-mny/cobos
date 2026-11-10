import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { exportDatabaseBackup, importDatabaseBackup, initializeDatabase } from '../../db/cobosDb';
import {
  Settings,
  Building,
  Coins,
  Cloud,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Save,
  Database,
  ExternalLink,
  KeyRound,
  Lock,
} from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { profile, updateProfile, syncState, triggerSync, triggerRefresh } = useApp();

  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline);
  const [address, setAddress] = useState(profile.address);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [taxNumber, setTaxNumber] = useState(profile.taxNumber || '');
  const [receiptFooter, setReceiptFooter] = useState(profile.receiptFooter);

  const [rateZiG, setRateZiG] = useState(profile.exchangeRates.ZiG);
  const [rateZAR, setRateZAR] = useState(profile.exchangeRates.ZAR);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [clerkKeyInput, setClerkKeyInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cobos_clerk_publishable_key') || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
    }
    return '';
  });
  const [clerkKeySaved, setClerkKeySaved] = useState(false);

  const handleSaveClerkKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = clerkKeyInput.trim();
    if (clean) {
      localStorage.setItem('cobos_clerk_publishable_key', clean);
    } else {
      localStorage.removeItem('cobos_clerk_publishable_key');
    }
    setClerkKeySaved(true);
    setTimeout(() => {
      setClerkKeySaved(false);
      window.location.reload();
    }, 1200);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      name,
      tagline,
      address,
      phone,
      email,
      taxNumber,
      receiptFooter,
      exchangeRates: {
        USD: 1.0,
        ZiG: rateZiG,
        ZAR: rateZAR,
      },
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleExportBackup = async () => {
    const json = await exportDatabaseBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `COBOS_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const ok = await importDatabaseBackup(content);
        if (ok) {
          setImportStatus('Backup restored successfully!');
          triggerRefresh();
        } else {
          setImportStatus('Failed to restore backup: Invalid format.');
        }
      } catch (err) {
        setImportStatus('Import failed.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDemoData = async () => {
    const confirmed = confirm('Are you sure you want to reset the database and restore default Zimbabwean SME demo data?');
    if (confirmed) {
      await initializeDatabase(true);
      triggerRefresh();
      alert('Database reset with clean demo data.');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto text-xs">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          Business Configuration & Offline Settings
        </h2>
        <p className="text-slate-400">
          Configure business details, exchange rates, Cloudflare D1 integration, and local backup files.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Business configuration saved successfully!</span>
        </div>
      )}

      {/* SECTION 1: BUSINESS PROFILE */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Building className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Business Profile & Receipts</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Business Legal / Trading Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Business Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Official Phone / WhatsApp
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Tax Registration / BP Number
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="e.g. BP200-984712-ZW"
                className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Physical Shop / Branch Address
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Receipt Footer Note / Return Policy
            </label>
            <textarea
              rows={2}
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
            />
          </div>

          {/* SECTION 2: CURRENCY & EXCHANGE RATES */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Multi-Currency Exchange Rates (Base: 1 USD)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <label className="text-[10px] text-slate-400 block mb-1 font-semibold">
                  1 USD to Zimbabwe Gold (ZiG) Rate
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">$1 =</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={rateZiG}
                    onChange={(e) => setRateZiG(parseFloat(e.target.value) || 28.5)}
                    className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold"
                  />
                  <span className="font-mono font-bold text-cyan-300">ZiG</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <label className="text-[10px] text-slate-400 block mb-1 font-semibold">
                  1 USD to South African Rand (ZAR) Rate
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">$1 =</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={rateZAR}
                    onChange={(e) => setRateZAR(parseFloat(e.target.value) || 18.2)}
                    className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold"
                  />
                  <span className="font-mono font-bold text-cyan-300">ZAR</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-2 shadow-md transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: CLERK AUTHENTICATION API CONFIGURATION */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Clerk Authentication API Configuration</h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
            {clerkKeyInput.startsWith('pk_') ? 'Active Key' : 'Not Configured'}
          </span>
        </div>

        <p className="text-slate-300 leading-relaxed">
          COBOS supports full Clerk authentication with <strong>Google Social Sign-in</strong>, <strong>Email & Password</strong>, and <strong>Phone Number credentials</strong> automatically converted to <code className="text-cyan-400 font-mono">number@cobos.zw</code> in the database.
        </p>

        {clerkKeySaved && (
          <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Clerk API Key saved! Refreshing...</span>
          </div>
        )}

        <form onSubmit={handleSaveClerkKey} className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Fresh Clerk Publishable Key (pk_test_... or pk_live_...)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={clerkKeyInput}
                onChange={(e) => setClerkKeyInput(e.target.value)}
                className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition whitespace-nowrap"
              >
                Save & Apply
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between items-center text-slate-300">
              <span>Target Clerk Application:</span>
              <span className="font-mono text-cyan-300 font-bold">app_3Lw5CSsIIK9QoN3objUAu5AehH5</span>
            </div>
            <p>
              You can obtain or manage this key from the <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">Clerk Dashboard <ExternalLink className="w-3 h-3" /></a> under <strong>API Keys</strong>.
            </p>
          </div>
        </form>
      </div>

      {/* SECTION 3: CLOUDFLARE PAGES & D1 SQLITE STATUS */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Cloudflare Pages & D1 SQLite Deployment</h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
            D1 SQLite Schema Ready
          </span>
        </div>

        <div className="space-y-3 text-slate-300">
          <p>
            COBOS is engineered for straight deployment to <strong>Cloudflare Pages</strong> with edge database binding to <strong>Cloudflare D1 (SQLite)</strong>.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Cloudflare D1 Binding:</span>
              <span className="text-cyan-300 font-bold">DB (cobos-db)</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Sync Endpoint:</span>
              <span className="text-slate-200">/api/sync (Pages Function)</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Offline Queue Backlog:</span>
              <span className="text-amber-400 font-bold">{syncState.pendingCount} Operations Queued</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Last Cloud Sync:</span>
              <span className="text-slate-200">{syncState.lastSyncedAt || 'Session Started'}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => triggerSync()}
              disabled={syncState.isSyncing}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition flex items-center gap-1.5"
            >
              <span>{syncState.isSyncing ? 'Syncing...' : 'Force Cloudflare D1 Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 4: DATABASE BACKUP & RESTORE */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Database className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Local Database Backup & Disaster Recovery</h3>
        </div>

        <p className="text-slate-400">
          You can create an offline JSON backup of your entire business database (customers, sales, inventory, ledgers, accounts) and restore it on any device.
        </p>

        {importStatus && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-medium">
            {importStatus}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportBackup}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export JSON Database Backup</span>
          </button>

          <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-2 cursor-pointer transition">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Restore Backup File</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            onClick={handleResetDemoData}
            className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-semibold flex items-center gap-2 transition ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
