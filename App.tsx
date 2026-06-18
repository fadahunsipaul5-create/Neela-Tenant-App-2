import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import TenantsView from './components/TenantsView';
import MaintenanceView from './components/MaintenanceView';
import LegalComplianceView from './components/LegalComplianceView';
import PublicPortal from './components/PublicPortal';
import SettingsView from './components/SettingsView';
import PaymentsView from './components/PaymentsView';
import ShortStaysView from './components/ShortStaysView';
import IncomeStatementView from './components/IncomeStatementView';
import PasswordReset from './components/PasswordReset';
import { Menu } from 'lucide-react';
import NeelaLogo from './components/NeelaLogo';
import { api } from './services/api';
import { isAuthenticated } from './services/auth';
import { Tenant, Payment, MaintenanceRequest, Property } from './types';

const App: React.FC = () => {
  const adminPagePadding = 'px-3 py-4 sm:px-4 sm:py-5 md:px-4 md:py-5 lg:px-6 lg:py-6 xl:px-8 xl:py-8';
  const location = useLocation();
  const navigate = useNavigate();
  // Check if we're on a password reset page - Vercel deployment trigger
  const pathname = window.location.pathname;
  const resetPasswordMatch = pathname.match(/^\/reset-password\/([^/]+)\/([^/]+)\/?$/);
  
  const [activeTab, setActiveTab] = useState('public-portal');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [tenantsInitialTab, setTenantsInitialTab] = useState<'residents' | 'applicants'>('residents');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State for data
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial mount - check auth and set initial tab
  useEffect(() => {
    const initializeApp = async () => {
      setIsAuthChecking(true);
      try {
        const isAuth = isAuthenticated();
        
        if (isAuth) {
          // Check if user is admin/staff
          try {
            const userStr = localStorage.getItem('user_data');
            if (userStr) {
              const user = JSON.parse(userStr);
              if (user.is_staff || user.is_superuser) {
                setActiveTab('dashboard');
              }
            }
          } catch (e) {
            console.error('Error parsing user data:', e);
          }
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      } finally {
        setIsAuthChecking(false);
      }
    };

    initializeApp();
  }, []); // Only run once on mount

  const loadAdminData = useCallback(async (options?: { blockUI?: boolean }) => {
    const blockUI = options?.blockUI !== false;
    if (blockUI) setLoading(true);

    const tenantsP = api.getTenants();
    const paymentsP = api.getPayments();
    const maintenanceP = api.getMaintenanceRequests();
    const propertiesP = api.getProperties();

    try {
      const [tenantsResult, paymentsResult] = await Promise.allSettled([tenantsP, paymentsP]);
      setTenants(tenantsResult.status === 'fulfilled' ? tenantsResult.value : []);
      setPayments(paymentsResult.status === 'fulfilled' ? paymentsResult.value : []);
      if (tenantsResult.status === 'rejected') console.error('Error fetching tenants:', tenantsResult.reason);
      if (paymentsResult.status === 'rejected') console.error('Error fetching payments:', paymentsResult.reason);
    } finally {
      if (blockUI) setLoading(false);
    }

    const [maintenanceResult, propertiesResult] = await Promise.allSettled([maintenanceP, propertiesP]);
    setMaintenance(maintenanceResult.status === 'fulfilled' ? maintenanceResult.value : []);
    setProperties(propertiesResult.status === 'fulfilled' ? propertiesResult.value : []);
    if (maintenanceResult.status === 'rejected') console.error('Error fetching maintenance:', maintenanceResult.reason);
    if (propertiesResult.status === 'rejected') console.error('Error fetching properties:', propertiesResult.reason);
  }, []);

  // When returning from /admin login, switch to admin dashboard
  useEffect(() => {
    const state = location.state as { adminLogin?: boolean } | null;
    if (state?.adminLogin) {
      setActiveTab('dashboard');
      setIsInitialLoad(false);
      navigate('/', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Fetch properties when switching to public portal only (admin data loads once on login)
  useEffect(() => {
    if (isInitialLoad || activeTab !== 'public-portal') return;

    if (properties.length > 0) return;

    const loadPublicProperties = async () => {
      try {
        const propertiesData = await api.getProperties();
        setProperties(propertiesData);
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };

    loadPublicProperties();
  }, [activeTab, isInitialLoad, properties.length]);

  // Initial data fetch after auth check completes
  useEffect(() => {
    if (isAuthChecking || !isInitialLoad) return;

    const fetchInitialData = async () => {
      try {
        const isAuth = isAuthenticated();

        if (activeTab !== 'public-portal' && isAuth) {
          await loadAdminData({ blockUI: true });
        } else if (activeTab === 'public-portal') {
          try {
            const propertiesData = await api.getProperties();
            setProperties(propertiesData);
          } catch (error) {
            console.error('Error fetching properties:', error);
          }
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Error fetching initial data:', error);
        setLoading(false);
      } finally {
        setIsInitialLoad(false);
      }
    };

    fetchInitialData();
  }, [isAuthChecking, isInitialLoad, activeTab, loadAdminData]);

  const handleReviewApplications = () => {
    setTenantsInitialTab('applicants');
    setActiveTab('tenants');
  };

  const handleSidebarNavigation = (tab: string) => {
    // Prevent unnecessary reload if clicking same tab
    if (tab === activeTab) {
      setIsMobileMenuOpen(false);
      return;
    }
    setActiveTab(tab);
    // Reset default tab for tenants view when navigating via sidebar
    if (tab === 'tenants') {
      setTenantsInitialTab('residents');
    }
    setIsMobileMenuOpen(false);
  };

  const handleAdminLogin = async () => {
    setIsInitialLoad(false);
    setActiveTab('dashboard');
    try {
      await loadAdminData({ blockUI: true });
    } catch (error) {
      console.error('Error fetching data after admin login:', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setActiveTab('public-portal');
    setIsMobileMenuOpen(false);
  };

  const refreshTenants = async () => {
    try {
      console.log('refreshTenants: Fetching tenant data...');
      const tenantsData = await api.getTenants();
      console.log('refreshTenants: Received', tenantsData.length, 'tenants');
      console.log('refreshTenants: Tenant balances:', tenantsData.map(t => ({ name: t.name, balance: t.balance })));
      setTenants(tenantsData);
      console.log('refreshTenants: State updated');
    } catch (error) {
      console.error("Error refreshing tenants:", error);
    }
  };

  const refreshMaintenance = async () => {
    try {
      const maintenanceData = await api.getMaintenanceRequests();
      setMaintenance(maintenanceData);
    } catch (error) {
      console.error("Error refreshing maintenance:", error);
    }
  };

  const refreshPaymentsAndTenants = async () => {
    try {
      console.log('Refreshing payments and tenants...');
      const [tenantsData, paymentsData] = await Promise.all([
        api.getTenants(),
        api.getPayments()
      ]);
      console.log('Fetched tenants:', tenantsData.length, 'tenants');
      console.log('Tenant balances:', tenantsData.map(t => ({ name: t.name, balance: t.balance })));
      setTenants(tenantsData);
      setPayments(paymentsData);
      console.log('State updated successfully');
    } catch (error) {
      console.error("Error refreshing payments and tenants:", error);
    }
  };

  const renderAdminContent = () => {
    // Check authentication for admin views
    if (activeTab !== 'public-portal' && !isAuthenticated()) {
      return (
        <div className="flex items-center justify-center h-full min-h-[60vh] sm:min-h-[520px] px-4">
          <div className="text-center bg-white/90 backdrop-blur-md rounded-3xl p-10 max-w-md w-full shadow-2xl shadow-indigo-500/10 border border-slate-200/60">
            <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 shadow-md"></div>
            </div>
            <h3 className="text-3xl font-bold mb-4 text-slate-900 tracking-tight">Authentication Required</h3>
            <p className="text-slate-600 mb-8 text-lg leading-relaxed">Please log in to access the admin portal.</p>
            <button
              onClick={() => setActiveTab('public-portal')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 transform hover:-translate-y-1 hover:scale-[1.02] shadow-lg hover:shadow-xl shadow-blue-500/25 transition-all duration-300 font-semibold text-base focus:outline-none focus:ring-4 focus:ring-blue-500/30"
              aria-label="Navigate to login page"
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[60vh] sm:min-h-[520px] px-4">
          <div className="text-center">
            <div className="relative mx-auto mb-8">
              <div className="w-16 h-16 border-[4px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-slate-700 font-semibold text-lg tracking-wide">Loading dashboard data...</p>
            <p className="text-slate-500 text-sm mt-2">Please wait while we fetch your information</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            tenants={tenants}
            payments={payments}
            maintenance={maintenance}
            properties={properties}
            onReviewApplications={handleReviewApplications}
            onNavigateToSettings={() => setActiveTab('settings')}
            onNavigateToTenants={() => setActiveTab('tenants')}
            onNavigateToPayments={() => setActiveTab('payments')}
            onNavigateToMaintenance={() => setActiveTab('maintenance')}
            onNavigateToIncomeStatement={() => setActiveTab('income-statement')}
          />
        );
      case 'tenants':
        return (
          <TenantsView 
            key={`tenants-${tenants.length}-${tenants.map(t => `${t.id}-${t.balance}`).join('-')}`}
            tenants={tenants} 
            initialTab={tenantsInitialTab} 
            onTenantsChange={refreshTenants} 
          />
        );
      case 'short-stays':
        return <ShortStaysView />;
      case 'income-statement':
        return <IncomeStatementView properties={properties} />;
      case 'maintenance':
        return <MaintenanceView requests={maintenance} tenants={tenants} onMaintenanceChange={refreshMaintenance} />;
      case 'legal':
        return <LegalComplianceView tenants={tenants} />;
      case 'settings':
        return <SettingsView />;
      case 'payments':
        return (
          <PaymentsView 
            key={`payments-${tenants.length}-${payments.length}`}
            tenants={tenants} 
            payments={payments} 
            invoices={[]} 
            onDataChange={refreshPaymentsAndTenants} 
          />
        );
      case 'documents':
        return (
          <div className="flex items-center justify-center h-96 text-slate-500 px-4">
            <div className="text-center bg-white/90 backdrop-blur-md rounded-3xl p-12 max-w-lg w-full shadow-2xl shadow-slate-500/10 border border-slate-200/60">
              <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center shadow-lg shadow-slate-500/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 shadow-md"></div>
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-900 tracking-tight">Document Center</h3>
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">Lease Templates & In-House Signing</p>
              <div className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-slate-100 rounded-xl text-slate-600 font-semibold text-sm">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></span>
                Coming Soon
              </div>
            </div>
          </div>
        );
      default:
        return (
          <DashboardView
            tenants={tenants}
            payments={payments}
            maintenance={maintenance}
            properties={properties}
            onReviewApplications={handleReviewApplications}
          />
        );
    }
  };

  // If we're on password reset page, render that component
  if (resetPasswordMatch) {
    const [, uidb64Raw, tokenRaw] = resetPasswordMatch;
    // URL decode the parameters in case they were encoded
    const uidb64 = decodeURIComponent(uidb64Raw);
    const token = decodeURIComponent(tokenRaw);
    return (
      <PasswordReset 
        uidb64={uidb64} 
        token={token}
        onSuccess={() => {
          window.location.href = '/tenant';
        }}
      />
    );
  }

  const isPublic = activeTab === 'public-portal';

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50/30 to-blue-50/30">
        <div className="text-center px-4">
          <div className="flex items-center justify-center gap-4 sm:gap-6 mb-8">
            <NeelaLogo variant="full" size="lg" showGlow />
            <div className="relative">
              <div className="w-16 h-16 border-[4px] border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 rounded-full animate-pulse shadow-lg shadow-blue-500/30"></div>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Neela Capital Investments</h1>
          <p className="text-slate-600 font-medium text-base">Premium Property Management</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-purple-50/20 to-blue-50/20">
      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && !isPublic && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {!isPublic && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSidebarNavigation}
          isMobileMenuOpen={isMobileMenuOpen}
          onLogout={handleLogout}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 w-full min-h-screen lg:min-h-0 lg:h-screen overflow-hidden">
        {/* Top Bar — tablets & small laptops use drawer; sidebar fixed from lg up */}
        {!isPublic && (
          <div className="admin-mobile-header lg:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-sm shadow-slate-500/5">
            <div className="flex items-center min-w-0 flex-1 overflow-visible">
              <NeelaLogo variant="full" size="sm" className="shrink-0" />
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              aria-label="Open mobile menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {isPublic ? (
            <PublicPortal 
              onAdminLogin={handleAdminLogin} 
              tenantId={tenants.length > 0 ? tenants[0].id : undefined}
              onMaintenanceCreated={refreshMaintenance}
            />
          ) : (
            <div className={adminPagePadding}>
              <div className="max-w-7xl mx-auto w-full min-w-0">
                {renderAdminContent()}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;