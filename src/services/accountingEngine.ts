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
 * Central Accounting Engine with Double-Entry and RBAC Auditing
 */
export class AccountingEngine {
  /**
   * Validates that debits equal credits in a journal entry
   */
  static validateDoubleEntry(lines: JournalEntryLine[]): boolean {
    const balancesByCurrency: Record<string, { debits: number; credits: number }> = {};

    for (const line of lines) {
      if (!balancesByCurrency[line.currency]) {
        balancesByCurrency[line.currency] = { debits: 0, credits: 0 };
      }
      balancesByCurrency[line.currency].debits += Number(line.debit) || 0;
      balancesByCurrency[line.currency].credits += Number(line.credit) || 0;
    }

    for (const curr in balancesByCurrency) {
      const diff = Math.abs(balancesByCurrency[curr].debits - balancesByCurrency[curr].credits);
      if (diff > 0.009) {
        return false;
      }
    }
    return true;
  }

  /**
   * Process a POS Sale with automatic double-entry creation and stock decrement
   */
  static async processSale(params: {
    sale: Omit<Sale, 'id' | 'journalEntryId' | 'syncStatus' | 'createdAt'>;
    userId: string;
    userName: string;
    userEmail?: string;
  }): Promise<{ sale: Sale; journalEntry: JournalEntry }> {
    const saleId = 'sale_' + generateUUID();
    const journalEntryId = 'je_' + generateUUID();
    const now = new Date().toISOString();
    const saleCurrency = params.sale.currency;

    const journalLines: JournalEntryLine[] = [];

    // 1. Debit Payment Accounts
    for (const payment of params.sale.payments) {
      let targetAccountId = 'acc_cash_usd';
      let targetAccountName = 'Cash in Hand (USD)';

      if (payment.currency === 'ZiG') {
        if (payment.method === 'ecocash') {
          targetAccountId = 'acc_ecocash_zig';
          targetAccountName = 'EcoCash Mobile Money (ZiG)';
        } else {
          targetAccountId = 'acc_cash_zig';
          targetAccountName = 'Cash in Hand (ZiG)';
        }
      } else {
        if (payment.method === 'bank' || payment.method === 'card') {
          targetAccountId = 'acc_bank_usd';
          targetAccountName = 'Bank Clearing (USD)';
        } else {
          targetAccountId = 'acc_cash_usd';
          targetAccountName = 'Cash in Hand (USD)';
        }
      }

      journalLines.push({
        id: generateUUID(),
        accountId: targetAccountId,
        accountName: targetAccountName,
        debit: payment.amount,
        credit: 0,
        currency: payment.currency,
        description: `Sale payment via ${payment.method} (${params.sale.receiptNumber})`,
      });

      // Update cash drawer / asset account balance
      const acc = await db.accounts.get(targetAccountId);
      if (acc) {
        await db.accounts.update(targetAccountId, { balance: (acc.balance || 0) + payment.amount });
      }
      const cAcc = await db.cashAccounts.get(targetAccountId === 'acc_cash_usd' ? 'cash_usd_drawer' : targetAccountId === 'acc_cash_zig' ? 'cash_zig_drawer' : targetAccountId === 'acc_ecocash_zig' ? 'cash_ecocash_merchant' : 'cash_bank_usd');
      if (cAcc) {
        await db.cashAccounts.update(cAcc.id, { balance: (cAcc.balance || 0) + payment.amount });
      }
    }

    // 2. Debit Accounts Receivable if sale is on credit
    if (params.sale.isCredit && params.sale.creditBalanceRemaining > 0) {
      const arAccountId = saleCurrency === 'ZiG' ? 'acc_ar_zig' : 'acc_ar_usd';
      const arAccountName = saleCurrency === 'ZiG' ? 'Accounts Receivable (ZiG)' : 'Accounts Receivable (USD)';

      journalLines.push({
        id: generateUUID(),
        accountId: arAccountId,
        accountName: arAccountName,
        debit: params.sale.creditBalanceRemaining,
        credit: 0,
        currency: saleCurrency,
        description: `Credit customer balance for ${params.sale.customerName || 'Customer'}`,
      });

      const arAcc = await db.accounts.get(arAccountId);
      if (arAcc) {
        await db.accounts.update(arAccountId, { balance: (arAcc.balance || 0) + params.sale.creditBalanceRemaining });
      }

      // Update customer outstanding balance
      if (params.sale.customerId) {
        const cust = await db.customers.get(params.sale.customerId);
        if (cust) {
          if (saleCurrency === 'ZiG') {
            await db.customers.update(cust.id, {
              outstandingBalanceZiG: (cust.outstandingBalanceZiG || 0) + params.sale.creditBalanceRemaining,
            });
          } else {
            await db.customers.update(cust.id, {
              outstandingBalanceUSD: (cust.outstandingBalanceUSD || 0) + params.sale.creditBalanceRemaining,
            });
          }
        }
      }
    }

    // 3. Credit Sales Revenue
    const revenueAccountId = saleCurrency === 'ZiG' ? 'acc_sales_rev_zig' : 'acc_sales_rev_usd';
    const revenueAccountName = saleCurrency === 'ZiG' ? 'Sales Revenue (ZiG)' : 'Sales Revenue (USD)';

    journalLines.push({
      id: generateUUID(),
      accountId: revenueAccountId,
      accountName: revenueAccountName,
      debit: 0,
      credit: params.sale.total,
      currency: saleCurrency,
      description: `Sales revenue for ${params.sale.receiptNumber}`,
    });

    const revAcc = await db.accounts.get(revenueAccountId);
    if (revAcc) {
      await db.accounts.update(revenueAccountId, { balance: (revAcc.balance || 0) + params.sale.total });
    }

    // 4. Calculate COGS & Inventory Reductions (Products Only, Skip Services)
    let totalCogs = 0;
    for (const item of params.sale.items) {
      const product = await db.products.get(item.productId);
      // Only reduce inventory and record COGS for tangible products, not services
      if (product && product.itemType !== 'service') {
        const lineCost = (product.purchaseCost || 0) * item.quantity;
        totalCogs += lineCost;

        // Decrement physical stock
        const newStock = Math.max(0, product.currentStock - item.quantity);
        await db.products.update(product.id, {
          currentStock: newStock,
          updatedAt: now,
        });

        // Record stock movement
        const movement: StockMovement = {
          id: generateUUID(),
          productId: product.id,
          productName: product.name,
          type: 'sale',
          quantityDelta: -item.quantity,
          stockAfter: newStock,
          unitCost: product.purchaseCost,
          reference: params.sale.receiptNumber,
          notes: `POS sale to ${params.sale.customerName || 'Walk-in'}`,
          date: params.sale.date,
          performedBy: params.userName,
          createdAt: now,
        };
        await db.stockMovements.put(movement);
        await queueSyncItem('stock_movement', movement.id, 'INSERT', movement);
      }
    }

    // Record COGS journal lines if products were sold
    if (totalCogs > 0) {
      const cogsAccountId = saleCurrency === 'ZiG' ? 'acc_cogs_zig' : 'acc_cogs_usd';
      const cogsAccountName = saleCurrency === 'ZiG' ? 'Cost of Goods Sold (ZiG)' : 'Cost of Goods Sold (USD)';
      const invAccountId = 'acc_inventory_usd';
      const invAccountName = 'Merchandise Inventory (USD)';

      journalLines.push({
        id: generateUUID(),
        accountId: cogsAccountId,
        accountName: cogsAccountName,
        debit: totalCogs,
        credit: 0,
        currency: saleCurrency,
        description: `COGS for ${params.sale.receiptNumber}`,
      });

      journalLines.push({
        id: generateUUID(),
        accountId: invAccountId,
        accountName: invAccountName,
        debit: 0,
        credit: totalCogs,
        currency: saleCurrency,
        description: `Inventory reduction for ${params.sale.receiptNumber}`,
      });

      const cogsAcc = await db.accounts.get(cogsAccountId);
      if (cogsAcc) {
        await db.accounts.update(cogsAccountId, { balance: (cogsAcc.balance || 0) + totalCogs });
      }
      const invAcc = await db.accounts.get(invAccountId);
      if (invAcc) {
        await db.accounts.update(invAccountId, { balance: (invAcc.balance || 0) - totalCogs });
      }
    }

    // Validate double-entry equality
    if (!this.validateDoubleEntry(journalLines)) {
      throw new Error('Double-entry bookkeeping validation failed: Debits do not equal credits.');
    }

    // Construct immutable Journal Entry
    const journalEntry: JournalEntry = {
      id: journalEntryId,
      organisationId: 'org_default',
      date: params.sale.date,
      reference: params.sale.receiptNumber,
      sourceType: 'sale',
      sourceId: saleId,
      description: `Sale ${params.sale.receiptNumber} (${params.sale.customerName || 'Walk-in Customer'})`,
      lines: journalLines,
      createdBy: params.userName,
      createdById: params.userId,
      createdAt: now,
    };
    await db.journalEntries.put(journalEntry);
    await queueSyncItem('journal_entry', journalEntry.id, 'INSERT', journalEntry);

    // Save Final Sale record
    const sale: Sale = {
      ...params.sale,
      id: saleId,
      cashierId: params.userId,
      cashierName: params.userName,
      journalEntryId,
      syncStatus: 'pending',
      createdAt: now,
    };
    await db.sales.put(sale);
    await queueSyncItem('sale', sale.id, 'INSERT', sale);

    // Save Financial Transaction record with cashier ownership
    const transaction: FinancialTransaction = {
      id: 'tx_' + generateUUID(),
      organisationId: 'org_default',
      date: params.sale.date,
      type: 'sale',
      category: 'Sales Revenue',
      description: `POS Sale Receipt #${params.sale.receiptNumber}`,
      amount: params.sale.total,
      currency: saleCurrency,
      paymentMethod: params.sale.payments[0]?.method || 'cash',
      accountId: revenueAccountId,
      relatedEntityId: params.sale.customerId,
      relatedEntityName: params.sale.customerName,
      journalEntryId,
      createdBy: params.userName,
      createdById: params.userId,
      createdAt: now,
      syncStatus: 'pending',
    };
    await db.transactions.put(transaction);
    await queueSyncItem('transaction', transaction.id, 'INSERT', transaction);

    return { sale, journalEntry };
  }

