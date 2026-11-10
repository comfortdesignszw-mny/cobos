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

// Default Chart of Accounts Template
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
  { id: 'cash_ecocash_merchant', name: 'EcoCash Merchant (ZiG)', type: 'mobile_money', currency: 'ZiG', balance: 0, accountNumber: '0772 123 456' },
  { id: 'cash_stanbic_usd', name: 'Stanbic Bank USD Nostro', type: 'bank', currency: 'USD', balance: 0, accountNumber: '91400034821' },
];

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  id: 'org_default',
  name: 'Comfort Enterprises & Wholesale',
  tagline: 'Know Your Money. Control Your Business. Grow With Confidence.',
  category: 'Wholesale & Retail Groceries / Hardware',
  country: 'Zimbabwe',
  city: 'Harare',
  address: 'Shop 14, Kwame Nkrumah Ave / 4th Street, Harare CBD',
  phone: '+263 77 212 3456',
  email: 'comfort.designszw@gmail.com',
  taxNumber: 'BP200-984712-ZW',
  defaultCurrency: 'USD',
  supportedCurrencies: ['USD', 'ZiG', 'ZAR'],
  exchangeRates: {
    USD: 1.0,
    ZiG: 28.5, // 1 USD = 28.50 ZiG
    ZAR: 18.2, // 1 USD = 18.20 ZAR
  },
  receiptFooter: 'Thank you for shopping with Comfort Enterprises! Goods once sold cannot be returned without original receipt.',
};

/**
 * Initializes the database and seeds realistic demo data if empty
 */
