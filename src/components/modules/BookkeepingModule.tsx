import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine } from '../../services/accountingEngine';
import type { FinancialTransaction, Account, CurrencyCode } from '../../types';
import {
  BookOpen,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Search,
  RotateCcw,
  Eye,
  CheckCircle2,
  Filter,
  Layers,
  AlertTriangle,
  X,
} from 'lucide-react';

export const BookkeepingModule: React.FC = () => {
  const {
    activeCurrency,
    activeUser,
    hasPermission,
    setJournalViewId,
    triggerRefresh,
    refreshKey,
  } = useApp();

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<Account[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'accounts' | 'record_expense'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Expense Form State
  const [expenseCategory, setExpenseCategory] = useState('Transport & Fuel');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseCurrency, setExpenseCurrency] = useState<CurrencyCode>(activeCurrency);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'cash' | 'ecocash' | 'bank' | 'card'>('cash');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  // Reversal Modal State
  const [reversalTx, setReversalTx] = useState<FinancialTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  useEffect(() => {
    async function loadData() {
      const allTx = await db.transactions.toArray();
      const allAccounts = await db.accounts.toArray();
      // sort latest first
      setTransactions(allTx.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setChartOfAccounts(allAccounts);
    }
    loadData();
  }, [refreshKey]);

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) {
      alert('Please enter a valid expense amount');
      return;
    }
    if (!expenseDescription.trim()) {
      alert('Please provide an expense description for the audit trail');
      return;
    }

    setIsSubmitting(true);
    try {
      await AccountingEngine.recordExpense({
        date: expenseDate,
        category: expenseCategory,
        description: expenseDescription,
        amount: expenseAmount,
        currency: expenseCurrency,
        paymentMethod: expensePaymentMethod,
        performedBy: activeUser.name,
      });

      setExpenseAmount(0);
      setExpenseDescription('');
      setFormSuccess(true);
      triggerRefresh();
      setTimeout(() => {
        setFormSuccess(false);
        setActiveSubTab('ledger');
      }, 1500);
    } catch (err: any) {
      alert('Error recording expense: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReversal = async () => {
    if (!reversalTx) return;
    if (!reversalReason.trim()) {
      alert('Accounting Compliance: A valid justification reason is required to reverse a transaction.');
      return;
    }

    setIsReversing(true);
    try {
      await AccountingEngine.reverseTransaction(reversalTx.id, reversalReason, activeUser.name);
      setReversalTx(null);
      setReversalReason('');
      triggerRefresh();
    } catch (err: any) {
      alert('Reversal failed: ' + err.message);
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Top Controls & Navigation Subtabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Digital Bookkeeping & General Ledger
          </h2>
          <p className="text-xs text-slate-400">
            Immutable central audit trail powered by strict double-entry journal entries.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'ledger'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Central Ledger
          </button>
          <button
            onClick={() => setActiveSubTab('record_expense')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'record_expense'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            + Record Expense
          </button>
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'accounts'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Chart of Accounts
          </button>
        </div>
      </div>

      {/* SUBTAB 1: RECORD EXPENSE */}
      {activeSubTab === 'record_expense' && (
        <div className="max-w-2xl mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <TrendingDown className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Record Operating Business Expense</h3>
          </div>

          {formSuccess ? (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-center space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
              <p className="font-bold text-sm">Expense Recorded Successfully!</p>
              <p className="text-xs text-slate-400">Balanced debit & credit journal entry posted to general ledger.</p>
            </div>
          ) : (
            <form onSubmit={handleRecordExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Expense Category
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-hidden focus:border-cyan-500"
                  >
                    <option value="Store Rent">Store Rent Expense</option>
                    <option value="Salaries & Wages">Salaries & Staff Wages</option>
                    <option value="Electricity & Water (ZESA)">Electricity & Water (ZESA)</option>
                    <option value="Transport & Fuel">Transport & Fuel</option>
                    <option value="Marketing & Promotions">Marketing & Promotions</option>
                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                    <option value="Transaction & Mobile Charges">EcoCash / Bank Transaction Charges</option>
                    <option value="Purchases & Consumables">Packaging & Store Consumables</option>
                    <option value="Miscellaneous">Other Operating Expenses</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Date of Expense
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Amount & Currency
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={expenseCurrency}
                      onChange={(e) => setExpenseCurrency(e.target.value as CurrencyCode)}
                      className="w-24 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="ZiG">ZiG</option>
                      <option value="ZAR">ZAR (R)</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={expenseAmount || ''}
                      onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                      className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                    Disbursed From Account
                  </label>
                  <select
                    value={expensePaymentMethod}
                    onChange={(e) => setExpensePaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="cash">Physical Cash Till</option>
                    <option value="ecocash">EcoCash Mobile Money</option>
                    <option value="bank">Bank Account</option>
                    <option value="card">Debit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Description / Payee Details (Audit Record)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. November electricity token from ZESA prepaid meter #2419..."
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('ledger')}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-md"
                >
                  {isSubmitting ? 'Posting...' : 'Save & Post to General Ledger'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SUBTAB 2: CENTRAL LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions by reference, payee or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
              >
                <option value="all">All Types</option>
                <option value="sale">Sales</option>
                <option value="expense">Expenses</option>
                <option value="customer_payment">Customer Collections</option>
                <option value="supplier_payment">Supplier Payments</option>
                <option value="reversal">Reversals</option>
              </select>
            </div>
          </div>

          {/* Transactions Ledger Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Category / Note</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Sync</th>
                    <th className="py-3 px-4 text-center">Journal & Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-850/50 transition ${
                          tx.isReversed ? 'bg-red-950/15 opacity-70' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              tx.type === 'sale'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : tx.type === 'expense'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : tx.type === 'reversal'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-white leading-tight">{tx.description}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Category: {tx.category} &bull; Recorded by: {tx.createdBy}
                          </div>
                          {tx.isReversed && (
                            <div className="text-[10px] text-rose-400 mt-1 font-mono">
                              REVERSED: {tx.reversalReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 uppercase text-slate-300 font-mono text-[11px]">
                          {tx.paymentMethod}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              tx.type === 'expense' || tx.type === 'supplier_payment'
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }
                          >
                            {tx.type === 'expense' || tx.type === 'supplier_payment' ? '-' : '+'}
                            {tx.currency} {tx.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              tx.syncStatus === 'synced'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {tx.syncStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setJournalViewId(tx.journalEntryId)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition"
                              title="Inspect Double-Entry Journal Lines"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Reversal action (Owner/Accountant only) */}
                            {hasPermission('reverse_tx') && !tx.isReversed && tx.type !== 'reversal' && (
                              <button
                                onClick={() => setReversalTx(tx)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition"
                                title="Reverse Transaction (Accounting Compliance)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: CHART OF ACCOUNTS */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            Standard double-entry chart of accounts. Every financial module feeds into these accounts to guarantee balanced books.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {chartOfAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-2 hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Code: {acc.code}</span>
                    <span className="uppercase font-semibold text-cyan-400">{acc.type}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">{acc.name}</h4>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between font-mono">
                  <span className="text-[10px] text-slate-400">Current Balance:</span>
                  <span className="text-base font-bold text-emerald-400">
                    {acc.currency} {acc.balance.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REVERSAL JUSTIFICATION MODAL */}
      {reversalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Reverse Transaction</h3>
              </div>
              <button
                onClick={() => setReversalTx(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300">
              In accordance with financial compliance rules, this will NOT delete the original record. Instead, it will create a balanced reversal entry in the general journal with inverted debits and credits.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-400">Target: <span className="font-semibold text-white">{reversalTx.description}</span></div>
              <div className="text-slate-400">Amount: <span className="font-mono text-cyan-400">{reversalTx.currency} {reversalTx.amount.toFixed(2)}</span></div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Reason for Reversal (Required for Audit Trail)
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Cashier typo entering $100 instead of $10..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReversalTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReversing}
                onClick={handleConfirmReversal}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
              >
                {isReversing ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
