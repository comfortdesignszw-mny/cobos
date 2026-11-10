import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import type { FinancialTransaction, Product, Account } from '../../types';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  PieChart,
  Scale,
} from 'lucide-react';

export const ReportsModule: React.FC = () => {
  const { activeCurrency, profile, refreshKey, hasPermission } = useApp();

  const [activeReport, setActiveReport] = useState<'pnl' | 'balance_sheet' | 'sales_summary' | 'inventory_valuation'>('pnl');
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    async function loadReportsData() {
      const allTx = await db.transactions.toArray();
      const allProds = await db.products.toArray();
      const allAccs = await db.accounts.toArray();
      setTransactions(allTx.filter((t) => !t.isReversed));
      setProducts(allProds);
      setAccounts(allAccs);
    }
    loadReportsData();
  }, [refreshKey]);

  // Calculations for P&L in activeCurrency
  const salesTx = transactions.filter((t) => t.type === 'sale' && t.currency === activeCurrency);
  const totalSalesRevenue = salesTx.reduce((sum, t) => sum + t.amount, 0);

  // Group Expenses by Category
  const expenseTx = transactions.filter((t) => t.type === 'expense' && t.currency === activeCurrency);
  const totalExpenses = expenseTx.reduce((sum, t) => sum + t.amount, 0);

  const expensesByCategory: Record<string, number> = {};
  for (const t of expenseTx) {
    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
  }

  // COGS estimate: from COGS account or products sold
  const cogsAccount = accounts.find((a) => a.id === (activeCurrency === 'ZiG' ? 'acc_cogs_zig' : 'acc_cogs_usd'));
  const totalCogs = cogsAccount?.balance || 0;
  const grossProfit = totalSalesRevenue - totalCogs;
  const netProfit = grossProfit - totalExpenses;
  const grossMarginPct = totalSalesRevenue > 0 ? ((grossProfit / totalSalesRevenue) * 100).toFixed(1) : '0';

  // Balance Sheet Totals
  const assetAccounts = accounts.filter((a) => a.type === 'asset' && a.currency === activeCurrency);
  const liabilityAccounts = accounts.filter((a) => a.type === 'liability' && a.currency === activeCurrency);
  const equityAccounts = accounts.filter((a) => a.type === 'equity' && a.currency === activeCurrency);

  const totalAssets = assetAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalEquity = equityAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `Comfort Business Operational System (COBOS) Report\n`;
    csvContent += `Report: ${activeReport.toUpperCase()}, Currency: ${activeCurrency}, Date: ${new Date().toISOString()}\n\n`;

    if (activeReport === 'pnl') {
      csvContent += `Line Item,Amount (${activeCurrency})\n`;
      csvContent += `Sales Revenue,${totalSalesRevenue.toFixed(2)}\n`;
      csvContent += `Cost of Goods Sold (COGS),-${totalCogs.toFixed(2)}\n`;
      csvContent += `Gross Profit,${grossProfit.toFixed(2)}\n`;
      csvContent += `Operating Expenses Total,-${totalExpenses.toFixed(2)}\n`;
      for (const [cat, amt] of Object.entries(expensesByCategory)) {
        csvContent += `  - ${cat},-${amt.toFixed(2)}\n`;
      }
      csvContent += `Net Profit,${netProfit.toFixed(2)}\n`;
    } else if (activeReport === 'sales_summary') {
      csvContent += `Date,Type,Category,Description,Amount\n`;
      for (const t of salesTx) {
        csvContent += `${t.date},${t.type},${t.category},"${t.description}",${t.amount.toFixed(2)}\n`;
      }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `COBOS_${activeReport}_${activeCurrency}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header & Subtabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Financial Reporting & Business Intelligence
          </h2>
          <p className="text-xs text-slate-400">
            Exportable P&L, Balance Sheet, Inventory Valuation and automated performance insights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800/80">
        {[
          { id: 'pnl', label: 'Income Statement (P&L)' },
          { id: 'balance_sheet', label: 'Balance Sheet' },
          { id: 'sales_summary', label: 'Sales Activity Log' },
          { id: 'inventory_valuation', label: 'Inventory Valuation' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              activeReport === tab.id
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT 1: INCOME STATEMENT (P&L) */}
      {activeReport === 'pnl' && (
        <div className="max-w-3xl mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6 text-xs">
          <div className="text-center pb-4 border-b border-slate-800 space-y-1">
            <h3 className="text-base font-bold text-white uppercase tracking-wider">{profile.name}</h3>
            <h4 className="text-sm font-semibold text-cyan-400">Statement of Profit and Loss (Income Statement)</h4>
            <p className="text-[11px] text-slate-400">
              For Period Ended {new Date().toLocaleDateString()} &bull; Currency: <span className="font-bold text-white">{activeCurrency}</span>
            </p>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {/* Revenue */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-slate-300 font-sans text-sm">
                <span>1. Revenue / Turn-over</span>
                <span></span>
              </div>
              <div className="flex justify-between pl-4 text-slate-300">
                <span>Gross Sales Revenue ({activeCurrency})</span>
                <span className="font-bold text-emerald-400">+{totalSalesRevenue.toFixed(2)}</span>
              </div>
            </div>

            {/* COGS */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex justify-between font-bold text-slate-300 font-sans text-sm">
                <span>2. Cost of Goods Sold (COGS)</span>
                <span></span>
              </div>
              <div className="flex justify-between pl-4 text-slate-400">
                <span>Cost of Inventory Sold</span>
                <span className="text-rose-400">-{totalCogs.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-800 font-bold text-white text-xs">
                <span>GROSS PROFIT (Margin: {grossMarginPct}%)</span>
                <span className={grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {activeCurrency} {grossProfit.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex justify-between font-bold text-slate-300 font-sans text-sm">
                <span>3. Operating Expenses</span>
                <span></span>
              </div>
              {Object.keys(expensesByCategory).length === 0 ? (
                <div className="pl-4 text-slate-500 italic">No operating expenses recorded in this currency.</div>
              ) : (
                Object.entries(expensesByCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between pl-4 text-slate-300">
                    <span>{cat}</span>
                    <span className="text-rose-400">-{amt.toFixed(2)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-800 font-bold text-slate-300">
                <span>Total Operating Expenses</span>
                <span className="text-rose-400">-{totalExpenses.toFixed(2)}</span>
              </div>
            </div>

            {/* Net Profit */}
            <div className="pt-3 border-t-2 border-slate-700 flex justify-between items-baseline font-black text-sm sm:text-base">
              <span className="text-white uppercase font-sans">NET PROFIT / (LOSS)</span>
              <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {activeCurrency} {netProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: BALANCE SHEET */}
      {activeReport === 'balance_sheet' && (
        <div className="max-w-3xl mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6 text-xs">
          <div className="text-center pb-4 border-b border-slate-800 space-y-1">
            <h3 className="text-base font-bold text-white uppercase tracking-wider">{profile.name}</h3>
            <h4 className="text-sm font-semibold text-cyan-400">Balance Sheet (Statement of Financial Position)</h4>
            <p className="text-[11px] text-slate-400">
              As of {new Date().toLocaleDateString()} &bull; Currency: <span className="font-bold text-white">{activeCurrency}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
            {/* ASSETS */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <h4 className="font-bold font-sans text-sm text-cyan-400 uppercase tracking-wider">Assets</h4>
              <div className="space-y-1.5 divide-y divide-slate-800/40">
                {assetAccounts.map((a) => (
                  <div key={a.id} className="pt-1.5 flex justify-between text-slate-300 text-xs">
                    <span className="font-sans">{a.name}</span>
                    <span className="font-bold">{a.balance.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-700 flex justify-between font-bold text-white">
                <span className="font-sans uppercase">Total Assets:</span>
                <span className="text-cyan-300">{activeCurrency} {totalAssets.toFixed(2)}</span>
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className="space-y-4">
              {/* Liabilities */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <h4 className="font-bold font-sans text-sm text-purple-400 uppercase tracking-wider">Liabilities</h4>
                <div className="space-y-1.5 divide-y divide-slate-800/40">
                  {liabilityAccounts.map((a) => (
                    <div key={a.id} className="pt-1.5 flex justify-between text-slate-300 text-xs">
                      <span className="font-sans">{a.name}</span>
                      <span className="font-bold">{a.balance.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between font-bold text-white">
                  <span className="font-sans uppercase">Total Liabilities:</span>
                  <span className="text-purple-300">{activeCurrency} {totalLiabilities.toFixed(2)}</span>
                </div>
              </div>

              {/* Equity */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <h4 className="font-bold font-sans text-sm text-emerald-400 uppercase tracking-wider">Equity</h4>
                <div className="space-y-1.5 divide-y divide-slate-800/40">
                  {equityAccounts.map((a) => (
                    <div key={a.id} className="pt-1.5 flex justify-between text-slate-300 text-xs">
                      <span className="font-sans">{a.name}</span>
                      <span className="font-bold">{a.balance.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between font-bold text-white">
                  <span className="font-sans uppercase">Total Equity:</span>
                  <span className="text-emerald-300">{activeCurrency} {totalEquity.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 font-sans">Accounting Balance Check:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span>Assets ({totalAssets.toFixed(2)}) ≈ Liab + Eq ({(totalLiabilities + totalEquity).toFixed(2)})</span>
            </span>
          </div>
        </div>
      )}

      {/* REPORT 3: SALES SUMMARY */}
      {activeReport === 'sales_summary' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center text-xs">
            <span className="font-bold text-white">Recorded Sales Activity Log ({salesTx.length} Transactions)</span>
            <span className="font-mono text-cyan-300 font-bold">Total: {activeCurrency} {totalSalesRevenue.toFixed(2)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/40 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Receipt / Description</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4">Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {salesTx.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-850/50">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{s.date}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-white">{s.description}</td>
                    <td className="py-2.5 px-4 uppercase text-slate-300 text-[11px]">{s.paymentMethod}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                      +{s.currency} {s.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-400">{s.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: INVENTORY VALUATION */}
      {activeReport === 'inventory_valuation' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center text-xs">
            <span className="font-bold text-white">Merchandise Valuation by Stock Line</span>
            <span className="font-mono text-cyan-300 font-bold">
              Total Catalog Items: {products.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/40 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Product Name</th>
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4 text-right">Unit Cost</th>
                  <th className="py-2.5 px-4 text-right">Selling Price</th>
                  <th className="py-2.5 px-4 text-center">On Hand</th>
                  <th className="py-2.5 px-4 text-right">Total Valuation (Cost)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {products.map((p) => {
                  const valCost = p.currentStock * p.purchaseCost;
                  return (
                    <tr key={p.id} className="hover:bg-slate-850/50">
                      <td className="py-2.5 px-4 font-sans font-semibold text-white">{p.name}</td>
                      <td className="py-2.5 px-4 text-slate-400">{p.sku}</td>
                      <td className="py-2.5 px-4 text-right text-slate-300">{p.currency} {p.purchaseCost.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right text-cyan-300 font-bold">{p.currency} {p.sellingPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-center text-slate-200">{p.currentStock} {p.unit}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-white whitespace-nowrap">
                        {p.currency} {valCost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