  /**
   * Record Operating Expense
   */
  static async recordExpense(params: {
    date: string;
    category: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    paymentMethod: 'cash' | 'ecocash' | 'bank' | 'card';
    userId: string;
    userName: string;
  }): Promise<FinancialTransaction> {
    const txId = 'tx_' + generateUUID();
    const journalEntryId = 'je_' + generateUUID();
    const now = new Date().toISOString();

    const expenseAccountId = 'acc_exp_misc';
    const expenseAccountName = `${params.category} Expense`;

    let cashAccountId = 'acc_cash_usd';
    let cashAccountName = 'Cash in Hand (USD)';

    if (params.currency === 'ZiG') {
      if (params.paymentMethod === 'ecocash') {
        cashAccountId = 'acc_ecocash_zig';
        cashAccountName = 'EcoCash Mobile Money (ZiG)';
      } else {
        cashAccountId = 'acc_cash_zig';
        cashAccountName = 'Cash in Hand (ZiG)';
      }
    } else {
      if (params.paymentMethod === 'bank' || params.paymentMethod === 'card') {
        cashAccountId = 'acc_bank_usd';
        cashAccountName = 'Bank Clearing (USD)';
      } else {
        cashAccountId = 'acc_cash_usd';
        cashAccountName = 'Cash in Hand (USD)';
      }
    }

    const journalLines: JournalEntryLine[] = [
      {
        id: generateUUID(),
        accountId: expenseAccountId,
        accountName: expenseAccountName,
        debit: params.amount,
        credit: 0,
        currency: params.currency,
        description: params.description,
      },
      {
        id: generateUUID(),
        accountId: cashAccountId,
        accountName: cashAccountName,
        debit: 0,
        credit: params.amount,
        currency: params.currency,
        description: `Disbursement for ${params.description}`,
      },
    ];

    if (!this.validateDoubleEntry(journalLines)) {
      throw new Error('Expense double-entry validation failed: Debits do not equal credits.');
    }

    const journalEntry: JournalEntry = {
      id: journalEntryId,
      organisationId: 'org_default',
      date: params.date,
      reference: 'EXP-' + Math.floor(1000 + Math.random() * 9000),
      sourceType: 'expense',
      sourceId: txId,
      description: params.description,
      lines: journalLines,
      createdBy: params.userName,
      createdById: params.userId,
      createdAt: now,
    };
    await db.journalEntries.put(journalEntry);
    await queueSyncItem('journal_entry', journalEntry.id, 'INSERT', journalEntry);

    // Update balances
    const cashAcc = await db.accounts.get(cashAccountId);
    if (cashAcc) {
      await db.accounts.update(cashAccountId, { balance: (cashAcc.balance || 0) - params.amount });
    }
    const cAcc = await db.cashAccounts.get(cashAccountId === 'acc_cash_usd' ? 'cash_usd_drawer' : cashAccountId === 'acc_cash_zig' ? 'cash_zig_drawer' : cashAccountId === 'acc_ecocash_zig' ? 'cash_ecocash_merchant' : 'cash_bank_usd');
    if (cAcc) {
      await db.cashAccounts.update(cAcc.id, { balance: (cAcc.balance || 0) - params.amount });
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
      journalEntryId,
      createdBy: params.userName,
      createdById: params.userId,
      createdAt: now,
      syncStatus: 'pending',
    };
    await db.transactions.put(tx);
    await queueSyncItem('transaction', tx.id, 'INSERT', tx);

    return tx;
  }

