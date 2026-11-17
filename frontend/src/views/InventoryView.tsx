import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { Product, Batch } from '../api/types';
import {
  AlertTriangle,
  Plus,
  Package,
  Calendar,
  ChevronDown,
  ChevronRight,
  Layers,
  CheckCircle,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<Batch[]>([]);
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const [productBatches, setProductBatches] = useState<{ [productId: string]: Batch[] }>({});
  const [loading, setLoading] = useState(true);

  // Receive stock modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantityReceived, setQuantityReceived] = useState<number>(30);
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [purchaseCost, setPurchaseCost] = useState<number>(45);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveSuccess, setReceiveSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, expiringRes] = await Promise.all([
        apiFetch('/products?pageSize=100'),
        apiFetch('/batches/expiring?withinDays=5'),
      ]);

      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData.items || []);
        if (pData.items && pData.items.length > 0 && !selectedProductId) {
          setSelectedProductId(pData.items[0].id);
        }
      }

      if (expiringRes.ok) {
        const eData = await expiringRes.json();
        setExpiringBatches(eData.items || []);
      }
    } catch (e) {
      console.error('Failed to load inventory data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleExpand = async (productId: string) => {
    const next = new Set(expandedProductIds);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
      if (!productBatches[productId]) {
        try {
          const res = await apiFetch(`/products/${productId}/batches?pageSize=100`);
          if (res.ok) {
            const data = await res.json();
            setProductBatches((prev) => ({ ...prev, [productId]: data.items }));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    setExpandedProductIds(next);
  };

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiveError(null);
    setReceiveSuccess(null);

    if (quantityReceived <= 0 || purchaseCost <= 0) {
      setReceiveError('Quantity and cost must be strictly greater than zero.');
      return;
    }
    if (new Date(expiryDate) <= new Date(purchaseDate)) {
      setReceiveError('Expiry date must be strictly after the purchase date.');
      return;
    }

    try {
      const res = await apiFetch(`/products/${selectedProductId}/batches`, {
        method: 'POST',
        body: JSON.stringify({
          quantityReceived: Number(quantityReceived),
          purchaseDate,
          expiryDate,
          purchaseCostPerUnit: Number(purchaseCost),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setReceiveError(err.message || 'Failed to receive stock');
        return;
      }

      setReceiveSuccess('Batch received successfully!');
      const bRes = await apiFetch(`/products/${selectedProductId}/batches?pageSize=100`);
      if (bRes.ok) {
        const bData = await bRes.json();
        setProductBatches((prev) => ({ ...prev, [selectedProductId]: bData.items }));
      }
      const eRes = await apiFetch('/batches/expiring?withinDays=5');
      if (eRes.ok) {
        const eData = await eRes.json();
        setExpiringBatches(eData.items || []);
      }

      setTimeout(() => {
        setModalOpen(false);
        setReceiveSuccess(null);
      }, 1200);
    } catch (err: any) {
      setReceiveError(err.message || 'Network error');
    }
  };

  const calculateDaysToExpiry = (expiryDateStr: string) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    exp.setUTCHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header and Receive Stock Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Overview</h1>
          <p className="text-sm text-slate-500">
            Real-time batch-level tracking of grocery items and expiration windows.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Receive Stock Batch</span>
        </button>
      </div>

      {/* Expiring-Soon Alerts */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-2 text-amber-900 font-semibold mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>Expiring-Soon Alerts (Within 5 Days)</span>
          <span className="bg-amber-200 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold ml-2">
            {expiringBatches.length} {expiringBatches.length === 1 ? 'Batch' : 'Batches'}
          </span>
        </div>

        {expiringBatches.length === 0 ? (
          <p className="text-sm text-amber-700">No active batches are expiring within the next 5 days.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringBatches.map((batch) => {
              const daysLeft = calculateDaysToExpiry(batch.expiryDate);
              return (
                <div
                  key={batch.id}
                  className="bg-white border border-amber-200 rounded-lg p-3.5 shadow-xs flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{batch.product?.name || 'Product'}</h4>
                    <span className="text-xs text-slate-500">
                      {batch.product?.category} • {Number(batch.quantityRemaining)} {batch.product?.unit} remaining
                    </span>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Expires: {new Date(batch.expiryDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                        daysLeft <= 1
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : daysLeft <= 3
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                      }`}
                    >
                      {daysLeft <= 0 ? 'Expires Today' : `${daysLeft}d left`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product List with Expandable Batches */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900 flex items-center space-x-2">
            <Package className="w-5 h-5 text-slate-500" />
            <span>Product Catalog &amp; Active Batches</span>
          </h2>
          <span className="text-xs text-slate-500">
            Click any item to inspect its purchase batches and depletion schedule
          </span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-800">No products in inventory</h3>
            <p className="text-sm text-slate-500 mt-1">
              Run the database seed command in the console to populate realistic Indian grocery inventory and sales history.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {products.map((product) => {
              const isExpanded = expandedProductIds.has(product.id);
              const batches = productBatches[product.id] || [];

              return (
                <div key={product.id} className="transition">
                  <div
                    onClick={() => toggleExpand(product.id)}
                    className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center space-x-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 text-sm">{product.name}</span>
                          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                            {product.category}
                          </span>
                          {!product.isActive && (
                            <span className="bg-rose-50 text-rose-600 text-xs px-2 py-0.5 rounded-full font-medium">
                              Deactivated
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Shelf life: {product.shelfLifeDays} days • Cost: ₹{Number(product.defaultPurchaseCost).toFixed(2)} • Sell: ₹{Number(product.defaultSellingPrice).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-brand-700 font-medium bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-md">
                        View Batches
                      </span>
                    </div>
                  </div>

                  {/* Expandable Batches Drilldown */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 border-t border-slate-100 px-6 py-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Batches for {product.name} (FIFO Consumption)</span>
                      </h4>

                      {batches.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No batches found for this product.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-semibold">
                              <tr>
                                <th className="px-3 py-2 rounded-l">Batch ID</th>
                                <th className="px-3 py-2">Purchase Date</th>
                                <th className="px-3 py-2">Expiry Date</th>
                                <th className="px-3 py-2">Days to Expiry</th>
                                <th className="px-3 py-2">Received</th>
                                <th className="px-3 py-2">Remaining</th>
                                <th className="px-3 py-2">Unit Cost</th>
                                <th className="px-3 py-2 rounded-r">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {batches.map((b) => {
                                const days = calculateDaysToExpiry(b.expiryDate);
                                return (
                                  <tr key={b.id} className="hover:bg-white transition">
                                    <td className="px-3 py-2.5 font-mono text-slate-500">
                                      {b.id.substring(0, 8)}...
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-700">
                                      {new Date(b.purchaseDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-700 font-medium">
                                      {new Date(b.expiryDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span
                                        className={`font-semibold ${
                                          b.status === 'EXPIRED'
                                            ? 'text-rose-600'
                                            : days <= 3
                                            ? 'text-amber-600'
                                            : 'text-slate-600'
                                        }`}
                                      >
                                        {b.status === 'EXPIRED' ? 'Expired' : `${days} days`}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600">
                                      {Number(b.quantityReceived)}
                                    </td>
                                    <td className="px-3 py-2.5 font-bold text-slate-900">
                                      {Number(b.quantityRemaining)}
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600">
                                      ₹{Number(b.purchaseCostPerUnit).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          b.status === 'ACTIVE'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : b.status === 'DEPLETED'
                                            ? 'bg-slate-200 text-slate-700'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {b.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Receive Stock Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Receive New Stock Batch</h3>
            <p className="text-xs text-slate-500 mb-4">
              Record a new delivery batch with purchase cost and expiration date.
            </p>

            {receiveError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{receiveError}</span>
              </div>
            )}

            {receiveSuccess && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-lg flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{receiveSuccess}</span>
              </div>
            )}

            <form onSubmit={handleReceiveStock} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={quantityReceived}
                    onChange={(e) => setQuantityReceived(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition text-sm font-semibold"
                >
                  Confirm &amp; Receive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
