import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine, generateUUID, queueSyncItem } from '../../services/accountingEngine';
import type { CashAccount, CashReconciliation, CurrencyCode, JournalEntry } from '../../types';
import {
  Wallet,
  ArrowRightLeft,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  Building,
  Smartphone,
  Coins,
  X,
  FileCheck,
} from 'lucide-react';

export const CashFlowModule: React.FC = () => {
  const { activeCurrency, activeUser, triggerRefresh, refreshKey } = useApp();

  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'transfer' | 'reconcile' | 'forecast'>('accounts');

  // Transfer State
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferNote, setTransferNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Reconciliation State
  const [reconAccountId, setReconAccountId] = useState('');
  const [countedBalance, setCountedBalance] = useState<number>(0);
  const [reconNotes, setReconNotes] = useState('');
  const [isReconciling, setIsReconciling] = useState(false);

  // Forecast state
  const [forecastDays, setForecastDays] = useState(30);

  useEffect(() => {
    async function loadData() {
      const accs = await db.cashAccounts.toArray();
      const recons = await db.cashReconciliations.toArray();
      setAccounts(accs);
      setReconciliations(recons.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (accs.length >= 2) {
        setFromAccountId(accs[0].id);
        setToAccountId(accs[1].id);
      }
      if (accs.length > 0) {
        setReconAccountId(accs[0].id);
      }
    }
    loadData();
  }, [refreshKey]);

  // Execute Account Transfer with Balanced Double-Entry Journal Entry
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromAccountId === toAccountId) {
      alert('Cannot transfer funds to the same account.');
      return;
    }
    if (transferAmount <= 0) {
      alert('Please enter a positive transfer amount.');
      return;
    }

    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    const toAcc = accounts.find((a) => a.id === toAccountId);
    if (!fromAcc || !toAcc) return;

    if (fromAcc.currency !== toAcc.currency) {
      alert(`Cross-currency transfer between ${fromAcc.currency} and ${toAcc.currency} requires explicit exchange conversion entry. Select accounts in the same currency.`);
      return;
    }

    if (fromAcc.balance < transferAmount) {
      const proceed = confirm(`Warning: Account balance (${fromAcc.balance}) is lower than transfer amount (${transferAmount}). Do you wish to proceed?`);
      if (!proceed) return;
    }

    setIsTransferring(true);
    try {
      const journalId = generateUUID();
      const dateStr = new Date().toISOString().split('T')[0];
      const createdAt = new Date().toISOString();

      // Update balances in cashAccounts
      await db.cashAccounts.update(fromAcc.id, { balance: fromAcc.balance - transferAmount });
      await db.cashAccounts.update(toAcc.id, { balance: toAcc.balance + transferAmount });

      // Post Balanced Journal Entry
      const journalEntry: JournalEntry = {
        id: journalId,
        organisationId: 'org_default',
        date: dateStr,
        reference: 'XFER-' + Math.floor(1000 + Math.random() * 9000),
        sourceType: 'transfer',
        sourceId: generateUUID(),
        description: `Internal Transfer: ${fromAcc.name} to ${toAcc.name} (${transferNote || 'Cash Transfer'})`,
        lines: [
          {
            id: generateUUID(),
            accountId: fromAcc.id,
            accountName: fromAcc.name,
            debit: 0,
            credit: transferAmount,
            currency: fromAcc.currency,
            description: `Transfer out to ${toAcc.name}`,
          },
          {
            id: generateUUID(),
            accountId: toAcc.id,
            accountName: toAcc.name,
            debit: transferAmount,
            credit: 0,
            currency: toAcc.currency,
            description: `Transfer in from ${fromAcc.name}`,
          },
        ],
        createdBy: activeUser.name,
        createdAt,
      };

      await db.journalEntries.put(journalEntry);
      await queueSyncItem('journal_entry', journalEntry.id, 'INSERT', journalEntry);

      alert(`Transferred ${fromAcc.currency} ${transferAmount.toFixed(2)} from ${fromAcc.name} to ${toAcc.name} successfully!`);
      setTransferAmount(0);
      setTransferNote('');
      triggerRefresh();
    } catch (err: any) {
      alert('Transfer failed: ' + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  // Execute Reconciliation
  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    const acc = accounts.find((a) => a.id === reconAccountId);
    if (!acc) return;

    setIsReconciling(true);
    try {
      const difference = countedBalance - acc.balance;
      const recon: CashReconciliation = {
        id: generateUUID(),
        accountId: acc.id,
        accountName: acc.name,
        date: new Date().toISOString().split('T')[0],
        systemBalance: acc.balance,
        actualCountedBalance: countedBalance,
        difference,
        currency: acc.currency,
        notes: reconNotes,
        checkedBy: activeUser.name,
        createdAt: new Date().toISOString(),
      };

      await db.cashReconciliations.put(recon);

      // If user confirms adjusting system to match physical count
      if (Math.abs(difference) > 0.001) {
        const adjust = confirm(
          `Difference detected: ${acc.currency} ${difference > 0 ? '+' : ''}${difference.toFixed(2)}. Adjust system balance to match counted balance?`
        );
        if (adjust) {
          await db.cashAccounts.update(acc.id, { balance: countedBalance });
        }
      }

      alert('Reconciliation recorded successfully!');
      setCountedBalance(0);
      setReconNotes('');
      triggerRefresh();
    } catch (err: any) {
      alert('Reconciliation error: ' + err.message);
    } finally {
      setIsReconciling(false);
    }
  };

  const selectedReconAcc = accounts.find((a) => a.id === reconAccountId);

  return (
    <div className="space-y-5 pb-20">
      {/* Header & Subtabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-cyan-400" />
            Cash-Flow Monitoring & Multi-Account Liquidity
          </h2>
          <p className="text-xs text-slate-400">
            Monitor real physical tills, EcoCash mobile money, bank accounts and run reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'accounts' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Accounts
          </button>
          <button
            onClick={() => setActiveSubTab('transfer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'transfer' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Inter-Account Transfer
          </button>
          <button
            onClick={() => setActiveSubTab('reconcile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'reconcile' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Reconciliation
          </button>
          <button
            onClick={() => setActiveSubTab('forecast')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'forecast' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            30-Day Forecast
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ACCOUNTS LIQUIDITY CARDS */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.map((acc) => {
              const isCash = acc.type === 'physical_cash';
              const isMobile = acc.type === 'mobile_money';

              return (
                <div
                  key={acc.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                      {isCash ? (
                        <Coins className="w-5 h-5" />
                      ) : isMobile ? (
                        <Smartphone className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Building className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-cyan-300 font-mono">
                      {acc.currency}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white">{acc.name}</h3>
                    {acc.accountNumber && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        A/C: {acc.accountNumber}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 font-mono">
                    <span className="text-[10px] text-slate-400 uppercase block">Available Balance</span>
                    <span className="text-xl font-black text-white">
                      {acc.currency} {acc.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 leading-relaxed">
            <span className="font-bold text-cyan-400 block mb-1">
              African Multi-Currency Strict Separation Rule:
            </span>
            COBOS never combines USD, ZiG and Rand balances into a single mixed currency balance. Each till and bank account maintains its own independent currency ledger to protect against inflation distortions and rate volatility.
          </div>
        </div>
      )}

      {/* SUBTAB 2: INTER-ACCOUNT TRANSFER */}
      {activeSubTab === 'transfer' && (
        <div className="max-w-xl mx-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Transfer Funds Between Accounts</h3>
          </div>

          <form onSubmit={handleExecuteTransfer} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  From Account (Source)
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency} {a.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  To Account (Destination)
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency} {a.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Transfer Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={transferAmount || ''}
                onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-base focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Transfer Description / Memo
              </label>
              <input
                type="text"
                placeholder="e.g. End of day cash drop banked to Stanbic..."
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isTransferring}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition shadow-md"
            >
              {isTransferring ? 'Posting Journal...' : 'Confirm Inter-Account Transfer'}
            </button>
          </form>
        </div>
      )}

      {/* SUBTAB 3: RECONCILIATION */}
      {activeSubTab === 'reconcile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Reconcile Form (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl space-y-4 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Count & Reconcile Account</h3>
            </div>

            <form onSubmit={handleSaveReconciliation} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Select Account
                </label>
                <select
                  value={reconAccountId}
                  onChange={(e) => setReconAccountId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              {selectedReconAcc && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>System Recorded Balance:</span>
                    <span className="font-bold text-white">
                      {selectedReconAcc.currency} {selectedReconAcc.balance.toFixed(2)}
                    </span>
                  </div>
                  {countedBalance > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Variance Difference:</span>
                      <span
                        className={`font-bold ${
                          countedBalance - selectedReconAcc.balance >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {selectedReconAcc.currency}{' '}
                        {(countedBalance - selectedReconAcc.balance).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Actual Counted Physical Cash / Statement Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={countedBalance || ''}
                  onChange={(e) => setCountedBalance(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-base focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Reconciliation Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Physical till notes counted at 17:00 close..."
                  value={reconNotes}
                  onChange={(e) => setReconNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isReconciling}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shadow-md"
              >
                {isReconciling ? 'Saving...' : 'Record Reconciliation'}
              </button>
            </form>
          </div>

          {/* Past Reconciliation Audits (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 font-bold text-xs text-white">
              Reconciliation Audit Trail
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/50 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Account</th>
                    <th className="py-2.5 px-3 text-right">System</th>
                    <th className="py-2.5 px-3 text-right">Counted</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                    <th className="py-2.5 px-3">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {reconciliations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 font-sans">
                        No reconciliation entries yet.
                      </td>
                    </tr>
                  ) : (
                    reconciliations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-850/50">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{r.date}</td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-white">{r.accountName}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{r.systemBalance.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-white font-bold">{r.actualCountedBalance.toFixed(2)}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${
                            Math.abs(r.difference) < 0.01
                              ? 'text-emerald-400'
                              : r.difference > 0
                              ? 'text-cyan-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {r.difference > 0 ? `+${r.difference.toFixed(2)}` : r.difference.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-400">{r.checkedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: 30-DAY CASH-FLOW FORECAST */}
      {activeSubTab === 'forecast' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
            <h3 className="font-bold text-white text-sm">30-Day Liquidity Projection</h3>
            <p className="text-slate-400">
              Distinguishes projected cash flows from actual cash balances in accordance with accounting principles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-emerald-400">
                Expected Customer Inflows (30 Days)
              </span>
              <div className="text-lg font-black font-mono text-white">
                USD $225.00
              </div>
              <span className="text-[10px] text-slate-400 block">Based on debtor repayment history</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-rose-400">
                Scheduled Supplier Obligations (30 Days)
              </span>
              <div className="text-lg font-black font-mono text-white">
                USD $335.00
              </div>
              <span className="text-[10px] text-slate-400 block">National Foods & Schweppes payables</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-cyan-400">
                Estimated Net Cash Movement
              </span>
              <div className="text-lg font-black font-mono text-cyan-300">
                -USD $110.00
              </div>
              <span className="text-[10px] text-slate-400 block">Covered by current available till liquidity</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
