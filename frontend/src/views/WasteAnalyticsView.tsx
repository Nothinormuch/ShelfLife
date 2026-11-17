import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { Trash2, IndianRupee } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface WasteData {
  byProduct: Array<{
    productId: string;
    productName: string;
    category: string;
    wastedQuantity: number;
    wastedCost: number;
  }>;
  total: {
    wastedQuantity: number;
    wastedCost: number;
  };
}

export const WasteAnalyticsView: React.FC = () => {
  const [data, setData] = useState<WasteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/analytics/waste')
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Waste &amp; Spoilage Analytics</h1>
        <p className="text-sm text-slate-500">
          Tracking unsold inventory expired on shelves and associated write-off loss.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center space-x-2 text-rose-600 font-semibold text-xs uppercase tracking-wider">
            <IndianRupee className="w-4 h-4" />
            <span>Total Spoilage Financial Loss</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            ₹{Number(data?.total?.wastedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calculated as sum of remaining quantity × unit purchase cost on expired batches.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center space-x-2 text-amber-600 font-semibold text-xs uppercase tracking-wider">
            <Trash2 className="w-4 h-4" />
            <span>Total Units Expired &amp; Discarded</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {Number(data?.total?.wastedQuantity || 0).toFixed(1)} units
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Unsold stock written off due to shelf-life expiration.
          </p>
        </div>
      </div>

      {/* Chart: Waste by Product */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Spoilage Cost by Product</h3>
        <p className="text-xs text-slate-500 mb-6">
          Breakdown of write-off losses across perishable grocery items.
        </p>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
            Calculating waste metrics...
          </div>
        ) : !data || data.byProduct.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
            No expired stock recorded yet. Inventory write-offs will appear here.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.byProduct}
                margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="productName"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, 'Wasted Cost']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="wastedCost"
                  name="Wasted Cost (₹)"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Per-Product Waste Summary</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Units Wasted</th>
                <th className="px-6 py-3">Total Cost Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.byProduct.map((p) => (
                <tr key={p.productId} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-3 font-semibold text-slate-800">{p.productName}</td>
                  <td className="px-6 py-3 text-slate-600">{p.category}</td>
                  <td className="px-6 py-3 text-slate-700 font-medium">{p.wastedQuantity}</td>
                  <td className="px-6 py-3 font-bold text-rose-600">
                    ₹{Number(p.wastedCost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
