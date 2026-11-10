import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine } from '../../services/accountingEngine';
import type { Product, Customer, SaleItem, CurrencyCode, SalePayment } from '../../types';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  UserCheck,
  CreditCard,
  DollarSign,
  AlertCircle,
  Barcode,
  Tag,
  Receipt,
  Layers,
} from 'lucide-react';

export const POSModule: React.FC = () => {
  const {
    activeCurrency,
    activeUser,
    setReceiptModalData,
    triggerRefresh,
    refreshKey,
    profile,
  } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'ecocash' | 'bank' | 'card' | 'credit' | 'split'>('cash');
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitSecondary, setSplitSecondary] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load products and customers
  useEffect(() => {
    async function loadData() {
      const allProds = await db.products.toArray();
      const allCusts = await db.customers.toArray();
      setProducts(allProds);
      setCustomers(allCusts);
    }
    loadData();
  }, [refreshKey]);

  // Extract unique categories
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(0, subtotal - (discountAmount || 0));

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      alert(`Warning: ${product.name} is out of stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          alert(`Cannot exceed available stock of ${product.currentStock} ${product.unit}`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: product.sellingPrice,
          costPrice: product.purchaseCost,
          total: product.sellingPrice,
          currency: product.currency,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const prod = products.find((p) => p.id === productId);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (prod && newQty > prod.currentStock) {
              alert(`Cannot exceed stock of ${prod.currentStock}`);
              return item;
            }
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty, total: newQty * item.unitPrice };
          }
          return item;
        })
        .filter(Boolean) as SaleItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setErrorMsg(null);
  };

  // Complete the Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setErrorMsg('Cart is empty. Please add items to sell.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

      // Validate credit sale rules
      if (paymentMethod === 'credit') {
        if (!selectedCustomer) {
          throw new Error('Please select a registered customer for a credit sale.');
        }
        const currentDebt = activeCurrency === 'ZiG' ? selectedCustomer.outstandingBalanceZiG : selectedCustomer.outstandingBalanceUSD;
        if (selectedCustomer.creditLimit > 0 && currentDebt + finalTotal > selectedCustomer.creditLimit) {
          const proceed = confirm(
            `Credit Alert: This sale exceeds ${selectedCustomer.name}'s credit limit ($${selectedCustomer.creditLimit}). Do you wish to override?`
          );
          if (!proceed) {
            setIsProcessing(false);
            return;
          }
        }
      }

      // Prepare payments breakdown
      let payments: SalePayment[] = [];
      if (paymentMethod === 'credit') {
        payments = []; // 0 cash paid
      } else if (paymentMethod === 'split') {
        payments = [
          { method: 'cash', amount: splitCash, currency: activeCurrency },
          { method: 'ecocash', amount: splitSecondary, currency: activeCurrency },
        ];
      } else {
        payments = [{ method: paymentMethod, amount: finalTotal, currency: activeCurrency }];
      }

      const sale = await AccountingEngine.processSale({
        date: new Date().toISOString().split('T')[0],
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        items: cart,
        subtotal,
        discount: discountAmount,
        tax: 0,
        total: finalTotal,
        currency: activeCurrency,
        payments,
        isCredit: paymentMethod === 'credit',
        creditBalanceRemaining: paymentMethod === 'credit' ? finalTotal : 0,
        cashierId: activeUser.id,
        cashierName: activeUser.name,
      });

      // Clear cart and show receipt
      clearCart();
      triggerRefresh();
      setReceiptModalData(sale);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete transaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-20">
      {/* LEFT: Product Catalog & Search (7 Cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search Bar & Barcode Scan Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name, SKU or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-400 text-xs focus:outline-hidden focus:border-cyan-500 transition"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
          {filteredProducts.map((p) => {
            const inCart = cart.find((i) => i.productId === p.id);
            const isOutOfStock = p.currentStock <= 0;
            const isLowStock = p.currentStock <= p.minStockLevel && !isOutOfStock;

            return (
              <div
                key={p.id}
                onClick={() => !isOutOfStock && addToCart(p)}
                className={`relative flex flex-col justify-between p-3 rounded-xl border text-left transition select-none ${
                  isOutOfStock
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                    : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 cursor-pointer shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-mono">{p.sku}</span>
                    <span
                      className={`font-semibold ${
                        isOutOfStock
                          ? 'text-rose-400'
                          : isLowStock
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {p.currentStock} {p.unit}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white mt-1 line-clamp-2 leading-tight">
                    {p.name}
                  </h4>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div className="font-mono font-bold text-sm text-cyan-300">
                    {p.currency} {p.sellingPrice.toFixed(2)}
                  </div>
                  {inCart && (
                    <span className="h-5 w-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">
                      {inCart.quantity}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Active Shopping Cart & Instant Checkout (5 Cols) */}
      <div className="lg:col-span-5 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col justify-between space-y-4 shadow-xl">
        {/* Cart Header */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Active Sale Cart</h3>
              <span className="text-[11px] text-slate-400 font-mono">({cart.length} items)</span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Customer Selection (Walk-in vs Account) */}
          <div className="mt-3">
            <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Customer Assignment
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs focus:outline-hidden focus:border-cyan-500"
            >
              <option value="">Walk-in Customer (Standard Cash)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) - Bal: ${c.outstandingBalanceUSD.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Cart Item Rows */}
          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-slate-800/60">
            {cart.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Click items on the left to add to cart
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="pt-2 flex items-center justify-between text-xs">
                  <div className="flex-1 pr-2">
                    <span className="font-semibold text-slate-200 block truncate leading-tight">
                      {item.productName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.currency} {item.unitPrice.toFixed(2)} each
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-white font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="w-16 text-right font-mono font-bold text-cyan-300">
                    {item.total.toFixed(2)}
                  </div>

                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="ml-2 text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Totals & Payment Method Selector */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          {/* Subtotal & Discount row */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-200">{activeCurrency} {subtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-cyan-400" /> Discount:
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-20 text-right py-0.5 px-1.5 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Total Due:</span>
              <span className="text-xl font-black font-mono text-emerald-400">
                {activeCurrency} {finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Select Payment Method
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'cash', label: 'Cash' },
                { id: 'ecocash', label: 'EcoCash' },
                { id: 'bank', label: 'Bank Transfer' },
                { id: 'card', label: 'Card' },
                { id: 'credit', label: 'On Credit' },
                { id: 'split', label: 'Split Pay' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition ${
                    paymentMethod === m.id
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-xs'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split Payment inputs if split selected */}
          {paymentMethod === 'split' && (
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block">Cash Portion</label>
                <input
                  type="number"
                  value={splitCash}
                  onChange={(e) => setSplitCash(parseFloat(e.target.value) || 0)}
                  className="w-full p-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">EcoCash / Bank</label>
                <input
                  type="number"
                  value={splitSecondary}
                  onChange={(e) => setSplitSecondary(parseFloat(e.target.value) || 0)}
                  className="w-full p-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Complete Transaction Button */}
          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || isProcessing}
            className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition ${
              cart.length === 0 || isProcessing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-[0.99]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProcessing ? 'Processing Transaction...' : `Complete Sale (${activeCurrency} ${finalTotal.toFixed(2)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
