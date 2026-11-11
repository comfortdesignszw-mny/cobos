import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { AccountingEngine } from '../../services/accountingEngine';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
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
  Camera,
  Layers,
  Sparkles,
  Package,
  Wrench,
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
  const [selectedItemType, setSelectedItemType] = useState<'all' | 'product' | 'service'>('all');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'ecocash' | 'bank' | 'card' | 'credit' | 'split'>('cash');
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitSecondary, setSplitSecondary] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Barcode Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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

  // Filter products by search, category, and Product vs Service
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesType = selectedItemType === 'all' || p.itemType === selectedItemType;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCat && matchesType && matchesSearch;
  });

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(0, subtotal - (discountAmount || 0));

  const addToCart = (product: Product) => {
    // Only physical products are subject to stock inventory checks; Services are always available
    if (product.itemType !== 'service' && product.currentStock <= 0) {
      alert(`Notice: ${product.name} is currently out of physical stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (product.itemType !== 'service' && existing.quantity >= product.currentStock) {
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
          itemType: product.itemType,
          imageUrl: product.imageUrl,
        },
      ];
    });
  };

  const handleScanCode = (scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    const match = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === clean) ||
        p.sku.toLowerCase() === clean
    );

    if (match) {
      addToCart(match);
    } else {
      setSearchQuery(scannedCode);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const prod = products.find((p) => p.id === productId);
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (prod && prod.itemType !== 'service' && newQty > prod.currentStock) {
              alert(`Cannot exceed available stock of ${prod.currentStock}`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              total: newQty * item.unitPrice,
            };
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
    setSelectedCustomerId('');
  };

  // Process checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setErrorMsg('Cart is empty. Add products or services first.');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      setErrorMsg('A customer account must be selected to record a credit sale.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
      const isCredit = paymentMethod === 'credit';

      const payments: SalePayment[] = [];
      let creditRemaining = 0;

      if (paymentMethod === 'split') {
        const cashAmt = Number(splitCash) || 0;
        const secondAmt = Number(splitSecondary) || 0;
        if (Math.abs(cashAmt + secondAmt - finalTotal) > 0.05) {
          throw new Error(`Split payments (${cashAmt} + ${secondAmt} = ${cashAmt + secondAmt}) must equal total of ${finalTotal.toFixed(2)} ${activeCurrency}`);
        }
        if (cashAmt > 0) payments.push({ method: 'cash', amount: cashAmt, currency: activeCurrency });
        if (secondAmt > 0) payments.push({ method: 'ecocash', amount: secondAmt, currency: activeCurrency });
      } else if (isCredit) {
        creditRemaining = finalTotal;
      } else {
        payments.push({
          method: paymentMethod as any,
          amount: finalTotal,
          currency: activeCurrency,
        });
      }

      const receiptNumber = 'REC-' + Math.floor(100000 + Math.random() * 900000);

      const { sale } = await AccountingEngine.processSale({
        sale: {
          receiptNumber,
          date: new Date().toISOString().split('T')[0],
          customerId: selectedCustomer?.id,
          customerName: selectedCustomer?.name || 'Walk-in Customer',
          items: cart,
          subtotal,
          discount: Number(discountAmount) || 0,
          tax: 0,
          total: finalTotal,
          currency: activeCurrency,
          payments,
          isCredit,
          creditBalanceRemaining: creditRemaining,
          cashierId: activeUser.id,
          cashierName: activeUser.name,
        },
        userId: activeUser.id,
        userName: activeUser.name,
        userEmail: activeUser.email,
      });

      // Clear Cart & Show Printable Receipt Modal
      clearCart();
      setReceiptModalData(sale);
      triggerRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete transaction.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Bar with Camera Scanner Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            <span>Point of Sale Terminal</span>
          </h2>
          <p className="text-xs text-slate-400">
            Cashier: <strong className="text-cyan-300">{activeUser.name}</strong> • Currency:{' '}
            <strong className="text-white font-mono">{activeCurrency}</strong>
          </p>
        </div>

        {/* Scan Barcode / QR with Camera */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition active:scale-[0.98]"
        >
          <Camera className="w-4 h-4" />
          <span>Scan Barcode / QR</span>
        </button>
      </div>

      {/* Main Grid: Catalog (Left) and Cart / Checkout (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Product & Service Catalog */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search, Type Filter & Categories */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search products or services by name, SKU or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              {/* Type Switcher: All / Products / Services */}
              <div className="flex rounded-xl bg-slate-900 p-0.5 border border-slate-800 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedItemType('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    selectedItemType === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemType('product')}
                  className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition ${
                    selectedItemType === 'product'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Goods</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemType('service')}
                  className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition ${
                    selectedItemType === 'service'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Services</span>
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const isService = product.itemType === 'service';
              const isOutOfStock = !isService && product.currentStock <= 0;
              const isLowStock = !isService && product.currentStock <= product.minStockLevel && product.currentStock > 0;

              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition group relative overflow-hidden ${
                    isOutOfStock
                      ? 'bg-slate-950/40 border-slate-800/50 opacity-50 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-cyan-500/50 shadow-sm active:scale-[0.98]'
                  }`}
                >
                  {/* Thumbnail if present */}
                  {product.imageUrl ? (
                    <div className="w-full aspect-video rounded-xl bg-slate-950 mb-2 overflow-hidden border border-slate-800">
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                  ) : null}

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-mono">{product.sku}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 uppercase">
                        {isService ? 'Service' : product.category}
                      </span>
                    </div>

                    <div className="font-bold text-white text-xs line-clamp-2 leading-snug group-hover:text-cyan-300 transition">
                      {product.name}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-white">
                        {product.currency} {product.sellingPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        per {product.unit}
                      </span>
                    </div>

                    <div className="text-right">
                      {isService ? (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                          Unlimited
                        </span>
                      ) : isOutOfStock ? (
                        <span className="text-[10px] text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded">
                          Out of stock
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            isLowStock ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          {product.currentStock} {product.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 space-y-2">
              <Package className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No items match your query</p>
              <p className="text-xs">Add new stock or services in the Inventory module.</p>
            </div>
          )}
        </div>

        {/* Right: Cart & Checkout Summary */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl space-y-4 text-xs">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Current Order</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 text-[10px] font-mono font-bold">
                  {cart.length} lines
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate text-xs">{item.productName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.currency} {item.unitPrice.toFixed(2)} ea
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-white w-6 text-center text-xs">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right font-mono font-bold text-white shrink-0 min-w-[50px]">
                    {item.total.toFixed(2)}
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-8 text-center text-slate-500 space-y-1">
                  <p>Cart is currently empty</p>
                  <p className="text-[10px]">Select items or scan barcode to begin</p>
                </div>
              )}
            </div>

            {/* Customer Link for Debt / Credit Sale */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <label className="text-[10px] font-semibold uppercase text-slate-400 block">
                Customer Account (Optional / Credit)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-hidden"
              >
                <option value="">Walk-in Customer (Cash)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - Bal: ${c.outstandingBalanceUSD.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase text-slate-400 block">
                Payment Settlement Method
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'cash', label: 'Cash' },
                  { id: 'ecocash', label: 'EcoCash' },
                  { id: 'bank', label: 'Bank/Card' },
                  { id: 'credit', label: 'On Credit' },
                  { id: 'split', label: 'Split Pay' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-center font-medium transition text-xs ${
                      paymentMethod === m.id
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Pay Inputs */}
            {paymentMethod === 'split' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Cash Portion:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={splitCash}
                    onChange={(e) => setSplitCash(parseFloat(e.target.value) || 0)}
                    className="w-24 p-1 rounded bg-slate-900 border border-slate-700 text-right font-mono text-white text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">EcoCash / Bank:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={splitSecondary}
                    onChange={(e) => setSplitSecondary(parseFloat(e.target.value) || 0)}
                    className="w-24 p-1 rounded bg-slate-900 border border-slate-700 text-right font-mono text-white text-xs"
                  />
                </div>
              </div>
            )}

            {/* Totals Summary */}
            <div className="pt-3 border-t border-slate-800 space-y-1.5">
              <div className="flex justify-between text-slate-400 text-xs">
                <span>Subtotal:</span>
                <span className="font-mono text-white">
                  {activeCurrency} {subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Discount:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-20 p-1 rounded bg-slate-950 border border-slate-700 text-right font-mono text-white text-xs"
                />
              </div>

              <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-slate-800 text-white">
                <span>Total Payable:</span>
                <span className="font-mono text-cyan-400 text-base">
                  {activeCurrency} {finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              onClick={handleCheckout}
              disabled={isProcessing || cart.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-lg transition active:scale-[0.99] disabled:opacity-50"
            >
              {isProcessing
                ? 'Posting Balanced Journal...'
                : `Complete Sale (${activeCurrency} ${finalTotal.toFixed(2)})`}
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanCode}
        title="Point of Sale Hardware Barcode / QR Scanner"
      />
    </div>
  );
};
