import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import TenantsView from './components/TenantsView';
import MaintenanceView from './components/MaintenanceView';
import LegalComplianceView from './components/LegalComplianceView';
import PublicPortal from './components/PublicPortal';
import SettingsView from './components/SettingsView';
import PaymentsView from './components/PaymentsView';
import PasswordReset from './components/PasswordReset';
import { Menu } from 'lucide-react';
import { api } from './services/api';
import { isAuthenticated } from './services/auth';
import { Tenant, Payment, MaintenanceRequest, Property } from './types';

const App: React.FC = () => {
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
        setIsInitialLoad(false);
      }
    };

    initializeApp();
  }, []); // Only run once on mount

  // When returning from /admin login, switch to admin dashboard
  useEffect(() => {
    const state = location.state as { adminLogin?: boolean } | null;
    if (state?.adminLogin) {
      setActiveTab('dashboard');
      setIsInitialLoad(false);
      navigate('/', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Fetch data when tab changes (but not on initial load)
  useEffect(() => {
    if (isInitialLoad) return; // Skip on initial mount

    const fetchData = async () => {
      try {
        const isAuth = isAuthenticated();

        // Only fetch admin data if user is authenticated and on admin view
        if (activeTab !== 'public-portal' && isAuth) {
          setLoading(true);
          const results = await Promise.allSettled([
            api.getTenants(),
            api.getPayments(),
            api.getMaintenanceRequests(),
            api.getProperties()
          ]);
          // Set data for successful requests, empty array for failed ones
          setTenants(results[0].status === 'fulfilled' ? results[0].value : []);
          setPayments(results[1].status === 'fulfilled' ? results[1].value : []);
          setMaintenance(results[2].status === 'fulfilled' ? results[2].value : []);
          setProperties(results[3].status === 'fulfilled' ? results[3].value : []);
          
          // Log individual errors if any
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              const names = ['tenants', 'payments', 'maintenance', 'properties'];
              console.error(`Error fetching ${names[index]}:`, result.reason);
            }
          });
        } else if (activeTab === 'public-portal') {
          // For public portal, only fetch properties if not already loaded
          if (properties.length === 0) {
            try {
              const propertiesData = await api.getProperties();
              setProperties(propertiesData);
            } catch (error) {
              console.error("Error fetching properties:", error);
            }
          }
        }
      } catch (error: any) {
        // Don't log 401 errors for public portal - they're handled gracefully
        if (activeTab === 'public-portal' && error?.message?.includes('401')) {
          // Silently handle
        } else {
          console.error("Error fetching data:", error);
        }
        // If authentication fails, redirect to public portal
        if (activeTab !== 'public-portal') {
          setActiveTab('public-portal');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, isInitialLoad]); // Run when tab changes, but skip initial load

  // Initial data fetch after auth check completes
  useEffect(() => {
    if (!isAuthChecking && isInitialLoad) {
      const fetchInitialData = async () => {
        try {
          const isAuth = isAuthenticated();

          if (activeTab !== 'public-portal' && isAuth) {
            setLoading(true);
            const results = await Promise.allSettled([
              api.getTenants(),
              api.getPayments(),
              api.getMaintenanceRequests(),
              api.getProperties()
            ]);
            setTenants(results[0].status === 'fulfilled' ? results[0].value : []);
            setPayments(results[1].status === 'fulfilled' ? results[1].value : []);
            setMaintenance(results[2].status === 'fulfilled' ? results[2].value : []);
            setProperties(results[3].status === 'fulfilled' ? results[3].value : []);
            
            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                const names = ['tenants', 'payments', 'maintenance', 'properties'];
                console.error(`Error fetching ${names[index]}:`, result.reason);
              }
            });
          } else if (activeTab === 'public-portal') {
            try {
              const propertiesData = await api.getProperties();
              setProperties(propertiesData);
            } catch (error) {
              console.error("Error fetching properties:", error);
            }
          }
        } catch (error: any) {
          console.error("Error fetching initial data:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchInitialData();
    }
  }, [isAuthChecking, isInitialLoad, activeTab]);

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
    // When admin logs in, mark initial load as complete and switch to dashboard
    setIsInitialLoad(false);
    setActiveTab('dashboard');
    // Immediately fetch data for dashboard
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        api.getTenants(),
        api.getPayments(),
        api.getMaintenanceRequests(),
        api.getProperties()
      ]);
      setTenants(results[0].status === 'fulfilled' ? results[0].value : []);
      setPayments(results[1].status === 'fulfilled' ? results[1].value : []);
      setMaintenance(results[2].status === 'fulfilled' ? results[2].value : []);
      setProperties(results[3].status === 'fulfilled' ? results[3].value : []);
      
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const names = ['tenants', 'payments', 'maintenance', 'properties'];
          console.error(`Error fetching ${names[index]}:`, result.reason);
        }
      });
    } catch (error) {
      console.error("Error fetching data after admin login:", error);
    } finally {
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
        <div className="flex items-center justify-center h-full min-h-[600px] px-4">
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
        <div className="flex items-center justify-center h-full min-h-[600px] px-4">
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
              <p className="text-slate-600 text-lg mb-6 leading-relaxed">Lease Templates & DocuSign Integration</p>
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
          window.location.href = '/';
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
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 blur-xl rounded-2xl"></div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-lg relative">
                N
                <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full border-2 border-white shadow-sm"></div>
              </div>
            </div>
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
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

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Bar (Mobile Only) - Only show in Admin Mode */}
        {!isPublic && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/60 p-5 flex items-center justify-between sticky top-0 z-30 shadow-sm shadow-slate-500/5">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 rounded-xl shadow-md shadow-blue-500/20"></div>
              <span className="font-bold text-slate-900 text-xl tracking-tight">PropGuard</span>
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

        <div className="flex-1 overflow-y-auto">
          {isPublic ? (
            <PublicPortal 
              onAdminLogin={handleAdminLogin} 
              tenantId={tenants.length > 0 ? tenants[0].id : undefined}
              onMaintenanceCreated={refreshMaintenance}
            />
          ) : (
            <div className="p-6 md:p-10">
              <div className="max-w-7xl mx-auto">
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