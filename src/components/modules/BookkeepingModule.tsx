import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine } from '../../services/accountingEngine';
import { GuestLimitService } from '../../services/guestLimitService';
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
  Lock,
} from 'lucide-react';

export const BookkeepingModule: React.FC = () => {
  const {
    activeCurrency,
    activeUser,
    currentUser,
    openNudge,
    hasPermission,
    setJournalViewId,
    triggerRefresh,
    refreshKey,
    isSuperAdmin,
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
  const [expensePaymentMethod, setPaymentMethod] = useState<'cash' | 'ecocash' | 'bank' | 'card'>('cash');
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

      // Row-Level Security: Cashiers only see their OWN transactions. Admins & Managers see all.
      const isManagerOrAdmin = ['super_admin', 'owner', 'manager', 'accountant'].includes(activeUser.role) || isSuperAdmin;

      const visibleTx = isManagerOrAdmin
        ? allTx
        : allTx.filter((tx) => tx.createdById === activeUser.id || tx.createdBy === activeUser.name);

      setTransactions(visibleTx.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setChartOfAccounts(allAccounts);
    }
    loadData();
  }, [refreshKey, activeUser.id, activeUser.role, isSuperAdmin]);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) {
      alert('Expense amount must be greater than zero.');
      return;
    }

    if (!currentUser) {
      const { allowed, count } = await GuestLimitService.checkCanTransact();
      if (!allowed) {
        openNudge('limit_transactions', count);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await AccountingEngine.recordExpense({
        date: expenseDate,
        category: expenseCategory,
        description: expenseDescription.trim() || `${expenseCategory} Expense`,
        amount: Number(expenseAmount),
        currency: expenseCurrency,
        paymentMethod: expensePaymentMethod,
        userId: activeUser.id,
        userName: activeUser.name,
      });

      setFormSuccess(true);
      setExpenseAmount(0);
      setExpenseDescription('');
      triggerRefresh();
      setTimeout(() => {
        setFormSuccess(false);
        setActiveSubTab('ledger');
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to record expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTx) return;
    if (!reversalReason.trim()) {
      alert('Please state an audit reason for this transaction reversal.');
      return;
    }

    setIsReversing(true);
    try {
      await AccountingEngine.reverseTransaction({
        transactionId: reversalTx.id,
        reason: reversalReason.trim(),
        performedBy: activeUser.name,
        performedById: activeUser.id,
        userRole: activeUser.role,
      });

      setReversalTx(null);
      setReversalReason('');
      triggerRefresh();
      alert('Transaction reversed with compensating balanced journal entry.');
    } catch (err: any) {
      alert(err.message || 'Reversal failed.');
    } finally {
      setIsReversing(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      tx.description.toLowerCase().includes(q) ||
      tx.category.toLowerCase().includes(q) ||
      tx.createdBy.toLowerCase().includes(q);
    const matchesType = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-5 pb-20">
      {/* Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <span>Digital Bookkeeping & General Ledger</span>
            {!currentUser && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 border border-amber-700/60 text-amber-300">
                Guest Limit: Max 20 Tx / Day
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Immutable transaction records, double-entry audit vouchers, and expense recording.
            {activeUser.role === 'cashier' && !isSuperAdmin && currentUser && (
              <span className="text-amber-400 ml-1 font-semibold">
                (Cashier Mode: Displaying your own personal sales & expenses)
              </span>
            )}
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === 'ledger'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Transaction Ledger
          </button>
          <button
            onClick={() => setActiveSubTab('record_expense')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
              activeSubTab === 'record_expense'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === 'accounts'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Chart of Accounts
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: TRANSACTION LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search ledger by description, category, or staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['all', 'sale', 'expense', 'reversal'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 rounded-xl uppercase text-[10px] font-bold tracking-wider transition ${
                    filterType === t
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Staff / Cashier</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Journal & Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredTransactions.map((tx) => {
                    const isExpense = tx.type === 'expense';
                    const isReversed = tx.isReversed;

                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-800/40 transition ${
                          isReversed ? 'opacity-40 line-through bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="p-3 text-slate-400 whitespace-nowrap">{tx.date}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tx.type === 'sale'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                : tx.type === 'expense'
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-3 font-sans text-white max-w-[280px] truncate">
                          {tx.description}
                          {isReversed && (
                            <span className="ml-2 text-[10px] text-rose-400 no-underline font-semibold block sm:inline">
                              (Reversed: {tx.reversalReason})
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400 font-sans">{tx.category}</td>
                        <td className="p-3 text-slate-300 font-sans text-[11px]">{tx.createdBy}</td>
                        <td
                          className={`p-3 text-right font-bold text-sm ${
                            isExpense ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {tx.currency} {tx.amount.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Double-Entry Journal Voucher */}
                            <button
                              onClick={() => setJournalViewId(tx.journalEntryId)}
                              title="Inspect balanced double-entry lines"
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Reversal Button: Restricted to Manager or Super Admin */}
                            {!isReversed && hasPermission('reverse_tx') && (
                              <button
                                onClick={() => setReversalTx(tx)}
                                title="Execute reversal voucher"
                                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isReversed && !hasPermission('reverse_tx') && (
                              <span title="Manager approval required to reverse" className="p-1 text-slate-600">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredTransactions.length === 0 && (
                <div className="p-8 text-center text-slate-500 space-y-1">
                  <p>No transactions found matching criteria</p>
                  <p className="text-[10px]">All completed sales and operational expenses appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: RECORD OPERATING EXPENSE */}
      {activeSubTab === 'record_expense' && (
        <div className="max-w-xl mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-5 text-xs">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-cyan-400" />
              <span>Record Business Operating Expense</span>
            </h3>
            <p className="text-slate-400">
              Posts an immediate balanced double-entry debit to Expense and credit to Cash/EcoCash.
            </p>
          </div>

          {formSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Expense recorded and posted to double-entry ledger!</span>
            </div>
          )}

          <form onSubmit={handleRecordExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-hidden"
                >
                  <option value="Store Rent">Store Rent</option>
                  <option value="Electricity & Water (ZESA)">Electricity & Water (ZESA)</option>
                  <option value="Transport & Fuel">Transport & Fuel</option>
                  <option value="Salaries & Wages">Salaries & Wages</option>
                  <option value="Marketing & Promotions">Marketing & Promotions</option>
                  <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                  <option value="Transaction & Mobile Charges">Transaction & Mobile Charges</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  placeholder="0.00"
                  value={expenseAmount || ''}
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Currency</label>
                <select
                  value={expenseCurrency}
                  onChange={(e) => setExpenseCurrency(e.target.value as CurrencyCode)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                >
                  <option value="USD">USD</option>
                  <option value="ZiG">ZiG</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Disbursement Source</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'Cash Drawer' },
                  { id: 'ecocash', label: 'EcoCash' },
                  { id: 'bank', label: 'Bank Account' },
                  { id: 'card', label: 'Card' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-2 rounded-xl text-center font-semibold transition ${
                      expensePaymentMethod === m.id
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Memo / Purpose Note</label>
              <input
                type="text"
                required
                placeholder="e.g. Generator petrol for store lighting during load-shedding"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold shadow-md transition"
            >
              {isSubmitting ? 'Posting Journal...' : 'Confirm & Post Expense'}
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 3: CHART OF ACCOUNTS */}
      {activeSubTab === 'accounts' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Account Name</th>
                <th className="p-3">Classification</th>
                <th className="p-3">Currency</th>
                <th className="p-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {chartOfAccounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 text-cyan-400 font-bold">{acc.code}</td>
                  <td className="p-3 font-sans text-white font-medium">{acc.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                      {acc.type}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{acc.currency}</td>
                  <td className="p-3 text-right font-bold text-white">
                    {acc.currency} {(acc.balance || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction Reversal Confirmation Modal */}
      {reversalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Execute Reversal Voucher</span>
              </h3>
              <button onClick={() => setReversalTx(null)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300 leading-relaxed">
              You are reversing transaction <strong>{reversalTx.description}</strong> for{' '}
              <strong className="text-cyan-400 font-mono">
                {reversalTx.currency} {reversalTx.amount.toFixed(2)}
              </strong>
              . This creates an auditable compensating journal entry and restores balances.
            </p>

            <form onSubmit={handleExecuteReversal} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Reversal Audit Reason (Required)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incorrect quantity entered, customer returned goods"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReversalTx(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReversing}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  {isReversing ? 'Posting Reversal...' : 'Authorize Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
