import { db } from '../db/cobosDb';
import type {
  CurrencyCode,
  FinancialTransaction,
  JournalEntry,
  JournalEntryLine,
  Sale,
  CustomerPayment,
  SupplierPurchase,
  SupplierPayment,
  StockMovement,
  SyncQueueItem,
} from '../types';

/**
 * Generate a unique ID (UUID fallback)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
}

/**
 * Helper to queue an entity for Cloudflare D1 background synchronization
 */
export async function queueSyncItem(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  data: unknown
) {
  const item: SyncQueueItem = {
    id: generateUUID(),
    entityType,
    entityId,
    operation,
    payload: JSON.stringify(data),
    timestamp: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };
  await db.syncQueue.put(item);
}

/**
 * Central Accounting Engine
 */
export class AccountingEngine {
  /**
   * Validates that debits equal credits in a journal entry
   */
  static validateDoubleEntry(lines: JournalEntryLine[]): boolean {
    // Group by currency to ensure debits and credits balance in the SAME currency
    const balancesByCurrency: Record<string, { debits: number; credits: number }> = {};

    for (const line of lines) {
      if (!balancesByCurrency[line.currency]) {
        balancesByCurrency[line.currency] = { debits: 0, credits: 0 };
      }
      balancesByCurrency[line.currency].debits += line.debit;
      balancesByCurrency[line.currency].credits += line.credit;
    }

    for (const [curr, { debits, credits }] of Object.entries(balancesByCurrency)) {
      if (Math.abs(debits - credits) > 0.001) {
        console.error(`Journal entry unbalanced in currency ${curr}: Debits = ${debits}, Credits = ${credits}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Posts a validated journal entry and updates Chart of Account balances
   */
  static async postJournalEntry(entry: JournalEntry): Promise<void> {
    if (!this.validateDoubleEntry(entry.lines)) {
      throw new Error('Accounting Violation: Journal entry debits and credits do not balance.');
    }

    await db.journalEntries.put(entry);
    await queueSyncItem('journal_entry', entry.id, 'INSERT', entry);

    // Update individual account balances
    for (const line of entry.lines) {
      const account = await db.accounts.get(line.accountId);
      if (account) {
        let delta = 0;
        // Accounting standard rule:
        // Asset & Expense normal balance is DEBIT: balance increases with debit, decreases with credit.
        // Liability, Equity, Revenue normal balance is CREDIT: balance increases with credit, decreases with debit.
        if (['asset', 'expense', 'cogs'].includes(account.type)) {
          delta = line.debit - line.credit;
        } else {
          delta = line.credit - line.debit;
        }

        const newBalance = (account.balance || 0) + delta;
        await db.accounts.update(account.id, { balance: newBalance });
      }
    }
  }

  /**
   * 1. Record POS Sale (Cash or Credit)
   * Updates inventory, recognizes revenue, posts COGS, updates cash/AR, creates journal & transaction
   */
  static async processSale(saleData: Omit<Sale, 'id' | 'journalEntryId' | 'receiptNumber' | 'createdAt' | 'syncStatus'>): Promise<Sale> {
    const saleId = generateUUID();
    const receiptNum = 'REC-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
    const createdAt = new Date().toISOString();
    const journalEntryId = generateUUID();

    let totalCogs = 0;
    for (const item of saleData.items) {
      totalCogs += (item.costPrice || 0) * item.quantity;
    }

    // Determine Accounts based on currency
    const isZiG = saleData.currency === 'ZiG';
    const isZar = saleData.currency === 'ZAR';

    const salesRevAccount = isZiG ? 'acc_sales_rev_zig' : 'acc_sales_rev_usd';
    const cogsAccount = isZiG ? 'acc_cogs_zig' : 'acc_cogs_usd';
    const arAccount = isZiG ? 'acc_ar_zig' : 'acc_ar_usd';
    const cashAccount = isZiG ? 'acc_cash_zig' : 'acc_cash_usd';
    const cashDrawerId = isZiG ? 'cash_zig_drawer' : 'cash_usd_drawer';

    const journalLines: JournalEntryLine[] = [];

    // Credit portion vs Cash portion
    const cashPaid = saleData.payments.reduce((sum, p) => sum + p.amount, 0);
    const creditAmount = saleData.total - cashPaid;

    // 1. Payment or Accounts Receivable debit
    if (cashPaid > 0) {
      journalLines.push({
        id: generateUUID(),
        accountId: cashAccount,
        accountName: isZiG ? 'Cash in Hand (ZiG)' : 'Cash in Hand (USD)',
        debit: cashPaid,
        credit: 0,
        currency: saleData.currency,
        description: `POS Payment for ${receiptNum}`,
      });
    }

    if (creditAmount > 0) {
      journalLines.push({
        id: generateUUID(),
        accountId: arAccount,
        accountName: isZiG ? 'Accounts Receivable (ZiG)' : 'Accounts Receivable (USD)',
        debit: creditAmount,
        credit: 0,
        currency: saleData.currency,
        description: `Credit Sale to ${saleData.customerName || 'Customer'}`,
      });
    }

    // 2. Revenue credit
    journalLines.push({
      id: generateUUID(),
      accountId: salesRevAccount,
      accountName: isZiG ? 'Sales Revenue (ZiG)' : 'Sales Revenue (USD)',
      debit: 0,
      credit: saleData.total,
      currency: saleData.currency,
      description: `Sales revenue for ${receiptNum}`,
    });

    // 3. Inventory and COGS posting (if cost price exists)
    if (totalCogs > 0 && !isZiG) { // for USD items
      journalLines.push({
        id: generateUUID(),
        accountId: cogsAccount,
        accountName: 'Cost of Goods Sold (USD)',
        debit: totalCogs,
        credit: 0,
        currency: 'USD',
        description: `COGS for ${receiptNum}`,
      });
      journalLines.push({
        id: generateUUID(),
        accountId: 'acc_inventory_usd',
        accountName: 'Merchandise Inventory (USD)',
        debit: 0,
        credit: totalCogs,
        currency: 'USD',
        description: `Inventory reduction for ${receiptNum}`,
      });
    }

    const journalEntry: JournalEntry = {
      id: journalEntryId,
      organisationId: 'org_default',
      date: saleData.date,
      reference: receiptNum,
      sourceType: creditAmount > 0 ? 'credit_sale' : 'sale',
      sourceId: saleId,
      description: `Sale ${receiptNum} - ${saleData.customerName || 'Walk-in'} (${saleData.items.length} items)`,
      lines: journalLines,
      createdBy: saleData.cashierName,
      createdAt,
    };

    // Post to General Ledger
    await this.postJournalEntry(journalEntry);

    // Save Sale record
    const sale: Sale = {
      ...saleData,
      id: saleId,
      receiptNumber: receiptNum,
      journalEntryId,
      isCredit: creditAmount > 0,
      creditBalanceRemaining: creditAmount > 0 ? creditAmount : 0,
      createdAt,
      syncStatus: 'pending',
    };
    await db.sales.put(sale);
    await queueSyncItem('sale', sale.id, 'INSERT', sale);

    // Update Cash Drawer balance if cash paid
    if (cashPaid > 0) {
      const drawer = await db.cashAccounts.get(cashDrawerId);
      if (drawer) {
        await db.cashAccounts.update(cashDrawerId, { balance: (drawer.balance || 0) + cashPaid });
      }

      // Financial Transaction
      const tx: FinancialTransaction = {
        id: generateUUID(),
        organisationId: 'org_default',
        date: saleData.date,
        type: 'sale',
        category: 'POS Sales',
        description: `POS Sale Receipt ${receiptNum}`,
        amount: cashPaid,
        currency: saleData.currency,
        paymentMethod: saleData.payments[0]?.method || 'cash',
        accountId: cashAccount,
        journalEntryId,
        createdBy: saleData.cashierName,
        createdAt,
        syncStatus: 'pending',
      };
      await db.transactions.put(tx);
      await queueSyncItem('transaction', tx.id, 'INSERT', tx);
    }

    // If Credit Sale, update Customer balance
    if (creditAmount > 0 && saleData.customerId) {
      const cust = await db.customers.get(saleData.customerId);
      if (cust) {
        if (saleData.currency === 'ZiG') {
          await db.customers.update(cust.id, {
            outstandingBalanceZiG: (cust.outstandingBalanceZiG || 0) + creditAmount,
          });
        } else if (saleData.currency === 'ZAR') {
          await db.customers.update(cust.id, {
            outstandingBalanceZAR: (cust.outstandingBalanceZAR || 0) + creditAmount,
          });
        } else {
          await db.customers.update(cust.id, {
            outstandingBalanceUSD: (cust.outstandingBalanceUSD || 0) + creditAmount,
          });
        }
      }
    }

    // Deduct Inventory and record Stock Movements
    for (const item of saleData.items) {
      const prod = await db.products.get(item.productId);
      if (prod) {
        const newStock = Math.max(0, (prod.currentStock || 0) - item.quantity);
        await db.products.update(prod.id, {
          currentStock: newStock,
          updatedAt: createdAt,
          syncStatus: 'pending',
        });
        await queueSyncItem('product', prod.id, 'UPDATE', { ...prod, currentStock: newStock });

        const movement: StockMovement = {
          id: generateUUID(),
          productId: prod.id,
          productName: prod.name,
          type: 'sale',
          quantityDelta: -item.quantity,
          stockAfter: newStock,
          unitCost: item.costPrice,
          reference: receiptNum,
          notes: `POS Sale to ${saleData.customerName || 'Walk-in'}`,
          date: saleData.date,
          performedBy: saleData.cashierName,
          createdAt,
        };
        await db.stockMovements.put(movement);
        await queueSyncItem('stock_movement', movement.id, 'INSERT', movement);
      }
    }

    // Audit Log
    await db.auditLogs.put({
      id: generateUUID(),
      action: 'POS_SALE_COMPLETED',
      entity: 'SALE',
      entityId: saleId,
      performedBy: saleData.cashierName,
      details: `Sale ${receiptNum} completed for ${saleData.currency} ${saleData.total.toFixed(2)}`,
      timestamp: createdAt,
    });

    return sale;
  }

  /**
   * 2. Record Operating Expense
   * Debits Expense Account, Credits Cash/Bank/EcoCash
   */
  static async recordExpense(params: {
    date: string;
    category: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    paymentMethod: 'cash' | 'ecocash' | 'bank' | 'card';
    expenseAccountId?: string;
    performedBy: string;
  }): Promise<FinancialTransaction> {
    const txId = generateUUID();
    const journalId = generateUUID();
    const createdAt = new Date().toISOString();

    const isZiG = params.currency === 'ZiG';
    const cashAccountId = isZiG ? 'acc_cash_zig' : 'acc_cash_usd';
    const cashDrawerId = isZiG ? 'cash_zig_drawer' : 'cash_usd_drawer';

    // Map category to chart of accounts if not specified
    let targetExpenseAcc = params.expenseAccountId || 'acc_exp_misc';
    const catLower = params.category.toLowerCase();
    if (catLower.includes('rent')) targetExpenseAcc = 'acc_exp_rent';
    else if (catLower.includes('salar') || catLower.includes('wage')) targetExpenseAcc = 'acc_exp_salaries';
    else if (catLower.includes('util') || catLower.includes('water') || catLower.includes('elect') || catLower.includes('zesa')) targetExpenseAcc = 'acc_exp_utilities';
    else if (catLower.includes('trans') || catLower.includes('fuel')) targetExpenseAcc = 'acc_exp_transport';
    else if (catLower.includes('market') || catLower.includes('ad')) targetExpenseAcc = 'acc_exp_marketing';
    else if (catLower.includes('repair') || catLower.includes('maint')) targetExpenseAcc = 'acc_exp_repairs';
    else if (catLower.includes('bank') || catLower.includes('charg') || catLower.includes('ecocash')) targetExpenseAcc = 'acc_exp_bank_charges';

    const expenseAccountObj = await db.accounts.get(targetExpenseAcc);

    const journalEntry: JournalEntry = {
      id: journalId,
      organisationId: 'org_default',
      date: params.date,
      reference: 'EXP-' + txId.substring(0, 6).toUpperCase(),
      sourceType: 'expense',
      sourceId: txId,
      description: `Expense: ${params.category} - ${params.description}`,
      lines: [
        {
          id: generateUUID(),
          accountId: targetExpenseAcc,
          accountName: expenseAccountObj?.name || params.category,
          debit: params.amount,
          credit: 0,
          currency: params.currency,
          description: params.description,
        },
        {
          id: generateUUID(),
          accountId: cashAccountId,
          accountName: isZiG ? 'Cash in Hand (ZiG)' : 'Cash in Hand (USD)',
          debit: 0,
          credit: params.amount,
          currency: params.currency,
          description: `Paid via ${params.paymentMethod}`,
        },
      ],
      createdBy: params.performedBy,
      createdAt,
    };

    await this.postJournalEntry(journalEntry);

    // Update Drawer balance
    const drawer = await db.cashAccounts.get(cashDrawerId);
    if (drawer) {
      await db.cashAccounts.update(cashDrawerId, { balance: (drawer.balance || 0) - params.amount });
    }

    const tx: FinancialTransaction = {
      id: txId,
      organisationId: 'org_default',
      date: params.date,
      type: 'expense',
      category: params.category,
      description: params.description,
      amount: params.amount,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      accountId: cashAccountId,
      journalEntryId: journalId,
      createdBy: params.performedBy,
      createdAt,
      syncStatus: 'pending',
    };

    await db.transactions.put(tx);
    await queueSyncItem('transaction', tx.id, 'INSERT', tx);

    await db.auditLogs.put({
      id: generateUUID(),
      action: 'EXPENSE_RECORDED',
      entity: 'EXPENSE',
      entityId: txId,
      performedBy: params.performedBy,
      details: `${params.category}: ${params.currency} ${params.amount} - ${params.description}`,
      timestamp: createdAt,
    });

    return tx;
  }

  /**
   * 3. Record Customer Debt Payment
   * Customer pays partial or full debt:
   * Debits Cash/Bank/EcoCash, Credits Accounts Receivable, Updates Customer Balance
   */
  static async recordCustomerPayment(params: {
    customerId: string;
    amount: number;
    currency: CurrencyCode;
    paymentMethod: 'cash' | 'ecocash' | 'bank' | 'card';
    date: string;
    notes?: string;
    performedBy: string;
  }): Promise<CustomerPayment> {
    const cust = await db.customers.get(params.customerId);
    if (!cust) throw new Error('Customer not found');

    const paymentId = generateUUID();
    const journalId = generateUUID();
    const createdAt = new Date().toISOString();

    const isZiG = params.currency === 'ZiG';
    const cashAccountId = isZiG ? 'acc_cash_zig' : 'acc_cash_usd';
    const arAccountId = isZiG ? 'acc_ar_zig' : 'acc_ar_usd';
    const cashDrawerId = isZiG ? 'cash_zig_drawer' : 'cash_usd_drawer';

    const journalEntry: JournalEntry = {
      id: journalId,
      organisationId: 'org_default',
      date: params.date,
      reference: 'PAY-' + paymentId.substring(0, 6).toUpperCase(),
      sourceType: 'customer_payment',
      sourceId: paymentId,
      description: `Debt payment received from ${cust.name}`,
      lines: [
        {
          id: generateUUID(),
          accountId: cashAccountId,
          accountName: isZiG ? 'Cash in Hand (ZiG)' : 'Cash in Hand (USD)',
          debit: params.amount,
          credit: 0,
          currency: params.currency,
          description: `Customer payment received via ${params.paymentMethod}`,
        },
        {
          id: generateUUID(),
          accountId: arAccountId,
          accountName: isZiG ? 'Accounts Receivable (ZiG)' : 'Accounts Receivable (USD)',
          debit: 0,
          credit: params.amount,
          currency: params.currency,
          description: `Receivable reduction for ${cust.name}`,
        },
      ],
      createdBy: params.performedBy,
      createdAt,
    };

    await this.postJournalEntry(journalEntry);

    // Update customer debt balance
    if (params.currency === 'ZiG') {
      const newBal = Math.max(0, (cust.outstandingBalanceZiG || 0) - params.amount);
      await db.customers.update(cust.id, { outstandingBalanceZiG: newBal, lastPaymentDate: params.date });
    } else if (params.currency === 'ZAR') {
      const newBal = Math.max(0, (cust.outstandingBalanceZAR || 0) - params.amount);
      await db.customers.update(cust.id, { outstandingBalanceZAR: newBal, lastPaymentDate: params.date });
    } else {
      const newBal = Math.max(0, (cust.outstandingBalanceUSD || 0) - params.amount);
      await db.customers.update(cust.id, { outstandingBalanceUSD: newBal, lastPaymentDate: params.date });
    }

    // Update drawer balance
    const drawer = await db.cashAccounts.get(cashDrawerId);
    if (drawer) {
      await db.cashAccounts.update(cashDrawerId, { balance: (drawer.balance || 0) + params.amount });
    }

    const payment: CustomerPayment = {
      id: paymentId,
      customerId: cust.id,
      customerName: cust.name,
      amount: params.amount,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      date: params.date,
      notes: params.notes,
      receivedBy: params.performedBy,
      journalEntryId: journalId,
      createdAt,
      syncStatus: 'pending',
    };
    await db.customerPayments.put(payment);
    await queueSyncItem('customer_payment', payment.id, 'INSERT', payment);

    // Financial Transaction
    const tx: FinancialTransaction = {
      id: generateUUID(),
      organisationId: 'org_default',
      date: params.date,
      type: 'customer_payment',
      category: 'Customer Collections',
      description: `Debt payment received from ${cust.name}`,
      amount: params.amount,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      accountId: cashAccountId,
      relatedEntityId: cust.id,
      relatedEntityName: cust.name,
      journalEntryId: journalId,
      createdBy: params.performedBy,
      createdAt,
      syncStatus: 'pending',
    };
    await db.transactions.put(tx);
    await queueSyncItem('transaction', tx.id, 'INSERT', tx);

    await db.auditLogs.put({
      id: generateUUID(),
      action: 'CUSTOMER_PAYMENT_RECEIVED',
      entity: 'CUSTOMER',
      entityId: cust.id,
      performedBy: params.performedBy,
      details: `Received ${params.currency} ${params.amount.toFixed(2)} from ${cust.name}`,
      timestamp: createdAt,
    });

    return payment;
  }

  /**
   * 4. Record Supplier Stock Purchase
   * Debits Inventory, Credits Accounts Payable (if credit) or Cash (if paid)
   */
  static async recordSupplierPurchase(params: {
    supplierId: string;
    invoiceNumber: string;
    totalAmount: number;
    currency: CurrencyCode;
    isCredit: boolean;
    paidAmount: number;
    paymentMethod?: 'cash' | 'ecocash' | 'bank' | 'card';
    itemsSummary: string;
    date: string;
    performedBy: string;
  }): Promise<SupplierPurchase> {
    const supp = await db.suppliers.get(params.supplierId);
    if (!supp) throw new Error('Supplier not found');

    const purchaseId = generateUUID();
    const journalId = generateUUID();
    const createdAt = new Date().toISOString();

    const isZiG = params.currency === 'ZiG';
    const cashAccountId = isZiG ? 'acc_cash_zig' : 'acc_cash_usd';
    const apAccountId = isZiG ? 'acc_ap_zig' : 'acc_ap_usd';
    const inventoryAccountId = 'acc_inventory_usd'; // standard inventory asset

    const journalLines: JournalEntryLine[] = [];

    // 1. Inventory Asset Debit
    journalLines.push({
      id: generateUUID(),
      accountId: inventoryAccountId,
      accountName: 'Merchandise Inventory',
      debit: params.totalAmount,
      credit: 0,
      currency: params.currency,
      description: `Stock Purchase Inv #${params.invoiceNumber} from ${supp.name}`,
    });

    // 2. Immediate Cash payment vs Accounts Payable
    if (params.paidAmount > 0) {
      journalLines.push({
        id: generateUUID(),
        accountId: cashAccountId,
        accountName: isZiG ? 'Cash in Hand (ZiG)' : 'Cash in Hand (USD)',
        debit: 0,
        credit: params.paidAmount,
        currency: params.currency,
        description: `Cash payment to ${supp.name}`,
      });
    }

    const creditAmount = params.totalAmount - (params.paidAmount || 0);
    if (creditAmount > 0) {
      journalLines.push({
        id: generateUUID(),
        accountId: apAccountId,
        accountName: isZiG ? 'Accounts Payable (ZiG)' : 'Accounts Payable (USD)',
        debit: 0,
        credit: creditAmount,
        currency: params.currency,
        description: `Payable owed to ${supp.name}`,
      });
    }

    const journalEntry: JournalEntry = {
      id: journalId,
      organisationId: 'org_default',
      date: params.date,
      reference: params.invoiceNumber || 'PUR-' + purchaseId.substring(0, 6).toUpperCase(),
      sourceType: 'purchase',
      sourceId: purchaseId,
      description: `Purchase from ${supp.name}: ${params.itemsSummary}`,
      lines: journalLines,
      createdBy: params.performedBy,
      createdAt,
    };

    await this.postJournalEntry(journalEntry);

    // Update supplier balance if on credit
    if (creditAmount > 0) {
      if (params.currency === 'ZiG') {
        await db.suppliers.update(supp.id, {
          outstandingBalanceZiG: (supp.outstandingBalanceZiG || 0) + creditAmount,
        });
      } else {
        await db.suppliers.update(supp.id, {
          outstandingBalanceUSD: (supp.outstandingBalanceUSD || 0) + creditAmount,
        });
      }
    }

    const purchase: SupplierPurchase = {
      id: purchaseId,
      invoiceNumber: params.invoiceNumber,
      supplierId: supp.id,
      supplierName: supp.name,
      date: params.date,
      totalAmount: params.totalAmount,
      currency: params.currency,
      isCredit: params.isCredit,
      paidAmount: params.paidAmount,
      paymentMethod: params.paymentMethod,
      itemsSummary: params.itemsSummary,
      receivedBy: params.performedBy,
      journalEntryId: journalId,
      createdAt,
      syncStatus: 'pending',
    };

    await db.supplierPurchases.put(purchase);
    await queueSyncItem('supplier_payment', purchase.id, 'INSERT', purchase);

    return purchase;
  }

  /**
   * 5. Record Supplier Debt Payment
   * Business pays supplier debt:
   * Debits Accounts Payable, Credits Cash/Bank/EcoCash, Decreases Supplier Balance
   */
  static async recordSupplierPayment(params: {
    supplierId: string;
    amount: number;
    currency: CurrencyCode;
    paymentMethod: 'cash' | 'ecocash' | 'bank' | 'card';
    date: string;
    notes?: string;
    performedBy: string;
  }): Promise<SupplierPayment> {
    const supp = await db.suppliers.get(params.supplierId);
    if (!supp) throw new Error('Supplier not found');

    const paymentId = generateUUID();
    const journalId = generateUUID();
    const createdAt = new Date().toISOString();

    const isZiG = params.currency === 'ZiG';
    const cashAccountId = isZiG ? 'acc_cash_zig' : 'acc_cash_usd';
    const apAccountId = isZiG ? 'acc_ap_zig' : 'acc_ap_usd';
    const cashDrawerId = isZiG ? 'cash_zig_drawer' : 'cash_usd_drawer';

    const journalEntry: JournalEntry = {
      id: journalId,
      organisationId: 'org_default',
      date: params.date,
      reference: 'SPAY-' + paymentId.substring(0, 6).toUpperCase(),
      sourceType: 'supplier_payment',
      sourceId: paymentId,
      description: `Payment to supplier ${supp.name}`,
      lines: [
        {
          id: generateUUID(),
          accountId: apAccountId,
          accountName: isZiG ? 'Accounts Payable (ZiG)' : 'Accounts Payable (USD)',
          debit: params.amount,
          credit: 0,
          currency: params.currency,
          description: `Reduction of debt to ${supp.name}`,
        },
        {
          id: generateUUID(),
          accountId: cashAccountId,
          accountName: isZiG ? 'Cash in Hand (ZiG)' : 'Cash in Hand (USD)',
          debit: 0,
          credit: params.amount,
          currency: params.currency,
          description: `Disbursed via ${params.paymentMethod}`,
        },
      ],
      createdBy: params.performedBy,
      createdAt,
    };

    await this.postJournalEntry(journalEntry);

    // Update supplier balance
    if (params.currency === 'ZiG') {
      const newBal = Math.max(0, (supp.outstandingBalanceZiG || 0) - params.amount);
      await db.suppliers.update(supp.id, { outstandingBalanceZiG: newBal });
    } else {
      const newBal = Math.max(0, (supp.outstandingBalanceUSD || 0) - params.amount);
      await db.suppliers.update(supp.id, { outstandingBalanceUSD: newBal });
    }

    // Update drawer balance
    const drawer = await db.cashAccounts.get(cashDrawerId);
    if (drawer) {
      await db.cashAccounts.update(cashDrawerId, { balance: (drawer.balance || 0) - params.amount });
    }

    const payment: SupplierPayment = {
      id: paymentId,
      supplierId: supp.id,
      supplierName: supp.name,
      amount: params.amount,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      date: params.date,
      notes: params.notes,
      paidBy: params.performedBy,
      journalEntryId: journalId,
      createdAt,
      syncStatus: 'pending',
    };
    await db.supplierPayments.put(payment);
    await queueSyncItem('supplier_payment', payment.id, 'INSERT', payment);

    const tx: FinancialTransaction = {
      id: generateUUID(),
      organisationId: 'org_default',
      date: params.date,
      type: 'supplier_payment',
      category: 'Supplier Payments',
      description: `Debt payment to supplier ${supp.name}`,
      amount: params.amount,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      accountId: cashAccountId,
      relatedEntityId: supp.id,
      relatedEntityName: supp.name,
      journalEntryId: journalId,
      createdBy: params.performedBy,
      createdAt,
      syncStatus: 'pending',
    };
    await db.transactions.put(tx);
    await queueSyncItem('transaction', tx.id, 'INSERT', tx);

    await db.auditLogs.put({
      id: generateUUID(),
      action: 'SUPPLIER_PAYMENT_DISBURSED',
      entity: 'SUPPLIER',
      entityId: supp.id,
      performedBy: params.performedBy,
      details: `Disbursed ${params.currency} ${params.amount.toFixed(2)} to ${supp.name}`,
      timestamp: createdAt,
    });

    return payment;
  }

  /**
   * 6. Reversal of an Erroneous Transaction (Immutable Ledger Rule)
   * Instead of silently deleting, creates a balancing reversal entry and marks original as reversed
   */
  static async reverseTransaction(txId: string, reason: string, performedBy: string): Promise<boolean> {
    const tx = await db.transactions.get(txId);
    if (!tx || tx.isReversed) return false;

    const originalJournal = await db.journalEntries.get(tx.journalEntryId);
    if (!originalJournal) return false;

    const reversalJournalId = generateUUID();
    const createdAt = new Date().toISOString();

    // Invert debits and credits
    const reversalLines: JournalEntryLine[] = originalJournal.lines.map((l) => ({
      id: generateUUID(),
      accountId: l.accountId,
      accountName: l.accountName,
      debit: l.credit, // Invert
      credit: l.debit, // Invert
      currency: l.currency,
      description: `REVERSAL: ${l.description || originalJournal.reference}`,
    }));

    const reversalJournal: JournalEntry = {
      id: reversalJournalId,
      organisationId: 'org_default',
      date: new Date().toISOString().split('T')[0],
      reference: `REV-${originalJournal.reference}`,
      sourceType: 'reversal',
      sourceId: tx.id,
      description: `Reversal of [${originalJournal.reference}]: ${reason}`,
      lines: reversalLines,
      createdBy: performedBy,
      createdAt,
    };

    await this.postJournalEntry(reversalJournal);

    // Mark original journal entry and transaction as reversed
    await db.journalEntries.update(originalJournal.id, {
      isReversed: true,
      reversedByEntryId: reversalJournalId,
    });

    await db.transactions.update(tx.id, {
      isReversed: true,
      reversalReason: reason,
      syncStatus: 'pending',
    });

    // Create a reversal transaction record
    const revTx: FinancialTransaction = {
      id: generateUUID(),
      organisationId: 'org_default',
      date: new Date().toISOString().split('T')[0],
      type: 'reversal',
      category: 'Adjustments & Reversals',
      description: `REVERSAL of ${tx.description} (Reason: ${reason})`,
      amount: tx.amount,
      currency: tx.currency,
      paymentMethod: tx.paymentMethod,
      accountId: tx.accountId,
      journalEntryId: reversalJournalId,
      createdBy: performedBy,
      createdAt,
      syncStatus: 'pending',
    };
    await db.transactions.put(revTx);
    await queueSyncItem('transaction', revTx.id, 'INSERT', revTx);

    // Audit log
    await db.auditLogs.put({
      id: generateUUID(),
      action: 'TRANSACTION_REVERSED',
      entity: 'TRANSACTION',
      entityId: tx.id,
      performedBy,
      details: `Reversed ${tx.currency} ${tx.amount} (${tx.description}). Reason: ${reason}`,
      timestamp: createdAt,
    });

    return true;
  }
}