export async function initializeDatabase(forceSeed = false) {
  const profileCount = await db.businessProfiles.count();
  if (profileCount === 0 || forceSeed) {
    if (forceSeed) {
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

    // Save profile and base setup
    await db.businessProfiles.put(DEFAULT_BUSINESS_PROFILE);
    await db.accounts.bulkPut(DEFAULT_CHART_OF_ACCOUNTS);
    await db.cashAccounts.bulkPut(DEFAULT_CASH_ACCOUNTS);

    // Realistic Demo Products (Zimbabwe SME Essentials)
    const demoProducts: Product[] = [
      {
        id: 'prod_mazoe_2l',
        sku: 'GRO-001',
        barcode: '6001234567891',
        name: 'Mazoe Orange Crush 2 Litres',
        category: 'Beverages',
        unit: 'bottles',
        purchaseCost: 2.80,
        sellingPrice: 3.50,
        currency: 'USD',
        currentStock: 48,
        minStockLevel: 12,
        supplierName: 'Schweppes Zimbabwe',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
      {
        id: 'prod_roller_meal_10kg',
        sku: 'GRO-002',
        barcode: '6001234567892',
        name: 'Red Seal Roller Meal 10kg',
        category: 'Food Staples',
        unit: 'bags',
        purchaseCost: 5.50,
        sellingPrice: 6.80,
        currency: 'USD',
        currentStock: 35,
        minStockLevel: 10,
        supplierName: 'National Foods Zimbabwe',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
      {
        id: 'prod_cooking_oil_2l',
        sku: 'GRO-003',
        barcode: '6001234567893',
        name: 'Pure Drop Cooking Oil 2L',
        category: 'Food Staples',
        unit: 'bottles',
        purchaseCost: 3.10,
        sellingPrice: 4.20,
        currency: 'USD',
        currentStock: 22,
        minStockLevel: 8,
        supplierName: 'Surface Wilmar',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
      {
        id: 'prod_sugar_2kg',
        sku: 'GRO-004',
        barcode: '6001234567894',
        name: 'Gold Star White Sugar 2kg',
        category: 'Food Staples',
        unit: 'packets',
        purchaseCost: 2.20,
        sellingPrice: 2.80,
        currency: 'USD',
        currentStock: 60,
        minStockLevel: 15,
        supplierName: 'Star Africa Corp',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
      {
        id: 'prod_bread_loaf',
        sku: 'BAK-001',
        barcode: '6001234567895',
        name: 'Lobels Fresh White Bread',
        category: 'Bakery',
        unit: 'loaves',
        purchaseCost: 24.00,
        sellingPrice: 28.50,
        currency: 'ZiG',
        currentStock: 40,
        minStockLevel: 10,
        supplierName: 'Lobels Bakery',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
      {
        id: 'prod_solar_lantern',
        sku: 'ELC-101',
        barcode: '6001234567896',
        name: 'Rechargeable Solar LED Lantern',
        category: 'Electronics',
        unit: 'pcs',
        purchaseCost: 8.50,
        sellingPrice: 14.00,
        currency: 'USD',
        currentStock: 14,
        minStockLevel: 5,
        supplierName: 'Shenzhen Direct Imports',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
      {
        id: 'prod_type_c_cable',
        sku: 'ELC-102',
        barcode: '6001234567897',
        name: 'Fast Charging USB-C Cable 2M',
        category: 'Electronics',
        unit: 'pcs',
        purchaseCost: 1.10,
        sellingPrice: 3.00,
        currency: 'USD',
        currentStock: 6,
        minStockLevel: 8, // Triggers low stock alert
        supplierName: 'Shenzhen Direct Imports',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
      {
        id: 'prod_cement_50kg',
        sku: 'HDW-201',
        barcode: '6001234567898',
        name: 'PPC Surebuild Cement 50kg (PC 32.5)',
        category: 'Hardware',
        unit: 'bags',
        purchaseCost: 10.20,
        sellingPrice: 12.50,
        currency: 'USD',
        currentStock: 4, // Low stock
        minStockLevel: 10,
        supplierName: 'PPC Zimbabwe Ltd',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      },
    ];
    await db.products.bulkPut(demoProducts);

    // Realistic Demo Customers
    const demoCustomers: Customer[] = [
      {
        id: 'cust_tendai_m',
        name: 'Tendai Moyo',
        phone: '+263773123456',
        email: 'tendai.moyo@gmail.com',
        address: 'Stand 402, Highfield, Harare',
        creditLimit: 250,
        outstandingBalanceUSD: 85.00,
        outstandingBalanceZiG: 0,
        outstandingBalanceZAR: 0,
        notes: 'Grocery store reseller, pays on Fridays',
        lastPaymentDate: '2026-11-02',
        createdAt: '2026-10-15T09:00:00Z',
      },
      {
        id: 'cust_sarah_k',
        name: 'Sarah Katsande (Catering)',
        phone: '+263712987654',
        email: 'sarah.katsande@weddings.co.zw',
        address: 'Avondale West, Harare',
        creditLimit: 500,
        outstandingBalanceUSD: 140.00,
        outstandingBalanceZiG: 350.00,
        outstandingBalanceZAR: 0,
        notes: 'Regular event planner, 30 days overdue for 140 USD invoice',
        lastPaymentDate: '2026-10-10',
        createdAt: '2026-09-01T10:00:00Z',
      },
      {
        id: 'cust_blessing_c',
        name: 'Blessing Chiwenga',
        phone: '+263778445566',
        email: 'b.chiwenga@outlook.com',
        address: 'Chitungwiza Unit C',
        creditLimit: 150,
        outstandingBalanceUSD: 0,
        outstandingBalanceZiG: 0,
        outstandingBalanceZAR: 0,
        notes: 'Always pays cash/EcoCash on delivery',
        createdAt: '2026-10-20T11:00:00Z',
      },
    ];
    await db.customers.bulkPut(demoCustomers);

    // Realistic Demo Suppliers
    const demoSuppliers: Supplier[] = [
      {
        id: 'supp_natfoods',
        name: 'National Foods Zimbabwe',
        contactPerson: 'Farai Dube (Wholesale Sales)',
        phone: '+263242753883',
        email: 'orders@natfoods.co.zw',
        address: '10 Stirling Road, Workington, Harare',
        paymentTerms: 'Net 14 Days',
        outstandingBalanceUSD: 240.00,
        outstandingBalanceZiG: 0,
        outstandingBalanceZAR: 0,
        createdAt: '2026-09-01T08:00:00Z',
      },
      {
        id: 'supp_schweppes',
        name: 'Schweppes Zimbabwe Ltd',
        contactPerson: 'Rutendo Mataruse',
        phone: '+263242620701',
        email: 'sales@schweppes.co.zw',
        address: 'Barrow Road, Southerton, Harare',
        paymentTerms: 'Cash on Delivery or 7 Days',
        outstandingBalanceUSD: 95.00,
        outstandingBalanceZiG: 0,
        outstandingBalanceZAR: 0,
        createdAt: '2026-09-01T08:00:00Z',
      },
      {
        id: 'supp_lobels',
        name: 'Lobels Bread Bakery',
        contactPerson: 'Patrick Zizhou',
        phone: '+263242621121',
        email: 'dispatch@lobels.co.zw',
        address: 'Highfield Road, Southerton, Harare',
        paymentTerms: 'Daily Cash or EcoCash',
        outstandingBalanceUSD: 0,
        outstandingBalanceZiG: 450.00,
        outstandingBalanceZAR: 0,
        createdAt: '2026-10-01T07:00:00Z',
      },
    ];
    await db.suppliers.bulkPut(demoSuppliers);

    // Seed Initial Financial Foundation & Journal Entries
    // 1. Initial Capital Injection
    const initialDate = '2026-11-01';
    const journalEntry1: JournalEntry = {
      id: 'je_init_capital',
      organisationId: 'org_default',
      date: initialDate,
      reference: 'CAP-2026-001',
      sourceType: 'transfer',
      sourceId: 'init',
      description: "Owner's Opening Working Capital Injection",
      lines: [
        { id: 'jel_1', accountId: 'acc_cash_usd', accountName: 'Cash in Hand (USD)', debit: 1200, credit: 0, currency: 'USD' },
        { id: 'jel_2', accountId: 'acc_cash_zig', accountName: 'Cash in Hand (ZiG)', debit: 8500, credit: 0, currency: 'ZiG' },
        { id: 'jel_3', accountId: 'acc_equity_capital', accountName: "Owner's Capital", debit: 0, credit: 1200, currency: 'USD' },
        { id: 'jel_4', accountId: 'acc_equity_capital', accountName: "Owner's Capital", debit: 0, credit: 8500, currency: 'ZiG' },
      ],
      createdBy: 'Comfort Ncube (Owner)',
      createdAt: '2026-11-01T08:00:00Z',
    };
    await db.journalEntries.put(journalEntry1);

    // Update account balances
    await db.accounts.update('acc_cash_usd', { balance: 1200 });
    await db.accounts.update('acc_cash_zig', { balance: 8500 });
    await db.accounts.update('acc_equity_capital', { balance: 1200 });
    await db.cashAccounts.update('cash_usd_drawer', { balance: 1200 });
    await db.cashAccounts.update('cash_zig_drawer', { balance: 8500 });

    // 2. Demo Operating Expense: Shop Rent Paid
    const journalEntry2: JournalEntry = {
      id: 'je_rent_nov',
      organisationId: 'org_default',
      date: '2026-11-03',
      reference: 'EXP-2026-001',
      sourceType: 'expense',
      sourceId: 'tx_rent_nov',
      description: 'November 2026 Shop Rent - Kwame Nkrumah CBD Store',
      lines: [
        { id: 'jel_5', accountId: 'acc_exp_rent', accountName: 'Store Rent Expense', debit: 250, credit: 0, currency: 'USD' },
        { id: 'jel_6', accountId: 'acc_cash_usd', accountName: 'Cash in Hand (USD)', debit: 0, credit: 250, currency: 'USD' },
      ],
      createdBy: 'Comfort Ncube (Owner)',
      createdAt: '2026-11-03T10:00:00Z',
    };
    await db.journalEntries.put(journalEntry2);

    const rentTx: FinancialTransaction = {
      id: 'tx_rent_nov',
      organisationId: 'org_default',
      date: '2026-11-03',
      type: 'expense',
      category: 'Rent',
      description: 'November 2026 Shop Rent - Kwame Nkrumah CBD Store',
      amount: 250,
      currency: 'USD',
      paymentMethod: 'cash',
      accountId: 'acc_cash_usd',
      journalEntryId: 'je_rent_nov',
      createdBy: 'Comfort Ncube (Owner)',
      createdAt: '2026-11-03T10:00:00Z',
      syncStatus: 'synced',
    };
    await db.transactions.put(rentTx);

    // 3. Demo Cash Sale
    const saleDate = '2026-11-09';
    const demoSale: Sale = {
      id: 'sale_1001',
      receiptNumber: 'REC-2026-1001',
      date: saleDate,
      customerId: undefined,
      customerName: 'Walk-in Customer',
      items: [
        { productId: 'prod_mazoe_2l', productName: 'Mazoe Orange Crush 2 Litres', sku: 'GRO-001', quantity: 2, unitPrice: 3.50, costPrice: 2.80, total: 7.00, currency: 'USD' },
        { productId: 'prod_roller_meal_10kg', productName: 'Red Seal Roller Meal 10kg', sku: 'GRO-002', quantity: 1, unitPrice: 6.80, costPrice: 5.50, total: 6.80, currency: 'USD' },
        { productId: 'prod_cooking_oil_2l', productName: 'Pure Drop Cooking Oil 2L', sku: 'GRO-003', quantity: 1, unitPrice: 4.20, costPrice: 3.10, total: 4.20, currency: 'USD' },
      ],
      subtotal: 18.00,
      discount: 0,
      tax: 0,
      total: 18.00,
      currency: 'USD',
      payments: [{ method: 'cash', amount: 18.00, currency: 'USD' }],
      isCredit: false,
      creditBalanceRemaining: 0,
      cashierId: 'usr_cashier_1',
      cashierName: 'Grace Tsuro (Cashier)',
      syncStatus: 'synced',
      journalEntryId: 'je_sale_1001',
      createdAt: '2026-11-09T14:30:00Z',
    };
    await db.sales.put(demoSale);

    const jeSale: JournalEntry = {
      id: 'je_sale_1001',
      organisationId: 'org_default',
      date: saleDate,
      reference: 'REC-2026-1001',
      sourceType: 'sale',
      sourceId: 'sale_1001',
      description: 'Cash Sale Walk-in Customer (Mazoe x2, Roller Meal x1, Cooking Oil x1)',
      lines: [
        { id: 'jel_s1', accountId: 'acc_cash_usd', accountName: 'Cash in Hand (USD)', debit: 18.00, credit: 0, currency: 'USD' },
        { id: 'jel_s2', accountId: 'acc_sales_rev_usd', accountName: 'Sales Revenue (USD)', debit: 0, credit: 18.00, currency: 'USD' },
        // COGS & Inventory Reduction
        { id: 'jel_s3', accountId: 'acc_cogs_usd', accountName: 'Cost of Goods Sold (USD)', debit: 14.20, credit: 0, currency: 'USD' },
        { id: 'jel_s4', accountId: 'acc_inventory_usd', accountName: 'Merchandise Inventory (USD)', debit: 0, credit: 14.20, currency: 'USD' },
      ],
      createdBy: 'Grace Tsuro (Cashier)',
      createdAt: '2026-11-09T14:30:00Z',
    };
    await db.journalEntries.put(jeSale);

    const saleTx: FinancialTransaction = {
      id: 'tx_sale_1001',
      organisationId: 'org_default',
      date: saleDate,
      type: 'sale',
      category: 'Sales Revenue',
      description: 'POS Cash Sale - Receipt #REC-2026-1001',
      amount: 18.00,
      currency: 'USD',
      paymentMethod: 'cash',
      accountId: 'acc_cash_usd',
      journalEntryId: 'je_sale_1001',
      createdBy: 'Grace Tsuro (Cashier)',
      createdAt: '2026-11-09T14:30:00Z',
      syncStatus: 'synced',
    };
    await db.transactions.put(saleTx);

    // Update balances
    const cashUsd = await db.accounts.get('acc_cash_usd');
    if (cashUsd) {
      await db.accounts.update('acc_cash_usd', { balance: (cashUsd.balance || 0) - 250 + 18.00 });
      await db.cashAccounts.update('cash_usd_drawer', { balance: (cashUsd.balance || 0) - 250 + 18.00 });
    }
    await db.accounts.update('acc_exp_rent', { balance: 250 });
    await db.accounts.update('acc_sales_rev_usd', { balance: 18.00 });
    await db.accounts.update('acc_cogs_usd', { balance: 14.20 });

    // Initial Audit Log
    await db.auditLogs.put({
      id: 'log_seed',
      action: 'SYSTEM_INITIALIZATION',
      entity: 'DATABASE',
      entityId: 'cobos_db',
      performedBy: 'System Engine',
      details: 'Comfort Business Operational System local database initialized with Zimbabwe SME standard setup.',
      timestamp: new Date().toISOString(),
    });
  }
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
