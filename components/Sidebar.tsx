
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
  Settings
} from 'lucide-react';

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
    { id: 'payments', label: 'Rent & Payments', icon: CreditCard },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'legal', label: 'Legal & Compliance', icon: Gavel },
    { id: 'documents', label: 'Document Center', icon: FileText },
    { id: 'settings', label: 'Setup & Config', icon: Settings },
  ];

  return (
    <aside 
      className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white transition-transform duration-300 ease-in-out shadow-2xl shadow-black/20
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-auto flex flex-col border-r border-slate-800/50
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-center h-28 border-b border-slate-800/60 flex-shrink-0 px-6 bg-gradient-to-r from-slate-900/50 to-slate-800/30">
        <div className="flex items-center gap-4">
          {/* Logo Mark */}
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-xl font-serif font-bold text-white tracking-widest">NCI</span>
          </div>
          
          {/* Vertical Divider */}
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent"></div>
          
          {/* Logo Text */}
          <div className="flex flex-col justify-center">
            <span className="text-sm font-bold text-white tracking-wide uppercase leading-tight">Neela Capital</span>
            <span className="text-[10px] text-slate-400 tracking-widest uppercase leading-tight font-semibold">Investment</span>
          </div>
        </div>
      </div>

      <nav className="mt-8 px-4 space-y-2 flex-1 overflow-y-auto pb-4" aria-label="Main menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                flex items-center w-full px-5 py-3.5 text-sm font-semibold rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white shadow-xl shadow-blue-500/30 transform scale-[1.02]' 
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white hover:translate-x-1'}
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-6 mt-6 border-t border-slate-800/60">
          <h3 className="px-5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Public Views
          </h3>
          <button
            onClick={() => setActiveTab('public-portal')}
            className={`
              flex items-center w-full px-5 py-3.5 text-sm font-semibold rounded-xl transition-all duration-200 group
              ${activeTab === 'public-portal'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-xl shadow-emerald-500/30 transform scale-[1.02]'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white hover:translate-x-1'}
            `}
            aria-current={activeTab === 'public-portal' ? 'page' : undefined}
          >
            <Globe className={`w-5 h-5 mr-3 ${activeTab === 'public-portal' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`} />
            <span>Applicant Portal</span>
          </button>
        </div>
      </nav>

      <div className="border-t border-slate-800/60 p-5 flex-shrink-0 bg-gradient-to-t from-slate-900/50 to-transparent">
        <button 
          onClick={onLogout}
          className="flex items-center w-full px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
