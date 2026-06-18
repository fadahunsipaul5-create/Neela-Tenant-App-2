
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText,
  CreditCard, 
  Wrench, 
  Gavel, 
  LogOut,
  Globe,
  Settings,
  CalendarDays,
  ReceiptText
} from 'lucide-react';
import NeelaLogo from './NeelaLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileMenuOpen: boolean;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isMobileMenuOpen, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants & Leases', icon: Users },
    { id: 'short-stays', label: 'Short Stays', icon: CalendarDays },
    { id: 'income-statement', label: 'Income Statement', icon: ReceiptText },
    { id: 'payments', label: 'Rent & Payments', icon: CreditCard },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'legal', label: 'Legal & Compliance', icon: Gavel },
    { id: 'documents', label: 'Document Center', icon: FileText },
    { id: 'settings', label: 'Setup & Config', icon: Settings },
  ];

  return (
    <aside 
      className={`
        fixed inset-y-0 left-0 z-50 w-[min(85vw,17.5rem)] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white transition-transform duration-300 ease-in-out shadow-2xl shadow-black/20
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:w-56 xl:w-64 lg:translate-x-0 lg:static lg:inset-auto flex flex-col border-r border-slate-800/50 flex-shrink-0
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="sidebar-logo-strip flex items-center justify-center min-h-[4.5rem] h-20 xl:h-24 border-b border-slate-800/60 flex-shrink-0 px-4 xl:px-5">
        <NeelaLogo variant="full" size="sm" className="lg:!h-10 xl:!h-14 shrink-0 w-auto min-w-[8.5rem] max-w-[min(100%,13rem)]" />
      </div>

      <nav className="mt-4 xl:mt-8 px-2 xl:px-4 space-y-1 xl:space-y-2 flex-1 overflow-y-auto pb-4" aria-label="Main menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                flex items-center w-full px-3 xl:px-5 py-2.5 xl:py-3.5 text-xs xl:text-sm font-semibold rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white shadow-xl shadow-blue-500/30' 
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'}
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`w-4 h-4 xl:w-5 xl:h-5 mr-2 xl:mr-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-4 xl:pt-6 mt-4 xl:mt-6 border-t border-slate-800/60">
          <h3 className="px-3 xl:px-5 text-[10px] xl:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 xl:mb-3">
            Public Views
          </h3>
          <button
            onClick={() => setActiveTab('public-portal')}
            className={`
              flex items-center w-full px-3 xl:px-5 py-2.5 xl:py-3.5 text-xs xl:text-sm font-semibold rounded-xl transition-all duration-200 group
              ${activeTab === 'public-portal'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-xl shadow-emerald-500/30'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'}
            `}
            aria-current={activeTab === 'public-portal' ? 'page' : undefined}
          >
            <Globe className={`w-4 h-4 xl:w-5 xl:h-5 mr-2 xl:mr-3 flex-shrink-0 ${activeTab === 'public-portal' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`} />
            <span className="truncate">Applicant Portal</span>
          </button>
        </div>
      </nav>

      <div className="border-t border-slate-800/60 p-3 xl:p-5 flex-shrink-0 bg-gradient-to-t from-slate-900/50 to-transparent">
        <button 
          onClick={onLogout}
          className="flex items-center w-full px-3 xl:px-5 py-2.5 xl:py-3 text-xs xl:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5 mr-3 text-slate-400 group-hover:text-white transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
