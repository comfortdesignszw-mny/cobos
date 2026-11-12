import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/cobosDb';
import { generateUUID, queueSyncItem } from '../../services/accountingEngine';
import { GuestLimitService } from '../../services/guestLimitService';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
import { compressImageFile } from '../../utils/imageCompressor';
import type { Product, StockMovement, CurrencyCode, StockMovementType, InventoryItemType } from '../../types';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Package,
  Layers,
  X,
  CheckCircle2,
  LayoutGrid,
  List,
  CreditCard,
  Camera,
  Image as ImageIcon,
  Wrench,
  Lock,
} from 'lucide-react';

export const InventoryModule: React.FC = () => {
  const { activeCurrency, activeUser, currentUser, openNudge, triggerRefresh, refreshKey } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'movements'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'low' | 'out'>('all');
  const [filterItemType, setFilterItemType] = useState<'all' | 'product' | 'service'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'cards' | 'list'>('grid');

  // New / Edit Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [itemType, setItemType] = useState<InventoryItemType>('product');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('pcs');
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minStockLevel, setMinStockLevel] = useState<number>(5);
  const [supplierName, setSupplierName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isCompressingImg, setIsCompressingImg] = useState(false);

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
    .filter((p) => p.currency === activeCurrency && p.itemType !== 'service')
    .reduce((sum, p) => sum + p.currentStock * p.purchaseCost, 0);

  const totalValuationRetail = products
    .filter((p) => p.currency === activeCurrency && p.itemType !== 'service')
    .reduce((sum, p) => sum + p.currentStock * p.sellingPrice, 0);

  const lowStockCount = products.filter((p) => p.itemType !== 'service' && p.currentStock <= p.minStockLevel && p.currentStock > 0).length;
  const outOfStockCount = products.filter((p) => p.itemType !== 'service' && p.currentStock <= 0).length;

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q);

    const matchesType = filterItemType === 'all' || p.itemType === filterItemType;

    if (filterStockStatus === 'low') return matchesSearch && matchesType && p.itemType !== 'service' && p.currentStock <= p.minStockLevel && p.currentStock > 0;
    if (filterStockStatus === 'out') return matchesSearch && matchesType && p.itemType !== 'service' && p.currentStock <= 0;
    return matchesSearch && matchesType;
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingImg(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 600, maxHeight: 600, quality: 0.8 });
      setImageUrl(compressed);
    } catch (err) {
      alert('Failed to process image file.');
    } finally {
      setIsCompressingImg(false);
    }
  };

  const openNewProductModal = async () => {
    if (!currentUser) {
      const { allowed, count } = await GuestLimitService.checkCanAddProduct();
      if (!allowed) {
        openNudge('limit_inventory', count);
        return;
      }
    }

    setEditingProduct(null);
    setItemType('product');
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
    setImageUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setItemType(p.itemType || 'product');
    setName(p.name);
    setSku(p.sku);
    setBarcode(p.barcode || '');
    setCategory(p.category);
    setUnit(p.unit);
    setPurchaseCost(p.purchaseCost);
    setSellingPrice(p.sellingPrice);
    setCurrency(p.currency);
    setCurrentStock(p.currentStock);
    setMinStockLevel(p.minStockLevel);
    setSupplierName(p.supplierName || '');
    setImageUrl(p.imageUrl || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct && !currentUser) {
      const { allowed, count } = await GuestLimitService.checkCanAddProduct();
      if (!allowed) {
        openNudge('limit_inventory', count);
        return;
      }
    }

    const now = new Date().toISOString();

    const productPayload: Product = {
      id: editingProduct ? editingProduct.id : 'prod_' + generateUUID(),
      itemType,
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      name: name.trim(),
      category: category.trim(),
      unit: itemType === 'service' ? (unit === 'pcs' ? 'sessions' : unit) : unit.trim(),
      purchaseCost: Number(purchaseCost) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      currency,
      currentStock: itemType === 'service' ? 999999 : Number(currentStock) || 0,
      minStockLevel: itemType === 'service' ? 0 : Number(minStockLevel) || 5,
      supplierName: supplierName.trim() || undefined,
      imageUrl: imageUrl || undefined,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await db.products.put(productPayload);
    await queueSyncItem('product', productPayload.id, editingProduct ? 'UPDATE' : 'INSERT', productPayload);

    setIsModalOpen(false);
    triggerRefresh();
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-400" />
            <span>Inventory & Services Management</span>
            {!currentUser && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 border border-amber-700/60 text-amber-300">
                Guest Limit: Max 20 Products
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Catalog, stock adjustments, and service rate management.
          </p>
        </div>

        <button
          onClick={openNewProductModal}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product / Service</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Total Inventory Items
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-white">
            {products.length}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Valuation Cost ({activeCurrency})
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-cyan-400">
            ${totalValuationCost.toFixed(2)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Retail Potential ({activeCurrency})
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
            ${totalValuationRetail.toFixed(2)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Low Stock Alerts
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
            {lowStockCount} items
          </span>
        </div>
      </div>

      {/* Controls: Search, View Mode (List/Grid/Cards), and Type Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, SKU, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden"
            />
          </div>

          {/* Type Filter */}
          <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setFilterItemType('all')}
              className={`px-3 py-1 rounded-lg ${filterItemType === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterItemType('product')}
              className={`px-3 py-1 rounded-lg ${filterItemType === 'product' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              Products
            </button>
            <button
              onClick={() => setFilterItemType('service')}
              className={`px-3 py-1 rounded-lg ${filterItemType === 'service' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              Services
            </button>
          </div>
        </div>

        {/* View Switcher: Grid, Cards, List */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            title="Grid View"
            className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            title="Card View"
            className={`p-1.5 rounded-lg ${viewMode === 'cards' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
          >
            <CreditCard className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List View"
            className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* View Mode 1: GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => openEditModal(p)}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer flex flex-col justify-between group shadow-sm text-xs"
            >
              <div>
                {p.imageUrl ? (
                  <div className="w-full aspect-video rounded-xl bg-slate-950 mb-2 overflow-hidden border border-slate-800">
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-xl bg-slate-950/70 mb-2 flex items-center justify-center border border-slate-800/80 text-slate-700">
                    {p.itemType === 'service' ? <Wrench className="w-6 h-6 text-slate-600" /> : <Package className="w-6 h-6 text-slate-600" />}
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="font-mono">{p.sku}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-cyan-300 uppercase">
                    {p.itemType === 'service' ? 'Service' : p.category}
                  </span>
                </div>
                <h4 className="font-bold text-white text-xs line-clamp-2">{p.name}</h4>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-white block">
                    {p.currency} {p.sellingPrice.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">per {p.unit}</span>
                </div>
                {p.itemType === 'service' ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                    Service
                  </span>
                ) : (
                  <span className="font-mono font-bold text-slate-400 text-[10px]">
                    {p.currentStock} {p.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Mode 2: CARDS VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => openEditModal(p)}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer flex gap-3 text-xs shadow-md"
            >
              <div className="w-20 h-20 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : p.itemType === 'service' ? (
                  <Wrench className="w-8 h-8 text-cyan-400" />
                ) : (
                  <Package className="w-8 h-8 text-slate-600" />
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-mono">{p.sku}</span>
                    <span className="font-bold text-cyan-300 uppercase">{p.itemType}</span>
                  </div>
                  <h4 className="font-bold text-white truncate text-sm">{p.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate">Category: {p.category}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="font-mono font-bold text-white">
                    {p.currency} {p.sellingPrice.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-slate-300 font-mono">
                    {p.itemType === 'service' ? 'Unlimited' : `Stock: ${p.currentStock} ${p.unit}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Mode 3: LIST VIEW */}
      {viewMode === 'list' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Cost Price</th>
                <th className="p-3 text-right">Selling Price</th>
                <th className="p-3 text-right">Stock Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredProducts.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openEditModal(p)}
                  className="hover:bg-slate-800/50 cursor-pointer transition"
                >
                  <td className="p-3 text-slate-400">{p.sku}</td>
                  <td className="p-3 font-sans font-bold text-white flex items-center gap-2">
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />}
                    <span>{p.name}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.itemType === 'service' ? 'bg-cyan-950 text-cyan-300' : 'bg-slate-800 text-slate-300'}`}>
                      {p.itemType}
                    </span>
                  </td>
                  <td className="p-3 font-sans text-slate-300">{p.category}</td>
                  <td className="p-3 text-right text-slate-400">{p.currency} {p.purchaseCost.toFixed(2)}</td>
                  <td className="p-3 text-right font-bold text-white">{p.currency} {p.sellingPrice.toFixed(2)}</td>
                  <td className="p-3 text-right text-slate-300">
                    {p.itemType === 'service' ? 'Unlimited' : `${p.currentStock} ${p.unit}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <span>{editingProduct ? 'Edit Catalog Item' : 'Add Product or Service'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              {/* Product vs Service Switcher */}
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1.5">
                  Select Item Classification
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemType('product')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition ${
                      itemType === 'product'
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>Physical Product</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('service')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition ${
                      itemType === 'service'
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Billable Service</span>
                  </button>
                </div>
              </div>

              {/* Image Upload with Compression */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isCompressingImg ? 'Compressing...' : 'Upload Item Photo'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Optimized WebP for fast mobile browsing
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                  {itemType === 'product' ? 'Product Name' : 'Service Description'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={itemType === 'product' ? 'e.g. Red Seal Roller Meal 10kg' : 'e.g. Device Repair / Consultation Fee'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold uppercase text-slate-400 block">Barcode / QR</label>
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Scan</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan with camera..."
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={itemType === 'product' ? 'pcs, kg, box' : 'hours, job'}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Cost Price ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Selling Price ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
              </div>

              {itemType === 'product' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Opening Physical Stock</label>
                    <input
                      type="number"
                      value={currentStock}
                      onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Min Alert Level</label>
                    <input
                      type="number"
                      value={minStockLevel}
                      onChange={(e) => setMinStockLevel(parseFloat(e.target.value) || 5)}
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setBarcode(code)}
        title="Scan Barcode to Link with Product"
      />
    </div>
  );
};
