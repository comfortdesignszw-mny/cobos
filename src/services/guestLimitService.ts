import { db } from '../db/cobosDb';

export const GUEST_MAX_DAILY_TRANSACTIONS = 20;
export const GUEST_MAX_INVENTORY_ITEMS = 20;

export class GuestLimitService {
  /**
   * Get total transactions created today (Sales + Financial Transactions)
   */
  static async getTodayTransactionCount(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const salesCount = await db.sales.where('date').equals(today).count();
    const txCount = await db.transactions.where('date').equals(today).count();
    return salesCount + txCount;
  }

  /**
   * Check if guest can perform a transaction today
   */
  static async checkCanTransact(): Promise<{ allowed: boolean; count: number; max: number }> {
    const count = await this.getTodayTransactionCount();
    return {
      allowed: count < GUEST_MAX_DAILY_TRANSACTIONS,
      count,
      max: GUEST_MAX_DAILY_TRANSACTIONS,
    };
  }

  /**
   * Check if guest can add another inventory item
   */
  static async checkCanAddProduct(): Promise<{ allowed: boolean; count: number; max: number }> {
    const count = await db.products.count();
    return {
      allowed: count < GUEST_MAX_INVENTORY_ITEMS,
      count,
      max: GUEST_MAX_INVENTORY_ITEMS,
    };
  }
}
