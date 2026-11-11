import Dexie, { type Table } from 'dexie';
import type {
  User,
  BusinessProfile,
  Account,
  JournalEntry,
  FinancialTransaction,
  Product,
  StockMovement,
  Sale,
  Customer,
  CustomerPayment,
  Supplier,
  SupplierPurchase,
  SupplierPayment,
  CashAccount,
  CashReconciliation,
  SyncQueueItem,
  AuditLog,
} from '../types';

export class CobosDatabase extends Dexie {
  users!: Table<User, string>;
  businessProfiles!: Table<BusinessProfile, string>;
  accounts!: Table<Account, string>;
  journalEntries!: Table<JournalEntry, string>;
  transactions!: Table<FinancialTransaction, string>;
  products!: Table<Product, string>;
  stockMovements!: Table<StockMovement, string>;
  sales!: Table<Sale, string>;
  customers!: Table<Customer, string>;
  customerPayments!: Table<CustomerPayment, string>;
  suppliers!: Table<Supplier, string>;
  supplierPurchases!: Table<SupplierPurchase, string>;
  supplierPayments!: Table<SupplierPayment, string>;
  cashAccounts!: Table<CashAccount, string>;
  cashReconciliations!: Table<CashReconciliation, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('cobos_offline_db');

    this.version(2).stores({
      users: 'id, email, phone, role',
      businessProfiles: 'id',
      accounts: 'id, code, type, currency',
      journalEntries: 'id, date, reference, sourceType, isReversed',
      transactions: 'id, date, type, currency, category, paymentMethod, accountId, syncStatus, isReversed',
      products: 'id, sku, barcode, category, currency, currentStock, syncStatus',
      stockMovements: 'id, productId, type, date, reference',
      sales: 'id, receiptNumber, date, customerId, currency, isCredit, syncStatus',
      customers: 'id, name, phone',
      customerPayments: 'id, customerId, date, currency, syncStatus',
      suppliers: 'id, name, phone',
      supplierPurchases: 'id, supplierId, date, currency, isCredit, syncStatus',
      supplierPayments: 'id, supplierId, date, currency, syncStatus',
      cashAccounts: 'id, type, currency, isDefault',
      cashReconciliations: 'id, accountId, date',
      syncQueue: 'id, entityType, status, timestamp, retryCount',
      auditLogs: 'id, entity, action, timestamp',
    });
  }
}

export const db = new CobosDatabase();

