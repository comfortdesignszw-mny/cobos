-- ==============================================================================
-- COMFORT BUSINESS OPERATIONAL SYSTEM (COBOS)
-- Cloudflare D1 (SQLite) Production Cloud Database Schema
-- Run with: npx wrangler d1 execute <database_name> --file=./d1/schema.sql
-- ==============================================================================

-- 1. Organizations & Profiles
CREATE TABLE IF NOT EXISTS organisations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Zimbabwe',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_profiles (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    category TEXT,
    city TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    tax_number TEXT,
    default_currency TEXT DEFAULT 'USD',
    supported_currencies TEXT DEFAULT '["USD","ZiG","ZAR"]',
    usd_to_zig_rate REAL DEFAULT 28.50,
    usd_to_zar_rate REAL DEFAULT 18.20,
    receipt_footer TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);

-- 2. Users & Roles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'accountant', 'cashier', 'inventory_manager')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);

-- 3. Accounting & Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense')),
    currency TEXT NOT NULL DEFAULT 'USD',
    balance REAL DEFAULT 0.0,
    description TEXT,
    is_system INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    date TEXT NOT NULL,
    reference TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    description TEXT NOT NULL,
    lines_json TEXT NOT NULL, -- JSON array of debit/credit lines
    created_by TEXT NOT NULL,
    is_reversed INTEGER DEFAULT 0,
    reversed_by_entry_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    account_id TEXT NOT NULL,
    related_entity_id TEXT,
    related_entity_name TEXT,
    journal_entry_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    is_reversed INTEGER DEFAULT 0,
    reversal_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

-- 4. Products & Inventory
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT DEFAULT 'pcs',
    purchase_cost REAL NOT NULL DEFAULT 0.0,
    selling_price REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'USD',
    current_stock REAL NOT NULL DEFAULT 0.0,
    min_stock_level REAL NOT NULL DEFAULT 5.0,
    supplier_name TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity_delta REAL NOT NULL,
    stock_after REAL NOT NULL,
    unit_cost REAL DEFAULT 0.0,
    reference TEXT,
    notes TEXT,
    date TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 5. Point of Sale & Sales
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    receipt_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    items_json TEXT NOT NULL, -- JSON array of sale items
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0.0,
    tax REAL DEFAULT 0.0,
    total REAL NOT NULL,
    currency TEXT NOT NULL,
    payments_json TEXT NOT NULL, -- JSON array of split payment methods
    is_credit INTEGER DEFAULT 0,
    credit_balance_remaining REAL DEFAULT 0.0,
    cashier_id TEXT,
    cashier_name TEXT,
    journal_entry_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customers & Debt Receivables
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    notes TEXT,
    credit_limit REAL DEFAULT 0.0,
    outstanding_balance_usd REAL DEFAULT 0.0,
    outstanding_balance_zig REAL DEFAULT 0.0,
    outstanding_balance_zar REAL DEFAULT 0.0,
    last_payment_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    received_by TEXT NOT NULL,
    journal_entry_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 7. Suppliers & Payables
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    payment_terms TEXT,
    outstanding_balance_usd REAL DEFAULT 0.0,
    outstanding_balance_zig REAL DEFAULT 0.0,
    outstanding_balance_zar REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_purchases (
    id TEXT PRIMARY KEY,
    invoice_number TEXT,
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_amount REAL NOT NULL,
    currency TEXT NOT NULL,
    is_credit INTEGER DEFAULT 0,
    paid_amount REAL DEFAULT 0.0,
    items_summary TEXT,
    received_by TEXT NOT NULL,
    journal_entry_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS supplier_payments (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    paid_by TEXT NOT NULL,
    journal_entry_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- 8. Cash Accounts & Reconciliations
CREATE TABLE IF NOT EXISTS cash_accounts (
    id TEXT PRIMARY KEY,
    organisation_id TEXT NOT NULL DEFAULT 'org_default',
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    currency TEXT NOT NULL,
    balance REAL DEFAULT 0.0,
    account_number TEXT,
    is_default INTEGER DEFAULT 0
);

-- 9. Sync & Audit Trail
CREATE TABLE IF NOT EXISTS sync_audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast mobile queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON financial_transactions(date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
