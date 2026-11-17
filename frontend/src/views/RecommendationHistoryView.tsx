import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { Recommendation } from '../api/types';
import { History, Filter, ArrowUpRight, Percent, Calendar } from 'lucide-react';

export const RecommendationHistoryView: React.FC = () => {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    try {
      let path = '/recommendations/history?pageSize=100';
      if (typeFilter) {
        path += `&type=${typeFilter}`;
      }
      const res = await apiFetch(path);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recommendation History</h1>
          <p className="text-sm text-slate-500">
            Immutable log of all previously generated restocking and markdown recommendations.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          >
            <option value="">All Types (Restock &amp; Discount)</option>
            <option value="RESTOCK">Restock Only</option>
            <option value="DISCOUNT">Discount Only</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading recommendation logs...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No recommendation history recorded yet. Run recommendations to populate this log.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Batch ID</th>
                  <th className="px-4 py-3">Suggested Action</th>
                  <th className="px-4 py-3">Stored Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const rationale = item.rationale as any;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(item.generatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            item.type === 'RESTOCK'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.type === 'RESTOCK' ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <Percent className="w-3 h-3" />
                          )}
                          <span>{item.type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.product?.name || 'Product'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {item.batchId ? `${item.batchId.substring(0, 8)}...` : '—'}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {item.type === 'RESTOCK'
                          ? `Order +${Number(item.suggestedValue)} units`
                          : `Apply ${Number(item.suggestedValue)}% Discount`}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {rationale?.basis || 'rule_evaluated'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
