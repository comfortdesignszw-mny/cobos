import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import type { JournalEntry } from '../../types';
import { Scale, X, CheckCircle2, AlertOctagon } from 'lucide-react';

export const JournalViewModal: React.FC = () => {
  const { journalViewId, setJournalViewId } = useApp();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!journalViewId) {
      setEntry(null);
      return;
    }

    setLoading(true);
    db.journalEntries.get(journalViewId).then((res) => {
      setEntry(res || null);
      setLoading(false);
    });
  }, [journalViewId]);

  if (!journalViewId) return null;

  const totalDebit = entry?.lines.reduce((s, l) => s + l.debit, 0) || 0;
  const totalCredit = entry?.lines.reduce((s, l) => s + l.credit, 0) || 0;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Double-Entry General Journal
                {entry?.isReversed && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
                    REVERSED
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Reference: <span className="font-mono text-cyan-300">{entry?.reference || journalViewId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setJournalViewId(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">Loading journal lines...</div>
          ) : !entry ? (
            <div className="text-center py-8 text-slate-400 text-xs">Journal record not found.</div>
          ) : (
            <>
              {/* Metadata banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">Date</span>
                  <span className="font-medium text-slate-200">{entry.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Source</span>
                  <span className="font-medium text-cyan-400 uppercase text-[11px]">{entry.sourceType}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Created By</span>
                  <span className="font-medium text-slate-200 truncate block">{entry.createdBy}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Status</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Balanced
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-300 font-medium">
                  Description: <span className="text-slate-400 font-normal">{entry.description}</span>
                </p>
              </div>

              {/* Journal Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3 text-right">Debit</th>
                      <th className="py-2.5 px-3 text-right">Credit</th>
                      <th className="py-2.5 px-3 text-center">Curr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                    {entry.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3">
                          <div className={`font-sans ${line.credit > 0 ? 'pl-4 text-slate-400' : 'text-slate-200 font-medium'}`}>
                            {line.accountName}
                          </div>
                          {line.description && (
                            <div className="font-sans text-[10px] text-slate-400 pl-1">{line.description}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-semibold whitespace-nowrap">
                          {line.debit > 0 ? line.debit.toFixed(2) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-cyan-400 font-semibold whitespace-nowrap">
                          {line.credit > 0 ? line.credit.toFixed(2) : '-'}
                        </td>
                        <td className="py-2 px-3 text-center text-[10px] text-slate-400 font-sans">
                          {line.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-950 font-mono font-bold text-xs border-t-2 border-slate-700">
                    <tr>
                      <td className="py-2.5 px-3 text-slate-300 font-sans">Total Balanced</td>
                      <td className="py-2.5 px-3 text-right text-emerald-300 whitespace-nowrap">
                        {totalDebit.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-cyan-300 whitespace-nowrap">
                        {totalCredit.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs text-emerald-400">✓</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!isBalanced && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0" />
                  <span>Warning: Debits and Credits do not match!</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex justify-end">
          <button
            onClick={() => setJournalViewId(null)}
            className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
