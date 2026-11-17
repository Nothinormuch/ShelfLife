import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Boxes,
  TrendingUp,
  Sparkles,
  History,
  Trash2,
  IndianRupee,
  Activity,
  LogOut,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { store, user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Inventory & Alerts', icon: Boxes },
    { to: '/forecast', label: 'Demand Forecast', icon: TrendingUp },
    { to: '/recommendations', label: 'Recommendations', icon: Sparkles },
    { to: '/history', label: 'History', icon: History },
    { to: '/waste', label: 'Waste Analytics', icon: Trash2 },
    { to: '/revenue', label: 'Revenue & Margin', icon: IndianRupee },
    { to: '/model-performance', label: 'Model Performance', icon: Activity },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
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

          {/* User Account & Logout */}
          <div className="flex items-center space-x-3">
            {user && (
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                <span className="text-xs text-slate-500 hidden md:inline">{user.email}</span>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition flex items-center space-x-1"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-xs font-medium">Log out</span>
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
    </header>
  );
};
