import React, { useState, useEffect } from 'react';
import { Tenant, TenantStatus } from '../types';
import { api } from '../services/api';
import { login, getCurrentUser, isAuthenticated, User as AuthUser, refreshTokenIfNeeded } from '../services/auth';
import { 
  Loader2, X, AlertCircle, Mail, Phone, Lock, Key, Building2, UserCheck, Eye, EyeOff, ArrowLeft
} from 'lucide-react';

type LoginType = 'admin' | 'tenant' | null;

export interface LoginModalProps {
  isOpen: boolean;
  loginType: 'admin' | 'tenant' | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  email: string;
  setEmail: (e: string) => void;
  password: string;
  setPassword: (p: string) => void;
  isLoading: boolean;
  error: string | null;
  onApplyClick: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, loginType, onClose, onSubmit, email, setEmail, password, setPassword, isLoading, error, onApplyClick 
}) => {
  const [showPassword, setShowPassword] = useState(false);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-indigo-500/10 w-full max-w-md overflow-hidden animate-slideInUp border border-slate-200/60">
        <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg flex-shrink-0 ${loginType === 'admin' ? 'bg-gradient-to-br from-red-50 via-red-100 to-red-50 text-red-600 shadow-red-500/20' : 'bg-gradient-to-br from-indigo-50 via-indigo-100 to-blue-50 text-indigo-600 shadow-indigo-500/20'}`}>
              {loginType === 'admin' ? <Key className="w-5 h-5 sm:w-6 sm:h-6" /> : <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="login-modal-title" className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
                {loginType === 'admin' ? 'Admin Portal Login' : 'Tenant Portal Login'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 font-medium">
                {loginType === 'admin' ? 'Secure Management Access' : 'Access Your Dashboard'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 flex-shrink-0 absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto"
            aria-label="Close login modal"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="p-5 sm:p-6 lg:p-8 md:p-10 space-y-5 sm:space-y-6 lg:space-y-7">
          {error && (
            <div className="bg-gradient-to-r from-red-50 via-red-100/50 to-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl text-sm flex items-start gap-4 animate-shake shadow-lg shadow-red-500/10">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
          )}
          
          <div className="space-y-3">
            <label htmlFor="login-email" className="block text-sm font-bold text-slate-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
              </div>
              <input 
                id="login-email"
                type="email" 
                className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-300 bg-white text-slate-900 placeholder-slate-400 hover:border-slate-300 shadow-sm hover:shadow-md"
                placeholder={loginType === 'admin' ? "admin@neelacapital.com" : "tenant@example.com"} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                aria-required="true"
                aria-invalid={error ? "true" : "false"}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <label htmlFor="login-password" className="block text-sm font-bold text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
              </div>
              <input 
                id="login-password"
                type={showPassword ? "text" : "password"} 
                className="w-full pl-12 pr-14 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all duration-300 bg-white text-slate-900 placeholder-slate-400 hover:border-slate-300 shadow-sm hover:shadow-md"
                placeholder="Enter your password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
                aria-invalid={error ? "true" : "false"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-r-xl"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          
          <div className="pt-4">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white font-bold rounded-lg sm:rounded-xl hover:shadow-2xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex justify-center items-center gap-2 sm:gap-3 group relative overflow-hidden focus:outline-none focus:ring-4 focus:ring-indigo-500/30 transform hover:-translate-y-0.5 text-sm sm:text-base"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2 sm:gap-3">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                      →
                    </div>
                  </>
                )}
              </span>
            </button>
          </div>
          
          <div className="pt-6 sm:pt-8 border-t border-slate-100">
            {loginType === 'admin' && (
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 border-slate-200 shadow-sm">
                <div className="p-1.5 sm:p-2 bg-slate-100 rounded-lg sm:rounded-xl shadow-sm flex-shrink-0">
                  <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                </div>
                <span className="font-semibold text-xs sm:text-sm">Secure Area. Authorized Personnel Only.</span>
              </div>
            )}
            {loginType === 'tenant' && (
              <p className="text-xs sm:text-sm text-center text-slate-600">
                Don't have an account?{' '}
                <button 
                  type="button" 
                  onClick={onApplyClick}
                  className="text-indigo-600 font-bold hover:text-indigo-800 hover:underline transition-colors duration-200 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded px-1"
                >
                  Apply for a property <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// Application Status Check Component
export interface CheckStatusViewProps {
  onBack: () => void;
  onStatusFound: (status: string, tenant: Tenant) => void;
}

export const CheckStatusView: React.FC<CheckStatusViewProps> = ({ onBack, onStatusFound }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !phone) {
      setError('Please enter both email and phone number.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.checkApplicationStatus(email, phone);
      
      if (result) {
        onStatusFound(result.status, result.tenant);
      } else {
        setError('No application found with these details. Please check and try again.');
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to check status. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fadeIn">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center">
          <div className="p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-3xl mb-6 shadow-xl shadow-indigo-500/20">
            <UserCheck className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-center text-4xl font-bold text-slate-900 tracking-tight">
            Check Application Status
          </h2>
          <p className="mt-4 text-center text-slate-600 max-w-sm leading-relaxed text-base font-medium">
            Enter your email and phone number to track your progress
          </p>
        </div>
      </div>

      <div className="mt-12 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-md py-10 px-6 sm:px-12 shadow-2xl shadow-indigo-500/10 rounded-3xl border-2 border-slate-200/60">
          <form className="space-y-8" onSubmit={handleCheck}>
            <div className="space-y-3">
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all duration-300 hover:border-slate-300 bg-white text-slate-900"
                  placeholder="you@example.com"
                  autoFocus
                  aria-required="true"
                  aria-invalid={error ? "true" : "false"}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="phone" className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                Phone Number
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="appearance-none block w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all duration-300 hover:border-slate-300 bg-white text-slate-900"
                  placeholder="(555) 123-4567"
                  aria-required="true"
                  aria-invalid={error ? "true" : "false"}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-gradient-to-r from-red-50 via-red-100/50 to-red-50 border-2 border-red-200 p-5 animate-fadeIn shadow-lg shadow-red-500/10">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-900">Unable to find application</h3>
                    <p className="text-sm text-red-700 mt-1 leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 sm:gap-3 py-3.5 sm:py-4 px-4 border border-transparent rounded-lg sm:rounded-xl shadow-xl text-sm sm:text-base font-bold text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 group relative overflow-hidden transform hover:-translate-y-0.5"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-3">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Checking Status...</span>
                    </>
                  ) : (
                    <>
                      <span>Check Application Status</span>
                      <div className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                        →
                      </div>
                    </>
                  )}
                </span>
              </button>
            </div>
          </form>

          <div className="mt-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-5 bg-white text-slate-500 text-sm font-semibold">Or</span>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to Home"
                className="w-full flex justify-center items-center gap-2 py-3.5 sm:py-4 px-4 sm:px-6 border-2 border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus-visible:ring-4 transition-all duration-200 group transform hover:-translate-y-0.5"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-0.5 transition-transform duration-200 flex-shrink-0" aria-hidden />
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-10 text-center">
          <p className="text-sm text-slate-600 font-medium">
            Having trouble? Contact support at{' '}
            <a 
              href="mailto:support@neelacapital.com" 
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-colors duration-200 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded px-1"
            >
              support@neelacapital.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export interface UseAuthReturn {
  loginType: LoginType;
  setLoginType: (type: LoginType) => void;
  isLoggingIn: boolean;
  loginError: string | null;
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  loginPassword: string;
  setLoginPassword: (password: string) => void;
  
  currentUser: AuthUser | null;
  currentTenant: Tenant | null;
  loadingTenant: boolean;
  tempTenant: Tenant | null;
  setTempTenant: (tenant: Tenant | null) => void;
  
  handleLoginSubmit: (e: React.FormEvent, onAdminLogin?: () => void, setUserStatus?: (status: 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident') => void, setView?: (view: string) => void) => Promise<void>;
  handleStatusFound: (status: string, tenant: any, setView: (view: string) => void) => void;
  refreshApplicationStatus: (setUserStatus?: (status: 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident') => void) => Promise<void>;
  
  setCurrentUser: (user: AuthUser | null) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  setLoadingTenant: (loading: boolean) => void;
}

export const useAuth = (): UseAuthReturn => {
  const [loginType, setLoginType] = useState<LoginType>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [tempTenant, setTempTenant] = useState<Tenant | null>(null);

  const handleStatusFound = (status: string, tenant: any, setView: (view: string) => void) => {
    const mappedTenant: Tenant = {
      id: String(tenant.id),
      name: tenant.name || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      status: tenant.status || 'Applicant',
      propertyUnit: tenant.property_unit || '',
      leaseStart: tenant.lease_start || null,
      leaseEnd: tenant.lease_end || null,
      rentAmount: parseFloat(tenant.rent_amount || '0'),
      deposit: parseFloat(tenant.deposit || '0'),
      balance: parseFloat(tenant.balance || '0'),
      creditScore: tenant.credit_score || null,
      backgroundCheckStatus: tenant.background_check_status || null,
      applicationData: tenant.application_data || null,
      leaseStatus: tenant.lease_status || null,
      signedLeaseUrl: tenant.signed_lease_url || null,
      photoIdFiles: tenant.photo_id_files || [],
      incomeVerificationFiles: tenant.income_verification_files || [],
      backgroundCheckFiles: tenant.background_check_files || [],
    };
    setTempTenant(mappedTenant);
    setView('status_tracker');
  };

  const handleLoginSubmit = async (
    e: React.FormEvent,
    onAdminLogin?: () => void,
    setUserStatus?: (status: 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident') => void,
    setView?: (view: string) => void
  ) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      if (loginType === 'admin') {
        const response = await login(loginEmail, loginPassword);
        setCurrentUser(response.user);
        if (!response.user.is_staff && !response.user.is_superuser) {
          setLoginError('Access denied. This account does not have admin privileges.');
          return;
        }
        onAdminLogin?.();
      } else if (loginType === 'tenant') {
        const response = await login(loginEmail, loginPassword);
        setCurrentUser(response.user);
        
        if (response.tenant) {
          const backendTenant = response.tenant as any;
          const tenant: Tenant = {
            id: String(backendTenant.id),
            name: backendTenant.name || '',
            email: backendTenant.email || '',
            phone: backendTenant.phone || '',
            status: backendTenant.status || 'Applicant',
            propertyUnit: backendTenant.property_unit || '',
            leaseStart: backendTenant.lease_start || null,
            leaseEnd: backendTenant.lease_end || null,
            rentAmount: parseFloat(backendTenant.rent_amount || '0'),
            deposit: parseFloat(backendTenant.deposit || '0'),
            balance: parseFloat(backendTenant.balance || '0'),
            creditScore: backendTenant.credit_score || null,
            backgroundCheckStatus: backendTenant.background_check_status || null,
            applicationData: backendTenant.application_data || null,
            leaseStatus: backendTenant.lease_status || null,
            signedLeaseUrl: backendTenant.signed_lease_url || null,
          };
          setCurrentTenant(tenant);
          
          if (setUserStatus) {
            if (tenant.status === TenantStatus.APPROVED || tenant.status === TenantStatus.ACTIVE) {
              setUserStatus('resident');
            } else if (tenant.status === TenantStatus.APPLICANT) {
              setUserStatus('applicant_pending');
            }
          }
        } else {
          try {
            setLoadingTenant(true);
            const tenantData = await api.getMyTenant();
            setCurrentTenant(tenantData);
            if (setUserStatus) {
              if (tenantData.status === TenantStatus.APPROVED || tenantData.status === TenantStatus.ACTIVE) {
                setUserStatus('resident');
              } else if (tenantData.status === TenantStatus.APPLICANT) {
                setUserStatus('applicant_pending');
              }
            }
          } catch (err) {
            console.error('Error fetching tenant data:', err);
          } finally {
            setLoadingTenant(false);
          }
        }
        
        if (setView) {
          setView('dashboard');
        }
      }
      setLoginType(null);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const refreshApplicationStatus = async (
    setUserStatus?: (status: 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident') => void
  ) => {
    setLoadingTenant(true);
    try {
      const tenantData = await api.getMyTenant();
      setCurrentTenant(tenantData);
      
      if (setUserStatus) {
        if (tenantData.status === TenantStatus.ACTIVE) {
          setUserStatus('resident');
        } else if (tenantData.status === TenantStatus.APPROVED) {
           if (tenantData.leaseStatus === 'Signed') {
             setUserStatus('resident');
           } else {
             setUserStatus('applicant_approved');
           }
        } else if (tenantData.status === TenantStatus.APPLICANT) {
          setUserStatus('applicant_pending');
        }
      }
      
    } catch (error) {
      console.error('Error refreshing tenant status:', error);
    } finally {
      setLoadingTenant(false);
    }
  };

  return {
    loginType,
    setLoginType,
    isLoggingIn,
    loginError,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    
    currentUser,
    currentTenant,
    loadingTenant,
    tempTenant,
    setTempTenant,
    
    handleLoginSubmit,
    handleStatusFound,
    refreshApplicationStatus,
    
    setCurrentUser,
    setCurrentTenant,
    setLoadingTenant,
  };
};

export const checkAuthOnMount = async (
  setCurrentUser: (user: AuthUser | null) => void,
  setCurrentTenant: (tenant: Tenant | null) => void,
  setLoadingTenant: (loading: boolean) => void,
  setUserStatus: (status: 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident') => void,
  setView: (view: string) => void
) => {
  try {
    await refreshTokenIfNeeded();
  } catch (error) {
    console.warn('Token refresh failed on app load:', error);
  }

  const user = getCurrentUser();
  if (user && isAuthenticated()) {
    setCurrentUser(user);
    try {
      setLoadingTenant(true);
      const tenantData = await api.getMyTenant();
      setCurrentTenant(tenantData);
      if (tenantData.status === TenantStatus.ACTIVE) {
        setUserStatus('resident');
        setView('dashboard');
      } else if (tenantData.status === TenantStatus.APPROVED) {
         if (tenantData.leaseStatus === 'Signed') {
           setUserStatus('resident');
         } else {
           setUserStatus('applicant_approved');
         }
         setView('dashboard');
      } else if (tenantData.status === TenantStatus.APPLICANT) {
        setUserStatus('applicant_pending');
        setView('dashboard');
      }
    } catch (error: any) {
      if (error?.message?.includes('Not authenticated') || error?.message?.includes('401')) {
        setCurrentUser(null);
        setCurrentTenant(null);
      } else {
        console.error('Error fetching tenant data:', error);
      }
    } finally {
      setLoadingTenant(false);
    }
  } else {
    setCurrentUser(null);
    setCurrentTenant(null);
  }
};