import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { exportDatabaseBackup, importDatabaseBackup, clearAllUserData } from '../../db/cobosDb';
import { compressImageFile } from '../../utils/imageCompressor';
import { queueSyncItem } from '../../services/accountingEngine';
import {
  Settings,
  Building,
  Coins,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Image as ImageIcon,
  ShieldCheck,
  Save,
  Database,
  User as UserIcon,
} from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { profile, updateProfile, currentUser, isSuperAdmin, triggerRefresh } = useApp();

  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline);
  const [address, setAddress] = useState(profile.address);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [taxNumber, setTaxNumber] = useState(profile.taxNumber || '');
  const [receiptFooter, setReceiptFooter] = useState(profile.receiptFooter);
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl || '');
  const [userAvatarUrl, setUserAvatarUrl] = useState(currentUser.avatarUrl || '');

  const [rateZiG, setRateZiG] = useState(profile.exchangeRates.ZiG);
  const [rateZAR, setRateZAR] = useState(profile.exchangeRates.ZAR);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingLogo(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
      setLogoUrl(compressed);
    } catch (err) {
      alert('Failed to process company logo image.');
    } finally {
      setIsCompressingLogo(false);
    }
  };

  const handleUserAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingAvatar(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 });
      setUserAvatarUrl(compressed);
    } catch (err) {
      alert('Failed to process avatar image.');
    } finally {
      setIsCompressingAvatar(false);
    }
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
      logoUrl,
      receiptFooter,
      exchangeRates: {
        USD: 1.0,
        ZiG: rateZiG,
        ZAR: rateZAR,
      },
    });

    if (userAvatarUrl !== currentUser.avatarUrl) {
      currentUser.avatarUrl = userAvatarUrl;
      await queueSyncItem('user', currentUser.id, 'UPDATE', currentUser);
    }

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

  const handleClearAllData = async () => {
    const confirmed = confirm('Are you sure you want to clear all operational records? Your chart of accounts and business setup will remain ready for clean operations.');
    if (confirmed) {
      await clearAllUserData();
      triggerRefresh();
      alert('All transactions and operational data cleared. System ready for live production.');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto text-xs">
      {/* Clean Header */}
      <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            Business Configuration & Operational Settings
          </h2>
          <p className="text-slate-400">
            Manage your company profile, multi-currency rates, logos, and local database recovery.
          </p>
        </div>
        {isSuperAdmin && (
          <span className="px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Super Admin Active
          </span>
        )}
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Business configuration and profile saved successfully!</span>
        </div>
      )}

      {/* SECTION 1: BUSINESS PROFILE & LOGO UPLOAD */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Building className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Business Profile & Company Branding</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Logo & Avatar Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            {/* Company Logo Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase text-slate-400 block">
                Company Brand Logo
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Company Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 transition">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isCompressingLogo ? 'Compressing...' : 'Upload Logo'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Auto-compressed to lightweight WebP
                  </p>
                </div>
              </div>
            </div>

            {/* User Profile Avatar Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase text-slate-400 block">
                Your Profile Avatar ({currentUser.name})
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {userAvatarUrl ? (
                    <img src={userAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 transition">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isCompressingAvatar ? 'Compressing...' : 'Upload Photo'}</span>
                    <input type="file" accept="image/*" onChange={handleUserAvatarUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Fast loading across all devices
                  </p>
                </div>
              </div>
            </div>
          </div>

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

      {/* SECTION 3: DATABASE BACKUP & RESTORE */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Database className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Local Database Backup & Disaster Recovery</h3>
        </div>

        <p className="text-slate-400">
          Export an offline JSON backup of your business records (customers, sales, inventory, ledgers, accounts) or restore backups safely on any device.
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
            onClick={handleClearAllData}
            className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-semibold flex items-center gap-2 transition ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear Operational Records</span>
          </button>
        </div>
      </div>
    </div>
  );
};
