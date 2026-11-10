import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine, generateUUID, queueSyncItem } from '../../services/accountingEngine';
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
  FileSpreadsheet,
} from 'lucide-react';

export const SupplierPayablesModule: React.FC = () => {
  const { activeCurrency, activeUser, triggerRefresh, refreshKey } = useApp();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [activeTab, setActiveTab] = useState<'payables' | 'directory' | 'purchases_history'>('payables');
  const [searchQuery, setSearchQuery] = useState('');

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [suppContact, setSuppContact] = useState('');
  const [suppPhone, setSuppPhone] = useState('+263');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppTerms, setSuppTerms] = useState('Net 14 Days');

  // Record Stock Purchase Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseTotal, setPurchaseTotal] = useState<number>(0);
  const [purchaseCurrency, setPurchaseCurrency] = useState<CurrencyCode>(activeCurrency);
  const [isPurchaseCredit, setIsPurchaseCredit] = useState(true);
  const [purchasePaidAmount, setPurchasePaidAmount] = useState<number>(0);
  const [purchaseItemsSummary, setPurchaseItemsSummary] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Record Supplier Payment Modal
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>(activeCurrency);
  const [payMethod, setPayMethod] = useState<'cash' | 'ecocash' | 'bank' | 'card'>('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Totals
  const totalPayableUSD = suppliers.reduce((sum, s) => sum + (s.outstandingBalanceUSD || 0), 0);
  const totalPayableZiG = suppliers.reduce((sum, s) => sum + (s.outstandingBalanceZiG || 0), 0);

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q);

    if (activeTab === 'payables') {
      const bal = activeCurrency === 'ZiG' ? s.outstandingBalanceZiG : s.outstandingBalanceUSD;
      return matchesSearch && (bal || 0) > 0;
    }
    return matchesSearch;
  });

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSupp: Supplier = {
      id: 'supp_' + generateUUID(),
      name: suppName,
      contactPerson: suppContact,
      phone: suppPhone,
      email: suppEmail || undefined,
      address: suppAddress || undefined,
      paymentTerms: suppTerms,
      outstandingBalanceUSD: 0,
      outstandingBalanceZiG: 0,
      outstandingBalanceZAR: 0,
      createdAt: new Date().toISOString(),
    };

    await db.suppliers.put(newSupp);
    await queueSyncItem('supplier', newSupp.id, 'INSERT', newSupp);

    setIsSupplierModalOpen(false);
    setSuppName('');
    setSuppContact('');
    setSuppPhone('+263');
    setSuppEmail('');
    setSuppAddress('');
    triggerRefresh();
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || purchaseTotal <= 0) return;

    setIsSubmitting(true);
    try {
      await AccountingEngine.recordSupplierPurchase({
        supplierId: selectedSupplierId,
        invoiceNumber: invoiceNumber || 'INV-' + Math.floor(1000 + Math.random() * 9000),
        totalAmount: purchaseTotal,
        currency: purchaseCurrency,
        isCredit: isPurchaseCredit,
        paidAmount: isPurchaseCredit ? purchasePaidAmount : purchaseTotal,
        paymentMethod: isPurchaseCredit && purchasePaidAmount === 0 ? undefined : 'cash',
        itemsSummary: purchaseItemsSummary || 'General Stock Inward',
        date: purchaseDate,
        performedBy: activeUser.name,
      });

      setIsPurchaseModalOpen(false);
      setPurchaseTotal(0);
      setPurchasePaidAmount(0);
      setPurchaseItemsSummary('');
      triggerRefresh();
    } catch (err: any) {
      alert('Error recording stock purchase: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || payAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await AccountingEngine.recordSupplierPayment({
        supplierId: payingSupplier.id,
        amount: payAmount,
        currency: payCurrency,
        paymentMethod: payMethod,
        date: payDate,
        notes: payNotes,
        performedBy: activeUser.name,
      });

      setPayingSupplier(null);
      setPayAmount(0);
      setPayNotes('');
      triggerRefresh();
    } catch (err: any) {
      alert('Error recording payment: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-400" />
            Supplier & Accounts Payable Management
          </h2>
          <p className="text-xs text-slate-400">
            Monitor supplier invoices, credit terms, and outgoing trade debt payments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('payables')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'payables'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Due Payables
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'directory'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Directory ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('purchases_history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'purchases_history'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Purchases Log
            </button>
          </div>

          <button
            onClick={() => setIsPurchaseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Stock Purchase</span>
          </button>

          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <span>+ Supplier</span>
          </button>
        </div>
      </div>

      {/* Payables KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Total Supplier Debt (USD)</span>
          <div className="text-lg font-black font-mono text-purple-400">
            ${totalPayableUSD.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">Accounts Payable (USD)</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Total Supplier Debt (ZiG)</span>
          <div className="text-lg font-black font-mono text-cyan-300">
            ZiG {totalPayableZiG.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">Accounts Payable (ZiG)</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Credit Inward Purchases</span>
          <div className="text-xs text-slate-300 pt-1">
            Recorded stock purchases automatically feed inventory valuation and general ledger.
          </div>
        </div>
      </div>

      {/* SUPPLIERS TABLE */}
      {activeTab !== 'purchases_history' ? (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by supplier name, contact person or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Contact Person</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Payment Terms</th>
                    <th className="py-3 px-4 text-right">Owing (USD)</th>
                    <th className="py-3 px-4 text-right">Owing (ZiG)</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">
                        No suppliers found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-850/50 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{s.name}</div>
                          {s.address && <div className="text-[10px] text-slate-400">{s.address}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{s.contactPerson || '—'}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{s.phone}</td>
                        <td className="py-3 px-4 text-slate-400">{s.paymentTerms || 'Standard'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span className={s.outstandingBalanceUSD > 0 ? 'text-purple-400' : 'text-slate-400'}>
                            ${s.outstandingBalanceUSD.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span className={s.outstandingBalanceZiG > 0 ? 'text-cyan-300' : 'text-slate-400'}>
                            {s.outstandingBalanceZiG.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setPayingSupplier(s);
                              setPayAmount(s.outstandingBalanceUSD > 0 ? s.outstandingBalanceUSD : s.outstandingBalanceZiG);
                              setPayCurrency(s.outstandingBalanceUSD > 0 ? 'USD' : 'ZiG');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition"
                          >
                            Pay Debt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* PURCHASES LOG */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Items / Description</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Credit Status</th>
                  <th className="py-3 px-4">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/50">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{p.date}</td>
                    <td className="py-2.5 px-4 text-cyan-300 font-bold">{p.invoiceNumber}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-white">{p.supplierName}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">{p.itemsSummary}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-white whitespace-nowrap">
                      {p.currency} {p.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.isCredit ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-emerald-950 text-emerald-300'
                        }`}
                      >
                        {p.isCredit ? 'ON CREDIT' : 'PAID CASH'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-400">{p.receivedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD PURCHASE MODAL */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Record Stock Inward Purchase</h3>
              <button onClick={() => setIsPurchaseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Select Supplier
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.paymentTerms})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Supplier Invoice #
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-98124"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Invoice Total
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={purchaseCurrency}
                      onChange={(e) => setPurchaseCurrency(e.target.value as CurrencyCode)}
                      className="w-20 p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    >
                      <option value="USD">USD</option>
                      <option value="ZiG">ZiG</option>
                      <option value="ZAR">ZAR</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={purchaseTotal || ''}
                      onChange={(e) => setPurchaseTotal(parseFloat(e.target.value) || 0)}
                      className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Terms & Payment
                  </label>
                  <select
                    value={isPurchaseCredit ? 'credit' : 'cash'}
                    onChange={(e) => setIsPurchaseCredit(e.target.value === 'credit')}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium"
                  >
                    <option value="credit">On Credit (Accounts Payable)</option>
                    <option value="cash">Paid Immediately (Cash)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Items Summary / Manifest
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. 10 cases Mazoe Orange Crush, 20 bags Roller meal 10kg..."
                  value={purchaseItemsSummary}
                  onChange={(e) => setPurchaseItemsSummary(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {isSubmitting ? 'Posting...' : 'Record Inward Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD SUPPLIER PAYMENT MODAL */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Disburse Supplier Debt Payment</h3>
              <button onClick={() => setPayingSupplier(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-1">
              <div>Supplier: <span className="font-bold text-white">{payingSupplier.name}</span></div>
              <div className="font-mono text-[11px] text-purple-400">
                Outstanding: ${payingSupplier.outstandingBalanceUSD.toFixed(2)} USD | {payingSupplier.outstandingBalanceZiG.toFixed(2)} ZiG
              </div>
            </div>

            <form onSubmit={handleRecordSupplierPayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Currency</label>
                  <select
                    value={payCurrency}
                    onChange={(e) => setPayCurrency(e.target.value as CurrencyCode)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="ZiG">ZiG</option>
                    <option value="ZAR">ZAR</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Disbursed Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-purple-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="cash">Physical Cash Till</option>
                    <option value="ecocash">EcoCash Merchant</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Reference / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Bank transfer confirmation ref #91024..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  {isSubmitting ? 'Posting...' : 'Confirm Supplier Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW SUPPLIER MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add New Supplier Profile</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Company / Supplier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schweppes Zimbabwe Ltd"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Account Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Tendai Dube (Wholesale rep)"
                  value={suppContact}
                  onChange={(e) => setSuppContact(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={suppPhone}
                    onChange={(e) => setSuppPhone(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Payment Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. 7 Days, Net 14 Days"
                    value={suppTerms}
                    onChange={(e) => setSuppTerms(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Physical Depot / Address</label>
                <input
                  type="text"
                  placeholder="e.g. Workington Industrial Area, Harare"
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
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
