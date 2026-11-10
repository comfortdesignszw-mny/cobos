import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { generateUUID, queueSyncItem } from '../../services/accountingEngine';
import type { Product, StockMovement, CurrencyCode, StockMovementType } from '../../types';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  History,
  Tag,
  DollarSign,
  Package,
  Layers,
  X,
  CheckCircle2,
} from 'lucide-react';

export const InventoryModule: React.FC = () => {
  const { activeCurrency, activeUser, triggerRefresh, refreshKey } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'movements'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'low' | 'out'>('all');

  // New / Edit Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [unit, setUnit] = useState('pcs');
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minStockLevel, setMinStockLevel] = useState<number>(5);
  const [supplierName, setSupplierName] = useState('');

  // Stock Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<StockMovementType>('addition');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    async function loadInventory() {
      const allProds = await db.products.toArray();
      const allMovements = await db.stockMovements.toArray();
      setProducts(allProds);
      setMovements(allMovements.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
    loadInventory();
  }, [refreshKey]);

  // Calculations
  const totalValuationCost = products
    .filter((p) => p.currency === activeCurrency)
    .reduce((sum, p) => sum + p.currentStock * p.purchaseCost, 0);

  const totalValuationRetail = products
    .filter((p) => p.currency === activeCurrency)
    .reduce((sum, p) => sum + p.currentStock * p.sellingPrice, 0);

  const lowStockCount = products.filter((p) => p.currentStock <= p.minStockLevel && p.currentStock > 0).length;
  const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q);

    if (filterStockStatus === 'low') return matchesSearch && p.currentStock <= p.minStockLevel && p.currentStock > 0;
    if (filterStockStatus === 'out') return matchesSearch && p.currentStock <= 0;
    return matchesSearch;
  });

  const openNewProductModal = () => {
    setEditingProduct(null);
    setName('');
    setSku('SKU-' + Math.floor(100 + Math.random() * 900));
    setBarcode('');
    setCategory('General');
    setUnit('pcs');
    setPurchaseCost(0);
    setSellingPrice(0);
    setCurrency(activeCurrency);
    setCurrentStock(10);
    setMinStockLevel(5);
    setSupplierName('');
    setIsModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setSku(prod.sku);
    setBarcode(prod.barcode || '');
    setCategory(prod.category);
    setUnit(prod.unit);
    setPurchaseCost(prod.purchaseCost);
    setSellingPrice(prod.sellingPrice);
    setCurrency(prod.currency);
    setCurrentStock(prod.currentStock);
    setMinStockLevel(prod.minStockLevel);
    setSupplierName(prod.supplierName || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();

    if (editingProduct) {
      const updated: Product = {
        ...editingProduct,
        name,
        sku,
        barcode: barcode || undefined,
        category,
        unit,
        purchaseCost,
        sellingPrice,
        currency,
        currentStock,
        minStockLevel,
        supplierName: supplierName || undefined,
        updatedAt: now,
        syncStatus: 'pending',
      };
      await db.products.put(updated);
      await queueSyncItem('product', updated.id, 'UPDATE', updated);
    } else {
      const newProduct: Product = {
        id: 'prod_' + generateUUID(),
        sku,
        barcode: barcode || undefined,
        name,
        category,
        unit,
        purchaseCost,
        sellingPrice,
        currency,
        currentStock,
        minStockLevel,
        supplierName: supplierName || undefined,
        updatedAt: now,
        syncStatus: 'pending',
      };
      await db.products.put(newProduct);
      await queueSyncItem('product', newProduct.id, 'INSERT', newProduct);

      // Record initial stock creation movement
      const initialMovement: StockMovement = {
        id: generateUUID(),
        productId: newProduct.id,
        productName: newProduct.name,
        type: 'addition',
        quantityDelta: currentStock,
        stockAfter: currentStock,
        unitCost: purchaseCost,
        reference: 'INIT-STOCK',
        notes: 'Initial inventory quantity upon catalog entry',
        date: now.split('T')[0],
        performedBy: activeUser.name,
        createdAt: now,
      };
      await db.stockMovements.put(initialMovement);
    }

    setIsModalOpen(false);
    triggerRefresh();
  };

  const handleApplyStockAdjustment = async () => {
    if (!adjustingProduct || adjustQuantity <= 0) return;

    setIsAdjusting(true);
    try {
      const isReduction = ['reduction', 'damage', 'sale'].includes(adjustType);
      const delta = isReduction ? -adjustQuantity : adjustQuantity;
      const newStock = Math.max(0, adjustingProduct.currentStock + delta);

      const now = new Date().toISOString();

      // Update product stock
      await db.products.update(adjustingProduct.id, {
        currentStock: newStock,
        updatedAt: now,
        syncStatus: 'pending',
      });
      await queueSyncItem('product', adjustingProduct.id, 'UPDATE', { ...adjustingProduct, currentStock: newStock });

      // Record movement
      const movement: StockMovement = {
        id: generateUUID(),
        productId: adjustingProduct.id,
        productName: adjustingProduct.name,
        type: adjustType,
        quantityDelta: delta,
        stockAfter: newStock,
        unitCost: adjustingProduct.purchaseCost,
        reference: `ADJ-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        notes: adjustNotes || `${adjustType.toUpperCase()} adjustment`,
        date: now.split('T')[0],
        performedBy: activeUser.name,
        createdAt: now,
      };
      await db.stockMovements.put(movement);
      await queueSyncItem('stock_movement', movement.id, 'INSERT', movement);

      setAdjustingProduct(null);
      setAdjustNotes('');
      triggerRefresh();
    } catch (err: any) {
      alert('Adjustment failed: ' + err.message);
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header & Valuation Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-400" />
            Inventory & Stock Management
          </h2>
          <p className="text-xs text-slate-400">
            Real-time stock ledger, weighted cost valuation and reorder alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'catalog'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Catalog ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'movements'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Movement History
            </button>
          </div>

          <button
            onClick={openNewProductModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Inventory KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Inventory Value (Cost)</span>
          <div className="text-base sm:text-lg font-black font-mono text-cyan-300">
            {activeCurrency} {totalValuationCost.toFixed(2)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Retail Potential Value</span>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
            {activeCurrency} {totalValuationRetail.toFixed(2)}
          </div>
        </div>

        <div
          onClick={() => setFilterStockStatus(filterStockStatus === 'low' ? 'all' : 'low')}
          className={`p-3.5 rounded-xl border space-y-1 cursor-pointer transition ${
            filterStockStatus === 'low'
              ? 'bg-amber-950/60 border-amber-500/80'
              : 'bg-slate-900 border-slate-800 hover:border-amber-600/50'
          }`}
        >
          <span className="text-[10px] uppercase font-semibold text-amber-400">Low Stock Products</span>
          <div className="text-base sm:text-lg font-black font-mono text-amber-300">
            {lowStockCount} items
          </div>
        </div>

        <div
          onClick={() => setFilterStockStatus(filterStockStatus === 'out' ? 'all' : 'out')}
          className={`p-3.5 rounded-xl border space-y-1 cursor-pointer transition ${
            filterStockStatus === 'out'
              ? 'bg-rose-950/60 border-rose-500/80'
              : 'bg-slate-900 border-slate-800 hover:border-rose-600/50'
          }`}
        >
          <span className="text-[10px] uppercase font-semibold text-rose-400">Out of Stock</span>
          <div className="text-base sm:text-lg font-black font-mono text-rose-300">
            {outOfStockCount} items
          </div>
        </div>
      </div>

      {/* CATALOG VIEW */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by SKU, name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            {filterStockStatus !== 'all' && (
              <button
                onClick={() => setFilterStockStatus('all')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Clear Filters (Showing {filteredProducts.length} items)
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item & SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Cost Price</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Stock Level</th>
                    <th className="py-3 px-4 text-center">Supplier</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredProducts.map((p) => {
                    const isOut = p.currentStock <= 0;
                    const isLow = p.currentStock <= p.minStockLevel && !isOut;

                    return (
                      <tr key={p.id} className="hover:bg-slate-850/50 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {p.sku} {p.barcode ? `• Barcode: ${p.barcode}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {p.currency} {p.purchaseCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                          {p.currency} {p.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isOut
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : isLow
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {p.currentStock} {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                          {p.supplierName || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setAdjustingProduct(p);
                                setAdjustQuantity(1);
                                setAdjustType('addition');
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-medium transition"
                              title="Adjust Stock (Add, Damage, Audit)"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => openEditProductModal(p)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENTS HISTORY VIEW */}
      {activeTab === 'movements' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Qty Change</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                  <th className="py-3 px-4">Reference & Note</th>
                  <th className="py-3 px-4">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-850/50">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{m.date}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-white">{m.productName}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-sans uppercase text-[10px] font-bold px-2 py-0.5 rounded ${
                          m.type === 'sale'
                            ? 'bg-rose-500/10 text-rose-400'
                            : m.type === 'purchase' || m.type === 'addition'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold ${
                        m.quantityDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-200">{m.stockAfter}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-400">
                      {m.reference} &bull; {m.notes || ''}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-400">{m.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                {editingProduct ? 'Edit Product Item' : 'New Catalog Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mazoe Orange Crush 2L"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Barcode (Optional)</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan barcode..."
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pcs, bottles, bags, kg"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="ZiG">ZiG</option>
                    <option value="ZAR">ZAR</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Selling Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Current Quantity</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Minimum Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Supplier / Distributor</label>
                <input
                  type="text"
                  placeholder="e.g. Schweppes Zimbabwe Ltd"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Adjust Stock: {adjustingProduct.name}</h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
              Current on-hand stock: <span className="font-bold text-cyan-400">{adjustingProduct.currentStock} {adjustingProduct.unit}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Operation Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as StockMovementType)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="addition">Stock Addition (Restock / Found Stock)</option>
                  <option value="reduction">Stock Reduction</option>
                  <option value="damage">Damaged / Expired Goods</option>
                  <option value="return">Customer Return</option>
                  <option value="audit_adjustment">Physical Stocktake Count Adjustment</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 2 bottles broken during offloading from supplier truck..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isAdjusting}
                  onClick={handleApplyStockAdjustment}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {isAdjusting ? 'Applying...' : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
