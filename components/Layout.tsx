
import React from 'react';
import { UniversalUploader } from './UniversalUploader.tsx';

const Logo: React.FC = () => (
  <div className="flex items-center gap-4">
    <div className="relative w-12 h-12 flex items-center justify-center bg-white rounded-xl p-1 shrink-0 overflow-hidden shadow-sm">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Outer stylized circle segments */}
        <path
          d="M 50 5 A 45 45 0 1 1 5 50"
          fill="none"
          stroke="#007a33"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 20 20 L 35 35 M 80 80 L 65 65"
          stroke="#007a33"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Stylized 'S' shape */}
        <path
          d="M 30 40 C 40 30 60 30 70 40 C 80 50 20 60 30 70 C 40 80 65 80 75 70"
          fill="none"
          stroke="#007a33"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </svg>
    </div>
    <div className="flex flex-col leading-none">
      <span className="text-2xl font-black tracking-tighter text-slate-800">SWISS</span>
      <span className="text-[7px] font-bold text-slate-500 uppercase tracking-[0.1em]">Pharmaceuticals (Pvt) Ltd</span>
    </div>
  </div>
);

interface LayoutProps {
  children: React.ReactNode;
  currentView: 'dashboard' | 'sales-audit' | 'territory-sales' | 'trade-ops' | 'production-dashboard' | 'finance-dashboard' | 'data-entry';
  onViewChange: (view: 'dashboard' | 'sales-audit' | 'territory-sales' | 'trade-ops' | 'production-dashboard' | 'finance-dashboard' | 'data-entry') => void;
  onSalesUpdate: (data: any[]) => void;
  onFinanceUpdate: (data: any[]) => void;
  onProductionUpdate: (data: any[]) => void;
  isSyncing?: boolean;
  syncError?: string | null;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange, onSalesUpdate, onFinanceUpdate, onProductionUpdate, isSyncing, syncError }) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">
      {/* Sidebar Trigger Area (only visible when collapsed) */}
      {!isSidebarExpanded && (
        <div
          className="fixed inset-y-0 left-0 w-4 z-40 bg-transparent cursor-pointer"
          onMouseEnter={() => setIsSidebarExpanded(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 text-slate-800 flex flex-col no-print shadow-2xl transition-all duration-500 ease-in-out transform ${isSidebarExpanded ? 'translate-x-0 w-72' : '-translate-x-full w-72'
          }`}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        <div className="p-8 border-b border-slate-50 mb-4">
          <Logo />
        </div>

        <div className="flex-1 px-4 overflow-y-auto scrollbar-thin space-y-8 mt-4">
          <nav className="space-y-1">
            <h3 className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Core Operations</h3>
            <NavItem
              icon="🏠"
              label="EXECUTIVE SUMMARY"
              active={currentView === 'dashboard'}
              onClick={() => { onViewChange('dashboard'); setIsSidebarExpanded(false); }}
            />
            <NavItem
              icon="📊"
              label="SALES PERFORMANCE"
              active={currentView === 'sales-audit'}
              onClick={() => { onViewChange('sales-audit'); setIsSidebarExpanded(false); }}
            />
            <NavItem
              icon="📍"
              label="TERRITORY SALES"
              active={currentView === 'territory-sales'}
              onClick={() => { onViewChange('territory-sales'); setIsSidebarExpanded(false); }}
            />
            <NavItem
              icon="🚛"
              label="TRADE OPS"
              active={currentView === 'trade-ops'}
              onClick={() => { onViewChange('trade-ops'); setIsSidebarExpanded(false); }}
            />
            <NavItem
              icon="🏭"
              label="PRODUCTION"
              active={currentView === 'production-dashboard'}
              onClick={() => { onViewChange('production-dashboard'); setIsSidebarExpanded(false); }}
            />
            <NavItem
              icon="💰"
              label="FINANCE"
              active={currentView === 'finance-dashboard'}
              onClick={() => { onViewChange('finance-dashboard'); setIsSidebarExpanded(false); }}
            />
            <div className="pt-4 mt-4 border-t border-slate-100">
              <NavItem
                icon="📝"
                label="DATA MANAGEMENT"
                active={currentView === 'data-entry'}
                onClick={() => { onViewChange('data-entry'); setIsSidebarExpanded(false); }}
              />
            </div>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-50 bg-slate-50/50">
          <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white text-[10px] font-black">SW</div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-900">Audit Admin</span>
              <span className="text-[8px] font-black text-green-600 uppercase tracking-tighter">Verified Access</span>
            </div>
          </div>
          <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">Version 5.0.0 Stable</p>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-w-0 overflow-auto relative transition-all duration-500 ease-in-out ${isSidebarExpanded ? 'lg:pl-72' : 'pl-0'
          }`}
      >
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-6">
            <button
              onMouseEnter={() => setIsSidebarExpanded(true)}
              className="lg:flex hidden w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
            >
              <span className="text-lg">☰</span>
            </button>
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-black text-slate-900 tracking-widest uppercase">
                {currentView === 'data-entry' ? 'Data Entry Portal' : 'Operations Command'}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(e => console.error(e));
                    } else {
                      document.exitFullscreen();
                    }
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg"
                  title="Toggle Full Screen"
                >
                  <span className="text-lg">⛶</span>
                </button>

                <button className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                  <span className="text-lg">🔔</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'sales-audit', label: 'Sales Audit', icon: '🛡️' },
  { id: 'trade-dashboard', label: 'TRADE Dashboard', icon: '🚛' },
  { id: 'production-dashboard', label: 'Production', icon: '🏭' },
  { id: 'finance-dashboard', label: 'Financials', icon: '💰' },
  { id: 'data-entry', label: 'Data Management', icon: '📝' },
];
const NavItem: React.FC<{ icon: string, label: string, active?: boolean, onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[13px] font-bold transition-all duration-200 ${active
      ? 'bg-green-600 text-white shadow-lg shadow-green-100 translate-x-1'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
  >
    <span className={`text-lg transition-transform duration-200 ${active ? 'scale-110' : 'opacity-70'}`}>{icon}</span>
    <span className="tracking-tight">{label}</span>
  </button>
);
