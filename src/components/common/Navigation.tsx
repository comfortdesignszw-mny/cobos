import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Boxes,
  Users,
  Truck,
  Wallet,
  BarChart3,
  Settings,
  MoreHorizontal,
  X,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, isSuperAdmin, activeRole } = useApp();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
    { id: 'transactions', label: 'Bookkeeping', icon: BookOpen },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'customers', label: 'Customers', icon: Users },
  ];

  const moreNavItems: NavItem[] = [
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'cashflow', label: 'Cash Flow', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const allNavItems = [...mainNavItems, ...moreNavItems];

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900/60 p-4 min-h-[calc(100vh-57px)]">
        <div className="space-y-4">
          {isSuperAdmin && (
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border border-cyan-500/40 text-[11px] text-cyan-200 flex items-center gap-2 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-white block">Super Admin Portal</span>
                <span className="text-[10px] text-cyan-400">Munyaradzi M.</span>
              </div>
            </div>
          )}

          <nav className="space-y-1">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition duration-200 ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Glassmorphism Bottom Navigation Bar with Cyan Glow & 3D Depth */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-cyan-500/20 bg-slate-950/80 backdrop-blur-xl px-3 py-2 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMoreOpen(false);
              }}
              className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition duration-300 ${
                isActive
                  ? 'text-cyan-300 scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Cyan Glow halo behind active icon */}
              {isActive && (
                <div className="absolute inset-0 bg-cyan-400/20 rounded-2xl blur-md pointer-events-none animate-pulse" />
              )}

              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition duration-300 ${
                  isActive
                    ? 'bg-gradient-to-b from-cyan-400 to-cyan-600 text-slate-950 shadow-[0_4px_12px_rgba(34,211,238,0.5),inset_0_1px_2px_rgba(255,255,255,0.6)] transform -translate-y-1'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'font-bold text-cyan-300' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Button with Glassmorphism */}
        <button
          onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
          className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition duration-300 ${
            moreNavItems.some((i) => i.id === activeTab)
              ? 'text-cyan-300 scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {moreNavItems.some((i) => i.id === activeTab) && (
            <div className="absolute inset-0 bg-cyan-400/20 rounded-2xl blur-md pointer-events-none animate-pulse" />
          )}
          <div
            className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition duration-300 ${
              moreNavItems.some((i) => i.id === activeTab)
                ? 'bg-gradient-to-b from-cyan-400 to-cyan-600 text-slate-950 shadow-[0_4px_12px_rgba(34,211,238,0.5),inset_0_1px_2px_rgba(255,255,255,0.6)] transform -translate-y-1'
                : 'bg-transparent'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer Modal */}
      {mobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900/95 border-t border-cyan-500/20 rounded-t-3xl p-5 space-y-4 pb-28 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Additional Modules & Management
              </span>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMoreOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left text-xs font-medium transition ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 font-bold shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
