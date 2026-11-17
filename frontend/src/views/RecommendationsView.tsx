import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { Recommendation } from '../api/types';
import {
  Sparkles,
  ArrowUpRight,
  Percent,
  RefreshCw,
  Package,
  Calendar,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export const RecommendationsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RESTOCK' | 'DISCOUNT'>('RESTOCK');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const fetchRecommendations = async (type: 'RESTOCK' | 'DISCOUNT') => {
    setLoading(true);
    try {
      const res = await apiFetch(`/recommendations?type=${type}&pageSize=50`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(activeTab);
  }, [activeTab]);

  const handleTriggerRecompute = async () => {
    setRecomputing(true);
    await fetchRecommendations(activeTab);
    setRecomputing(false);
  };

  const calculateDaysToExpiry = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    exp.setUTCHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Decision Support</h1>
          <p className="text-sm text-slate-500">
            Hybrid ML-driven recommendations combining next-day demand with deterministic business rules.
          </p>
        </div>
        <button
          onClick={handleTriggerRecompute}
          disabled={recomputing || loading}
          className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`} />
          <span>Recompute Recommendations</span>
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          onClick={() => setActiveTab('RESTOCK')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition border-b-2 ${
            activeTab === 'RESTOCK'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Restock Recommendations (Products)</span>
        </button>
        <button
          onClick={() => setActiveTab('DISCOUNT')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition border-b-2 ${
            activeTab === 'DISCOUNT'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Discount Recommendations (At-Risk Batches)</span>
        </button>
      </div>

      {/* Recommendations Cards / Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Computing recommendations...</div>
        ) : recommendations.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-slate-800">
              {activeTab === 'RESTOCK' ? 'Stock Levels Optimal' : 'No Batches at Imminent Expiry Risk'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {activeTab === 'RESTOCK'
                ? 'Current inventory across all products is sufficient to meet projected demand.'
                : 'Projected demand will deplete existing inventory batches before their respective expiry dates.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recommendations.map((rec) => {
              const daysLeft = calculateDaysToExpiry(rec.batch?.expiryDate);

              return (
                <div key={rec.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                  {/* Left: Target details */}
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                        rec.type === 'RESTOCK' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rec.type === 'RESTOCK' ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <Percent className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-slate-900 text-base">{rec.product?.name}</h4>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                          {rec.product?.category}
                        </span>
                      </div>

                      {rec.type === 'DISCOUNT' && rec.batch && (
                        <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                          <span className="font-mono">Batch: {rec.batch.id.substring(0, 8)}...</span>
                          <span>Remaining: {Number(rec.batch.quantityRemaining)} {rec.product?.unit}</span>
                          <span className="font-medium text-amber-700">
                            Expires: {new Date(rec.batch.expiryDate).toLocaleDateString()} ({daysLeft}d left)
                          </span>
                        </div>
                      )}

                      <div className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Generated: {new Date(rec.generatedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Recommendation Value (FR-29: renders clean recommendation directly) */}
                  <div className="flex items-center md:text-right">
                    {rec.type === 'RESTOCK' ? (
                      <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
                        <span className="text-xs text-emerald-800 font-semibold uppercase tracking-wider block">
                          Suggested Reorder
                        </span>
                        <span className="text-2xl font-black text-emerald-700">
                          +{Number(rec.suggestedValue)} {rec.product?.unit || 'units'}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl">
                        <span className="text-xs text-amber-800 font-semibold uppercase tracking-wider block">
                          Suggested Markdown
                        </span>
                        <span className="text-2xl font-black text-amber-700">
                          {Number(rec.suggestedValue)}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
