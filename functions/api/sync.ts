/**
 * Cloudflare Pages Function: /api/sync
 * Receives queued operations from COBOS PWA client and applies them to Cloudflare D1 (SQLite)
 */

interface Env {
  DB: any; // Cloudflare D1 Database binding
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const body: any = await request.json();
    const operations: any[] = body.operations || [];

    if (!Array.isArray(operations) || operations.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If D1 is bound in Cloudflare runtime
    if (env && env.DB) {
      const statements: any[] = [];

      for (const op of operations) {
        const payload = typeof op.payload === 'string' ? JSON.parse(op.payload) : op.payload;

        // Process based on entity type
        if (op.entityType === 'sale' && op.operation === 'INSERT') {
          statements.push(
            env.DB.prepare(
              `INSERT OR REPLACE INTO sales (id, receipt_number, date, customer_id, customer_name, items_json, subtotal, discount, tax, total, currency, payments_json, is_credit, credit_balance_remaining, cashier_id, cashier_name, journal_entry_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              payload.id,
              payload.receiptNumber,
              payload.date,
              payload.customerId || null,
              payload.customerName || null,
              JSON.stringify(payload.items || []),
              payload.subtotal || 0,
              payload.discount || 0,
              payload.tax || 0,
              payload.total || 0,
              payload.currency || 'USD',
              JSON.stringify(payload.payments || []),
              payload.isCredit ? 1 : 0,
              payload.creditBalanceRemaining || 0,
              payload.cashierId || null,
              payload.cashierName || null,
              payload.journalEntryId
            )
          );
        } else if (op.entityType === 'transaction' && op.operation === 'INSERT') {
          statements.push(
            env.DB.prepare(
              `INSERT OR REPLACE INTO financial_transactions (id, date, type, category, description, amount, currency, payment_method, account_id, related_entity_id, related_entity_name, journal_entry_id, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              payload.id,
              payload.date,
              payload.type,
              payload.category,
              payload.description,
              payload.amount,
              payload.currency,
              payload.paymentMethod,
              payload.accountId,
              payload.relatedEntityId || null,
              payload.relatedEntityName || null,
              payload.journalEntryId,
              payload.createdBy
            )
          );
        } else if (op.entityType === 'product' && (op.operation === 'INSERT' || op.operation === 'UPDATE')) {
          statements.push(
            env.DB.prepare(
              `INSERT OR REPLACE INTO products (id, sku, barcode, name, category, unit, purchase_cost, selling_price, currency, current_stock, min_stock_level, supplier_name)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              payload.id,
              payload.sku,
              payload.barcode || null,
              payload.name,
              payload.category,
              payload.unit || 'pcs',
              payload.purchaseCost || 0,
              payload.sellingPrice || 0,
              payload.currency || 'USD',
              payload.currentStock || 0,
              payload.minStockLevel || 5,
              payload.supplierName || null
            )
          );
        }

        // Record in sync audit log
        statements.push(
          env.DB.prepare(
            `INSERT INTO sync_audit_log (id, entity_type, entity_id, operation) VALUES (?, ?, ?, ?)`
          ).bind(op.id, op.entityType, op.entityId, op.operation)
        );
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: operations.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal Cloudflare D1 sync error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
