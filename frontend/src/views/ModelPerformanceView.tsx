import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { ModelEvaluation } from '../api/types';
import {
  Activity,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Info,
  Layers,
  Play,
  RefreshCw,
  TrendingDown,
} from 'lucide-react';

interface LatestEvaluationResponse {
  aggregate: ModelEvaluation | null;
  byProduct: ModelEvaluation[];
}

export const ModelPerformanceView: React.FC = () => {
  const [latest, setLatest] = useState<LatestEvaluationResponse | null>(null);
  const [history, setHistory] = useState<ModelEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const [latestRes, historyRes] = await Promise.all([
        apiFetch('/ml/evaluation'),
        apiFetch('/ml/evaluation/history'),
      ]);

      if (latestRes.ok) {
        const lData = await latestRes.json();
        setLatest(lData);
      }

      if (historyRes.ok) {
        const hData = await historyRes.json();
        setHistory(hData.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluations();
  }, []);

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await apiFetch('/ml/evaluation/run', { method: 'POST' });
      if (res.ok) {
        await loadEvaluations();
      } else {
        const err = await res.json();
        alert(`Evaluation run failed: ${err.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error running evaluation: ${e.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const agg = latest?.aggregate;

  return (
    <div className="space-y-6">
      {/* Header & Run Evaluation Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Model Performance &amp; Evaluation</h1>
          <p className="text-sm text-slate-500">
            Out-of-sample holdout validation (80% train / 20% test split) measuring demand forecast accuracy.
          </p>
        </div>
        <button
          onClick={handleRunEvaluation}
          disabled={evaluating || loading}
          className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-xs"
        >
          {evaluating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-white" />
          )}
          <span>{evaluating ? 'Evaluating Holdout...' : 'Trigger Evaluation Run'}</span>
        </button>
      </div>

      {/* Methodology Banner */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start space-x-3 text-sky-900">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-sm">Evaluation Methodology (FR-31 &amp; C-12)</p>
          <p>
            For each product with ≥30 days of sales history, the earliest 80% is used exclusively for training and the remaining 20% is held out as an unobserved test set (minimum 6 test points required). MAE and RMSE are computed strictly on the held-out test window.
          </p>
        </div>
      </div>

      {/* Aggregate KPI Cards (AC-17) */}
      {!agg || agg.testSetSize === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-slate-800">No Evaluation History Available</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Products must have at least 30 days of sales history before time-based holdout evaluation can execute. Click "Seed Synthetic Data" in the top bar to generate history!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mean Absolute Error (MAE)
            </span>
            <div className="mt-2 text-3xl font-extrabold text-brand-700">
              {Number(agg.mae).toFixed(2)}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Average units deviation per day
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Root Mean Squared Error (RMSE)
            </span>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {Number(agg.rmse).toFixed(2)}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Penalizes large demand outliers
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Holdout Test Set Size
            </span>
            <div className="mt-2 text-3xl font-extrabold text-slate-800">
              {agg.testSetSize}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Held-out daily test instances
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Model Architecture
            </span>
            <div className="mt-2 text-xl font-bold font-mono text-slate-800">
              {agg.modelVersion}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Evaluated: {new Date(agg.evaluatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Per-Product Breakdown Table (FR-32, AC-17) */}
      {latest && latest.byProduct.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 text-sm">
              Per-Product Holdout Metrics ({latest.aggregate?.modelVersion})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Product Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Holdout Test Points</th>
                  <th className="px-6 py-3">MAE (Daily Error)</th>
                  <th className="px-6 py-3">RMSE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latest.byProduct.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-3 font-semibold text-slate-800">
                      {p.product?.name || p.productId}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{p.product?.category || '—'}</td>
                    <td className="px-6 py-3 text-slate-600 font-medium">{p.testSetSize} days</td>
                    <td className="px-6 py-3 font-bold text-brand-700">
                      ±{Number(p.mae).toFixed(2)} units
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-700">
                      {Number(p.rmse).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Evaluation Runs for Cross-Version Comparison (FR-34, AC-18) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">
            Historical Model Evaluation Runs (Cross-Version Comparison)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Log of aggregate test runs over time, enabling performance comparisons across model versions.
          </p>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No prior evaluation runs recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Run Timestamp</th>
                  <th className="px-6 py-3">Model Version</th>
                  <th className="px-6 py-3">Holdout Points</th>
                  <th className="px-6 py-3">Aggregate MAE</th>
                  <th className="px-6 py-3">Aggregate RMSE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-3 text-slate-600">
                      {new Date(h.evaluatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-slate-800">
                      {h.modelVersion}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{h.testSetSize} points</td>
                    <td className="px-6 py-3 font-bold text-brand-700">
                      {Number(h.mae).toFixed(2)} units
                    </td>
                    <td className="px-6 py-3 text-slate-800 font-medium">
                      {Number(h.rmse).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
