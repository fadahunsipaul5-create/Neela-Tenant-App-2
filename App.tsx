import React, { useState, useEffect } from 'react';
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
import { MOCK_INVOICES } from './constants'; // Keep invoices mock for now as we didn't backend it yet
import { api } from './services/api';
import { isAuthenticated } from './services/auth';
import { Tenant, Payment, MaintenanceRequest, Property } from './types';

const App: React.FC = () => {
  // Check if we're on a password reset page - Vercel deployment trigger
  const pathname = window.location.pathname;
  const resetPasswordMatch = pathname.match(/^\/reset-password\/([^/]+)\/([^/]+)\/?$/);
  
  const [activeTab, setActiveTab] = useState('public-portal');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [tenantsInitialTab, setTenantsInitialTab] = useState<'residents' | 'applicants'>('residents');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State for datas
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      setIsAuthChecking(true);
      try {
        // First check if we have a valid session
        const isAuth = isAuthenticated();
        
        // If authenticated, default to dashboard unless we were already on public portal (explicit logout)
        // But since this is initial load/refresh, we want to restore the session
        if (isAuth && activeTab === 'public-portal') {
           // We need to know if the user is admin or tenant
           // For now, we'll default to dashboard if it's an admin, or public portal if it's a tenant
           // But App.tsx mainly handles Admin dashboard switching. 
           // PublicPortal handles its own internal state for tenants.
           
           // Check if user is admin/staff by peeking at local storage or relying on the fact 
           // that only admins usually see the full dashboard here.
           // Ideally, we should check user role. 
           // For now, let's assume if they are authenticated at this level, they might be an admin
           // BUT tenants also use the same auth token.
           
           // Let's rely on PublicPortal to handle tenant view if activeTab remains 'public-portal'
           // But if it's an admin, they expect to see the dashboard.
           const user = JSON.parse(localStorage.getItem('user') || '{}');
           if (user.is_staff || user.is_superuser) {
             setActiveTab('dashboard');
           }
        }

        // Only fetch admin data if user is authenticated and on admin view
        if (activeTab !== 'public-portal' && isAuth) {
          const [tenantsData, paymentsData, maintenanceData, propertiesData] = await Promise.all([
            api.getTenants(),
            api.getPayments(),
            api.getMaintenanceRequests(),
            api.getProperties()
          ]);
          setTenants(tenantsData);
          setPayments(paymentsData);
          setMaintenance(maintenanceData);
          setProperties(propertiesData);
        } else if (activeTab === 'public-portal') {
          // For public portal, only fetch properties
          const propertiesData = await api.getProperties();
          setProperties(propertiesData);
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
        setIsAuthChecking(false);
      }
    };

    checkAuthAndFetch();
  }, [activeTab]);

  const handleReviewApplications = () => {
    setTenantsInitialTab('applicants');
    setActiveTab('tenants');
  };

  const handleSidebarNavigation = (tab: string) => {
    setActiveTab(tab);
    // Reset default tab for tenants view when navigating via sidebar
    if (tab === 'tenants') {
      setTenantsInitialTab('residents');
    }
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    setActiveTab('public-portal');
    setIsMobileMenuOpen(false);
  };

  const refreshTenants = async () => {
    try {
      const tenantsData = await api.getTenants();
      setTenants(tenantsData);
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

  const renderAdminContent = () => {
    // Check authentication for admin views
    if (activeTab !== 'public-portal' && !isAuthenticated()) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2 text-slate-800">Authentication Required</h3>
            <p className="text-slate-600 mb-4">Please log in to access the admin portal.</p>
            <button
              onClick={() => setActiveTab('public-portal')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }

    if (loading) {
      return <div className="flex items-center justify-center h-full">Loading...</div>;
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
          />
        );
      case 'tenants':
        return <TenantsView tenants={tenants} initialTab={tenantsInitialTab} onTenantsChange={refreshTenants} />;
      case 'maintenance':
        return <MaintenanceView requests={maintenance} tenants={tenants} onMaintenanceChange={refreshMaintenance} />;
      case 'legal':
        return <LegalComplianceView tenants={tenants} />;
      case 'settings':
        return <SettingsView />;
      case 'payments':
        return <PaymentsView tenants={tenants} payments={payments} invoices={MOCK_INVOICES} />;
      case 'documents':
        return (
          <div className="flex items-center justify-center h-96 text-slate-500">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Document Center</h3>
              <p>Lease Templates & DocuSign Integration (Placeholder)</p>
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading Neela Capital Investments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && !isPublic && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
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
          <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
            <span className="font-bold text-slate-800">PropGuard</span>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isPublic ? (
            <PublicPortal 
              onAdminLogin={() => setActiveTab('dashboard')} 
              tenantId={tenants.length > 0 ? tenants[0].id : undefined}
              onMaintenanceCreated={refreshMaintenance}
            />
          ) : (
            <div className="p-4 md:p-8">
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
