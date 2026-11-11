/**
 * Comfort Business Operational System (COBOS)
 * Core Domain Models & Accounting Types
 */

export type CurrencyCode = 'USD' | 'ZiG' | 'ZAR';

/**
 * Enhanced RBAC Roles:
 * - super_admin: Munyaradzi Muchineripi (comfort.designszw@gmail.com) - overseas all companies, accounts, subscription upgrades, system audits.
 * - company_admin / manager: Controls company account, manages staff, approves reversals, oversees inventory.
 * - accountant: Double-entry ledgers, financial statements, bank/cash reconciliation.
 * - cashier: Point of sale, record sales & expenses, add inventory, view ONLY their own transactions (cannot edit/reverse without manager approval).
 * - inventory_manager: Stock additions, audits, supplier invoices.
 */
export type UserRole = 
  | 'super_admin' 
  | 'owner' 
  | 'manager' 
  | 'accountant' 
  | 'cashier' 
  | 'inventory_manager';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  organisationId: string;
  authProvider?: 'clerk_google' | 'clerk_email' | 'clerk_phone';
  avatarUrl?: string;
  pinHash?: string;
  passwordHash?: string;
  subscriptionPlan?: 'standard' | 'professional' | 'enterprise';
  createdAt?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  tagline: string;
  category: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  taxNumber?: string;
  logoUrl?: string;
  subscriptionPlan?: 'standard' | 'professional' | 'enterprise';
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  exchangeRates: {
    // Rates relative to 1 USD
    USD: number;
    ZiG: number;
    ZAR: number;
  };
  receiptFooter: string;
}

// Accounting & Chart of Accounts
export type AccountType = 
  | 'asset' 
  | 'liability' 
  | 'equity' 
  | 'revenue' 
  | 'cogs' 
  | 'expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  balance: number;
  description?: string;
  isSystem?: boolean;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  currency: CurrencyCode;
  description?: string;
}

export interface JournalEntry {
  id: string;
  organisationId: string;
  date: string; // ISO
  reference: string; // e.g. SALE-2026-001
  sourceType: 'sale' | 'expense' | 'credit_sale' | 'customer_payment' | 'purchase' | 'supplier_payment' | 'transfer' | 'reversal';
  sourceId: string;
  description: string;
  lines: JournalEntryLine[];
  createdBy: string;
  createdById?: string;
  createdAt: string;
  isReversed?: boolean;
  reversedByEntryId?: string;
}

export type TransactionType = 
  | 'income' 
  | 'expense' 
  | 'sale' 
  | 'sale_credit' 
  | 'customer_payment' 
  | 'purchase' 
  | 'purchase_credit' 
  | 'supplier_payment' 
  | 'transfer' 
  | 'reversal';

export interface FinancialTransaction {
  id: string;
  organisationId: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: 'cash' | 'ecocash' | 'bank' | 'card' | 'credit';
  accountId: string;
  relatedEntityId?: string; // customerId or supplierId
  relatedEntityName?: string;
  journalEntryId: string;
  createdBy: string;
  createdById?: string;
  createdAt: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  isReversed?: boolean;
  reversalReason?: string;
}

// POS & Sales
export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  total: number;
  currency: CurrencyCode;
  itemType?: 'product' | 'service';
  imageUrl?: string;
}

export interface SalePayment {
  method: 'cash' | 'ecocash' | 'bank' | 'card' | 'credit';
  amount: number;
  currency: CurrencyCode;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  date: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: CurrencyCode;
  payments: SalePayment[];
  isCredit: boolean;
  creditBalanceRemaining: number;
  cashierId: string;
  cashierName: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  journalEntryId: string;
  createdAt: string;
}

// Inventory: Product vs Service
export type InventoryItemType = 'product' | 'service';

export interface Product {
  id: string;
  itemType: InventoryItemType; // 'product' (physical stock tracked) or 'service' (unlimited/labour/consulting)
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  unit: string; // 'pcs', 'kg', 'box', 'hours', 'sessions'
  purchaseCost: number;
  sellingPrice: number;
  currency: CurrencyCode;
  currentStock: number;
  minStockLevel: number;
  supplierId?: string;
  supplierName?: string;
  imageUrl?: string; // compressed WebP/JPEG data URL or Cloudflare URL
  updatedAt: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

export type StockMovementType = 'purchase' | 'sale' | 'addition' | 'reduction' | 'damage' | 'return' | 'audit_adjustment';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantityDelta: number;
  stockAfter: number;
  unitCost: number;
  reference: string;
  notes?: string;
  date: string;
  performedBy: string;
  createdAt: string;
}

// Customers & Receivables
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  avatarUrl?: string;
  creditLimit: number;
  outstandingBalanceUSD: number;
  outstandingBalanceZiG: number;
  outstandingBalanceZAR: number;
  lastPaymentDate?: string;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  saleId?: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: 'cash' | 'ecocash' | 'bank' | 'card';
  date: string;
  notes?: string;
  receivedBy: string;
  journalEntryId: string;
  createdAt: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

// Suppliers & Payables
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  paymentTerms?: string;
  outstandingBalanceUSD: number;
  outstandingBalanceZiG: number;
  outstandingBalanceZAR: number;
  createdAt: string;
}

export interface SupplierPurchase {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  totalAmount: number;
  currency: CurrencyCode;
  isCredit: boolean;
  paidAmount: number;
  paymentMethod?: 'cash' | 'ecocash' | 'bank' | 'card';
  itemsSummary: string;
  receivedBy: string;
  journalEntryId: string;
  createdAt: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseId?: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: 'cash' | 'ecocash' | 'bank' | 'card';
  date: string;
  notes?: string;
  paidBy: string;
  journalEntryId: string;
  createdAt: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

// Cash Management & Accounts
export interface CashAccount {
  id: string;
  name: string;
  type: 'physical_cash' | 'mobile_money' | 'bank';
  currency: CurrencyCode;
  balance: number;
  accountNumber?: string;
  isDefault?: boolean;
}

export interface CashReconciliation {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  systemBalance: number;
  actualCountedBalance: number;
  difference: number;
  currency: CurrencyCode;
  notes?: string;
  checkedBy: string;
  createdAt: string;
}

// Offline Sync Queue
export interface SyncQueueItem {
  id: string;
  entityType: 'sale' | 'transaction' | 'product' | 'customer' | 'customer_payment' | 'supplier' | 'supplier_payment' | 'stock_movement' | 'journal_entry' | 'business_profile' | 'user';
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string; // JSON
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed' | 'synced';
  errorMessage?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  performedBy: string;
  details: string;
  timestamp: string;
}
