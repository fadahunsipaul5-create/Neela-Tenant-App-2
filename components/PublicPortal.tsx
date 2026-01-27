//PublicPortal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Listing, ApplicationForm, MaintenanceStatus, Invoice, PortalNotification, MaintenanceRequest, Property, Tenant, Payment, LegalDocument, TenantStatus } from '../types';
import { analyzeMaintenanceRequest } from '../services/geminiService';
import { api } from '../services/api';
import { logout } from '../services/auth';
import { useAuth, LoginModal, CheckStatusView, checkAuthOnMount } from './Auth';
import { usePayments, PaymentModal, renderPaymentInstructions, PaymentSubTab, PaymentMethod } from './Payments';
import { useApplication, ApplicationFormView } from './Application';
import { Listings } from './Listings';
import { StatusTracker, StatusTrackerView } from './Status';
import { 
  MapPin, BedDouble, Bath, Maximize, Check, ArrowLeft, 
  FileText, Save, Send, User, FileSignature, Download, 
  CreditCard, Clock, AlertCircle, Building2, PenTool,
  Bell, Smartphone, Banknote, Image as ImageIcon, Loader2, X,
  MessageSquare, History, FileCheck, Mail, Lock, LogIn, ChevronRight,
  Wallet, DollarSign, Copy, Info, RefreshCw, Search, Shield, CheckCircle, CheckCircle2,
  Home, Calendar, ShieldCheck, Users, FileLock, Zap, Sparkles, ChevronDown,
  Building, House, Key, Star, Eye, Phone, Settings, HelpCircle,
  TrendingUp, Shield as ShieldIcon, Award, Target, Globe
} from 'lucide-react';

type PortalView = 'listings' | 'application' | 'dashboard' | 'lease_signing' | 'status_check' | 'status_tracker';
type UserStatus = 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident';
type ResidentTab = 'overview' | 'payments' | 'maintenance' | 'documents';
type LoginType = 'admin' | 'tenant' | null;

interface PublicPortalProps {
  onAdminLogin?: () => void;
  tenantId?: string;
  onMaintenanceCreated?: () => void;
}

