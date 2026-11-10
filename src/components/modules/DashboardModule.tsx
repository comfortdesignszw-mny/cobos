import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import type {
  FinancialTransaction,
  Product,
  Customer,
  Supplier,
  CashAccount,
} from '../../types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Truck,
  ShoppingCart,
  PlusCircle,
  Eye,
  MessageSquare,
  Wallet,
  AlertCircle,
} from 'lucide-react';

export const DashboardModule: React.FC = () => {
  const {
    activeCurrency,
    setActiveTab,
    refreshKey,
    hasPermission,
    setJournalViewId,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [estimatedProfit, setEstimatedProfit] = useState(0);
  const [totalCustomerDebt, setTotalCustomerDebt] = useState(0);
  const [totalSupplierDebt, setTotalSupplierDebt] = useState(0);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<FinancialTransaction[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [overdueCustomers, setOverdueCustomers] = useState<Customer[]>([]);
  const [suppliersDue, setSuppliersDue] = useState<Supplier[]>([]);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Transactions for today
      const allTx = await db.transactions.toArray();
      const todayTx = allTx.filter((t) => t.date === todayStr && !t.isReversed);

      const salesToday = todayTx
        .filter((t) => t.type === 'sale' && t.currency === activeCurrency)
        .reduce((sum, t) => sum + t.amount, 0);

      const expensesToday = todayTx
        .filter((t) => t.type === 'expense' && t.currency === activeCurrency)
        .reduce((sum, t) => sum + t.amount, 0);

      const profitToday = salesToday - expensesToday;

      // 2. Customers debt
      const customers = await db.customers.toArray();
      let custDebt = 0;
      if (activeCurrency === 'ZiG') {
        custDebt = customers.reduce((sum, c) => sum + (c.outstandingBalanceZiG || 0), 0);
      } else if (activeCurrency === 'ZAR') {
        custDebt = customers.reduce((sum, c) => sum + (c.outstandingBalanceZAR || 0), 0);
      } else {
        custDebt = customers.reduce((sum, c) => sum + (c.outstandingBalanceUSD || 0), 0);
      }

      const overdues = customers.filter((c) => {
        const debt = activeCurrency === 'ZiG' ? c.outstandingBalanceZiG : c.outstandingBalanceUSD;
        return (debt || 0) > 0;
      });

      // 3. Suppliers debt
      const suppliers = await db.suppliers.toArray();
      let suppDebt = 0;
      if (activeCurrency === 'ZiG') {
        suppDebt = suppliers.reduce((sum, s) => sum + (s.outstandingBalanceZiG || 0), 0);
      } else {
        suppDebt = suppliers.reduce((sum, s) => sum + (s.outstandingBalanceUSD || 0), 0);
      }
      const dueSuppliers = suppliers.filter(
        (s) => (s.outstandingBalanceUSD || 0) > 0 || (s.outstandingBalanceZiG || 0) > 0
      );

      // 4. Cash Accounts
      const accounts = await db.cashAccounts.toArray();

      // 5. Products & Low Stock
      const products = await db.products.toArray();
      const lowStock = products.filter((p) => p.currentStock <= p.minStockLevel);

      let invValue = 0;
      for (const p of products) {
        if (p.currency === activeCurrency) {
          invValue += p.currentStock * p.purchaseCost;
        }
      }

      // 6. Recent Transactions (last 8)
      const sortedTx = [...allTx]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8);

      if (mounted) {
        setTodaySales(salesToday);
        setTodayExpenses(expensesToday);
        setEstimatedProfit(profitToday);
        setTotalCustomerDebt(custDebt);
        setTotalSupplierDebt(suppDebt);
        setCashAccounts(accounts);
        setLowStockProducts(lowStock);
        setOverdueCustomers(overdues);
        setSuppliersDue(dueSuppliers);
        setTotalInventoryValue(invValue);
        setRecentTransactions(sortedTx);
        setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      mounted = false;
    };
  }, [activeCurrency, refreshKey]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Bar: Clean Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Financial Dashboard
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <span>Operating Currency: <strong className="text-white">{activeCurrency}</strong></span>
            <span>·</span>
            <span>Offline-Ready Local Database</span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {hasPermission('pos_sale') && (
            <button
              onClick={() => setActiveTab('pos')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-sm transition active:scale-[0.99]"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>New POS Sale</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('transactions')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Customer Pay</span>
          </button>
        </div>
      </div>

      {/* PROMINENT NUMBER STATS CARDS (6 Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Today's Sales */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1">
          <span className="text-xs font-medium text-slate-400 block">Today's Sales</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white tabular-nums">
            {todaySales.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block">{activeCurrency} gross today</span>
        </div>

        {/* Today's Expenses */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1">
          <span className="text-xs font-medium text-slate-400 block">Today's Expenses</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white tabular-nums">
            {todayExpenses.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block">{activeCurrency} operating costs</span>
        </div>

        {/* Estimated Profit */}
        {hasPermission('view_profit') ? (
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1">
            <span className="text-xs font-medium text-slate-400 block">Estimated Profit</span>
            <div
              className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums ${
                estimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {estimatedProfit.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400 block">
              {activeCurrency} net today
            </span>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-1">
            <span className="text-xs font-medium text-slate-400 block">Profit</span>
            <span className="text-xs text-slate-400 italic block pt-2">Admin Only</span>
          </div>
        )}

        {/* Customer Debts (Receivables) */}
        <div
          onClick={() => setActiveTab('customers')}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1 hover:border-amber-600/50 cursor-pointer transition"
        >
          <span className="text-xs font-medium text-slate-400 block">Customer Debts</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-400 tabular-nums">
            {totalCustomerDebt.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block">
            {overdueCustomers.length} active debtors
          </span>
        </div>

        {/* Supplier Debts (Payables) */}
        <div
          onClick={() => setActiveTab('suppliers')}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1 hover:border-purple-600/50 cursor-pointer transition"
        >
          <span className="text-xs font-medium text-slate-400 block">Supplier Debts</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-purple-400 tabular-nums">
            {totalSupplierDebt.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block">
            {suppliersDue.length} suppliers owed
          </span>
        </div>

        {/* Total Inventory Value */}
        <div
          onClick={() => setActiveTab('inventory')}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1 hover:border-cyan-600/50 cursor-pointer transition"
        >
          <span className="text-xs font-medium text-slate-400 block">Inventory Value</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-cyan-300 tabular-nums">
            {totalInventoryValue.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block">At cost valuation</span>
        </div>
      </div>

      {/* Account Balances Grid (Independent Currencies) */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">
            Cash & Financial Accounts
          </h3>
          <button
            onClick={() => setActiveTab('cashflow')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
          >
            Reconcile Accounts &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cashAccounts.map((acc) => (
            <div
              key={acc.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium text-slate-300">{acc.name}</span>
                <span className="font-mono text-[10px] text-slate-400 font-bold">
                  {acc.currency}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {acc.currency} {acc.balance.toFixed(2)}
              </div>
              {acc.accountNumber && (
                <div className="text-[10px] text-slate-400 font-mono">
                  A/C: {acc.accountNumber}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION: Recent Transactions & Priority Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions Table (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
            <button
              onClick={() => setActiveTab('transactions')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Full Ledger &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-850/40">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-medium text-slate-200">{tx.description}</div>
                      {tx.isReversed && (
                        <span className="text-[10px] text-rose-400 font-mono">
                          Reversed: {tx.reversalReason || 'Correction'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">
                      {tx.category}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap tabular-nums">
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
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setJournalViewId(tx.journalEntryId)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 transition"
                        title="View Double-Entry Journal Lines"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Priority Action Items (Right Column) */}
        <div className="space-y-4">
          {/* Low Stock Watch */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Low Stock Alert ({lowStockProducts.length})
              </h4>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Stocktake &rarr;
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-slate-400 italic">All items are sufficiently stocked.</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white block">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-rose-400">
                        {p.currentStock} {p.unit}
                      </span>
                      <span className="block text-[10px] text-slate-400">Min: {p.minStockLevel}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue Debtors with One-Click Reminder */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Debtors ({overdueCustomers.length})
              </h4>
              <button
                onClick={() => setActiveTab('customers')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Receivables &rarr;
              </button>
            </div>

            {overdueCustomers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No outstanding customer debts.</p>
            ) : (
              <div className="space-y-2">
                {overdueCustomers.slice(0, 4).map((c) => {
                  const bal = activeCurrency === 'ZiG' ? c.outstandingBalanceZiG : c.outstandingBalanceUSD;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white block">{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 tabular-nums">
                          {activeCurrency} {bal.toFixed(2)}
                        </span>
                        <button
                          onClick={() => {
                            const msg = encodeURIComponent(
                              `Hello ${c.name}, payment reminder from Comfort Enterprises. Outstanding balance: ${activeCurrency} ${bal.toFixed(2)}.`
                            );
                            window.open(`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white transition"
                          title="WhatsApp Reminder"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
