import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { TrendingUp, PiggyBank, AlertOctagon } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface RevenueData {
  series: Array<{
    date: string;
    revenue: number;
    cost: number;
    grossMargin: number;
  }>;
  estimatedWasteLoss: number;
  estimatedRecommendationSavings: number;
}

export const RevenueProfitView: React.FC = () => {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/analytics/revenue')
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = data?.series.reduce((s, d) => s + d.revenue, 0) || 0;
  const totalCost = data?.series.reduce((s, d) => s + d.cost, 0) || 0;
  const totalGrossMargin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (totalGrossMargin / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Profit &amp; Revenue Analytics</h1>
        <p className="text-sm text-slate-500">
          Financial performance, gross margin trends, and inventory waste mitigation impact.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Revenue
          </span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">From store sales</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gross Margin
          </span>
          <div className="mt-2 text-2xl font-extrabold text-brand-700">
            ₹{totalGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-brand-600 font-medium mt-1 block">
            {marginPct.toFixed(1)}% margin rate
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider flex items-center space-x-1">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Waste Loss</span>
          </span>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">
            -₹{Number(data?.estimatedWasteLoss || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Actual expired inventory cost</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center space-x-1">
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Potential Savings</span>
          </span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">
            +₹{Number(data?.estimatedRecommendationSavings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Value preserved via markdowns</span>
        </div>
      </div>

      {/* Area Chart: Revenue vs Cost vs Margin */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-brand-600" />
          <span>Daily Revenue, Cost &amp; Gross Margin Over Time</span>
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Daily sales trends and margin tracking.
        </p>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
            Loading revenue data...
          </div>
        ) : !data || data.series.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
            No sales recorded yet.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.series}
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v).toFixed(2)}`]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue (₹)"
                  stroke="#16a34a"
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
                <Area
                  type="monotone"
                  dataKey="grossMargin"
                  name="Gross Margin (₹)"
                  stroke="#0ea5e9"
                  fillOpacity={1}
                  fill="url(#colorMargin)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
