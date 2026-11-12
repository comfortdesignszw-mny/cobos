import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { exportDatabaseBackup, importDatabaseBackup, clearAllUserData, db } from '../../db/cobosDb';
import { compressImageFile } from '../../utils/imageCompressor';
import { generateUUID, queueSyncItem } from '../../services/accountingEngine';
import type { SubscriptionPaymentRequest, User, BusinessProfile } from '../../types';
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
  CreditCard,
  Sparkles,
  Check,
  Clock,
  Calendar,
  Smartphone,
  Landmark,
  Banknote,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { profile, updateProfile, currentUser, isSuperAdmin, triggerRefresh, refreshKey } = useApp();

  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline);
  const [address, setAddress] = useState(profile.address);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [taxNumber, setTaxNumber] = useState(profile.taxNumber || '');
  const [receiptFooter, setReceiptFooter] = useState(profile.receiptFooter);
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl || '');
  const [userAvatarUrl, setUserAvatarUrl] = useState(currentUser?.avatarUrl || '');

  const [rateZiG, setRateZiG] = useState(profile.exchangeRates.ZiG);
  const [rateZAR, setRateZAR] = useState(profile.exchangeRates.ZAR);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);

  // Subscriptions & Licensing State
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allProfiles, setAllProfiles] = useState<BusinessProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<SubscriptionPaymentRequest[]>([]);
  
  // User Subscription Form
  const [subPlan, setSubPlan] = useState<'professional' | 'enterprise'>('professional');
  const [subMethod, setSubMethod] = useState<'ecocash' | 'cash' | 'bank_transfer'>('ecocash');
  const [subRef, setSubRef] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subSuccess, setSubSuccess] = useState<string | null>(null);

  // Super Admin Upgrader State
  const [adminTargetType, setAdminTargetType] = useState<'company' | 'user'>('company');
  const [adminTargetId, setAdminTargetId] = useState<string>('');
  const [adminPlan, setAdminPlan] = useState<'professional' | 'enterprise'>('professional');
  const [adminUpgradeMsg, setAdminUpgradeMsg] = useState<string | null>(null);
  const [isAdminUpgrading, setIsAdminUpgrading] = useState(false);

  useEffect(() => {
    async function loadSubscriptionData() {
      try {
        const users = await db.users.toArray();
        const profiles = await db.businessProfiles.toArray();
        const requests = await db.subscriptionRequests.toArray();
        setAllUsers(users);
        setAllProfiles(profiles);
        setPendingRequests(requests.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
        if (profiles.length > 0 && !adminTargetId) {
          setAdminTargetId(profiles[0].id);
        }
      } catch (err) {
        console.warn('Failed to load subscription tables:', err);
      }
    }
    loadSubscriptionData();
  }, [refreshKey]);

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

    if (currentUser && userAvatarUrl !== currentUser.avatarUrl) {
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

  const handleSubmitSubscriptionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subRef.trim()) {
      alert('Please enter your payment reference code or receipt number.');
      return;
    }

    setSubSubmitting(true);
    try {
      const amount = subPlan === 'enterprise' ? 35 : 15;
      const newRequest: SubscriptionPaymentRequest = {
        id: 'sub_' + generateUUID(),
        organisationId: profile.id || 'default_org',
        userId: currentUser?.id || 'guest_user',
        userEmail: currentUser?.email || profile.email || 'guest@cobos.local',
        userName: currentUser?.name || profile.name || 'Business User',
        plan: subPlan,
        amount,
        currency: 'USD',
        paymentMethod: subMethod,
        referenceNumber: subRef.trim(),
        proofNotes: subNotes.trim() || undefined,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      await db.subscriptionRequests.put(newRequest);
      await queueSyncItem('subscription_request', newRequest.id, 'INSERT', newRequest);

      setSubSuccess(`Proof of payment (${subRef}) submitted! Your subscription will be activated upon Super Admin verification.`);
      setSubRef('');
      setSubNotes('');
      triggerRefresh();
      setTimeout(() => setSubSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit payment proof.');
    } finally {
      setSubSubmitting(false);
    }
  };

  const handleGrantSuperAdminUpgrade = async (targetCompanyOrUserId?: string, targetType?: 'company' | 'user', specificPlan?: 'professional' | 'enterprise') => {
    const type = targetType || adminTargetType;
    const id = targetCompanyOrUserId || adminTargetId;
    const plan = specificPlan || adminPlan;

    if (!id) {
      alert('Please select an account to upgrade.');
      return;
    }

    setIsAdminUpgrading(true);
    try {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      if (type === 'company') {
        const foundProfile = await db.businessProfiles.get(id);
        const currentExp = foundProfile?.subscriptionExpiresAt ? new Date(foundProfile.subscriptionExpiresAt).getTime() : 0;
        const baseTime = currentExp > now ? currentExp : now;
        const newExpiry = new Date(baseTime + THIRTY_DAYS_MS).toISOString();

        if (foundProfile) {
          foundProfile.subscriptionPlan = plan;
          foundProfile.subscriptionExpiresAt = newExpiry;
          await db.businessProfiles.put(foundProfile);
          await queueSyncItem('business_profile', foundProfile.id, 'UPDATE', foundProfile);
        }

        if (profile.id === id) {
          await updateProfile({
            subscriptionPlan: plan,
            subscriptionExpiresAt: newExpiry,
          });
        }
        setAdminUpgradeMsg(`Successfully granted +30 Days ${plan.toUpperCase()} subscription to Company "${foundProfile?.name || id}". New Expiry: ${new Date(newExpiry).toLocaleDateString()}`);
      } else {
        const foundUser = await db.users.get(id);
        if (foundUser) {
          const currentExp = foundUser.subscriptionExpiresAt ? new Date(foundUser.subscriptionExpiresAt).getTime() : 0;
          const baseTime = currentExp > now ? currentExp : now;
          const newExpiry = new Date(baseTime + THIRTY_DAYS_MS).toISOString();

          foundUser.subscriptionPlan = plan;
          foundUser.subscriptionExpiresAt = newExpiry;
          await db.users.put(foundUser);
          await queueSyncItem('user', foundUser.id, 'UPDATE', foundUser);

          if (currentUser?.id === id) {
            currentUser.subscriptionPlan = plan;
            currentUser.subscriptionExpiresAt = newExpiry;
          }
          setAdminUpgradeMsg(`Successfully granted +30 Days ${plan.toUpperCase()} subscription to User "${foundUser.name} (${foundUser.email})". New Expiry: ${new Date(newExpiry).toLocaleDateString()}`);
        }
      }

      triggerRefresh();
      setTimeout(() => setAdminUpgradeMsg(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to apply upgrade.');
    } finally {
      setIsAdminUpgrading(false);
    }
  };

  const handleApprovePaymentRequest = async (req: SubscriptionPaymentRequest) => {
    try {
      const now = new Date().toISOString();
      const updatedReq: SubscriptionPaymentRequest = {
        ...req,
        status: 'approved',
        approvedAt: now,
        approvedBy: currentUser?.email || 'comfort.designszw@gmail.com',
      };
      await db.subscriptionRequests.put(updatedReq);
      await queueSyncItem('subscription_request', updatedReq.id, 'UPDATE', updatedReq);

      await handleGrantSuperAdminUpgrade(req.organisationId || req.userId, 'company', req.plan);
      alert(`Approved request ${req.referenceNumber} and granted +30 days ${req.plan} subscription!`);
      triggerRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to approve request.');
    }
  };

  const handleRejectPaymentRequest = async (req: SubscriptionPaymentRequest) => {
    try {
      const updatedReq: SubscriptionPaymentRequest = {
        ...req,
        status: 'rejected',
      };
      await db.subscriptionRequests.put(updatedReq);
      await queueSyncItem('subscription_request', updatedReq.id, 'UPDATE', updatedReq);
      alert(`Payment request ${req.referenceNumber} was rejected.`);
      triggerRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to reject request.');
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
                Your Profile Avatar ({currentUser?.name || 'Staff Member'})
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

      {/* SECTION 3: PAID SUBSCRIPTIONS & LICENSING */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Cloud Subscriptions & Commercial Licensing</h3>
              <p className="text-[11px] text-slate-400">
                Upgrade for multi-branch sync, unlimited transactions, advanced double-entry audits, and cloud persistence.
              </p>
            </div>
          </div>

          {/* Current Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300">
              Active Tier: <span className="text-cyan-300 uppercase font-mono">{profile.subscriptionPlan || 'standard'}</span>
            </span>
            {profile.subscriptionExpiresAt ? (
              <span className="text-[10px] text-emerald-400 font-mono ml-1">
                (Expires: {new Date(profile.subscriptionExpiresAt).toLocaleDateString()})
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono ml-1">(Starter Free)</span>
            )}
          </div>
        </div>

        {subSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{subSuccess}</span>
          </div>
        )}

        {/* Subscription Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Plan 1: Standard (Starter) */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Community Tier</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-300">Free</span>
              </div>
              <h4 className="text-sm font-bold text-white">Starter Edition</h4>
              <p className="text-xl font-bold font-mono text-slate-200 mt-1">
                $0 <span className="text-xs text-slate-500 font-normal">/ forever</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Offline POS & Receipts</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Standard 20 items / txs per day limit</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Local device storage</li>
              </ul>
            </div>
            <div className="text-center py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-400">
              Default Tier
            </div>
          </div>

          {/* Plan 2: Professional */}
          <div className={`p-4 rounded-xl border relative flex flex-col justify-between space-y-3 transition ${
            subPlan === 'professional' ? 'bg-cyan-950/20 border-cyan-500 shadow-md ring-1 ring-cyan-500/40' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-cyan-600 text-slate-950 text-[9px] font-bold uppercase tracking-wide">
              Most Popular
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-cyan-400">SME Pro</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">30 Days</span>
              </div>
              <h4 className="text-sm font-bold text-white">Professional Tier</h4>
              <p className="text-xl font-bold font-mono text-cyan-400 mt-1">
                $15 <span className="text-xs text-slate-400 font-normal">USD / 30 Days</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Unlimited sales & catalog inventory</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Multi-device D1 Cloud Sync</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Multi-Currency ZiG, USD, ZAR</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Automated Double-Entry Ledger</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setSubPlan('professional')}
              className={`w-full py-2 rounded-xl text-xs font-bold transition ${
                subPlan === 'professional'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {subPlan === 'professional' ? 'Selected Plan ($15)' : 'Select Professional'}
            </button>
          </div>

          {/* Plan 3: Enterprise */}
          <div className={`p-4 rounded-xl border relative flex flex-col justify-between space-y-3 transition ${
            subPlan === 'enterprise' ? 'bg-indigo-950/20 border-indigo-500 shadow-md ring-1 ring-indigo-500/40' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400">Corporate & Chains</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">30 Days</span>
              </div>
              <h4 className="text-sm font-bold text-white">Enterprise Tier</h4>
              <p className="text-xl font-bold font-mono text-indigo-400 mt-1">
                $35 <span className="text-xs text-slate-400 font-normal">USD / 30 Days</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> All Professional Features</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Unlimited Staff Accounts & Cashiers</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Multi-Branch Audit Trails & RLS</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Priority WhatsApp & Onsite Support</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setSubPlan('enterprise')}
              className={`w-full py-2 rounded-xl text-xs font-bold transition ${
                subPlan === 'enterprise'
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {subPlan === 'enterprise' ? 'Selected Plan ($35)' : 'Select Enterprise'}
            </button>
          </div>
        </div>

        {/* Payment Methods Tabs and Instructions */}
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-cyan-400" />
              <span>Select Payment Channel for {subPlan === 'enterprise' ? '$35 USD' : '$15 USD'}</span>
            </span>

            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setSubMethod('ecocash')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                  subMethod === 'ecocash' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>EcoCash</span>
              </button>
              <button
                type="button"
                onClick={() => setSubMethod('cash')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                  subMethod === 'cash' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash Deposit</span>
              </button>
              <button
                type="button"
                onClick={() => setSubMethod('bank_transfer')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                  subMethod === 'bank_transfer' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Bank Transfer</span>
              </button>
            </div>
          </div>

          {/* EcoCash Instructions */}
          {subMethod === 'ecocash' && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-900/50 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300">EcoCash USD / ZiG Mobile Payment</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">Instant</span>
              </div>
              <p className="text-slate-300">
                1. Dial <span className="font-mono font-bold text-white">*151*2*2#</span> on your Econet line.
              </p>
              <p className="text-slate-300">
                2. Enter Merchant / Biller Code: <span className="font-mono font-bold text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-700">COBOS-PAY (123456)</span> or send to Admin Mobile: <span className="font-mono font-bold text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-700">+263 77 282 4132</span> (Comfort M.).
              </p>
              <p className="text-slate-300">
                3. Amount: <span className="font-mono font-bold text-white">${subPlan === 'enterprise' ? '35.00' : '15.00'} USD</span> (or equivalent ZiG at prevailing bank rate).
              </p>
              <p className="text-slate-400 text-[11px]">
                Copy the SMS Approval Reference code received and enter it into the verification box below.
              </p>
            </div>
          )}

          {/* Cash Deposit Instructions */}
          {subMethod === 'cash' && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-emerald-300">Cash Direct Collection & Official Invoicing</span>
              <p className="text-slate-300">
                Visit any of our operational offices to pay over the counter in physical USD notes:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="font-bold text-white block">Harare Head Office:</span>
                  <span>4th Floor, Celestial Park, Borrowdale Rd, Harare</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="font-bold text-white block">Bulawayo Regional Branch:</span>
                  <span>2nd Floor, Pioneer House, 8th Ave / Fife St, Bulawayo</span>
                </div>
              </div>
              <p className="text-slate-400 text-[11px]">
                Enter your issued paper receipt number below for instant activation.
              </p>
            </div>
          )}

          {/* Bank Transfer Instructions */}
          {subMethod === 'bank_transfer' && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-indigo-300">Direct Electronic Bank Transfer (USD Nostro / RTGS)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <span className="font-bold text-white block">Stanbic Bank Zimbabwe (USD Nostro):</span>
                  <div>Account: <span className="font-mono font-bold text-cyan-300">0240 2824 1320 01</span></div>
                  <div>Account Name: <span className="text-white">COBOS Business Technologies</span></div>
                  <div>Branch: <span className="text-slate-400">Minerva Branch, Harare (SWIFT: SBICZWHAXXX)</span></div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <span className="font-bold text-white block">CBZ Bank Zimbabwe (USD / ZiG):</span>
                  <div>Account: <span className="font-mono font-bold text-cyan-300">0112 4918 2000 12</span></div>
                  <div>Account Name: <span className="text-white">COBOS Technologies PVT LTD</span></div>
                  <div>Branch: <span className="text-slate-400">Kwame Nkrumah Branch</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Submission Form */}
          <form onSubmit={handleSubmitSubscriptionRequest} className="space-y-3 pt-2 border-t border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Payment Reference Code / Receipt # <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    subMethod === 'ecocash'
                      ? 'e.g. MP261112.0734.K98271'
                      : subMethod === 'cash'
                      ? 'e.g. CASH-RCPT-8941'
                      : 'e.g. STANBIC-TRF-091248'
                  }
                  value={subRef}
                  onChange={(e) => setSubRef(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:border-cyan-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Additional Notes / Depositor Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid by Comfort Ncube via EcoCash"
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={subSubmitting}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>{subSubmitting ? 'Submitting...' : `Submit ${subPlan.toUpperCase()} ($${subPlan === 'enterprise' ? 35 : 15}) Proof`}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* SECTION 4: SUPER ADMIN ACCOUNT UPGRADE CONSOLE (For comfort.designszw@gmail.com) */}
      {isSuperAdmin && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-700/60 p-5 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Super Admin Account Upgrader Console</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500 text-slate-950">
                    MUNYARADZI MUCHINERIPPI
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  Grant +30 Days subscriptions to any business company or individual user account across COBOS.
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono text-cyan-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-cyan-800">
              comfort.designszw@gmail.com
            </span>
          </div>

          {adminUpgradeMsg && (
            <div className="p-3 rounded-xl bg-cyan-950 border border-cyan-500 text-cyan-200 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{adminUpgradeMsg}</span>
            </div>
          )}

          {/* Quick Upgrade Form */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
            <span className="text-xs font-bold text-white block">
              1-Click Direct +30 Days Subscription Grant
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Type Switcher */}
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Target Entity
                </label>
                <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminTargetType('company');
                      if (allProfiles.length > 0) setAdminTargetId(allProfiles[0].id);
                    }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                      adminTargetType === 'company' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Company
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminTargetType('user');
                      if (allUsers.length > 0) setAdminTargetId(allUsers[0].id);
                    }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                      adminTargetType === 'user' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    User
                  </button>
                </div>
              </div>

              {/* Account Dropdown */}
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Select {adminTargetType === 'company' ? 'Company Account' : 'User Account'}
                </label>
                {adminTargetType === 'company' ? (
                  <select
                    value={adminTargetId}
                    onChange={(e) => setAdminTargetId(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-sans"
                  >
                    {allProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.subscriptionPlan || 'standard'}) - {p.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={adminTargetId}
                    onChange={(e) => setAdminTargetId(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-sans"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) - {u.role}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Plan Tier */}
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Target Tier (+30 Days)
                </label>
                <select
                  value={adminPlan}
                  onChange={(e) => setAdminPlan(e.target.value as any)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-sans"
                >
                  <option value="professional">Professional Tier ($15)</option>
                  <option value="enterprise">Enterprise Tier ($35)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleGrantSuperAdminUpgrade()}
                disabled={isAdminUpgrading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition"
              >
                <Calendar className="w-4 h-4" />
                <span>{isAdminUpgrading ? 'Granting...' : 'Grant +30 Days Subscription'}</span>
              </button>
            </div>
          </div>

          {/* Pending Payment Proofs Review */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Pending Subscription Payment Verification ({pendingRequests.filter(r => r.status === 'pending').length})</span>
            </span>

            {pendingRequests.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 text-center text-slate-500 text-xs">
                No subscription payment requests submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{req.userName}</span>
                        <span className="text-slate-400">({req.userEmail})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.status === 'approved'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : req.status === 'rejected'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 flex items-center gap-2">
                        <span className="font-bold text-cyan-300 uppercase font-mono">{req.plan}</span>
                        <span>•</span>
                        <span>Method: {req.paymentMethod.toUpperCase()}</span>
                        <span>•</span>
                        <span className="font-mono font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded">Ref: {req.referenceNumber}</span>
                        <span>•</span>
                        <span className="text-slate-500 font-mono">{new Date(req.submittedAt).toLocaleString()}</span>
                      </div>
                      {req.proofNotes && (
                        <p className="text-[11px] text-slate-400 italic">"{req.proofNotes}"</p>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprovePaymentRequest(req)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Grant 30 Days</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectPaymentRequest(req)}
                          className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-300 text-xs transition"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: DATABASE BACKUP & RESTORE */}
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
