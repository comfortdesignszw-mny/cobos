import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, Share2, Copy, Check, X, MessageSquare } from 'lucide-react';

export const ReceiptModal: React.FC = () => {
  const { receiptModalData, setReceiptModalData, profile } = useApp();
  const [copied, setCopied] = useState(false);

  if (!receiptModalData) return null;

  const sale = receiptModalData;

  const receiptPlainText = `*${profile.name.toUpperCase()}*
${profile.address}
Tel: ${profile.phone}
Tax No: ${profile.taxNumber || 'N/A'}
--------------------------------
RECEIPT: ${sale.receiptNumber}
DATE: ${sale.date}
CASHIER: ${sale.cashierName}
CUSTOMER: ${sale.customerName || 'Walk-in'}
--------------------------------
${sale.items
  .map(
    (item) =>
      `${item.quantity}x ${item.productName}\n   @ ${sale.currency} ${item.unitPrice.toFixed(2)} = ${sale.currency} ${item.total.toFixed(2)}`
  )
  .join('\n')}
--------------------------------
SUBTOTAL: ${sale.currency} ${sale.subtotal.toFixed(2)}
${sale.discount > 0 ? `DISCOUNT: -${sale.currency} ${sale.discount.toFixed(2)}\n` : ''}TOTAL: ${sale.currency} ${sale.total.toFixed(2)}
PAYMENTS:
${sale.payments.map((p) => ` - ${p.method.toUpperCase()}: ${p.currency} ${p.amount.toFixed(2)}`).join('\n')}
${sale.isCredit ? `CREDIT OWING: ${sale.currency} ${sale.creditBalanceRemaining.toFixed(2)}\n` : ''}--------------------------------
${profile.receiptFooter}
Powered by COBOS Offline-First PWA`;

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptPlainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(receiptPlainText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Official Sales Receipt
            </span>
          </div>
          <button
            onClick={() => setReceiptModalData(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-4 overflow-y-auto bg-white text-slate-950 font-mono text-xs select-text">
          <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
            <h2 className="text-sm font-black tracking-tight">{profile.name}</h2>
            <p className="text-[10px] text-slate-600">{profile.address}</p>
            <p className="text-[10px] text-slate-600">Tel: {profile.phone}</p>
            {profile.taxNumber && <p className="text-[10px] text-slate-600">Tax Reg: {profile.taxNumber}</p>}
          </div>

          <div className="py-2 border-b border-dashed border-slate-300 text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-bold">{sale.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{sale.date}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{sale.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{sale.customerName || 'Walk-in Customer'}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-2 border-b border-dashed border-slate-300">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] uppercase text-slate-500">
                  <th className="pb-1">Item</th>
                  <th className="pb-1 text-center">Qty</th>
                  <th className="pb-1 text-right">Price</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1 pr-1 font-sans text-[11px] leading-tight font-medium text-slate-900">
                      {item.productName}
                    </td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-1 text-right font-bold whitespace-nowrap">
                      {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{sale.currency} {sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-{sale.currency} {sale.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300">
              <span>TOTAL ({sale.currency}):</span>
              <span>{sale.currency} {sale.total.toFixed(2)}</span>
            </div>

            {/* Payment Details */}
            <div className="pt-1 text-[10px] text-slate-600">
              <span className="font-bold">Paid via:</span>
              {sale.payments.map((p, i) => (
                <div key={i} className="flex justify-between pl-2">
                  <span>- {p.method.toUpperCase()}</span>
                  <span>{p.currency} {p.amount.toFixed(2)}</span>
                </div>
              ))}
              {sale.isCredit && (
                <div className="flex justify-between text-amber-700 font-bold pl-2 pt-0.5">
                  <span>- ON CREDIT (OWING):</span>
                  <span>{sale.currency} {sale.creditBalanceRemaining.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-2 text-center text-[9px] text-slate-500 font-sans leading-tight">
            <p>{profile.receiptFooter}</p>
            <p className="mt-1 font-mono text-[8px] text-slate-400">COBOS POS &bull; Verified Transaction</p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-3 bg-slate-800/90 border-t border-slate-700 grid grid-cols-3 gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-xs transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
