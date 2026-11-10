import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine, generateUUID, queueSyncItem } from '../../services/accountingEngine';
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
} from 'lucide-react';

export const CustomerReceivablesModule: React.FC = () => {
  const { activeCurrency, activeUser, triggerRefresh, refreshKey, profile } = useApp();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'debtors' | 'all_customers' | 'payments_history'>('debtors');

  // New Customer Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('+263');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState<number>(200);
  const [custNotes, setCustNotes] = useState('');

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

  // Total Receivables
  const totalDebtUSD = customers.reduce((sum, c) => sum + (c.outstandingBalanceUSD || 0), 0);
  const totalDebtZiG = customers.reduce((sum, c) => sum + (c.outstandingBalanceZiG || 0), 0);

  // Filter
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.address && c.address.toLowerCase().includes(q));

    if (activeTab === 'debtors') {
      const bal = activeCurrency === 'ZiG' ? c.outstandingBalanceZiG : c.outstandingBalanceUSD;
      return matchesSearch && (bal || 0) > 0;
    }
    return matchesSearch;
  });

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCust: Customer = {
      id: 'cust_' + generateUUID(),
      name: custName,
      phone: custPhone,
      email: custEmail || undefined,
      address: custAddress || undefined,
      creditLimit: custCreditLimit,
      outstandingBalanceUSD: 0,
      outstandingBalanceZiG: 0,
      outstandingBalanceZAR: 0,
      notes: custNotes || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.customers.put(newCust);
    await queueSyncItem('customer', newCust.id, 'INSERT', newCust);

    setIsCustomerModalOpen(false);
    setCustName('');
    setCustPhone('+263');
    setCustEmail('');
    setCustAddress('');
    setCustNotes('');
    triggerRefresh();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer || paymentAmount <= 0) return;

    setIsSubmittingPayment(true);
    try {
      await AccountingEngine.recordCustomerPayment({
        customerId: payingCustomer.id,
        amount: paymentAmount,
        currency: paymentCurrency,
        paymentMethod,
        date: paymentDate,
        notes: paymentNotes,
        performedBy: activeUser.name,
      });

      setPayingCustomer(null);
      setPaymentAmount(0);
      setPaymentNotes('');
      triggerRefresh();
    } catch (err: any) {
      alert('Error recording payment: ' + err.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const openStatement = async (c: Customer) => {
    setStatementCustomer(c);
    const sales = await db.sales.where('customerId').equals(c.id).toArray();
    const pays = await db.customerPayments.where('customerId').equals(c.id).toArray();
    setCustomerSales(sales);
    setCustomerPaymentsList(pays);
  };

  const sendWhatsAppReminder = (c: Customer) => {
    const bal = activeCurrency === 'ZiG' ? c.outstandingBalanceZiG : c.outstandingBalanceUSD;
    const cleanPhone = c.phone.replace(/[^0-9]/g, '');
    const message = `Hello ${c.name},\n\nThis is a friendly statement reminder from *${profile.name}*.\n\nYour current outstanding balance is *${activeCurrency} ${bal.toFixed(2)}*.\n\nPlease arrange settlement at our shop (${profile.address}) or via EcoCash merchant: ${profile.phone}.\n\nThank you for your valued business!\n*${profile.name}*`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header & Receivables Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Customer Debt & Receivables Management
          </h2>
          <p className="text-xs text-slate-400">
            Track credit sales, debt ageing, settlements and 1-tap WhatsApp reminders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('debtors')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'debtors'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Debtors
            </button>
            <button
              onClick={() => setActiveTab('all_customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'all_customers'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Profiles ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('payments_history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'payments_history'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Collections Ledger
            </button>
          </div>

          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Receivables KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Total Customer Debt (USD)</span>
          <div className="text-lg font-black font-mono text-amber-400">
            ${totalDebtUSD.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">Independent USD Book</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Total Customer Debt (ZiG)</span>
          <div className="text-lg font-black font-mono text-cyan-300">
            ZiG {totalDebtZiG.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">Independent ZiG Book</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Instant WhatsApp Reminders</span>
          <div className="text-xs text-slate-300 pt-1">
            Generate and send individualized collection DMs with 1 tap.
          </div>
        </div>
      </div>

      {/* Customer List / Active Debtors */}
      {activeTab !== 'payments_history' ? (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, phone or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Phone / WhatsApp</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4 text-right">Balance (USD)</th>
                    <th className="py-3 px-4 text-right">Balance (ZiG)</th>
                    <th className="py-3 px-4">Last Payment</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">
                        No customers match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const hasDebt = (c.outstandingBalanceUSD || 0) > 0 || (c.outstandingBalanceZiG || 0) > 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-850/50 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{c.name}</div>
                            {c.address && <div className="text-[10px] text-slate-400">{c.address}</div>}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {c.phone}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            ${c.creditLimit.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                            <span className={c.outstandingBalanceUSD > 0 ? 'text-amber-400' : 'text-slate-400'}>
                              ${c.outstandingBalanceUSD.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                            <span className={c.outstandingBalanceZiG > 0 ? 'text-cyan-300' : 'text-slate-400'}>
                              {c.outstandingBalanceZiG.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                            {c.lastPaymentDate || 'Never'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Receive Payment Button */}
                              <button
                                onClick={() => {
                                  setPayingCustomer(c);
                                  setPaymentAmount(c.outstandingBalanceUSD > 0 ? c.outstandingBalanceUSD : c.outstandingBalanceZiG);
                                  setPaymentCurrency(c.outstandingBalanceUSD > 0 ? 'USD' : 'ZiG');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-semibold transition"
                              >
                                Record Pay
                              </button>

                              {/* WhatsApp Reminder Deeplink Button */}
                              {hasDebt && (
                                <button
                                  onClick={() => sendWhatsAppReminder(c)}
                                  className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition"
                                  title="Send WhatsApp Reminder Message"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* View Statement */}
                              <button
                                onClick={() => openStatement(c)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition"
                                title="View Customer Account Statement"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* PAYMENTS / COLLECTIONS LEDGER */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/50">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{p.date}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-white">{p.customerName}</td>
                    <td className="py-2.5 px-4 uppercase text-slate-300 text-[11px]">{p.paymentMethod}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                      +{p.currency} {p.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-400">{p.receivedBy}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-400">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Register New Customer Profile</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Full Name / Business Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tendai Moyo"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Phone Number (for WhatsApp Reminders)
                </label>
                <input
                  type="text"
                  required
                  placeholder="+263 77 123 4567"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={custCreditLimit}
                    onChange={(e) => setCustCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Physical Address / Stand</label>
                <input
                  type="text"
                  placeholder="e.g. Stand 402, Highfield, Harare"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Pays every 2 weeks on Friday..."
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD CUSTOMER PAYMENT MODAL */}
      {payingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Record Debt Collection</h3>
              <button onClick={() => setPayingCustomer(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-1">
              <div>Customer: <span className="font-bold text-white">{payingCustomer.name}</span></div>
              <div className="font-mono text-[11px] text-amber-400">
                Total Debt: ${payingCustomer.outstandingBalanceUSD.toFixed(2)} USD | {payingCustomer.outstandingBalanceZiG.toFixed(2)} ZiG
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Currency</label>
                  <select
                    value={paymentCurrency}
                    onChange={(e) => setPaymentCurrency(e.target.value as CurrencyCode)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="ZiG">ZiG</option>
                    <option value="ZAR">ZAR</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Amount Settled</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="cash">Physical Cash Till</option>
                    <option value="ecocash">EcoCash Mobile Money</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="card">Card Swipe</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. EcoCash ref MP261109.1412.A81293..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  {isSubmittingPayment ? 'Recording...' : 'Save & Post Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER STATEMENT MODAL (Printable) */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-2xl p-6 font-sans text-xs space-y-4 max-h-[90vh] overflow-y-auto select-text">
            <div className="flex items-center justify-between pb-3 border-b border-slate-300 print:hidden">
              <span className="font-bold text-sm text-slate-800">Account Statement</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded-lg bg-cyan-600 text-white font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setStatementCustomer(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Statement Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-base font-black text-slate-950">{profile.name}</h2>
                <p className="text-slate-600">{profile.address}</p>
                <p className="text-slate-600">Tel: {profile.phone}</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-bold text-slate-500">Statement for:</span>
                <h3 className="text-sm font-bold text-slate-950">{statementCustomer.name}</h3>
                <p className="text-slate-600 font-mono">{statementCustomer.phone}</p>
                <p className="text-slate-500 text-[10px]">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Balance Card */}
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex justify-between items-center font-mono">
              <span className="font-bold text-slate-700">Closing Balance Owed:</span>
              <span className="text-base font-black text-rose-600">
                ${statementCustomer.outstandingBalanceUSD.toFixed(2)} USD | {statementCustomer.outstandingBalanceZiG.toFixed(2)} ZiG
              </span>
            </div>

            {/* Recent Purchases & Payments */}
            <div>
              <h4 className="font-bold uppercase text-[10px] text-slate-500 mb-2">Transaction History</h4>
              <table className="w-full text-left text-[11px] border border-slate-200">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Details</th>
                    <th className="p-2 text-right">Debit ($)</th>
                    <th className="p-2 text-right">Credit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {customerSales.map((s) => (
                    <tr key={s.id}>
                      <td className="p-2 text-slate-600">{s.date}</td>
                      <td className="p-2 font-sans">Credit Sale #{s.receiptNumber}</td>
                      <td className="p-2 text-right font-bold text-slate-900">{s.total.toFixed(2)}</td>
                      <td className="p-2 text-right text-slate-400">-</td>
                    </tr>
                  ))}
                  {customerPaymentsList.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2 text-slate-600">{p.date}</td>
                      <td className="p-2 font-sans">Payment via {p.paymentMethod.toUpperCase()}</td>
                      <td className="p-2 text-right text-slate-400">-</td>
                      <td className="p-2 text-right font-bold text-emerald-600">{p.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500">
              {profile.receiptFooter}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
