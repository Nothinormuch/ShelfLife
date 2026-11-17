import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Boxes,
  TrendingUp,
  Sparkles,
  History,
  Trash2,
  DollarSign,
  Activity,
  Database,
  LogOut,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../api/client';

export const Navbar: React.FC<{ onDataGenerated?: () => void }> = ({ onDataGenerated }) => {
  const { store, user, logout } = useAuth();
  const location = useLocation();
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<string | null>(null);

  const navLinks = [
    { to: '/', label: 'Inventory & Alerts', icon: Boxes },
    { to: '/forecast', label: 'Demand Forecast', icon: TrendingUp },
    { to: '/recommendations', label: 'Recommendations', icon: Sparkles },
    { to: '/history', label: 'History', icon: History },
    { to: '/waste', label: 'Waste Analytics', icon: Trash2 },
    { to: '/revenue', label: 'Revenue & Margin', icon: DollarSign },
    { to: '/model-performance', label: 'Model Performance', icon: Activity },
  ];

  const handleGenerateData = async () => {
    if (!confirm('Generate 180 days of realistic synthetic sales, batches, and catalog for this store?')) {
      return;
    }
    setGenerating(true);
    setGenStatus('Generating 180 days of synthetic data & training model...');
    try {
      const res = await apiFetch('/sales/generate', {
        method: 'POST',
        body: JSON.stringify({ days: 180, overwrite: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setGenStatus(`Generated ${data.productsCreated} products, ${data.batchesCreated} batches, ${data.salesRecordsCreated} sales!`);
        setTimeout(() => setGenStatus(null), 5000);
        if (onDataGenerated) onDataGenerated();
        window.location.reload();
      } else {
        const err = await res.json();
        alert(`Generation failed: ${err.message || 'Unknown error'}`);
        setGenStatus(null);
      }
    } catch (e: any) {
      alert(`Error generating data: ${e.message}`);
      setGenStatus(null);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Store Name */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2 text-brand-600 font-bold text-xl">
              <Boxes className="w-7 h-7 text-brand-600" />
              <span>ShelfLife</span>
            </Link>
            {store && (
              <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200">
                Store: {store.name}
              </span>
            )}
          </div>

          {/* Quick Actions & User Account */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleGenerateData}
              disabled={generating}
              className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-sm font-medium transition"
              title="Populates realistic products, batches, and 180 days of sales history"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <Database className="w-4 h-4 text-emerald-600" />
              )}
              <span>{generating ? 'Generating...' : 'Seed Synthetic Data'}</span>
            </button>

            {user && (
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                <span className="text-xs text-slate-500 hidden md:inline">{user.email}</span>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-100 text-sm font-medium">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition ${
                  active
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {genStatus && (
        <div className="bg-emerald-600 text-white text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{genStatus}</span>
        </div>
      )}
    </header>
  );
};
