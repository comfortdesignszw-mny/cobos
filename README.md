# Comfort Business Operational System (COBOS)
> **"Know Your Money. Control Your Business. Grow With Confidence."**

**COBOS** is a professional, lightweight, 100% offline-first Progressive Web Application (PWA) designed for small and medium enterprises (SMEs), retailers, wholesalers, informal traders, and service businesses in Zimbabwe and broader African markets.

---

## 🌟 Key Architecture Highlights

1. **Cold-Start 100% Offline-First**:
   - Zero HTTPS handshake required to boot or operate.
   - Built on **Dexie.js** (IndexedDB) with local transaction queues.
   - Works reliably on low-end Android smartphones, older tablets, and desktop computers with intermittent or zero internet connectivity.

2. **Unified Financial Accounting Engine**:
   - POS, inventory, customer receivables, supplier payables, and cash drawers are **NOT** isolated silos.
   - Every single financial event feeds the **central double-entry journal engine** (Assets, Liabilities, Equity, Revenue, COGS, Expenses).
   - Immutable transaction ledger: No silent overwriting or deletions. Corrections produce balanced, auditable reversal entries.

3. **Clerk Authentication & Phone-to-Email Credential Mapping**:
   - Integrated with Clerk authentication supporting **Google 1-Tap Social Sign-In**, **Email & Password**, and **Phone & Password**.
   - **Phone-to-Email Conversion**: Users can register and sign in using their raw phone number (e.g. `077 212 3456` or `+263 77 212 3456`). In the database and Clerk credentials, the number is cleanly normalized to `{number}@cobos.zw`. The user can authenticate with either their phone or their email address.

4. **Strict Multi-Currency Separation (USD, ZiG, ZAR)**:
   - Independent currency tracking for the Zimbabwean economic reality (USD, Zimbabwe Gold [ZiG], and South African Rand [ZAR]).
   - Never artificially combines currencies into a single distorted total without explicit exchange transactions.

5. **Cloudflare Pages & D1 SQLite Cloud Sync**:
   - Edge-native synchronization with **Cloudflare Pages Functions** and **Cloudflare D1 (SQLite)**.
   - Local sync queue automatically detects network availability and atomically flushes transactions to D1 via `/api/sync`.

6. **Customer WhatsApp Integration**:
   - Instant WhatsApp reminders with pre-filled debt statements and direct deeplinks (`wa.me`).
   - Digital, thermal (58mm/80mm), and printable receipts.

---

## 🚀 7 Integrated Business Modules

| Module | Core Capabilities |
|---|---|
| **1. Digital Bookkeeping** | Income & expense tracking, immutable central ledger, traceable reversals, Chart of Accounts. |
| **2. Point of Sale (POS)** | Barcode search, product categories, split payments (Cash, EcoCash, Bank, Card), credit sales, receipt generator. |
| **3. Inventory Management** | SKU & barcode catalog, low-stock & out-of-stock alerts, stock additions/damages/audits, weighted cost valuation. |
| **4. Customer Receivables** | Customer profiles, credit limits, debt ageing, settlements, 1-tap WhatsApp payment reminders, statement generator. |
| **5. Supplier Payables** | Supplier directory, stock purchase invoices on credit or cash, payment disbursements. |
| **6. Cash-Flow Monitoring** | Multi-account cash management (Till USD, Till ZiG, EcoCash Merchant, Bank), inter-account transfers, statement reconciliation. |
| **7. Reporting & Analytics** | Income Statement (P&L), Balance Sheet, Sales logs, Inventory valuation, CSV & print exports, automatic business insights. |

---

## 📦 Cloudflare Pages & D1 Deployment Guide

This repository is ready to be pushed to GitHub and deployed straight to Cloudflare Pages.

### 1. Store Source Code in GitHub

```bash
git init
git add .
git commit -m "feat: initial commit of COBOS offline-first PWA"
git branch -M main
git remote add origin https://github.com/<your-username>/cobos-operational-system.git
git push -u origin main
```

### 2. Set Up Cloudflare D1 (SQLite Database)

Ensure you have the Cloudflare Wrangler CLI installed:

```bash
npm install -g wrangler
wrangler login
```

Create your D1 database:

```bash
npx wrangler d1 create cobos-db
```

Wrangler will output your database ID. Update `wrangler.jsonc` with this ID:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "cobos-db",
    "database_id": "<your-database-id-here>"
  }
]
```

Execute the database schema migration to provision all tables and indexes:

```bash
# For local preview:
npx wrangler d1 execute cobos-db --local --file=./d1/schema.sql

# For production cloud database:
npx wrangler d1 execute cobos-db --remote --file=./d1/schema.sql
```

### 3. Deploy to Cloudflare Pages

Build the production frontend bundle:

```bash
npm run build
```

Deploy straight to Cloudflare Pages:

```bash
npx wrangler pages deploy dist
```

Or connect your GitHub repository directly in the **Cloudflare Dashboard > Workers & Pages > Create Application > Pages > Connect to Git**:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **D1 Database Binding**: Variable Name `DB`, Database `cobos-db`.

---

## 📱 Progressive Web App (PWA) Installation

- **Android / Chrome / Desktop**: Tap the in-app **"Install App"** button in the header, or browser menu > "Add to Home screen".
- **iOS (iPhone/iPad)**: Tap Safari's **Share** icon > Scroll down > Tap **"Add to Home Screen"**.
- **Cold Start**: Once installed, you can turn on Airplane mode and open COBOS. The application will launch instantly and record sales and transactions without any network dependency.

---

## 🛡️ Role-Based Access Control (RBAC & RLS)

COBOS includes configurable role-level permissions:
- **Owner / Administrator**: Full access to all modules, confidential profit & loss reports, and transaction reversals.
- **Manager**: Operations, sales, expenses, and inventory controls.
- **Accountant**: Double-entry general ledgers, journals, reconciliations, and financial statements.
- **Cashier**: High-speed POS sales, customer lookup, and receipt generation. Restricted from deleting or viewing profit margins.
- **Inventory Manager**: Catalog, physical stock movements, and low-stock alerts.

Switch roles directly from the header dropdown to test role-level permissions.

---

## 📄 License
Apache-2.0