// Clean Standard Chart of Accounts Foundation for Double-Entry Bookkeeping
export const DEFAULT_CHART_OF_ACCOUNTS: Account[] = [
  // Assets
  { id: 'acc_cash_usd', code: '1001', name: 'Cash in Hand (USD)', type: 'asset', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_cash_zig', code: '1002', name: 'Cash in Hand (ZiG)', type: 'asset', currency: 'ZiG', balance: 0, isSystem: true },
  { id: 'acc_ecocash_zig', code: '1010', name: 'EcoCash Mobile Money (ZiG)', type: 'asset', currency: 'ZiG', balance: 0, isSystem: true },
  { id: 'acc_bank_usd', code: '1020', name: 'Bank Clearing (USD)', type: 'asset', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_ar_usd', code: '1201', name: 'Accounts Receivable (USD)', type: 'asset', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_ar_zig', code: '1202', name: 'Accounts Receivable (ZiG)', type: 'asset', currency: 'ZiG', balance: 0, isSystem: true },
  { id: 'acc_inventory_usd', code: '1301', name: 'Merchandise Inventory (USD)', type: 'asset', currency: 'USD', balance: 0, isSystem: true },

  // Liabilities
  { id: 'acc_ap_usd', code: '2001', name: 'Accounts Payable (USD)', type: 'liability', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_ap_zig', code: '2002', name: 'Accounts Payable (ZiG)', type: 'liability', currency: 'ZiG', balance: 0, isSystem: true },
  { id: 'acc_tax_payable', code: '2100', name: 'Sales Tax Payable', type: 'liability', currency: 'USD', balance: 0, isSystem: true },

  // Equity
  { id: 'acc_equity_capital', code: '3000', name: "Owner's Capital", type: 'equity', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_retained_earnings', code: '3100', name: 'Retained Earnings', type: 'equity', currency: 'USD', balance: 0, isSystem: true },

  // Revenue
  { id: 'acc_sales_rev_usd', code: '4001', name: 'Sales Revenue (USD)', type: 'revenue', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_sales_rev_zig', code: '4002', name: 'Sales Revenue (ZiG)', type: 'revenue', currency: 'ZiG', balance: 0, isSystem: true },
  { id: 'acc_other_income', code: '4200', name: 'Other Income', type: 'revenue', currency: 'USD', balance: 0, isSystem: true },

  // Cost of Goods Sold
  { id: 'acc_cogs_usd', code: '5001', name: 'Cost of Goods Sold (USD)', type: 'cogs', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_cogs_zig', code: '5002', name: 'Cost of Goods Sold (ZiG)', type: 'cogs', currency: 'ZiG', balance: 0, isSystem: true },

  // Operating Expenses
  { id: 'acc_exp_rent', code: '6010', name: 'Store Rent Expense', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_exp_salaries', code: '6020', name: 'Salaries & Wages', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_exp_utilities', code: '6030', name: 'Electricity & Water (ZESA)', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_exp_transport', code: '6040', name: 'Transport & Fuel', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_exp_marketing', code: '6050', name: 'Marketing & Promotions', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_exp_repairs', code: '6060', name: 'Repairs & Maintenance', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_exp_bank_charges', code: '6070', name: 'Transaction & Mobile Charges', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
  { id: 'acc_exp_misc', code: '6090', name: 'Miscellaneous Expenses', type: 'expense', currency: 'USD', balance: 0, isSystem: true },
];

export const DEFAULT_CASH_ACCOUNTS: CashAccount[] = [
  { id: 'cash_usd_drawer', name: 'Main Till Cash (USD)', type: 'physical_cash', currency: 'USD', balance: 0, isDefault: true },
  { id: 'cash_zig_drawer', name: 'Main Till Cash (ZiG)', type: 'physical_cash', currency: 'ZiG', balance: 0, isDefault: true },
  { id: 'cash_ecocash_merchant', name: 'EcoCash Merchant (ZiG)', type: 'mobile_money', currency: 'ZiG', balance: 0, accountNumber: '0772 824 132' },
  { id: 'cash_bank_usd', name: 'Business Bank Account (USD)', type: 'bank', currency: 'USD', balance: 0, accountNumber: '91400034821' },
];

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  id: 'org_default',
  name: 'Comfort Enterprises',
  tagline: 'Know Your Money. Control Your Business. Grow With Confidence.',
  category: 'Commercial Wholesale, Retail & Services',
  country: 'Zimbabwe',
  city: 'Harare',
  address: 'CBD Commercial Centre, Harare',
  phone: '+263 77 282 4132',
  email: 'comfort.designszw@gmail.com',
  taxNumber: 'BP200-984712-ZW',
  defaultCurrency: 'USD',
  supportedCurrencies: ['USD', 'ZiG', 'ZAR'],
  exchangeRates: {
    USD: 1.0,
    ZiG: 28.5,
    ZAR: 18.2,
  },
  receiptFooter: 'Thank you for choosing Comfort Enterprises. Please retain this receipt for warranty and returns.',
};

/**
 * Initializes the clean database structure without fake demo transactions
 */
export async function initializeDatabase(forceReset = false) {
  const profileCount = await db.businessProfiles.count();
  if (profileCount === 0 || forceReset) {
    if (forceReset) {
      await db.businessProfiles.clear();
      await db.accounts.clear();
      await db.journalEntries.clear();
      await db.transactions.clear();
      await db.products.clear();
      await db.stockMovements.clear();
      await db.sales.clear();
      await db.customers.clear();
      await db.customerPayments.clear();
      await db.suppliers.clear();
      await db.supplierPurchases.clear();
      await db.supplierPayments.clear();
      await db.cashAccounts.clear();
      await db.cashReconciliations.clear();
      await db.syncQueue.clear();
      await db.auditLogs.clear();
    }

    // Save profile and clean chart of accounts
    await db.businessProfiles.put(DEFAULT_BUSINESS_PROFILE);
    await db.accounts.bulkPut(DEFAULT_CHART_OF_ACCOUNTS);
    await db.cashAccounts.bulkPut(DEFAULT_CASH_ACCOUNTS);

    // Initial Clean Audit Log
    await db.auditLogs.put({
      id: 'log_init',
      action: 'SYSTEM_INITIALIZATION',
      entity: 'DATABASE',
      entityId: 'cobos_db',
      performedBy: 'Admin (Comfort Ncube)',
      details: 'Comfort Business Operational System database initialized ready for production transactions.',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Clean all user data tables while keeping the structural chart of accounts and business profile
 */
export async function clearAllUserData(): Promise<void> {
  await db.journalEntries.clear();
  await db.transactions.clear();
  await db.sales.clear();
  await db.products.clear();
  await db.stockMovements.clear();
  await db.customers.clear();
  await db.customerPayments.clear();
  await db.suppliers.clear();
  await db.supplierPurchases.clear();
  await db.supplierPayments.clear();
  await db.syncQueue.clear();
  await db.cashReconciliations.clear();

  // Reset account balances to 0
  const accounts = await db.accounts.toArray();
  for (const acc of accounts) {
    await db.accounts.update(acc.id, { balance: 0 });
  }

  const cashAccounts = await db.cashAccounts.toArray();
  for (const cAcc of cashAccounts) {
    await db.cashAccounts.update(cAcc.id, { balance: 0 });
  }

  await db.auditLogs.put({
    id: 'log_clear_' + Date.now(),
    action: 'DATA_CLEARED',
    entity: 'ALL_MODULES',
    entityId: 'system',
    performedBy: 'Admin (Comfort Ncube)',
    details: 'All operational records cleared. System reset to fresh clean operational state.',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Backup entire database to JSON string
 */
export async function exportDatabaseBackup(): Promise<string> {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    businessProfiles: await db.businessProfiles.toArray(),
    accounts: await db.accounts.toArray(),
    journalEntries: await db.journalEntries.toArray(),
    transactions: await db.transactions.toArray(),
    products: await db.products.toArray(),
    stockMovements: await db.stockMovements.toArray(),
    sales: await db.sales.toArray(),
    customers: await db.customers.toArray(),
    customerPayments: await db.customerPayments.toArray(),
    suppliers: await db.suppliers.toArray(),
    supplierPurchases: await db.supplierPurchases.toArray(),
    supplierPayments: await db.supplierPayments.toArray(),
    cashAccounts: await db.cashAccounts.toArray(),
    cashReconciliations: await db.cashReconciliations.toArray(),
    syncQueue: await db.syncQueue.toArray(),
    auditLogs: await db.auditLogs.toArray(),
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Restore database from JSON backup
 */
export async function importDatabaseBackup(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.businessProfiles || !data.accounts) {
      throw new Error('Invalid COBOS backup format');
    }

    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }

      if (data.businessProfiles) await db.businessProfiles.bulkPut(data.businessProfiles);
      if (data.accounts) await db.accounts.bulkPut(data.accounts);
      if (data.journalEntries) await db.journalEntries.bulkPut(data.journalEntries);
      if (data.transactions) await db.transactions.bulkPut(data.transactions);
      if (data.products) await db.products.bulkPut(data.products);
      if (data.stockMovements) await db.stockMovements.bulkPut(data.stockMovements);
      if (data.sales) await db.sales.bulkPut(data.sales);
      if (data.customers) await db.customers.bulkPut(data.customers);
      if (data.customerPayments) await db.customerPayments.bulkPut(data.customerPayments);
      if (data.suppliers) await db.suppliers.bulkPut(data.suppliers);
      if (data.supplierPurchases) await db.supplierPurchases.bulkPut(data.supplierPurchases);
      if (data.supplierPayments) await db.supplierPayments.bulkPut(data.supplierPayments);
      if (data.cashAccounts) await db.cashAccounts.bulkPut(data.cashAccounts);
      if (data.cashReconciliations) await db.cashReconciliations.bulkPut(data.cashReconciliations);
      if (data.syncQueue) await db.syncQueue.bulkPut(data.syncQueue);
      if (data.auditLogs) await db.auditLogs.bulkPut(data.auditLogs);
    });

    return true;
  } catch (err) {
    console.error('Failed to import backup:', err);
    return false;
  }
}
