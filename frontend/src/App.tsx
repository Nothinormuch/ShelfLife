import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { InventoryView } from './views/InventoryView';
import { DemandForecastView } from './views/DemandForecastView';
import { RecommendationsView } from './views/RecommendationsView';
import { RecommendationHistoryView } from './views/RecommendationHistoryView';
import { WasteAnalyticsView } from './views/WasteAnalyticsView';
import { RevenueProfitView } from './views/RevenueProfitView';
import { ModelPerformanceView } from './views/ModelPerformanceView';
import { AuthView } from './views/AuthView';

const AppLayout: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Loading ShelfLife...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<InventoryView />} />
          <Route path="/forecast" element={<DemandForecastView />} />
          <Route path="/recommendations" element={<RecommendationsView />} />
          <Route path="/history" element={<RecommendationHistoryView />} />
          <Route path="/waste" element={<WasteAnalyticsView />} />
          <Route path="/revenue" element={<RevenueProfitView />} />
          <Route path="/model-performance" element={<ModelPerformanceView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400 bg-white">
        ShelfLife — Grocery Inventory Intelligence SaaS
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