  /**
   * Reverse transaction - restricted to Manager or Super Admin
   */
  static async reverseTransaction(params: {
    transactionId: string;
    reason: string;
    performedBy: string;
    performedById: string;
    userRole: string;
  }): Promise<{ reversalTx: FinancialTransaction; reversalJournal: JournalEntry }> {
    if (params.userRole === 'cashier') {
      throw new Error('Cashiers are not permitted to reverse or cancel transactions without Company Admin/Manager approval.');
    }

    const originalTx = await db.transactions.get(params.transactionId);
    if (!originalTx) throw new Error('Transaction not found.');
    if (originalTx.isReversed) throw new Error('Transaction has already been reversed.');

    const originalJournal = await db.journalEntries.get(originalTx.journalEntryId);
    if (!originalJournal) throw new Error('Associated journal entry not found.');

    const now = new Date().toISOString();
    const reversalJournalId = 'je_rev_' + generateUUID();
    const reversalTxId = 'tx_rev_' + generateUUID();

    // Mirror journal lines: swap debits and credits
    const reversalLines: JournalEntryLine[] = originalJournal.lines.map((line) => ({
      id: generateUUID(),
      accountId: line.accountId,
      accountName: line.accountName,
      debit: line.credit,
      credit: line.debit,
      currency: line.currency,
      description: `REVERSAL: ${line.description || originalJournal.description} - Reason: ${params.reason}`,
    }));

    const reversalJournal: JournalEntry = {
      id: reversalJournalId,
      organisationId: originalJournal.organisationId,
      date: now.split('T')[0],
      reference: `REV-${originalJournal.reference}`,
      sourceType: 'reversal',
      sourceId: originalTx.id,
      description: `Reversal of ${originalJournal.reference}: ${params.reason}`,
      lines: reversalLines,
      createdBy: params.performedBy,
      createdById: params.performedById,
      createdAt: now,
    };
    await db.journalEntries.put(reversalJournal);
    await queueSyncItem('journal_entry', reversalJournal.id, 'INSERT', reversalJournal);

    // Mark original journal as reversed
    await db.journalEntries.update(originalJournal.id, {
      isReversed: true,
      reversedByEntryId: reversalJournalId,
    });

    // Mark original transaction as reversed
    await db.transactions.update(originalTx.id, {
      isReversed: true,
      reversalReason: params.reason,
    });

    const reversalTx: FinancialTransaction = {
      id: reversalTxId,
      organisationId: originalTx.organisationId,
      date: now.split('T')[0],
      type: 'reversal',
      category: 'Reversals',
      description: `Reversal of ${originalTx.description} (${params.reason})`,
      amount: originalTx.amount,
      currency: originalTx.currency,
      paymentMethod: originalTx.paymentMethod,
      accountId: originalTx.accountId,
      relatedEntityId: originalTx.relatedEntityId,
      relatedEntityName: originalTx.relatedEntityName,
      journalEntryId: reversalJournalId,
      createdBy: params.performedBy,
      createdById: params.performedById,
      createdAt: now,
      syncStatus: 'pending',
    };
    await db.transactions.put(reversalTx);
    await queueSyncItem('transaction', reversalTx.id, 'INSERT', reversalTx);

    // Adjust account balances back
    for (const line of reversalLines) {
      const acc = await db.accounts.get(line.accountId);
      if (acc) {
        const netChange = (line.debit || 0) - (line.credit || 0);
        await db.accounts.update(acc.id, { balance: (acc.balance || 0) + netChange });
      }
    }

    return { reversalTx, reversalJournal };
  }
}
