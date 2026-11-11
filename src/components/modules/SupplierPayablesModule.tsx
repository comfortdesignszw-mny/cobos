import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine, generateUUID, queueSyncItem } from '../../services/accountingEngine';
import { compressImageFile } from '../../utils/imageCompressor';
import type { Supplier, SupplierPurchase, SupplierPayment, CurrencyCode } from '../../types';
import {
  Truck,
  Plus,
  Search,
  DollarSign,
  Calendar,
  CheckCircle2,
  X,
  Phone,
  Building,
  LayoutGrid,
  List,
  CreditCard,
  Image as ImageIcon,
} from 'lucide-react';

export const SupplierPayablesModule: React.FC = () => {
  const { activeCurrency, activeUser, triggerRefresh, refreshKey } = useApp();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [activeTab, setActiveTab] = useState<'payables' | 'directory' | 'purchases_history'>('payables');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'grid' | 'list'>('cards');

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [suppContact, setSuppContact] = useState('');
  const [suppPhone, setSuppPhone] = useState('+263');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppTerms, setSuppTerms] = useState('Net 14 Days');
  const [suppLogoUrl, setSuppLogoUrl] = useState('');
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);

  useEffect(() => {
    async function loadSuppliers() {
      const allSupp = await db.suppliers.toArray();
      const allPurch = await db.supplierPurchases.toArray();
      const allPay = await db.supplierPayments.toArray();
      setSuppliers(allSupp);
      setPurchases(allPurch.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPayments(allPay.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
    loadSuppliers();
  }, [refreshKey]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingLogo(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 });
      setSuppLogoUrl(compressed);
    } catch (err) {
      alert('Failed to process supplier logo.');
    } finally {
      setIsCompressingLogo(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSupp: Supplier = {
      id: 'supp_' + generateUUID(),
      name: suppName.trim(),
      contactPerson: suppContact.trim(),
      phone: suppPhone.trim(),
      email: suppEmail.trim() || undefined,
      address: suppAddress.trim() || undefined,
      paymentTerms: suppTerms.trim(),
      logoUrl: suppLogoUrl || undefined,
      outstandingBalanceUSD: 0,
      outstandingBalanceZiG: 0,
      outstandingBalanceZAR: 0,
      createdAt: new Date().toISOString(),
    };

    await db.suppliers.put(newSupp);
    await queueSyncItem('supplier', newSupp.id, 'INSERT', newSupp);

    setIsSupplierModalOpen(false);
    triggerRefresh();
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matches = s.name.toLowerCase().includes(q) || s.phone.includes(q);
    if (activeTab === 'payables') {
      return matches && (s.outstandingBalanceUSD > 0 || s.outstandingBalanceZiG > 0 || s.outstandingBalanceZAR > 0);
    }
    return matches;
  });

  return (
    <div className="space-y-5 pb-20">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-400" />
            <span>Supplier Payables & Trade Purchases</span>
          </h2>
          <p className="text-xs text-slate-400">
            Wholesale suppliers, credit purchase invoices, and disbursements.
          </p>
        </div>

        <button
          onClick={() => {
            setSuppName('');
            setSuppContact('');
            setSuppPhone('+263');
            setSuppEmail('');
            setSuppAddress('');
            setSuppTerms('Net 14 Days');
            setSuppLogoUrl('');
            setIsSupplierModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Controls: Search, View Mode (List/Cards/Grid), and Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search supplier name or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden"
            />
          </div>

          <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('payables')}
              className={`px-3 py-1 rounded-lg ${activeTab === 'payables' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              Pending Payables
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1 rounded-lg ${activeTab === 'directory' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              All Suppliers
            </button>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setViewMode('cards')}
            title="Card View"
            className={`p-1.5 rounded-lg ${viewMode === 'cards' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
          >
            <CreditCard className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid View"
            className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List View"
            className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => (
            <div key={s.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md text-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white text-sm truncate">{s.name}</h4>
                  <p className="text-slate-400 text-[11px] truncate">Contact: {s.contactPerson}</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between font-mono">
                <span className="text-[10px] text-slate-400">Payable Balance:</span>
                <span className={`font-bold ${s.outstandingBalanceUSD > 0 ? 'text-rose-400 text-sm' : 'text-slate-300'}`}>
                  ${s.outstandingBalanceUSD.toFixed(2)} USD
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredSuppliers.map((s) => (
            <div key={s.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm text-xs space-y-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden mx-auto flex items-center justify-center">
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-white text-xs truncate">{s.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono truncate">{s.phone}</p>
              </div>
              <div className="pt-1 font-mono font-bold text-rose-400">
                ${s.outstandingBalanceUSD.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
              <tr>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Payment Terms</th>
                <th className="p-3 text-right">Outstanding Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/50 transition">
                  <td className="p-3 font-sans font-bold text-white flex items-center gap-2">
                    {s.logoUrl && <img src={s.logoUrl} alt="" className="w-5 h-5 rounded object-cover" />}
                    <span>{s.name}</span>
                  </td>
                  <td className="p-3 font-sans text-slate-300">{s.contactPerson}</td>
                  <td className="p-3 text-slate-400">{s.phone}</td>
                  <td className="p-3 font-sans text-slate-400">{s.paymentTerms}</td>
                  <td className={`p-3 text-right font-bold ${s.outstandingBalanceUSD > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    ${s.outstandingBalanceUSD.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                <span>Add Wholesale Supplier</span>
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  {suppLogoUrl ? (
                    <img src={suppLogoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isCompressingLogo ? 'Compressing...' : 'Upload Logo'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400">Compressed WebP format</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Company / Supplier Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schweppes Zimbabwe Ltd"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Farai Dube"
                    value={suppContact}
                    onChange={(e) => setSuppContact(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Telephone / WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={suppPhone}
                    onChange={(e) => setSuppPhone(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Email</label>
                  <input
                    type="email"
                    value={suppEmail}
                    onChange={(e) => setSuppEmail(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Credit Terms</label>
                  <input
                    type="text"
                    value={suppTerms}
                    onChange={(e) => setSuppTerms(e.target.value)}
                    placeholder="e.g. Net 14 Days"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Depot / Warehouse Address</label>
                <input
                  type="text"
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