const PublicPortal: React.FC<PublicPortalProps> = ({ onAdminLogin, tenantId, onMaintenanceCreated }) => {
  const [view, setView] = useState<PortalView>('listings');
  const [userStatus, setUserStatus] = useState<UserStatus>('guest');
  const [activeTab, setActiveTab] = useState<ResidentTab>('overview');

  const {
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
    handleStatusFound: handleStatusFoundFromAuth,
    refreshApplicationStatus,
    setCurrentUser,
    setCurrentTenant,
    setLoadingTenant,
  } = useAuth();

  const handleStatusFound = (status: string, tenant: any) => {
    handleStatusFoundFromAuth(status, tenant, setView);
  };

  const [currentLeaseId, setCurrentLeaseId] = useState<string | null>(null);

  // Contact Manager (email-only)
  const [contactMessage, setContactMessage] = useState('');
  const [isSendingContactMessage, setIsSendingContactMessage] = useState(false);
  const [contactMessageSuccess, setContactMessageSuccess] = useState<string | null>(null);
  const [contactMessageError, setContactMessageError] = useState<string | null>(null);

  const {
    formData,
    setFormData,
    selectedListing,
    setSelectedListing,
    isSubmittingApplication,
    applicationError,
    applicationSuccess,
    draftSaveMessage,
    handleApply: handleApplyFromHook,
    handleSubmitApplication: handleSubmitApplicationFromHook,
    handleSaveDraft,
    handleClearForm,
    propertyToListing,
    confirmModal,
    setConfirmModal,
  } = useApplication();

  const {
    showPaymentModal,
    setShowPaymentModal,
    manualPaymentMode,
    setManualPaymentMode,
    payments,
    loadingPayments,
    paymentSubTab,
    setPaymentSubTab,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    downloadReceipt,
  } = usePayments(currentTenant, tenantId);

  const handleSendContactMessage = async () => {
    const msg = contactMessage.trim();
    if (!msg) return;
    try {
      setIsSendingContactMessage(true);
      setContactMessageError(null);
      setContactMessageSuccess(null);

      await api.sendContactManagerMessage({
        message: msg,
        tenant_id: currentTenant?.id || tenantId,
        sender_name: currentTenant?.name || undefined,
        sender_email: currentTenant?.email || undefined,
      });

      setContactMessage('');
      setContactMessageSuccess('Message sent. A manager will get back to you soon.');
      setTimeout(() => setContactMessageSuccess(null), 4000);
    } catch (e) {
      setContactMessageError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setIsSendingContactMessage(false);
    }
  };

  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceDesc, setMaintenanceDesc] = useState('');
  const [maintenanceCategory, setMaintenanceCategory] = useState<'Plumbing'|'Electrical'|'HVAC'|'Appliance'|'General'>('General');
  const [maintenanceUrgency, setMaintenanceUrgency] = useState<'Low'|'Medium'|'High'|'Emergency'>('Medium');
  const [isAnalyzingMaintenance, setIsAnalyzingMaintenance] = useState(false);
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<MaintenanceRequest[]>([]);
  const [maintenanceImages, setMaintenanceImages] = useState<File[]>([]);
  const [maintenanceImagePreviews, setMaintenanceImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  
  const [leaseDocument, setLeaseDocument] = useState<any | null>(null);
  const [loadingLease, setLoadingLease] = useState(false);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  
  useEffect(() => {
    const tenantIdToUse = currentTenant?.id || tenantId;
    if (!tenantIdToUse || view !== 'dashboard') {
      return;
    }
    
    let isMounted = true;
    
    const fetchLeaseForStatus = async () => {
      try {
        const docs = await api.getLegalDocuments(tenantIdToUse);
        const lease = docs.find((doc: any) => doc.type === 'Lease Agreement');
        if (isMounted && lease) {
          setLeaseDocument(lease);
          setCurrentLeaseId(lease.id);
        }
      } catch (error) {
        console.error("Error fetching lease for status:", error);
      }
    };
    
    fetchLeaseForStatus();
    
    return () => {
      isMounted = false;
    };
  }, [currentTenant?.id, tenantId, view]);
  
  const residentBalance = currentTenant ? parseFloat(currentTenant.balance.toString()) : 0;
  
  const daysUntilDue = (() => {
    if (!currentTenant?.leaseStart) return 3;
    const today = new Date();
    const leaseStart = new Date(currentTenant.leaseStart);
    const nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const diffTime = nextDueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  })();

  const notifications: PortalNotification[] = [
    { id: 'n1', type: 'Rent', title: 'Rent Due Soon', message: `Your rent of $${residentBalance} is due in ${daysUntilDue} days.`, date: '2 hours ago', read: false },
    { id: 'n2', type: 'Maintenance', title: 'Ticket Updated', message: 'Ticket #M1 (Leaking Faucet) status changed to In Progress.', date: 'Yesterday', read: true },
    { id: 'n3', type: 'System', title: 'Lease Document Available', message: 'Your countersigned lease is now available in documents.', date: '3 days ago', read: true },
  ].filter(n => residentBalance > 0 || n.type !== 'Rent');

  const invoices: Invoice[] = [
    { id: 'inv-101', tenantId: currentTenant?.id || 'resident-1', date: '2024-11-01', dueDate: '2024-11-01', amount: residentBalance, period: 'November 2024', status: 'Pending' },
    { id: 'inv-100', tenantId: currentTenant?.id || 'resident-1', date: '2024-10-01', dueDate: '2024-10-01', amount: residentBalance, period: 'October 2024', status: 'Paid' },
    { id: 'inv-099', tenantId: currentTenant?.id || 'resident-1', date: '2024-09-01', dueDate: '2024-09-01', amount: residentBalance, period: 'September 2024', status: 'Paid' },
  ];

  useEffect(() => {
    checkAuthOnMount(
      setCurrentUser,
      setCurrentTenant,
      setLoadingTenant,
      setUserStatus,
      setView
    );
  }, []);

  const handleRefreshApplicationStatus = async () => {
    await refreshApplicationStatus(setUserStatus);
  };

  useEffect(() => {
    const tenantIdToUse = currentTenant?.id || tenantId;
    if (!tenantIdToUse) {
      setMyTickets([]);
      return;
    }
    
    let isMounted = true;
    
    const fetchMaintenanceRequests = async () => {
      try {
        const allRequests = await api.getMaintenanceRequests();
        if (isMounted) {
          const tenantRequests = allRequests.filter(req => req.tenantId === tenantIdToUse);
          setMyTickets(tenantRequests);
        }
      } catch (error) {
        console.error("Error fetching maintenance requests:", error);
        if (isMounted) {
          setMyTickets([]);
        }
      }
    };
    
    fetchMaintenanceRequests();
    
    return () => {
      isMounted = false;
    };
  }, [currentTenant?.id, tenantId]);

  useEffect(() => {
    const tenantIdToUse = currentTenant?.id || tenantId;
    if (!tenantIdToUse || view !== 'lease_signing') {
      setLeaseDocument(null);
      return;
    }
    
    let isMounted = true;
    
    const fetchLeaseDocument = async () => {
      setLoadingLease(true);
      setLeaseError(null);
      try {
        const docs = await api.getLegalDocuments(tenantIdToUse);
        const lease = docs.find((doc: any) => doc.type === 'Lease Agreement');
        if (isMounted) {
          if (lease) {
            setLeaseDocument(lease);
          } else {
            setLeaseError('No lease document found. Please contact your property manager.');
          }
        }
      } catch (error) {
        console.error("Error fetching lease document:", error);
        if (isMounted) {
          setLeaseError(error instanceof Error ? error.message : 'Failed to load lease document');
        }
      } finally {
        if (isMounted) {
          setLoadingLease(false);
        }
      }
    };
    
    fetchLeaseDocument();
    
    return () => {
      isMounted = false;
    };
  }, [currentTenant?.id, tenantId, view]);

  useEffect(() => {
    const tenantIdToUse = currentTenant?.id || tenantId;
    if (!tenantIdToUse || activeTab !== 'documents') {
      return;
    }
    
    let isMounted = true;
    
    const fetchDocuments = async () => {
      setLoadingDocuments(true);
      try {
        const docs = await api.getLegalDocuments(tenantIdToUse);
        if (isMounted) {
          setDocuments(docs);
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
        if (isMounted) {
          setDocuments([]);
        }
      } finally {
        if (isMounted) {
          setLoadingDocuments(false);
        }
      }
    };
    
    fetchDocuments();
    
    return () => {
      isMounted = false;
    };
  }, [currentTenant?.id, tenantId, activeTab]);

  const handleApply = (listing: Listing) => {
    handleApplyFromHook(listing, setView);
  };

  const handleSubmitApplication = async () => {
    await handleSubmitApplicationFromHook(setUserStatus, setView);
  };

  const handleLoginSubmitWrapper = async (e: React.FormEvent) => {
    await handleLoginSubmit(e, onAdminLogin, setUserStatus, setView);
  };

  const handleSignLease = async () => {
    const leaseId = currentLeaseId || (leaseDocument as any)?.id;
    
    if (!leaseId) {
      console.error("No lease ID available for signing");
      setTimeout(() => {
        setUserStatus('resident');
        setView('dashboard');
      }, 1500);
      return;
    }
    
    try {
      await api.updateLegalDocument(leaseId, {
        status: 'Signed',
        signed_at: new Date().toISOString()
      });
      
      setTimeout(() => {
        setUserStatus('resident');
        setView('dashboard');
      }, 1500);
    } catch (error) {
      console.error("Error signing lease:", error);
      setTimeout(() => {
        setUserStatus('resident');
        setView('dashboard');
      }, 1500);
    }
  };

  const handleMaintenanceSubmit = async () => {
    if(!maintenanceDesc) {
      setMaintenanceError('Please provide a description of the maintenance issue.');
      return;
    }
    
    const tenantIdToUse = currentTenant?.id || tenantId;
    if(!tenantIdToUse) {
      setMaintenanceError('Unable to identify tenant. Please refresh the page or contact support.');
      return;
    }
    
    setIsSubmittingMaintenance(true);
    setMaintenanceError(null);
    setMaintenanceSuccess(null);
    
    try {
      const imageUrls: string[] = [];
      for (const file of maintenanceImages) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imageUrls.push(dataUrl);
      }

      const newRequest: Partial<MaintenanceRequest> = {
        tenantId: tenantIdToUse,
        category: maintenanceCategory,
        description: maintenanceDesc,
        priority: maintenanceUrgency,
        status: MaintenanceStatus.OPEN,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      };
      
      const created = await api.createMaintenanceRequest(newRequest);
      setMyTickets([created, ...myTickets]);
      setShowMaintenanceForm(false);
      setMaintenanceDesc('');
      setMaintenanceCategory('General');
      setMaintenanceUrgency('Medium');
      setMaintenanceImages([]);
      setMaintenanceImagePreviews([]);
      setMaintenanceSuccess('Ticket submitted successfully! You will receive email updates.');
      setTimeout(() => setMaintenanceSuccess(null), 5000);
      
      onMaintenanceCreated?.();
    } catch (error) {
      setMaintenanceError(error instanceof Error ? error.message : 'Failed to submit maintenance request');
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  const handleAnalyzeIssue = async () => {
     if(!maintenanceDesc) return;
     setIsAnalyzingMaintenance(true);
     try {
       const result = await analyzeMaintenanceRequest(maintenanceDesc);
       if (result.priority) {
          setMaintenanceUrgency(result.priority as any);
       }
     } catch (e) {
       console.error(e);
     } finally {
       setIsAnalyzingMaintenance(false);
     }
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    setMaintenanceImages(prev => [...prev, ...newFiles]);

    newFiles.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMaintenanceImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setMaintenanceImages(prev => prev.filter((_, i) => i !== index));
    setMaintenanceImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const LandingHeader = () => (
    <header className="bg-gradient-to-b from-white via-white to-gray-50/50 backdrop-blur-xl border-b border-gray-200/30 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 sm:h-20 flex items-center justify-between">
        <div 
            className="flex items-center gap-2 sm:gap-4 cursor-pointer group" 
          onClick={() => { setView('listings'); setUserStatus('guest'); }}
        >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 blur-xl rounded-2xl"></div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-500 relative">
                N
                <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full border-2 border-white shadow-sm"></div>
              </div>
            </div>
           <div className="flex flex-col">
              <span className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-800 bg-clip-text text-transparent leading-none tracking-tight">
                Neela Capital
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-0.5 sm:mt-1 hidden sm:block">Resident Portal</span>
           </div>
        </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {userStatus === 'guest' && (
              <>
                <button 
                  onClick={() => setLoginType('tenant')} 
                  className="flex items-center px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 rounded-lg sm:rounded-xl hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 border border-gray-300/30 group"
                >
                  <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 group-hover:scale-110 transition-transform" /> 
                  <span className="hidden sm:inline lg:inline">Tenant Sign In</span>
                  <span className="sm:hidden">Sign In</span>
                </button>
               <button 
                 onClick={() => setLoginType('admin')}
                  className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 shadow-md group relative overflow-hidden"
               >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 inline" /> 
                  <span className="hidden sm:inline">Admin Login</span>
                  <span className="sm:hidden">Admin</span>
               </button>
             </>
          )}
          {userStatus !== 'guest' && currentUser && (
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden md:block text-right">
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 block truncate max-w-[150px] lg:max-w-none">
                    Welcome back, {currentUser.first_name || currentUser.email}
                </span>
                  <span className="text-[10px] sm:text-xs text-gray-500">
                    {userStatus === 'resident' ? 'Resident Dashboard' : 'Application Portal'}
                  </span>
                </div>
                <div className="relative group">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg sm:rounded-xl flex items-center justify-center border border-gray-300/30 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  </div>
                  <div className="absolute right-0 top-full mt-2 sm:mt-3 w-48 sm:w-56 bg-white/95 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 overflow-hidden border border-gray-200">
                    <div className="p-3 sm:p-4">
                      <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{currentUser.first_name} {currentUser.last_name}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 truncate">{currentUser.email}</div>
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-2 sm:my-3"></div>
                <button 
                   onClick={() => { 
                     logout();
                     setUserStatus('guest'); 
                     setView('listings');
                     setCurrentUser(null);
                     setCurrentTenant(null);
                   }}
                        className="w-full text-left px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200 hover:text-red-600 flex items-center gap-2"
                >
                        <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180" />
                   Sign Out
                </button>
             </div>
        </div>
      </div>
          </div>
        )}
        </div>
      </div>
        </div>
    </header>
  );

  const renderPaymentInstructionsWrapper = (method: string) => {
    return renderPaymentInstructions({ method, residentBalance });
    };

    return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-blue-50/20 flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/30 via-transparent to-transparent"></div>
      <LandingHeader />
      {loginType && (
        <LoginModal 
          isOpen={!!loginType}
          loginType={loginType}
          onClose={() => setLoginType(null)}
          onSubmit={handleLoginSubmitWrapper}
          email={loginEmail}
          setEmail={setLoginEmail}
          password={loginPassword}
          setPassword={setLoginPassword}
          isLoading={isLoggingIn}
          error={loginError}
          onApplyClick={() => {setLoginType(null); setView('listings')}}
        />
      )}
      
      <div className="relative flex-1 flex flex-col">
        {view === 'lease_signing' && (
          <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 flex-1 flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setView('dashboard')} className="flex items-center text-gray-600 hover:text-gray-900 group transition-all duration-300 px-4 py-2.5 rounded-xl hover:bg-gray-100 border border-gray-300/30">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
                <span className="font-semibold">Back to Dashboard</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg blur-md opacity-10"></div>
                  <div className="relative px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-300/30 flex items-center gap-3 shadow-sm">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-bold text-gray-700">Powered by</span>
                    <span className="font-black text-gray-900 italic tracking-tight">DocuSign</span>
              </div>
            </div>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col md:flex-row">
              <div className="flex-1 bg-gray-50 p-8 overflow-y-auto border-r border-gray-200 max-h-[800px]">
                  {loadingLease ? (
                    <div className="flex items-center justify-center min-h-[800px]">
                      <div className="text-center">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-4" />
                      <p className="text-gray-600">Loading lease document...</p>
                      </div>
                    </div>
                  ) : leaseError ? (
                    <div className="flex items-center justify-center min-h-[800px]">
                    <div className="text-center bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
                      <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                      <p className="text-red-800 font-medium mb-2">Unable to Load Lease</p>
                      <p className="text-red-600 text-sm">{leaseError}</p>
                      </div>
                    </div>
                  ) : leaseDocument?.pdfUrl ? (
                  <div className="bg-white shadow-lg rounded-xl overflow-hidden min-h-[800px]">
                      <iframe
                        src={leaseDocument.pdfUrl}
                        className="w-full h-[800px] border-0"
                        title="Lease Agreement PDF"
                      />
                    </div>
                  ) : leaseDocument?.signedPdfUrl ? (
                  <div className="bg-white shadow-lg rounded-xl overflow-hidden min-h-[800px]">
                      <iframe
                        src={leaseDocument.signedPdfUrl}
                        className="w-full h-[800px] border-0"
                        title="Signed Lease Agreement PDF"
                      />
                    </div>
                  ) : (
                  <div className="bg-white shadow-lg rounded-xl min-h-[800px] p-12 max-w-3xl mx-auto text-gray-800">
                      <h1 className="text-2xl font-bold serif mb-2 text-center">RESIDENTIAL LEASE AGREEMENT</h1>
                    <p className="text-center text-gray-500 mb-8">Texas Property Code</p>
                    <div className="space-y-6 font-serif text-sm leading-relaxed text-gray-800">
                         <p>This agreement is made between PropGuard Management and {currentTenant?.name || formData.firstName + ' ' + formData.lastName}.</p>
                         <p>Rent: ${currentTenant?.rentAmount || selectedListing?.price || 1850}.00 per month.</p>
                      <div className="my-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-xs">
                           <p className="font-bold mb-1">Sign Here:</p>
                           <div className="h-12 border-b border-yellow-400"></div>
                         </div>
                      </div>
                    </div>
                  )}
               </div>
              <div className="w-full md:w-96 bg-white p-8 flex flex-col border-t md:border-t-0">
                <h3 className="font-bold text-gray-900 text-lg mb-6">Action Required</h3>
                  {leaseDocument?.status === 'Signed' ? (
                    <>
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-emerald-800 font-semibold">✓ Lease Signed</p>
                        {leaseDocument.signedAt && (
                          <p className="text-emerald-600 text-xs mt-1">Signed on {new Date(leaseDocument.signedAt).toLocaleDateString()}</p>
                        )}
                        </div>
                      </div>
                      </div>
                      {leaseDocument.signedPdfUrl && (
                        <a
                          href={leaseDocument.signedPdfUrl}
                          download
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 text-center mb-3 flex items-center justify-center"
                        >
                        <Download className="w-4 h-4 mr-2" />
                          Download Signed Lease
                        </a>
                      )}
                    </>
                  ) : leaseDocument?.docusignSigningUrl ? (
                    <>
                    <p className="text-sm text-gray-600 mb-8">Click the button below to sign via DocuSign.</p>
                      <a
                        href={leaseDocument.docusignSigningUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 text-center"
                      >
                        Sign via DocuSign
                      </a>
                    </>
                  ) : (
                    <>
                    <p className="text-sm text-gray-600 mb-8">Please review the lease document. Once you're ready, you can sign it.</p>
                      <button 
                          onClick={handleSignLease}
                      className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 mt-auto"
                        >
                          Finish & Submit
                      </button>
                    </>
                  )}
               </div>
            </div>
          </div>
        )}

        {view === 'listings' && (
          <Listings
            setView={setView}
            setLoginType={setLoginType}
            handleApply={handleApply}
            propertyToListing={propertyToListing}
          />
        )}

        {view === 'check_status' && (
           <CheckStatusView 
              onBack={() => setView('listings')} 
              onStatusFound={handleStatusFound} 
           />
        )}

        {view === 'status_tracker' && tempTenant && (
          <StatusTrackerView
            tempTenant={tempTenant}
            setView={setView}
          />
        )}

        {view === 'application' && (
          <ApplicationFormView
            formData={formData}
            setFormData={setFormData}
            selectedListing={selectedListing}
            isSubmittingApplication={isSubmittingApplication}
            applicationError={applicationError}
            applicationSuccess={applicationSuccess}
            draftSaveMessage={draftSaveMessage}
            handleSubmitApplication={handleSubmitApplication}
            handleSaveDraft={handleSaveDraft}
            handleClearForm={handleClearForm}
            setView={setView}
            confirmModal={confirmModal}
            setConfirmModal={setConfirmModal}
          />
        )}

        {(view === 'dashboard') && (
          <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-8 animate-fadeIn pb-20">
            {showPaymentModal && (
              <PaymentModal
                showPaymentModal={showPaymentModal}
                setShowPaymentModal={setShowPaymentModal}
                manualPaymentMode={manualPaymentMode}
                setManualPaymentMode={setManualPaymentMode}
                residentBalance={residentBalance}
                daysUntilDue={daysUntilDue}
                renderPaymentInstructions={renderPaymentInstructionsWrapper}
              />
            )}
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 lg:mb-10 gap-4 sm:gap-0">
              <div className="w-full sm:w-auto">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
                  {userStatus === 'resident' 
                    ? `Welcome Home, ${currentUser?.first_name || currentTenant?.name?.split(' ')[0] || 'Resident'}` 
                    : 'Application Status'}
                </h1>
                <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                  {userStatus === 'resident' 
                    ? 'Manage your home, payments, and requests.' 
                    : 'Track your application progress below.'}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                {userStatus !== 'resident' && (
                  <button 
                    onClick={handleRefreshApplicationStatus}
                    disabled={loadingTenant}
                    className="flex items-center px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm w-full sm:w-auto justify-center"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${loadingTenant ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh Status</span>
                    <span className="sm:hidden">Refresh</span>
                  </button>
                )}
                {userStatus === 'resident' && (
                    <div className="relative">
                    <button className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200" aria-label="Notifications">
                      <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    </div>
                )}
              </div>
            </div>
            
            {loadingTenant && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              </div>
            )}

            {userStatus !== 'resident' && !loadingTenant && (
              <div className="space-y-10">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-8">Application Timeline</h3>
                  <StatusTracker status={userStatus} leaseStatus={leaseDocument?.status || currentTenant?.leaseStatus} />
                </div>
                {userStatus === 'applicant_approved' && (
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                    <CheckCircle className="w-16 h-16 text-emerald-600 mb-6" />
                    <h3 className="text-3xl font-bold text-emerald-900 mb-4">Application Approved!</h3>
                    <p className="text-emerald-800 mb-8 max-w-lg text-lg">
                        Your application has been approved. A lease agreement will be sent to your email address. Please check your inbox to review and sign. Once signed, refresh this page to access your dashboard.
                      </p>
                      {leaseDocument ? (
                      <div className="bg-white/50 p-5 rounded-xl border border-emerald-200 text-sm text-emerald-800 flex items-center gap-4">
                           <Mail className="w-5 h-5 flex-shrink-0" />
                           <span>Check your email for the lease agreement</span>
                         </div>
                      ) : (
                        <div className="flex flex-col items-center">
                        <button disabled className="px-10 py-4 bg-emerald-400 text-white font-bold rounded-xl cursor-not-allowed flex items-center gap-3">
                          <Loader2 className="w-5 h-5 animate-spin" /> Lease Being Prepared
                          </button>
                        <p className="text-emerald-700 text-sm mt-3">Your property manager is preparing your lease document.</p>
                        </div>
                      )}
                   </div>
                )}
                 {userStatus === 'applicant_pending' && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-10 text-center">
                    <Clock className="w-16 h-16 text-blue-500 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-blue-900 mb-4">Application Under Review</h3>
                    <p className="text-blue-700 text-lg">We are processing your background check. This usually takes 24-48 hours.</p>
                  </div>
                )}
              </div>
            )}

            {userStatus === 'resident' && !loadingTenant && (
              <div className="space-y-6 sm:space-y-8">
                <div className="flex border-b border-gray-200 mb-6 sm:mb-8 overflow-x-auto hide-scrollbar -mx-2 sm:mx-0 px-2 sm:px-0">
                  {[
                    { id: 'overview', label: 'Overview', icon: Building2 },
                    { id: 'payments', label: 'Payments', icon: CreditCard },
                    { id: 'maintenance', label: 'Maintenance', icon: PenTool },
                    { id: 'documents', label: 'Documents', icon: FileText },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as ResidentTab)}
                      className={`
                        flex items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-300 whitespace-nowrap flex-shrink-0
                        ${activeTab === tab.id 
                          ? 'border-blue-600 text-blue-600' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                      `}
                    >
                      <tab.icon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'overview' && (
                  <div className="space-y-8 animate-fadeIn">
                    {daysUntilDue <= 3 && residentBalance > 0 && (
                        <div className={`
                        p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border-l-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 backdrop-blur-sm
                        ${daysUntilDue < 0 ? 'bg-red-50/80 border-red-500 text-red-900' : 
                          daysUntilDue === 0 ? 'bg-orange-50/80 border-orange-500 text-orange-900' : 
                          'bg-amber-50/80 border-amber-500 text-amber-900'}
                      `}>
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-base sm:text-lg">
                                {daysUntilDue < 0 ? 'Rent is Overdue' : daysUntilDue === 0 ? 'Rent is Due Today' : 'Rent Due Soon'}
                              </p>
                            <p className="text-xs sm:text-sm opacity-90 mt-1">
                                 {daysUntilDue < 0 
                                   ? `Your payment was due ${Math.abs(daysUntilDue)} days ago. Late fees have been applied.` 
                                   : `Upcoming charge of $${residentBalance} due on Nov 1st.`}
                              </p>
                            </div>
                          </div>
                        <button 
                          onClick={() => { setActiveTab('payments'); setShowPaymentModal(true); }} 
                          className="px-4 sm:px-5 py-2 sm:py-2.5 bg-white hover:bg-white/90 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold border border-transparent hover:border-black/10 transition-all duration-200 shadow-sm w-full sm:w-auto"
                        >
                            Pay Now
                          </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                      <div className="bg-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                          <h3 className="font-semibold text-gray-500 text-sm sm:text-base">Current Balance</h3>
                          <div className="p-2 sm:p-2.5 bg-emerald-50 rounded-lg">
                            <Banknote className="text-emerald-600 w-4 h-4 sm:w-5 sm:h-5" />
                         </div>
                        </div>
                        <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">${residentBalance}.00</p>
                        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">Includes rent & utilities</p>
                        <button 
                          onClick={() => setShowPaymentModal(true)} 
                          disabled={residentBalance === 0}
                          className={`w-full py-2.5 sm:py-3 lg:py-3.5 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 text-sm sm:text-base ${
                            residentBalance === 0 
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' 
                              : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:shadow-lg hover:shadow-blue-200'
                          }`}
                        >
                            Make Payment
                         </button>
                      </div>
                      
                      <div className="bg-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                          <h3 className="font-semibold text-gray-500 text-sm sm:text-base">Lease Status</h3>
                          <div className="p-2 sm:p-2.5 bg-blue-50 rounded-lg">
                            <FileSignature className="text-blue-600 w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                         </div>
                         {leaseDocument ? (
                           <>
                            <div className="mb-5">
                              <span className={`inline-flex px-4 py-1.5 rounded-full text-sm font-bold mb-3
                                  ${leaseDocument.status === 'Signed' ? 'bg-emerald-100 text-emerald-700' :
                                    leaseDocument.status === 'Sent' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-700'}`}>
                                  {leaseDocument.status || 'Draft'}
                                </span>
                             </div>
                             {leaseDocument.status === 'Signed' && leaseDocument.signedAt && (
                              <p className="text-sm text-gray-500 mb-3">
                                 Signed: {new Date(leaseDocument.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                               </p>
                             )}
                             {leaseDocument.status === 'Sent' && (
                              <p className="text-sm text-amber-600 mb-3">
                                 Waiting for your signature
                               </p>
                             )}
                             {leaseDocument.status === 'Draft' && (
                              <p className="text-sm text-gray-500 mb-3">
                                 Lease is being prepared
                               </p>
                             )}
                             <button 
                               onClick={() => setView('lease_signing')} 
                              className="w-full py-2.5 sm:py-3 lg:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg sm:rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 text-xs sm:text-sm"
                             >
                               {leaseDocument.status === 'Signed' ? 'View Signed Lease' : 
                                leaseDocument.status === 'Sent' ? 'Sign Lease' : 
                                'View Lease'}
                             </button>
                           </>
                         ) : (
                           <>
                            <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">No lease document available</p>
                            <p className="text-[10px] sm:text-xs text-gray-400">Contact your property manager</p>
                           </>
                         )}
                      </div>
                      
                      <div className="bg-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                        <h3 className="font-semibold text-gray-500 mb-4 sm:mb-6 text-sm sm:text-base">Quick Actions</h3>
                        <div className="space-y-3 sm:space-y-4">
                          <button 
                            onClick={() => setActiveTab('maintenance')} 
                            className="w-full py-2.5 sm:py-3 lg:py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg sm:rounded-xl font-medium border border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center justify-center group text-sm sm:text-base"
                          >
                            <PenTool className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-orange-500 group-hover:scale-110 transition-transform" /> 
                            Request Repair
                         </button>
                          <button 
                            onClick={() => setActiveTab('documents')} 
                            className="w-full py-2.5 sm:py-3 lg:py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg sm:rounded-xl font-medium border border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center justify-center group text-sm sm:text-base"
                          >
                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-blue-500 group-hover:scale-110 transition-transform" /> 
                            Message Manager
                         </button>
                        </div>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3 bg-white p-5 sm:p-6 lg:p-7 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100">
                        <h3 className="font-semibold text-gray-500 mb-4 sm:mb-6 text-sm sm:text-base">Notifications</h3>
                        <div className="space-y-3 sm:space-y-4 lg:space-y-5">
                            {notifications.map(n => (
                            <div key={n.id} className="flex gap-3 sm:gap-4 items-start p-3 sm:p-4 rounded-lg sm:rounded-xl hover:bg-gray-50 transition-colors duration-200">
                              <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full mt-1.5 sm:mt-2 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-blue-500'}`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0">
                                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{n.title}</p>
                                  <span className="text-xs text-gray-400 whitespace-nowrap">{n.date}</span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">{n.message}</p>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'payments' && (
                  <div className="space-y-6 sm:space-y-8 animate-fadeIn">
                    <div className="border-b border-gray-200 overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
                      <nav className="-mb-px flex space-x-4 sm:space-x-6 lg:space-x-10">
                           <button
                              onClick={() => {
                                 setPaymentSubTab('history');
                                 setSelectedPaymentMethod(null);
                              }}
                              className={`
                            whitespace-nowrap py-3 sm:py-4 lg:py-5 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-300 flex-shrink-0
                                ${paymentSubTab === 'history'
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                              `}
                           >
                          <History className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2 sm:mr-3" />
                              Payment History
                           </button>
                           <button
                              onClick={() => {
                                 setPaymentSubTab('payment-options');
                                 setSelectedPaymentMethod(null);
                              }}
                              className={`
                            whitespace-nowrap py-3 sm:py-4 lg:py-5 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-300 flex-shrink-0
                                ${paymentSubTab === 'payment-options'
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                              `}
                           >
                          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2 sm:mr-3" />
                              Payment Options
                           </button>
                        </nav>
                     </div>

                    {paymentSubTab === 'history' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                        <div className="lg:col-span-2 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                          <div className="p-4 sm:p-5 lg:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center text-sm sm:text-base">
                              <History className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3"/> Payment History
                            </h3>
                          </div>
                          {loadingPayments ? (
                            <div className="p-8 sm:p-12 text-center">
                              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 mx-auto animate-spin text-blue-600 mb-3 sm:mb-4" />
                              <p className="text-gray-500 text-xs sm:text-sm">Loading payments...</p>
                            </div>
                          ) : payments.length === 0 ? (
                            <div className="p-8 sm:p-12 text-center text-gray-500 text-xs sm:text-sm">
                              <History className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 text-gray-300" />
                              <p>No payment history available.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs sm:text-sm text-left">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                                  <tr>
                                    <th className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 font-medium">Date</th>
                                    <th className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 font-medium hidden sm:table-cell">Type</th>
                                    <th className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 font-medium">Amount</th>
                                    <th className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 font-medium">Status</th>
                                    <th className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 font-medium text-right">Receipt</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {payments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors duration-200">
                                      <td className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 text-gray-600">
                                        <div className="flex flex-col">
                                          <span>{new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                          <span className="text-xs text-gray-400 sm:hidden mt-0.5">{payment.type}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 text-gray-900 font-semibold hidden sm:table-cell">{payment.type}</td>
                                      <td className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 text-gray-900 font-bold">${payment.amount.toFixed(2)}</td>
                                      <td className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5">
                                        <span className={`inline-flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold ${payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                          {payment.status}
                                        </span>
                                      </td>
                                      <td className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 text-right">
                                        {payment.status === 'Paid' && (
                                          <button 
                                            onClick={() => downloadReceipt(payment.id)} 
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 sm:p-2 lg:p-2.5 rounded-lg sm:rounded-xl transition-colors duration-200" 
                                            title="Download Receipt"
                                            aria-label="Download receipt"
                                          >
                                            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl sm:rounded-2xl p-6 sm:p-7 lg:p-8 text-white shadow-2xl">
                            <p className="text-blue-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2">Total Balance</p>
                            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 sm:mb-8">${residentBalance}.00</p>
                            <div className="space-y-3 sm:space-y-4">
                              <div className="flex justify-between text-xs sm:text-sm border-b border-blue-500/30 pb-2 sm:pb-3">
                                <span>Rent (Nov)</span>
                                <span>$1,800.00</span>
                              </div>
                              <div className="flex justify-between text-xs sm:text-sm border-b border-blue-500/30 pb-2 sm:pb-3">
                                <span>Utility: Water</span>
                                <span>$50.00</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => setShowPaymentModal(true)} 
                              className="w-full mt-6 sm:mt-8 py-2.5 sm:py-3 lg:py-3.5 bg-white text-blue-900 font-bold rounded-lg sm:rounded-xl hover:bg-blue-50 transition-all duration-300 shadow-lg text-sm sm:text-base"
                            >
                              Pay Now
                            </button>
                          </div>
                          <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-200 text-xs sm:text-sm text-gray-600">
                            <p className="font-semibold text-gray-900 mb-2 sm:mb-3">Auto-Pay</p>
                            <p className="mb-3 sm:mb-4">Set up automatic payments to avoid late fees.</p>
                            <button className="text-blue-600 font-semibold hover:underline hover:text-blue-800 transition-colors text-xs sm:text-sm">
                              Configure Auto-Pay →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentSubTab === 'payment-options' && (
                      <div className="space-y-6 sm:space-y-8">
                        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-5 sm:p-6 lg:p-8">
                          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">How to Pay Your Rent</h3>
                          <p className="text-gray-600 text-sm sm:text-base">Choose a payment method below to see detailed instructions.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-5 sm:p-6 lg:p-8">
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center">
                              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-600" />
                              Digital Payments
                            </h4>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                              {[
                                { id: 'zelle', label: 'Zelle', desc: 'Bank transfer' },
                                { id: 'cashapp', label: 'CashApp', desc: 'Mobile payment' },
                                { id: 'venmo', label: 'Venmo', desc: 'Social payment' },
                                { id: 'applepay', label: 'Apple Pay', desc: 'Apple device' },
                                { id: 'ach', label: 'ACH', desc: 'Bank account' },
                                { id: 'card', label: 'Card', desc: 'Credit/Debit' },
                              ].map((method) => (
                                <button
                                  key={method.id}
                                  onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === method.id ? null : method.id as PaymentMethod)}
                                  className={`p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border-2 text-left transition-all duration-300 hover:scale-[1.02] ${
                                    selectedPaymentMethod === method.id
                                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="font-semibold text-gray-900 text-sm sm:text-base">{method.label}</div>
                                  <div className="text-xs text-gray-500 mt-1">{method.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-5 sm:p-6 lg:p-8">
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center">
                              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-emerald-600" />
                              Cash Payments
                            </h4>
                            <button
                              onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'cash' ? null : 'cash')}
                              className={`w-full p-5 sm:p-6 lg:p-7 rounded-lg sm:rounded-xl border-2 text-left transition-all duration-300 hover:scale-[1.02] ${
                                selectedPaymentMethod === 'cash'
                                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                  : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="font-semibold text-gray-900 text-base sm:text-lg mb-1 sm:mb-2">Cash</div>
                              <div className="text-xs sm:text-sm text-gray-500">Physical cash payment instructions</div>
                            </button>
                          </div>
                        </div>

                        {selectedPaymentMethod && (
                          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-5 sm:p-6 lg:p-8 animate-fadeIn">
                            <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
                              <h4 className="text-xl sm:text-2xl font-bold text-gray-900">
                                {selectedPaymentMethod === 'zelle' && 'Zelle Payment Instructions'}
                                {selectedPaymentMethod === 'cashapp' && 'CashApp Payment Instructions'}
                                {selectedPaymentMethod === 'venmo' && 'Venmo Payment Instructions'}
                                {selectedPaymentMethod === 'applepay' && 'Apple Pay Payment Instructions'}
                                {selectedPaymentMethod === 'ach' && 'ACH Payment Instructions'}
                                {selectedPaymentMethod === 'card' && 'Card Payment Instructions'}
                                {selectedPaymentMethod === 'cash' && 'Cash Payment Instructions'}
                              </h4>
                              <button
                                onClick={() => setSelectedPaymentMethod(null)}
                                className="text-gray-400 hover:text-gray-600 p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                aria-label="Close instructions"
                              >
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                            </div>
                            {selectedPaymentMethod && renderPaymentInstructions({ method: selectedPaymentMethod, residentBalance })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'maintenance' && (
                  <div className="space-y-6 sm:space-y-8 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Maintenance Requests</h2>
                      <button 
                        onClick={() => {
                          if (showMaintenanceForm) {
                            setMaintenanceDesc('');
                            setMaintenanceCategory('General');
                            setMaintenanceUrgency('Medium');
                            setMaintenanceImages([]);
                            setMaintenanceImagePreviews([]);
                            setMaintenanceError(null);
                            setMaintenanceSuccess(null);
                          }
                          setShowMaintenanceForm(!showMaintenanceForm);
                        }} 
                        className="flex items-center px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all duration-300 text-sm sm:text-base w-full sm:w-auto justify-center"
                      >
                        {showMaintenanceForm ? <X className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2"/> : <PenTool className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />}
                        {showMaintenanceForm ? 'Cancel' : 'New Request'}
                      </button>
                    </div>

                    {showMaintenanceForm && (
                      <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 animate-slideIn border-l-4 border-l-blue-500">
                        <h3 className="font-bold text-gray-900 text-lg sm:text-xl mb-4 sm:mb-6">Submit New Ticket</h3>
                        <div className="space-y-4 sm:space-y-6 max-w-2xl">
                          <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Describe the issue</label>
                            <textarea 
                              value={maintenanceDesc}
                              onChange={(e) => setMaintenanceDesc(e.target.value)}
                              rows={3} 
                              className="w-full p-3 sm:p-4 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 transition-all duration-200 text-sm sm:text-base"
                              placeholder="e.g., Leaking faucet in master bath..."
                            />
                            <button 
                              onClick={handleAnalyzeIssue}
                              disabled={isAnalyzingMaintenance || !maintenanceDesc}
                              className="mt-2 sm:mt-3 text-xs sm:text-sm text-blue-600 font-semibold flex items-center hover:text-blue-800 transition-colors"
                            >
                              {isAnalyzingMaintenance ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin mr-1.5 sm:mr-2"/> : "✨ Auto-detect urgency with AI"}
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Category</label>
                              <select 
                                value={maintenanceCategory}
                                onChange={(e) => setMaintenanceCategory(e.target.value as any)}
                                className="w-full p-3 sm:p-3.5 border border-gray-300 rounded-lg sm:rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                              >
                                <option value="Plumbing">Plumbing</option>
                                <option value="Electrical">Electrical</option>
                                <option value="HVAC">HVAC</option>
                                <option value="Appliance">Appliance</option>
                                <option value="General">General</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Urgency</label>
                              <select 
                                value={maintenanceUrgency}
                                onChange={(e) => setMaintenanceUrgency(e.target.value as any)}
                                className="w-full p-3 sm:p-3.5 border border-gray-300 rounded-lg sm:rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                              >
                                <option value="Low">Low (Cosmetic)</option>
                                <option value="Medium">Normal (Standard repair)</option>
                                <option value="High">High (Affects daily life)</option>
                                <option value="Emergency">Emergency (Safety/Water)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                              Photos <span className="text-gray-400 font-normal text-[10px] sm:text-xs">(Optional)</span>
                            </label>
                            <div 
                              onClick={handleImageUploadClick}
                              className="border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer transition-all duration-200 hover:border-blue-300"
                            >
                              <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3" />
                              <span className="text-xs sm:text-sm font-medium">Click to upload images</span>
                              <span className="text-[10px] sm:text-xs text-gray-400 mt-1">JPEG, PNG up to 5MB</span>
                              <input 
                                ref={fileInputRef}
                                type="file" 
                                className="hidden" 
                                multiple 
                                accept="image/*"
                                onChange={handleImageChange}
                              />
                            </div>
                            
                            {maintenanceImagePreviews.length > 0 && (
                              <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                {maintenanceImagePreviews.map((preview, index) => (
                                  <div key={index} className="relative group">
                                    <div className="relative overflow-hidden rounded-lg sm:rounded-xl border border-gray-200">
                                      <img 
                                        src={preview} 
                                        alt={`Preview ${index + 1}`}
                                        className="w-full h-24 sm:h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveImage(index);
                                        }}
                                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1 sm:p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600"
                                        aria-label="Remove image"
                                      >
                                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      </button>
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2 truncate">
                                      {maintenanceImages[index]?.name}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {maintenanceError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4 text-red-800 text-xs sm:text-sm">
                              {maintenanceError}
                            </div>
                          )}
                          {maintenanceSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg sm:rounded-xl p-3 sm:p-4 text-emerald-800 text-xs sm:text-sm">
                              {maintenanceSuccess}
                            </div>
                          )}

                          <div className="pt-2">
                            <button 
                              onClick={handleMaintenanceSubmit} 
                              disabled={isSubmittingMaintenance || !maintenanceDesc || !(currentTenant?.id || tenantId)}
                              className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 lg:py-3.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-semibold rounded-lg sm:rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
                              type="button"
                            >
                              {isSubmittingMaintenance ? (
                                <>
                                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                'Submit Ticket'
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                        {myTickets.length === 0 && !showMaintenanceForm && (
                        <div className="bg-white p-12 rounded-2xl shadow-lg border border-gray-200 text-center">
                          <PenTool className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-gray-500">No maintenance requests yet.</p>
                           </div>
                        )}
                        {myTickets.map((ticket) => (
                        <div key={ticket.id} className="bg-white p-7 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                          <div className="flex justify-between items-start mb-6">
                                 <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-bold text-gray-900">{ticket.category}</span>
                                <span className="text-gray-400 text-sm">• {ticket.createdAt}</span>
                                    </div>
                              <p className="text-gray-600">{ticket.description}</p>
                                    {ticket.assignedTo && (
                                <p className="text-sm text-gray-500 mt-3">
                                  Assigned to: <span className="font-semibold">{ticket.assignedTo}</span>
                                       </p>
                                    )}
                                 </div>
                                 <div className="flex flex-col items-end">
                              <span className={`px-4 py-1.5 rounded-full text-sm font-bold mb-3 
                                ${ticket.status === MaintenanceStatus.OPEN ? 'bg-red-100 text-red-700' : 
                                         ticket.status === MaintenanceStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700' : 
                                         ticket.status === MaintenanceStatus.RESOLVED ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-gray-100 text-gray-700'}`}>
                                       {ticket.status}
                                    </span>
                                 </div>
                              </div>

                          <div className="relative pt-4 pb-3">
                            <div className="flex mb-3 items-center justify-between text-sm font-semibold text-gray-500">
                              <span className={ticket.status !== MaintenanceStatus.OPEN ? 'text-blue-600' : ''}>Received</span>
                              <span className={ticket.status === MaintenanceStatus.IN_PROGRESS ? 'text-blue-600' : ''}>In Progress</span>
                              <span className={ticket.status === MaintenanceStatus.RESOLVED ? 'text-blue-600' : ''}>Resolved</span>
                                 </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700" 
                                       style={{ 
                                         width: ticket.status === MaintenanceStatus.OPEN ? '10%' : 
                                                ticket.status === MaintenanceStatus.IN_PROGRESS ? '50%' : 
                                                ticket.status === MaintenanceStatus.RESOLVED || ticket.status === MaintenanceStatus.CLOSED ? '100%' : '10%'
                                       }}
                                    ></div>
                                 </div>
                              </div>

                              {ticket.updates && ticket.updates.length > 0 && (
                            <div className="mt-6 bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">
                              <p className="font-semibold text-gray-700 text-xs uppercase mb-3">Latest Update</p>
                                    {ticket.updates.map((u, idx) => (
                                <div key={idx} className="flex gap-3 text-gray-600 mb-2 last:mb-0">
                                  <span className="text-gray-400 text-xs">{u.date}:</span>
                                          <span>{u.message}</span>
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                    <div className="lg:col-span-2 space-y-8">
                      <h3 className="font-bold text-gray-900 text-xl">Official Documents & Notices</h3>
                         {loadingDocuments ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
                          <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-4" />
                          <p className="text-gray-500 text-sm">Loading documents...</p>
                           </div>
                         ) : documents.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center text-gray-500 text-sm">
                          <FileCheck className="w-14 h-14 mx-auto mb-4 text-gray-300" />
                             <p>No documents available at this time.</p>
                           </div>
                         ) : (
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                              {documents.map((doc) => {
                                const docDate = doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                                const docType = doc.type || 'Document';
                                const docName = doc.type === 'Lease Agreement' ? 
                                  (doc.status === 'Signed' ? 'Signed Lease Agreement' : 'Lease Agreement') : 
                                  doc.type || 'Document';
                                const pdfUrl = doc.signed_pdf_url || doc.pdf_url;
                                const isSigned = doc.status === 'Signed' && doc.signed_pdf_url;
                                
                                return (
                              <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200">
                                <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-xl ${isSigned ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                    <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                    <div className="flex items-center gap-3">
                                      <p className="font-semibold text-gray-900">{docName}</p>
                                              {isSigned && (
                                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                                                  Signed
                                                </span>
                                              )}
                                              {doc.status === 'Sent' && (
                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                                                  Pending Signature
                                                </span>
                                              )}
                                           </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                              {docDate} • {docType}
                                              {doc.signed_at && ` • Signed ${new Date(doc.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                           </p>
                                        </div>
                                     </div>
                                     {pdfUrl && (
                                       <a 
                                         href={pdfUrl} 
                                         target="_blank" 
                                         rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2.5 rounded-xl transition-all duration-200"
                                         download
                                         title={isSigned ? 'Download Signed PDF' : 'Download PDF'}
                                       >
                                         <Download className="w-5 h-5"/>
                                       </a>
                                     )}
                                  </div>
                                );
                              })}
                           </div>
                         )}

                      <h3 className="font-bold text-gray-900 text-xl pt-6">Notice Archive</h3>
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 text-center text-gray-500 text-sm">
                        <FileCheck className="w-14 h-14 mx-auto mb-4 text-gray-300" />
                            <p>You have no active compliance notices or lease violations.</p>
                         </div>
                      </div>

                    <div className="space-y-8">
                      <div className="bg-white p-7 rounded-2xl shadow-lg border border-gray-200">
                        <h3 className="font-bold text-gray-900 text-lg mb-6 flex items-center">
                          <Mail className="w-5 h-5 mr-3"/> Contact Manager
                        </h3>
                        <div className="space-y-4">
                               <textarea 
                            className="w-full p-4 border border-gray-300 rounded-xl text-sm h-36 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 transition-all duration-200" 
                                  placeholder="Type your message here..."
                                  value={contactMessage}
                                  onChange={(e) => setContactMessage(e.target.value)}
                               ></textarea>

                               {contactMessageError && (
                                 <div className="text-xs text-rose-600 font-semibold">{contactMessageError}</div>
                               )}
                               {contactMessageSuccess && (
                                 <div className="text-xs text-emerald-600 font-semibold">{contactMessageSuccess}</div>
                               )}

                          <button
                            onClick={handleSendContactMessage}
                            disabled={isSendingContactMessage || !contactMessage.trim()}
                            className="w-full py-3.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                                  {isSendingContactMessage ? 'Sending...' : 'Send Message'}
                               </button>
                            </div>
                        <div className="mt-6 pt-6 border-t border-gray-100 text-sm text-gray-500">
                          <p className="mb-2 font-semibold text-gray-700">Office Hours:</p>
                               <p>Mon-Fri: 9am - 6pm</p>
                               <p>Sat: 10am - 4pm</p>
                          <p className="mt-4 text-blue-600 font-semibold">(512) 555-0199</p>
                            </div>
                         </div>
                      </div>
                   </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicPortal;