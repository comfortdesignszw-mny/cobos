import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine, generateUUID, queueSyncItem } from '../../services/accountingEngine';
import { compressImageFile } from '../../utils/imageCompressor';
import type { Customer, CustomerPayment, CurrencyCode, Sale } from '../../types';
import {
  Users,
  Plus,
  Search,
  MessageSquare,
  DollarSign,
  FileText,
  Clock,
  Printer,
  CheckCircle2,
  X,
  Phone,
  Send,
  AlertCircle,
  LayoutGrid,
  List,
  CreditCard,
  Image as ImageIcon,
} from 'lucide-react';

export const CustomerReceivablesModule: React.FC = () => {
  const { activeCurrency, activeUser, triggerRefresh, refreshKey, profile } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'debtors' | 'all_customers' | 'payments_history'>('debtors');
  const [viewMode, setViewMode] = useState<'grid' | 'cards' | 'list'>('cards');

  // New Customer Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('+263');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState<number>(200);
  const [custNotes, setCustNotes] = useState('');
  const [custAvatarUrl, setCustAvatarUrl] = useState('');
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);

  // Payment Recording Modal
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>(activeCurrency);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'ecocash' | 'bank' | 'card'>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Statement Modal
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [customerPaymentsList, setCustomerPaymentsList] = useState<CustomerPayment[]>([]);

  useEffect(() => {
    async function loadCustomers() {
      const allCust = await db.customers.toArray();
      const allPay = await db.customerPayments.toArray();
      setCustomers(allCust);
      setPayments(allPay.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
    loadCustomers();
  }, [refreshKey]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingAvatar(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 });
      setCustAvatarUrl(compressed);
    } catch (err) {
      alert('Failed to process image file.');
    } finally {
      setIsCompressingAvatar(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCust: Customer = {
      id: 'cust_' + generateUUID(),
      name: custName.trim(),
      phone: custPhone.trim(),
      email: custEmail.trim() || undefined,
      address: custAddress.trim() || undefined,
      creditLimit: Number(custCreditLimit) || 0,
      outstandingBalanceUSD: 0,
      outstandingBalanceZiG: 0,
      outstandingBalanceZAR: 0,
      notes: custNotes.trim() || undefined,
      avatarUrl: custAvatarUrl || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.customers.put(newCust);
    await queueSyncItem('customer', newCust.id, 'INSERT', newCust);

    setIsCustomerModalOpen(false);
    triggerRefresh();
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matches = c.name.toLowerCase().includes(q) || c.phone.includes(q);
    if (activeTab === 'debtors') {
      return matches && (c.outstandingBalanceUSD > 0 || c.outstandingBalanceZiG > 0 || c.outstandingBalanceZAR > 0);
    }
    return matches;
  });

  const sendWhatsAppReminder = (c: Customer) => {
    const balanceText = `${c.outstandingBalanceUSD > 0 ? `$${c.outstandingBalanceUSD.toFixed(2)} USD` : ''} ${c.outstandingBalanceZiG > 0 ? `${c.outstandingBalanceZiG.toFixed(2)} ZiG` : ''}`.trim();
    const message = encodeURIComponent(
      `Hello ${c.name},\nThis is a friendly statement from ${profile.name}.\nYour outstanding operational balance is ${balanceText}.\nPlease settle at your earliest convenience.\nThank you!`
    );
    const cleanPhone = c.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Customer Receivables & Debt Ledger</span>
          </h2>
          <p className="text-xs text-slate-400">
            Debtors tracking, one-tap WhatsApp statements, and customer balances.
          </p>
        </div>

        <button
          onClick={() => {
            setCustName('');
            setCustPhone('+263');
            setCustEmail('');
            setCustAddress('');
            setCustCreditLimit(200);
            setCustNotes('');
            setCustAvatarUrl('');
            setIsCustomerModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Controls: Search, View Mode (List/Cards/Grid), and Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden"
            />
          </div>

          <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('debtors')}
              className={`px-3 py-1 rounded-lg ${activeTab === 'debtors' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              Active Debtors
            </button>
            <button
              onClick={() => setActiveTab('all_customers')}
              className={`px-3 py-1 rounded-lg ${activeTab === 'all_customers' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              All Customers
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
          {filteredCustomers.map((c) => (
            <div key={c.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md text-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white text-sm truncate">{c.name}</h4>
                  <p className="text-slate-400 font-mono text-[11px] truncate">{c.phone}</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between font-mono">
                <span className="text-[10px] text-slate-400">Balance USD:</span>
                <span className={`font-bold ${c.outstandingBalanceUSD > 0 ? 'text-amber-400 text-sm' : 'text-slate-300'}`}>
                  ${c.outstandingBalanceUSD.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => sendWhatsAppReminder(c)}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredCustomers.map((c) => (
            <div key={c.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm text-xs space-y-2 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 overflow-hidden mx-auto flex items-center justify-center">
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-white text-xs truncate">{c.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono truncate">{c.phone}</p>
              </div>
              <div className="pt-1 font-mono font-bold text-amber-400">
                ${c.outstandingBalanceUSD.toFixed(2)}
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
                <th className="p-3">Customer</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Credit Limit</th>
                <th className="p-3 text-right">Balance USD</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/50 transition">
                  <td className="p-3 font-sans font-bold text-white flex items-center gap-2">
                    {c.avatarUrl && <img src={c.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
                    <span>{c.name}</span>
                  </td>
                  <td className="p-3 text-slate-400">{c.phone}</td>
                  <td className="p-3 text-slate-400">${c.creditLimit.toFixed(2)}</td>
                  <td className={`p-3 text-right font-bold ${c.outstandingBalanceUSD > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                    ${c.outstandingBalanceUSD.toFixed(2)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => sendWhatsAppReminder(c)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800 text-[11px] font-sans font-semibold inline-flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Add Customer Account</span>
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  {custAvatarUrl ? (
                    <img src={custAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isCompressingAvatar ? 'Compressing...' : 'Upload Photo'}</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400">Compressed for mobile</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Customer Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tendai Moyo"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">WhatsApp Phone</label>
                  <input
                    type="text"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    value={custCreditLimit}
                    onChange={(e) => setCustCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Address / Stand Location</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
