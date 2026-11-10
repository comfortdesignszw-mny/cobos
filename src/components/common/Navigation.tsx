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
  CreditCard,
  Building,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, hasPermission } = useApp();
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
      <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900/50 p-4 min-h-[calc(100vh-57px)]">
        <div className="space-y-4">
          <nav className="space-y-1">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20'
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

      {/* Mobile Bottom Navigation Bar (High Ergonomics for Cashiers & Mobile Owners) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-slate-800 bg-slate-900/95 backdrop-blur-lg px-2 py-1.5 safe-area-pb">
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
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition ${
                isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition ${
            moreNavItems.some((i) => i.id === activeTab)
              ? 'text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px]">More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer Modal */}
      {mobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-2xl p-5 space-y-4 pb-20 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Additional Modules
              </span>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left text-xs font-medium transition ${
                      isActive
                        ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300 font-semibold'
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
