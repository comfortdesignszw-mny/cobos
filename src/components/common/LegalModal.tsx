import React from 'react';
import { X, ShieldCheck, FileText, CheckCircle } from 'lucide-react';

interface LegalModalProps {
  type: 'terms' | 'privacy' | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const isTerms = type === 'terms';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-200 space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {isTerms ? (
              <FileText className="w-5 h-5 text-cyan-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <h3 className="text-base font-bold text-white">
                {isTerms ? 'Terms of Service' : 'Privacy Policy'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Comfort Business Operational System (COBOS) • Effective 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-300 pr-2">
          {isTerms ? (
            <>
              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">1. Acceptance of Terms</h4>
                <p>
                  By accessing, installing, or using the Comfort Business Operational System (“COBOS”), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a business, company, or legal entity, you represent that you have the authority to bind such entity.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">2. Purpose & System Operation</h4>
                <p>
                  COBOS is an offline-first financial management, bookkeeping, point of sale (POS), multi-currency ledger, inventory management, and business operational system tailored for small and medium enterprises (SMEs). All financial entries are processed using standardized double-entry bookkeeping rules.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">3. Multi-Currency Operations</h4>
                <p>
                  COBOS provides strict multi-currency isolation supporting United States Dollars (USD), Zimbabwe Gold (ZiG), and South African Rand (ZAR). Exchange rates set within your business configuration are applied at your discretion. The business owner retains sole responsibility for verifying statutory currency compliance and tax filings.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">4. Offline Storage & Cloud Synchronization</h4>
                <p>
                  COBOS operates offline by storing transaction data in your device’s local IndexedDB storage. When an active internet connection is detected, data is synchronized with your Cloudflare D1 cloud database. Users are encouraged to utilize the built-in database backup export feature periodically.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">5. User Accounts & Security</h4>
                <p>
                  Access to COBOS is managed through role-based access control (Admin, Manager, Accountant, Cashier, Inventory Manager). Administrators are responsible for maintaining the confidentiality of their credentials and monitoring staff actions recorded in the immutable audit log.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">6. Limitation of Liability</h4>
                <p>
                  COBOS and Comfort Designs provide the software on an “as is” and “as available” basis without warranty of any kind. In no event shall the authors or copyright holders be liable for any financial claim, damages, or business losses arising from the use of this operational platform.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">1. Information We Collect</h4>
                <p>
                  COBOS collects only the essential business information necessary to operate your point of sale and accounting engine:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-2">
                  <li>Business identity: Legal name, contact phone/WhatsApp, address, tax registration number.</li>
                  <li>User accounts: Full name, login email or normalized phone credentials (<code className="text-cyan-400">number@cobos.zw</code>), and system roles.</li>
                  <li>Operational data: Sales receipts, journal vouchers, inventory movements, customer balances, and supplier invoices.</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">2. Where Your Data Lives</h4>
                <p>
                  <strong>Offline-First Privacy:</strong> Your primary business records are stored locally on your device in secure IndexedDB storage. No third-party tracking scripts, advertising trackers, or telemetry analytics are deployed in the application.
                </p>
                <p>
                  <strong>Cloud Persistence:</strong> When synchronization is enabled, your data is securely transmitted over HTTPS to your dedicated Cloudflare D1 SQLite database instance.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">3. Customer & Debtor Privacy</h4>
                <p>
                  Customer names, phone numbers, and outstanding debts recorded in your receivables ledger remain strictly proprietary to your organization. They are never shared, rented, or monetized with external parties.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">4. Data Ownership & Portability</h4>
                <p>
                  You own 100% of your business data. You can export complete, unencrypted JSON snapshots of your entire database at any time from the Settings module for backup, migration, or external accounting audits.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-white text-sm">5. Contact & Data Controller</h4>
                <p>
                  For any privacy inquiries or technical questions regarding your COBOS installation, contact Comfort Designs at <a href="mailto:comfort.designszw@gmail.com" className="text-cyan-400 hover:underline">comfort.designszw@gmail.com</a> or via phone/WhatsApp at <span className="text-white font-mono">+263 77 282 4132</span>.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>GDPR & African SME Data Privacy Standard Compliant</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
