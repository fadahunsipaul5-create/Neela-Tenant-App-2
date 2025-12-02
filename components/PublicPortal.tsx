
import React, { useState, useEffect, useRef } from 'react';
import { Listing, ApplicationForm, MaintenanceStatus, Invoice, PortalNotification, MaintenanceRequest, Property, Tenant, Payment, LegalDocument, TenantStatus } from '../types';
import { analyzeMaintenanceRequest } from '../services/geminiService';
import { api } from '../services/api';
import { login, logout, getCurrentUser, isAuthenticated, User as AuthUser, refreshTokenIfNeeded } from '../services/auth';
import { 
  MapPin, BedDouble, Bath, Maximize, Check, ArrowLeft, 
  FileText, Save, Send, User, FileSignature, Download, 
  CreditCard, Clock, AlertCircle, Building2, PenTool,
  Bell, Smartphone, Banknote, Image as ImageIcon, Loader2, X,
  MessageSquare, History, FileCheck, Mail, Lock, LogIn, ChevronRight,
  Wallet, DollarSign, Copy, Info, RefreshCw
} from 'lucide-react';

type PortalView = 'listings' | 'application' | 'dashboard' | 'lease_signing';
type UserStatus = 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident';
type ResidentTab = 'overview' | 'payments' | 'maintenance' | 'documents';
type PaymentSubTab = 'history' | 'payment-options';
type PaymentMethod = 'zelle' | 'cashapp' | 'venmo' | 'applepay' | 'ach' | 'card' | 'cash' | null;
type LoginType = 'admin' | 'tenant' | null;

interface PublicPortalProps {
  onAdminLogin?: () => void;
  tenantId?: string; // Optional tenant ID for fetching maintenance requests
  onMaintenanceCreated?: () => void; // Callback to notify parent when maintenance request is created
}

const PublicPortal: React.FC<PublicPortalProps> = ({ onAdminLogin, tenantId, onMaintenanceCreated }) => {
  const [view, setView] = useState<PortalView>('listings');
  const [userStatus, setUserStatus] = useState<UserStatus>('guest');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [activeTab, setActiveTab] = useState<ResidentTab>('overview');
  
  // Login State
  const [loginType, setLoginType] = useState<LoginType>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);

  // Application Form State
  const [formData, setFormData] = useState<ApplicationForm>(() => {
    // Load draft from localStorage if available
    const savedDraft = localStorage.getItem('application_draft');
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft);
      } catch (e) {
        console.error('Error parsing saved draft:', e);
      }
    }
    return {
      firstName: '', lastName: '', email: '', phone: '', dob: '',
      currentAddress: '', employer: '', jobTitle: '', income: '', ssnLast4: '',
      references: [{ name: '', relation: '', phone: '' }],
      consentBackgroundCheck: false
    };
  });
  
  // Application Submission State
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [applicationSuccess, setApplicationSuccess] = useState<string | null>(null);

  // Resident State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
  const [manualPaymentMode, setManualPaymentMode] = useState(false);
  
  // Documents and Payments State
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSubTab, setPaymentSubTab] = useState<PaymentSubTab>('history');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(null);
  
  // Lease State
  const [leaseDocument, setLeaseDocument] = useState<any | null>(null);
  const [loadingLease, setLoadingLease] = useState(false);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  
  // Fetch lease document for status tracking in dashboard
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
  
  // Properties State
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  
  // Computed values from tenant data
  const residentBalance = currentTenant ? parseFloat(currentTenant.balance.toString()) : 0;
  
  // Calculate days until due from lease dates
  const daysUntilDue = (() => {
    if (!currentTenant?.leaseStart) return 3; // Default fallback
    const today = new Date();
    const leaseStart = new Date(currentTenant.leaseStart);
    // Calculate days until next rent due (assuming rent is due on the 1st of each month)
    const nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const diffTime = nextDueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  })();

  // Mock notifications (TODO: Fetch from API when backend supports it)
  const notifications: PortalNotification[] = [
    { id: 'n1', type: 'Rent', title: 'Rent Due Soon', message: `Your rent of $${residentBalance} is due in ${daysUntilDue} days.`, date: '2 hours ago', read: false },
    { id: 'n2', type: 'Maintenance', title: 'Ticket Updated', message: 'Ticket #M1 (Leaking Faucet) status changed to In Progress.', date: 'Yesterday', read: true },
    { id: 'n3', type: 'System', title: 'Lease Document Available', message: 'Your countersigned lease is now available in documents.', date: '3 days ago', read: true },
  ];

  // Mock invoices (TODO: Fetch from API when backend supports it)
  const invoices: Invoice[] = [
    { id: 'inv-101', tenantId: currentTenant?.id || 'resident-1', date: '2024-11-01', dueDate: '2024-11-01', amount: residentBalance, period: 'November 2024', status: 'Pending' },
    { id: 'inv-100', tenantId: currentTenant?.id || 'resident-1', date: '2024-10-01', dueDate: '2024-10-01', amount: residentBalance, period: 'October 2024', status: 'Paid' },
    { id: 'inv-099', tenantId: currentTenant?.id || 'resident-1', date: '2024-09-01', dueDate: '2024-09-01', amount: residentBalance, period: 'September 2024', status: 'Paid' },
  ];

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      // First, proactively refresh token if needed
      try {
        await refreshTokenIfNeeded();
      } catch (error) {
        // Token refresh failed - user will need to log in again
        console.warn('Token refresh failed on app load:', error);
      }

      const user = getCurrentUser();
      if (user && isAuthenticated()) {
        setCurrentUser(user);
        try {
          setLoadingTenant(true);
          const tenantData = await api.getMyTenant();
          setCurrentTenant(tenantData);
          // Determine user status based on tenant status
          if (tenantData.status === TenantStatus.ACTIVE) {
            setUserStatus('resident');
            setView('dashboard');
          } else if (tenantData.status === TenantStatus.APPROVED) {
            setUserStatus('applicant_approved');
            setView('dashboard');
          } else if (tenantData.status === TenantStatus.APPLICANT) {
            setUserStatus('applicant_pending');
            setView('dashboard');
          }
        } catch (error: any) {
          // If error is "Not authenticated", clear user state - token was invalid
          if (error?.message?.includes('Not authenticated') || error?.message?.includes('401')) {
            setCurrentUser(null);
            setCurrentTenant(null);
            // Don't log as error - this is expected for unauthenticated users
          } else {
            console.error('Error fetching tenant data:', error);
            // User might not have a tenant record yet
          }
        } finally {
          setLoadingTenant(false);
        }
      } else {
        // No user or not authenticated - ensure state is clear
        setCurrentUser(null);
        setCurrentTenant(null);
      }
    };
    
    checkAuth();
  }, []);

  // Add this manual refresh function
  const refreshApplicationStatus = async () => {
    setLoadingTenant(true);
    try {
      const tenantData = await api.getMyTenant();
      setCurrentTenant(tenantData);
      
      // Update status
      if (tenantData.status === TenantStatus.ACTIVE) {
        setUserStatus('resident');
      } else if (tenantData.status === TenantStatus.APPROVED) {
        setUserStatus('applicant_approved');
      } else if (tenantData.status === TenantStatus.APPLICANT) {
        setUserStatus('applicant_pending');
      }
      
      // Fetch lease doc if we are approved
      if (tenantData.status === TenantStatus.APPROVED || tenantData.status === TenantStatus.ACTIVE) {
         // Trigger fetching lease by updating dependencies or calling fetch directly?
         // The existing useEffect [currentTenant?.id, tenantId, view] will likely fire when currentTenant changes.
      }
      
    } catch (error) {
      console.error('Error refreshing tenant status:', error);
    } finally {
      setLoadingTenant(false);
    }
  };

  // Fetch tenant's maintenance requests
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
        // Filter to show only this tenant's requests
        if (isMounted) {
          const tenantRequests = allRequests.filter(req => req.tenantId === tenantIdToUse);
          setMyTickets(tenantRequests);
        }
      } catch (error) {
        console.error("Error fetching maintenance requests:", error);
        // Set empty array on error to prevent UI issues
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

  // Fetch lease document when lease_signing view is opened
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
        // Find lease agreement document
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

  // Save application draft to localStorage whenever formData changes
  useEffect(() => {
    if (view === 'application') {
      localStorage.setItem('application_draft', JSON.stringify(formData));
    }
  }, [formData, view]);

  // Fetch documents when documents tab is opened
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

  // Fetch payments when payments tab is opened or tenant changes
  useEffect(() => {
    const tenantIdToUse = currentTenant?.id || tenantId;
    if (!tenantIdToUse) {
      setPayments([]);
      return;
    }
    
    let isMounted = true;
    
    const fetchPayments = async () => {
      setLoadingPayments(true);
      try {
        const allPayments = await api.getPayments();
        // Filter to show only this tenant's payments
        if (isMounted) {
          const tenantPayments = allPayments.filter(p => p.tenantId === tenantIdToUse);
          setPayments(tenantPayments);
        }
      } catch (error) {
        console.error("Error fetching payments:", error);
        if (isMounted) {
          setPayments([]);
        }
      } finally {
        if (isMounted) {
          setLoadingPayments(false);
        }
      }
    };
    
    fetchPayments();
    
    return () => {
      isMounted = false;
    };
  }, [currentTenant?.id, tenantId]);

  // Fetch properties for listings
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoadingProperties(true);
        const propertiesData = await api.getProperties();
        setProperties(propertiesData);
      } catch (error) {
        console.error("Error fetching properties:", error);
        setProperties([]);
      } finally {
        setLoadingProperties(false);
      }
    };

    fetchProperties();
  }, []);

  // Convert Property to Listing format
  const propertyToListing = (property: Property): Listing => {
    // Handle image URL - display_image from serializer should be a full URL
    // If it's still relative, prepend API base URL
    let imageUrl = property.image || '';
    if (imageUrl && !imageUrl.startsWith('http')) {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      // Remove /api from the end if present
      const baseUrl = API_BASE.replace(/\/api$/, '');
      // Ensure imageUrl starts with / for proper concatenation
      imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    }

    return {
      id: property.id,
      title: property.name,
      address: `${property.address}, ${property.city}, ${property.state}`,
      price: property.price || 0,
      beds: 2, // Default since Property model doesn't have beds
      baths: 2, // Default since Property model doesn't have baths
      sqft: 1000, // Default since Property model doesn't have sqft
      image: imageUrl,
      description: `Beautiful ${property.name} located in ${property.city}, ${property.state}. ${property.units} ${property.units === 1 ? 'unit' : 'units'} available.`,
      amenities: [] // Property model doesn't have amenities
    };
  };

  const handleApply = (listing: Listing) => {
    setSelectedListing(listing);
    setView('application');
    // Reset form state when opening application
    setApplicationError(null);
    setApplicationSuccess(null);
  };

  const handleSubmitApplication = async () => {
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setApplicationError('Please fill in all required fields (First Name, Last Name, Email, Phone)');
      return;
    }
    
    if (!selectedListing) {
      setApplicationError('No property selected');
      return;
    }
    
    setIsSubmittingApplication(true);
    setApplicationError(null);
    setApplicationSuccess(null);
    
    try {
      // Prepare tenant data
      // Ensure rent_amount and deposit are valid decimal numbers (required fields)
      const rentAmount = selectedListing?.price && selectedListing.price > 0 
        ? selectedListing.price 
        : 1000; // Default rent amount if not specified
      
      const propertyUnit = selectedListing?.title || selectedListing?.address || 'Property Application';
      
      const tenantData = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        status: TenantStatus.APPLICANT,
        propertyUnit: propertyUnit,
        rentAmount: rentAmount,
        deposit: 500, // Default deposit amount (will be adjusted later)
        balance: 0,
        applicationData: {
          submissionDate: new Date().toISOString(),
          employment: {
            employer: formData.employer || '',
            jobTitle: formData.jobTitle || '',
            monthlyIncome: formData.income ? parseFloat(formData.income.replace(/[^0-9.]/g, '')) || 0 : 0,
            duration: 'N/A', // Can be added to form later
          },
          references: formData.references || [],
          documents: [], // Can be added later
          internalNotes: '',
          firstName: formData.firstName,
          lastName: formData.lastName,
          dob: formData.dob,
          currentAddress: formData.currentAddress,
          ssnLast4: formData.ssnLast4,
          consentBackgroundCheck: formData.consentBackgroundCheck,
        }
      };
      
      // Submit application (this will trigger admin email notification)
      await api.createTenant(tenantData);
      
      // Clear draft after successful submission
      localStorage.removeItem('application_draft');
      
      setApplicationSuccess('Application submitted successfully! You will receive an email once it\'s reviewed.');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        setUserStatus('applicant_pending');
        setView('dashboard');
      }, 2000);
      
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      if (loginType === 'admin') {
        // For admin login, verify user has admin privileges
        const response = await login(loginEmail, loginPassword);
        // Store user data
        setCurrentUser(response.user);
        // Check if user is staff or superuser (admin)
        if (!response.user.is_staff && !response.user.is_superuser) {
          setLoginError('Access denied. This account does not have admin privileges.');
          return;
        }
        // User is verified as admin, proceed with admin login
        onAdminLogin?.();
      } else if (loginType === 'tenant') {
        // Tenant login
        const response = await login(loginEmail, loginPassword);
        setCurrentUser(response.user);
        
        // Fetch tenant data
        if (response.tenant) {
          // Map backend tenant data (snake_case) to frontend format (camelCase)
          const backendTenant = response.tenant as any; // Backend returns snake_case
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
          
          // Determine user status based on tenant status
          if (tenant.status === TenantStatus.APPROVED || tenant.status === TenantStatus.ACTIVE) {
        setUserStatus('resident');
          } else if (tenant.status === TenantStatus.APPLICANT) {
            setUserStatus('applicant_pending');
          }
        } else {
          // If no tenant data, try to fetch it
          try {
            setLoadingTenant(true);
            const tenantData = await api.getMyTenant();
            setCurrentTenant(tenantData);
            if (tenantData.status === TenantStatus.APPROVED || tenantData.status === TenantStatus.ACTIVE) {
              setUserStatus('resident');
            } else if (tenantData.status === TenantStatus.APPLICANT) {
              setUserStatus('applicant_pending');
            }
          } catch (err) {
            console.error('Error fetching tenant data:', err);
            // User might not have a tenant record yet
          } finally {
            setLoadingTenant(false);
          }
        }
        
        setView('dashboard');
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

  const handleSignLease = () => {
    setTimeout(() => {
      setUserStatus('resident');
      setView('dashboard');
    }, 1500);
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
      // Convert images to base64 data URLs for backend
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
        images: imageUrls.length > 0 ? imageUrls : undefined, // Optional - only include if images exist
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
      
      // Notify parent component to refresh maintenance list
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

    // Create previews
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

  const downloadReceipt = (paymentId: string) => {
    // Find the payment in the payments array
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
      alert('Receipt not available for this payment.');
      return;
    }
    
    // For now, we'll create a simple receipt text or use a receipt URL if available
    // In a real implementation, this would fetch a PDF from the backend
    // For now, we'll show an alert with payment details
    const receiptText = `
Payment Receipt
================
Payment ID: ${payment.id}
Date: ${payment.date}
Amount: $${payment.amount}
Status: ${payment.status}
Type: ${payment.type}
Method: ${payment.method || 'N/A'}
${payment.reference ? `Reference: ${payment.reference}` : ''}
    `.trim();
    
    // Create a blob and download it as a text file
    // In production, this would be a PDF from the backend
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${payment.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- SUB-COMPONENTS ---

  const LoginModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden scale-100">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            {loginType === 'admin' ? 'Admin Portal Login' : 'Tenant Portal Login'}
          </h3>
          <button onClick={() => setLoginType(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleLoginSubmit} className="p-8 space-y-4">
           {loginError && (
             <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-sm">
               {loginError}
             </div>
           )}
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
             <input 
               type="email" 
               className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-slate-900"
               placeholder={loginType === 'admin' ? "admin@neelacapital.com" : "tenant@example.com"} 
               value={loginEmail}
               onChange={(e) => setLoginEmail(e.target.value)}
               required
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
             <input 
               type="password" 
               className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-slate-900"
               placeholder="••••••••" 
               value={loginPassword}
               onChange={(e) => setLoginPassword(e.target.value)}
               required
             />
           </div>
           <button 
             type="submit"
             disabled={isLoggingIn}
             className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In to Dashboard'}
           </button>
           
           {loginType === 'admin' && (
              <p className="text-xs text-center text-slate-500 mt-4 bg-slate-50 p-2 rounded">
                <Lock className="w-3 h-3 inline mr-1"/> Secure Area. Authorized Personnel Only.
              </p>
           )}
           {loginType === 'tenant' && (
              <p className="text-xs text-center text-slate-500 mt-4">
                Don't have an account? <button type="button" onClick={() => {setLoginType(null); setView('listings')}} className="text-indigo-600 hover:underline">Apply for a property</button>
              </p>
           )}
        </form>
      </div>
    </div>
  );

  const LandingHeader = () => (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => { setView('listings'); setUserStatus('guest'); }}
        >
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold font-serif shadow-md">N</div>
           <div className="flex flex-col">
              <span className="text-lg font-bold text-slate-800 leading-none">Neela Capital</span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Resident Portal</span>
           </div>
        </div>
        <div className="flex items-center gap-3">
          {userStatus === 'guest' && (
             <>
               <button 
                 onClick={() => setLoginType('tenant')} 
                 className="hidden md:flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
               >
                  <LogIn className="w-4 h-4 mr-2" /> Tenant Sign In
               </button>
               <button 
                 onClick={() => setLoginType('admin')}
                 className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
               >
                  <Lock className="w-4 h-4" /> Admin Login
               </button>
             </>
          )}
          {userStatus !== 'guest' && currentUser && (
             <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">
                  Hello, {currentUser.first_name || currentUser.email}
                </span>
                <button 
                   onClick={() => { 
                     logout();
                     setUserStatus('guest'); 
                     setView('listings');
                     setCurrentUser(null);
                     setCurrentTenant(null);
                   }}
                   className="text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                   Sign Out
                </button>
             </div>
          )}
        </div>
      </div>
    </header>
  );

  const ListingCard: React.FC<{ listing: Listing }> = ({ listing }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="relative h-56 group">
        {listing.image ? (
        <img src={listing.image} alt={listing.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-slate-200 flex items-center justify-center">
            <Building2 className="w-16 h-16 text-slate-400" />
          </div>
        )}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-indigo-600">
          ${listing.price}/mo
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{listing.title}</h3>
        <div className="flex items-start text-slate-600 mb-4 text-sm">
          <MapPin className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
          {listing.address}
        </div>
        
        <div className="flex items-center justify-between mb-6 text-sm text-slate-600">
          <div className="flex items-center"><BedDouble className="w-4 h-4 mr-1"/> {listing.beds} Beds</div>
          <div className="flex items-center"><Bath className="w-4 h-4 mr-1"/> {listing.baths} Baths</div>
          <div className="flex items-center"><Maximize className="w-4 h-4 mr-1"/> {listing.sqft} sqft</div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100">
          <button 
            onClick={() => handleApply(listing)}
            className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex justify-center items-center"
          >
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );

  const StatusTracker: React.FC<{ status: UserStatus; leaseStatus?: string }> = ({ status, leaseStatus }) => {
    const steps = [
      { id: 'applicant_pending', label: 'Application Submitted', icon: FileText },
      { id: 'reviewing', label: 'Under Review', icon: User },
      { id: 'applicant_approved', label: 'Approved', icon: Check },
      { id: 'resident', label: 'Lease Signed', icon: FileSignature },
    ];

    const getStepState = (stepId: string) => {
      if (status === 'resident') return 'completed';
      
      if (status === 'applicant_approved') {
        // If we are approved, 'Approved' step should be active/completed
        if (stepId === 'applicant_pending' || stepId === 'reviewing') return 'completed';
        if (stepId === 'applicant_approved') return 'completed'; // Or 'current' depending on design, but 'completed' usually implies "done"
        
        if (stepId === 'resident') {
           return leaseStatus === 'Signed' ? 'completed' : 'pending';
        }
        return 'completed';
      }
      
      // If pending, submitted is done, reviewing is current
      if (status === 'applicant_pending') {
        if (stepId === 'applicant_pending') return 'completed';
        if (stepId === 'reviewing') return 'current';
        return 'pending';
      }
      
      return 'pending';
    };

    return (
      <div className="w-full py-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10"></div>
          {steps.map((step) => {
            const state = getStepState(step.id);
            const isCompleted = state === 'completed';
            const isCurrent = state === 'current';
            
            return (
              <div key={step.id} className="flex flex-col items-center bg-slate-50 px-2">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                  ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 
                    isCurrent ? 'bg-indigo-600 border-indigo-600 text-white' : 
                    'bg-white border-slate-300 text-slate-300'}
                `}>
                  <step.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium mt-2 ${isCurrent || isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPaymentInstructions = (method: string) => {
    // Normalize method name for comparison (just in case)
    const m = method.toLowerCase().replace(' ', '');
    
    return (
      <div className="space-y-4 animate-in slide-in-from-right-4">
         {/* Zelle Instructions */}
         {(m === 'zelle') && (
            <div className="space-y-4">
               <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-start">
                     <Info className="w-5 h-5 text-indigo-600 mt-0.5 mr-3 flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-indigo-900 mb-2">Property Manager Zelle Information</p>
                        <div className="space-y-2 text-sm text-indigo-800">
                           <div className="flex items-center justify-between">
                              <span className="font-medium">Email:</span>
                              <span className="font-mono bg-white px-2 py-1 rounded">payments@property.com</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="font-medium">Phone:</span>
                              <span className="font-mono bg-white px-2 py-1 rounded">(555) 123-4567</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <h5 className="font-semibold text-slate-800">Step-by-Step Instructions:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                     <li>Open your bank's mobile app or website and navigate to Zelle</li>
                     <li>Select "Send Money" or "Send with Zelle"</li>
                     <li>Enter the email or phone number listed above</li>
                     <li>Enter the payment amount (your current balance is ${residentBalance}.00)</li>
                     <li>Review the recipient name to ensure it matches your property manager</li>
                     <li>Add a memo/note: "Rent - [Your Unit Number]"</li>
                     <li>Confirm and send the payment</li>
                     <li>Save your transaction confirmation for your records</li>
                  </ol>
               </div>
               <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                     <strong>Important:</strong> Payments may take 1-3 business days to process. Please send payments at least 3 days before your due date to avoid late fees.
                  </p>
               </div>
            </div>
         )}

         {/* CashApp Instructions */}
         {(m === 'cashapp') && (
            <div className="space-y-4">
               <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                     <Info className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-green-900 mb-2">Property Manager CashApp Information</p>
                        <div className="space-y-2 text-sm text-green-800">
                           <div className="flex items-center justify-between">
                              <span className="font-medium">CashApp Tag:</span>
                              <span className="font-mono bg-white px-2 py-1 rounded">$PropertyRent</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <h5 className="font-semibold text-slate-800">Step-by-Step Instructions:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                     <li>Open the Cash App on your mobile device</li>
                     <li>Tap the "$" icon or "Pay" button</li>
                     <li>Enter the CashApp tag: <code className="bg-slate-100 px-1 rounded">$PropertyRent</code></li>
                     <li>Enter the payment amount (${residentBalance}.00)</li>
                     <li>Tap "Pay" and enter your PIN or use Touch ID/Face ID</li>
                     <li>Add a note: "Rent - [Your Unit Number]"</li>
                     <li>Confirm the payment</li>
                     <li>Screenshot your receipt for your records</li>
                  </ol>
               </div>
               <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                     <strong>Note:</strong> CashApp payments are typically instant. Make sure you have sufficient funds in your CashApp balance or linked account.
                  </p>
               </div>
            </div>
         )}

         {/* Venmo Instructions */}
         {(m === 'venmo') && (
            <div className="space-y-4">
               <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                     <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-blue-900 mb-2">Property Manager Venmo Information</p>
                        <div className="space-y-2 text-sm text-blue-800">
                           <div className="flex items-center justify-between">
                              <span className="font-medium">Venmo Username:</span>
                              <span className="font-mono bg-white px-2 py-1 rounded">@PropertyRent</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <h5 className="font-semibold text-slate-800">Step-by-Step Instructions:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                     <li>Open the Venmo app on your mobile device</li>
                     <li>Tap the "Pay or Request" button</li>
                     <li>Search for <code className="bg-slate-100 px-1 rounded">@PropertyRent</code> and select the verified account</li>
                     <li>Enter the payment amount (${residentBalance}.00)</li>
                     <li>Add a note: "Rent - [Your Unit Number]"</li>
                     <li>Select your payment method (bank account or card)</li>
                     <li>Review and tap "Pay"</li>
                     <li>Save your payment confirmation</li>
                  </ol>
               </div>
               <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                     <strong>Important:</strong> Ensure you're sending to the correct verified account. Payments to bank accounts may take 1-3 business days.
                  </p>
               </div>
            </div>
         )}

         {/* Apple Pay Instructions */}
         {(m === 'applepay') && (
            <div className="space-y-4">
               <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start">
                     <Info className="w-5 h-5 text-slate-600 mt-0.5 mr-3 flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-slate-900 mb-2">Apple Pay Payment Instructions</p>
                        <p className="text-sm text-slate-700">Use Apple Pay through our payment portal or in-person.</p>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <h5 className="font-semibold text-slate-800">Step-by-Step Instructions:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                     <li>Click the "Pay Now" button in your portal</li>
                     <li>Enter your payment amount (${residentBalance}.00)</li>
                     <li>Select "Apple Pay" as your payment method</li>
                     <li>Authenticate using Face ID, Touch ID, or passcode</li>
                     <li>Confirm the payment on your device</li>
                     <li>Wait for the confirmation screen</li>
                     <li>Download or save your receipt</li>
                  </ol>
               </div>
               <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                     <strong>Tip:</strong> Apple Pay is the fastest and most secure way to pay. Your payment is processed immediately.
                  </p>
               </div>
            </div>
         )}

         {/* ACH Instructions */}
         {(m === 'ach' || m === 'banktransfer(ach)') && (
            <div className="space-y-4">
               <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-start">
                     <Info className="w-5 h-5 text-indigo-600 mt-0.5 mr-3 flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-indigo-900 mb-2">ACH Bank Transfer Information</p>
                        <div className="space-y-2 text-sm text-indigo-800">
                           <div className="flex items-center justify-between">
                              <span className="font-medium">Bank Name:</span>
                              <span className="bg-white px-2 py-1 rounded">First National Bank</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="font-medium">Account Number:</span>
                              <span className="font-mono bg-white px-2 py-1 rounded">****1234</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="font-medium">Routing Number:</span>
                              <span className="font-mono bg-white px-2 py-1 rounded">123456789</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <h5 className="font-semibold text-slate-800">Step-by-Step Instructions:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                     <li>Log in to your online banking account</li>
                     <li>Navigate to "Bill Pay" or "Transfers"</li>
                     <li>Select "Add Payee" or "External Transfer"</li>
                     <li>Enter the bank information provided above</li>
                     <li>Enter your payment amount (${residentBalance}.00)</li>
                     <li>Set the payment date (at least 3 days before due date)</li>
                     <li>Add a memo: "Rent - [Your Unit Number]"</li>
                     <li>Review and submit the payment</li>
                     <li>Save your confirmation number</li>
                  </ol>
               </div>
               <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                     <strong>Processing Time:</strong> ACH transfers typically take 3-5 business days. Please schedule payments well in advance of your due date.
                  </p>
               </div>
            </div>
         )}

         {/* Card Instructions */}
         {(m === 'card' || m === 'credit/debitcard') && (
            <div className="space-y-4">
               <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-start">
                     <Info className="w-5 h-5 text-indigo-600 mt-0.5 mr-3 flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-indigo-900 mb-2">Credit/Debit Card Payment</p>
                        <p className="text-sm text-indigo-800">Pay securely using Visa, Mastercard, American Express, or Discover.</p>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <h5 className="font-semibold text-slate-800">Step-by-Step Instructions:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                     <li>Click the "Pay Now" button in your portal</li>
                     <li>Enter your payment amount (${residentBalance}.00)</li>
                     <li>Select "Credit/Debit Card" as payment method</li>
                     <li>Enter your card number, expiration date, and CVV</li>
                     <li>Enter the cardholder name and billing address</li>
                     <li>Review the payment details and any processing fees</li>
                     <li>Click "Submit Payment"</li>
                     <li>Wait for confirmation and download your receipt</li>
                  </ol>
               </div>
               <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                     <strong>Processing Fee:</strong> Credit/debit card payments may include a processing fee (typically 2.9% + $0.30). This fee covers the cost of card processing services.
                  </p>
               </div>
               <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                     <strong>Security:</strong> All card payments are processed through a secure, encrypted payment gateway. Your card information is never stored on our servers.
                  </p>
               </div>
            </div>
         )}

         {/* Cash Instructions */}
         {(m === 'cash') && (
            <div className="space-y-4">
               <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start">
                     <Info className="w-5 h-5 text-emerald-600 mt-0.5 mr-3 flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-emerald-900 mb-2">Cash Payment Information</p>
                        <p className="text-sm text-emerald-800">Please follow these guidelines for cash payments.</p>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <h5 className="font-semibold text-slate-800">Step-by-Step Instructions:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                     <li>Prepare exact cash amount: ${residentBalance}.00</li>
                     <li>Place cash in a sealed envelope</li>
                     <li>Write your name and unit number on the envelope</li>
                     <li>Include a note with the payment date and amount</li>
                     <li>Drop off at the property management office during business hours</li>
                     <li>Office hours: Monday-Friday, 9:00 AM - 5:00 PM</li>
                     <li>Request a receipt immediately upon payment</li>
                     <li>Keep your receipt in a safe place</li>
                  </ol>
               </div>
               <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                  <p className="text-sm text-rose-800 font-semibold mb-2">Important Guidelines:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-rose-700">
                     <li>Only pay during office hours with a staff member present</li>
                     <li>Always request and keep a receipt</li>
                     <li>Never leave cash unattended or in a drop box</li>
                     <li>Count your cash before handing it over</li>
                     <li>Do not send cash through the mail</li>
                  </ul>
               </div>
               <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                     <strong>Office Location:</strong> 123 Property Management St, Suite 100, [Your City, State 12345]
                  </p>
               </div>
            </div>
         )}
      </div>
    );
  };

  const PaymentModal = () => {
    const [modalMethod, setModalMethod] = useState<string | null>(null);

    return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="sticky top-0 bg-white z-10 p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center">
             {modalMethod && (
                <button onClick={() => setModalMethod(null)} className="mr-3 text-slate-500 hover:text-slate-800 transition-colors">
                   <ArrowLeft className="w-5 h-5" />
                </button>
             )}
             <h3 className="text-lg font-bold text-slate-800">
               {modalMethod ? 'Payment Instructions' : (manualPaymentMode ? 'Report Manual Payment' : 'Make a Payment')}
             </h3>
          </div>
          <button onClick={() => { setShowPaymentModal(false); setManualPaymentMode(false); }} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
           {!modalMethod && (
               <div className="text-center">
                 <p className="text-sm text-slate-600">Total Amount Due</p>
                 <p className="text-4xl font-bold text-slate-800 mt-1">${residentBalance}.00</p>
                 {daysUntilDue < 0 && <span className="inline-block mt-2 px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded">Includes Late Fees</span>}
               </div>
           )}

           {modalMethod ? (
               <div>
                   <div className="mb-4 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                       <div className="flex items-center font-medium text-slate-800">
                           {['Zelle', 'Venmo', 'CashApp', 'Apple Pay'].includes(modalMethod) ? <Smartphone className="w-4 h-4 mr-2 text-indigo-600"/> : 
                            modalMethod === 'Cash' ? <DollarSign className="w-4 h-4 mr-2 text-emerald-600"/> :
                            <CreditCard className="w-4 h-4 mr-2 text-indigo-600"/>}
                           {modalMethod}
                       </div>
                       <span className="text-sm font-bold text-slate-900">${residentBalance}.00</span>
                   </div>
                   {renderPaymentInstructions(modalMethod)}
               </div>
           ) : !manualPaymentMode ? (
             <>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Instant Pay</p>
                <div className="grid grid-cols-2 gap-3">
                  {['Zelle', 'Venmo', 'CashApp', 'Apple Pay'].map(method => (
                    <button 
                        key={method} 
                        onClick={() => setModalMethod(method)}
                        className="flex items-center justify-center py-3 border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors font-medium text-sm text-slate-700"
                    >
                      <Smartphone className="w-4 h-4 mr-2 text-slate-400" /> {method}
                    </button>
                  ))}
                </div>
                
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-4">Bank & Card</p>
                <div className="space-y-2">
                    <button 
                        onClick={() => setModalMethod('Credit/Debit Card')}
                        className="w-full flex items-center px-4 py-3 border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
                    >
                      <CreditCard className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 mr-3" />
                      <div className="text-left">
                        <span className="block text-sm font-medium text-slate-700 group-hover:text-indigo-700">Credit / Debit Card</span>
                        <span className="block text-xs text-slate-500">2.9% processing fee</span>
                      </div>
                    </button>
                    <button 
                        onClick={() => setModalMethod('Bank Transfer (ACH)')}
                        className="w-full flex items-center px-4 py-3 border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
                    >
                      <Building2 className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 mr-3" />
                      <div className="text-left">
                        <span className="block text-sm font-medium text-slate-700 group-hover:text-indigo-700">Bank Transfer (ACH)</span>
                        <span className="block text-xs text-slate-500">Free • 1-3 business days</span>
                      </div>
                    </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setManualPaymentMode(true)}
                    className="text-slate-600 text-sm font-medium hover:text-slate-800 flex items-center justify-center w-full transition-colors"
                  >
                    I paid by Cash or Check
                  </button>
              </div>
             </>
           ) : (
             <div className="space-y-4 animate-in slide-in-from-right-4">
                <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded border border-amber-200">
                  Manual payments must be verified by the property manager before your balance is updated.
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
                  <select className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white">
                    <option>Personal Check</option>
                    <option>Cashier's Check</option>
                    <option>Cash (Handed to Office)</option>
                    <option>Money Order</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check Number / Reference</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" placeholder="e.g. #1054" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date Handed Over</label>
                  <input type="date" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" />
                </div>
                <button 
                  onClick={() => { alert("Payment reported!"); setShowPaymentModal(false); setManualPaymentMode(false); }}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 mt-4"
                >
                  Submit Report
                </button>
                <button 
                  onClick={() => setManualPaymentMode(false)}
                  className="w-full py-2 text-slate-600 text-sm hover:text-slate-800"
                >
                  Back to Digital Payment
                </button>
             </div>
           )}
        </div>
      </div>
    </div>
    );
  };

  // --- VIEWS ---

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <LandingHeader />
      {loginType && <LoginModal />}
      
      <div className="flex-1 flex flex-col">
        {/* 1. LEASE SIGNING VIEW */}
        {view === 'lease_signing' && (
          <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-8 flex-1 flex flex-col animate-fade-in">
             <div className="flex items-center justify-between mb-6">
              <button onClick={() => setView('dashboard')} className="flex items-center text-slate-500 hover:text-slate-800">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
              </button>
              <div className="flex items-center gap-2">
                 <span className="text-sm text-slate-600">Powered by</span>
                 <span className="font-bold text-slate-700 italic">DocuSign</span>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col md:flex-row">
               <div className="flex-1 bg-slate-100 p-8 overflow-y-auto border-r border-slate-200 max-h-[800px]">
                  {loadingLease ? (
                    <div className="flex items-center justify-center min-h-[800px]">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600 mb-4" />
                        <p className="text-slate-600">Loading lease document...</p>
                      </div>
                    </div>
                  ) : leaseError ? (
                    <div className="flex items-center justify-center min-h-[800px]">
                      <div className="text-center bg-rose-50 border border-rose-200 rounded-lg p-6 max-w-md">
                        <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-4" />
                        <p className="text-rose-800 font-medium mb-2">Unable to Load Lease</p>
                        <p className="text-rose-600 text-sm">{leaseError}</p>
                      </div>
                    </div>
                  ) : leaseDocument?.pdfUrl ? (
                    <div className="bg-white shadow-sm min-h-[800px]">
                      <iframe
                        src={leaseDocument.pdfUrl}
                        className="w-full h-[800px] border-0"
                        title="Lease Agreement PDF"
                      />
                    </div>
                  ) : leaseDocument?.signedPdfUrl ? (
                    <div className="bg-white shadow-sm min-h-[800px]">
                      <iframe
                        src={leaseDocument.signedPdfUrl}
                        className="w-full h-[800px] border-0"
                        title="Signed Lease Agreement PDF"
                      />
                    </div>
                  ) : (
                    <div className="bg-white shadow-sm min-h-[800px] p-12 max-w-3xl mx-auto text-slate-800">
                      <h1 className="text-2xl font-bold serif mb-2 text-center">RESIDENTIAL LEASE AGREEMENT</h1>
                      <p className="text-center text-slate-500 mb-8">Texas Property Code</p>
                      <div className="space-y-6 font-serif text-sm leading-relaxed text-slate-800">
                         <p>This agreement is made between PropGuard Management and {currentTenant?.name || formData.firstName + ' ' + formData.lastName}.</p>
                         <p>Rent: ${currentTenant?.rentAmount || selectedListing?.price || 1850}.00 per month.</p>
                         <div className="my-8 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
                           <p className="font-bold mb-1">Sign Here:</p>
                           <div className="h-12 border-b border-yellow-400"></div>
                         </div>
                      </div>
                    </div>
                  )}
               </div>
               <div className="w-full md:w-80 bg-white p-6 flex flex-col border-t md:border-t-0">
                  <h3 className="font-bold text-slate-800 mb-4">Action Required</h3>
                  {leaseDocument?.status === 'Signed' ? (
                    <>
                      <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <p className="text-emerald-800 text-sm font-medium">✓ Lease Signed</p>
                        {leaseDocument.signedAt && (
                          <p className="text-emerald-600 text-xs mt-1">Signed on {new Date(leaseDocument.signedAt).toLocaleDateString()}</p>
                        )}
                      </div>
                      {leaseDocument.signedPdfUrl && (
                        <a
                          href={leaseDocument.signedPdfUrl}
                          download
                          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all text-center mb-3"
                        >
                          <Download className="w-4 h-4 inline mr-2" />
                          Download Signed Lease
                        </a>
                      )}
                    </>
                  ) : leaseDocument?.docusignSigningUrl ? (
                    <>
                      <p className="text-sm text-slate-600 mb-6">Click the button below to sign via DocuSign.</p>
                      <a
                        href={leaseDocument.docusignSigningUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all text-center"
                      >
                        Sign via DocuSign
                      </a>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 mb-6">Please review the lease document. Once you're ready, you can sign it.</p>
                      <button 
                          onClick={handleSignLease}
                          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all mt-auto"
                        >
                          Finish & Submit
                      </button>
                    </>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* 2. LISTINGS VIEW (GUEST) */}
        {view === 'listings' && (
          <div className="space-y-8 pb-12">
            {/* Hero Section */}
            <div className="bg-indigo-900 text-white py-16 px-6 md:px-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-10 bg-cover bg-center"></div>
              <div className="relative z-10 max-w-7xl mx-auto">
                <div className="max-w-2xl">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">Find your next home in Texas</h1>
                    <p className="text-indigo-200 text-lg mb-8">Browse our curated selection of premium rentals with transparent pricing and instant applications.</p>
                    
                    <div className="flex flex-wrap gap-4">
                       <button onClick={() => setLoginType('tenant')} className="px-6 py-3 bg-white text-indigo-900 font-bold rounded-lg hover:bg-indigo-50 transition-colors">
                         Resident Login
                       </button>
                       <button onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-3 bg-indigo-800/50 hover:bg-indigo-800 text-white font-bold rounded-lg backdrop-blur-sm border border-indigo-500/30 transition-colors">
                         Browse Listings
                       </button>
                    </div>
                </div>
              </div>
            </div>

            <div id="listings" className="max-w-7xl mx-auto px-4 md:px-8 w-full">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Available Properties</h2>
                {loadingProperties ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600 mb-4" />
                    <p className="text-slate-600">Loading properties...</p>
                  </div>
                ) : properties.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-600">No properties available at this time.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {properties.map(property => {
                      const listing = propertyToListing(property);
                      return <ListingCard key={listing.id} listing={listing} />;
                    })}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* 3. APPLICATION VIEW */}
        {view === 'application' && (
          <div className="max-w-2xl mx-auto w-full px-4 md:px-8 py-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                   <button onClick={() => setView('listings')} className="text-slate-400 hover:text-slate-600"><ArrowLeft/></button>
                   <h2 className="text-xl font-bold text-slate-800">Application for {selectedListing?.title}</h2>
                </div>
                <div className="p-8">
                   <div className="space-y-6">
                      {/* Error/Success Messages */}
                      {applicationError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-sm">
                          {applicationError}
                        </div>
                      )}
                      {applicationSuccess && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">
                          {applicationSuccess}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">First Name <span className="text-rose-500">*</span></label>
                            <input 
                              type="text" 
                              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                              value={formData.firstName}
                              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                              required
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name <span className="text-rose-500">*</span></label>
                            <input 
                              type="text" 
                              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                              value={formData.lastName}
                              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                              required
                            />
                         </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Email Address <span className="text-rose-500">*</span></label>
                          <input 
                            type="email" 
                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            required
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-rose-500">*</span></label>
                          <input 
                            type="tel" 
                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            placeholder="(555) 123-4567"
                            required
                          />
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                         <h4 className="font-medium text-slate-800 mb-2">Application Fee</h4>
                         <div className="flex justify-between text-sm mb-4">
                            <span className="text-slate-600">Processing & Background Check</span>
                            <span className="font-bold text-slate-800">$45.00</span>
                         </div>
                         <p className="text-xs text-slate-500 mb-4 italic">Payment will be processed after application review</p>
                         <button 
                            onClick={handleSubmitApplication}
                            disabled={isSubmittingApplication}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                         >
                            {isSubmittingApplication ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              'Submit Application'
                            )}
                         </button>
                      </div>
                   </div>
                </div>
            </div>
          </div>
        )}

        {/* 4. RESIDENT / APPLICANT DASHBOARD */}
        {(view === 'dashboard') && (
          <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 animate-fade-in pb-20">
            {showPaymentModal && <PaymentModal />}
            
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  {userStatus === 'resident' 
                    ? `Welcome Home, ${currentUser?.first_name || currentTenant?.name?.split(' ')[0] || 'Resident'}` 
                    : 'Application Status'}
                </h1>
                <p className="text-slate-500">
                  {userStatus === 'resident' 
                    ? 'Manage your home, payments, and requests.' 
                    : 'Track your application progress below.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {userStatus !== 'resident' && (
                  <button 
                    onClick={refreshApplicationStatus}
                    disabled={loadingTenant}
                    className="flex items-center px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingTenant ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                )}
                {userStatus === 'resident' && (
                    <div className="relative">
                        <Bell className="w-6 h-6 text-slate-400 hover:text-slate-600 cursor-pointer" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-50"></span>
                    </div>
                )}
              </div>
            </div>
            
            {/* Loading State */}
            {loadingTenant && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            )}

            {/* APPLICANT VIEW */}
            {userStatus !== 'resident' && !loadingTenant && (
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-6">Timeline</h3>
                  <StatusTracker status={userStatus} leaseStatus={leaseDocument?.status || currentTenant?.leaseStatus} />
                </div>
                {userStatus === 'applicant_approved' && (
                   <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                      <Check className="w-12 h-12 text-emerald-600 mb-4" />
                      <h3 className="text-2xl font-bold text-emerald-900 mb-2">Approved!</h3>
                      <p className="text-emerald-800 mb-6 max-w-lg">
                        Your application has been approved. Please sign the lease to finalize your move-in.
                      </p>
                      {leaseDocument ? (
                        <button onClick={() => setView('lease_signing')} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all">
                          Review & Sign Lease
                        </button>
                      ) : (
                        <div className="flex flex-col items-center">
                          <button disabled className="px-8 py-3 bg-emerald-400 text-white font-bold rounded-lg cursor-not-allowed flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Lease Being Prepared
                          </button>
                          <p className="text-emerald-700 text-xs mt-2">Your property manager is preparing your lease document.</p>
                        </div>
                      )}
                   </div>
                )}
                 {userStatus === 'applicant_pending' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center">
                     <Clock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                     <h3 className="text-xl font-bold text-blue-900 mb-2">Application Under Review</h3>
                     <p className="text-blue-700">We are processing your background check. This usually takes 24-48 hours.</p>
                  </div>
                )}
              </div>
            )}

            {/* RESIDENT PORTAL */}
            {userStatus === 'resident' && !loadingTenant && (
              <div className="space-y-6">
                {/* Resident Navigation Tabs */}
                <div className="flex border-b border-slate-200 mb-6 overflow-x-auto hide-scrollbar">
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
                        flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                        ${activeTab === tab.id 
                          ? 'border-indigo-600 text-indigo-600' 
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                      `}
                    >
                      <tab.icon className="w-4 h-4 mr-2" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB CONTENT */}

                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Rent Status Alert */}
                    {daysUntilDue <= 3 && (
                        <div className={`
                          p-4 rounded-lg border-l-4 flex justify-between items-center
                          ${daysUntilDue < 0 ? 'bg-rose-50 border-rose-500 text-rose-900' : 
                            daysUntilDue === 0 ? 'bg-orange-50 border-orange-500 text-orange-900' : 
                            'bg-amber-50 border-amber-500 text-amber-900'}
                        `}>
                          <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5" />
                            <div>
                              <p className="font-bold">
                                {daysUntilDue < 0 ? 'Rent is Overdue' : daysUntilDue === 0 ? 'Rent is Due Today' : 'Rent Due Soon'}
                              </p>
                              <p className="text-sm opacity-90">
                                 {daysUntilDue < 0 
                                   ? `Your payment was due ${Math.abs(daysUntilDue)} days ago. Late fees have been applied.` 
                                   : `Upcoming charge of $${residentBalance} due on Nov 1st.`}
                              </p>
                            </div>
                          </div>
                          <button onClick={() => { setActiveTab('payments'); setShowPaymentModal(true); }} className="px-4 py-2 bg-white/50 hover:bg-white/80 rounded-lg text-sm font-bold border border-transparent hover:border-black/10 transition-colors">
                            Pay Now
                          </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Balance Card */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-500">Current Balance</h3>
                            <Banknote className="text-emerald-500 w-5 h-5" />
                         </div>
                         <p className="text-3xl font-bold text-slate-800 mb-1">${residentBalance}.00</p>
                         <p className="text-xs text-slate-500 mb-4">Includes rent & utilities</p>
                         <button onClick={() => setShowPaymentModal(true)} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                            Make Payment
                         </button>
                      </div>
                      
                      {/* Lease Status Card */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-500">Lease Status</h3>
                            <FileSignature className="text-indigo-500 w-5 h-5" />
                         </div>
                         {leaseDocument ? (
                           <>
                             <div className="mb-3">
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold mb-2
                                  ${leaseDocument.status === 'Signed' ? 'bg-emerald-100 text-emerald-700' :
                                    leaseDocument.status === 'Sent' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-700'}`}>
                                  {leaseDocument.status || 'Draft'}
                                </span>
                             </div>
                             {leaseDocument.status === 'Signed' && leaseDocument.signedAt && (
                               <p className="text-xs text-slate-500 mb-2">
                                 Signed: {new Date(leaseDocument.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                               </p>
                             )}
                             {leaseDocument.status === 'Sent' && (
                               <p className="text-xs text-amber-600 mb-2">
                                 Waiting for your signature
                               </p>
                             )}
                             {leaseDocument.status === 'Draft' && (
                               <p className="text-xs text-slate-500 mb-2">
                                 Lease is being prepared
                               </p>
                             )}
                             <button 
                               onClick={() => setView('lease_signing')} 
                               className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm mt-2"
                             >
                               {leaseDocument.status === 'Signed' ? 'View Signed Lease' : 
                                leaseDocument.status === 'Sent' ? 'Sign Lease' : 
                                'View Lease'}
                             </button>
                           </>
                         ) : (
                           <>
                             <p className="text-sm text-slate-500 mb-4">No lease document available</p>
                             <p className="text-xs text-slate-400">Contact your property manager</p>
                           </>
                         )}
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center gap-3">
                          <h3 className="font-semibold text-slate-500 mb-2">Quick Actions</h3>
                         <button onClick={() => setActiveTab('maintenance')} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg font-medium border border-slate-200 flex items-center justify-center">
                            <PenTool className="w-4 h-4 mr-2 text-orange-500" /> Request Repair
                         </button>
                         <button onClick={() => setActiveTab('documents')} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg font-medium border border-slate-200 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 mr-2 text-blue-500" /> Message Manager
                         </button>
                      </div>

                       {/* Recent Activity Feed */}
                       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                         <h3 className="font-semibold text-slate-500 mb-4">Notifications</h3>
                         <div className="space-y-4">
                            {notifications.map(n => (
                               <div key={n.id} className="flex gap-3 items-start">
                                  <div className={`w-2 h-2 rounded-full mt-1.5 ${n.read ? 'bg-slate-300' : 'bg-indigo-500'}`}></div>
                                  <div>
                                     <p className="text-sm font-medium text-slate-800">{n.title}</p>
                                     <p className="text-xs text-slate-500 leading-snug">{n.message}</p>
                                     <span className="text-[10px] text-slate-400">{n.date}</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PAYMENTS TAB */}
                {activeTab === 'payments' && (
                  <div className="space-y-6 animate-fade-in">
                     {/* Sub-Tab Navigation */}
                     <div className="border-b border-slate-200">
                        <nav className="-mb-px flex space-x-8">
                           <button
                              onClick={() => {
                                 setPaymentSubTab('history');
                                 setSelectedPaymentMethod(null);
                              }}
                              className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                                ${paymentSubTab === 'history'
                                  ? 'border-indigo-500 text-indigo-600'
                                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                              `}
                           >
                              <History className="w-4 h-4 inline mr-2" />
                              Payment History
                           </button>
                           <button
                              onClick={() => {
                                 setPaymentSubTab('payment-options');
                                 setSelectedPaymentMethod(null);
                              }}
                              className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                                ${paymentSubTab === 'payment-options'
                                  ? 'border-indigo-500 text-indigo-600'
                                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                              `}
                           >
                              <CreditCard className="w-4 h-4 inline mr-2" />
                              Payment Options
                           </button>
                        </nav>
                     </div>

                     {/* Sub-Tab Content */}
                     {paymentSubTab === 'history' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           {/* Invoice List */}
                           <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                 <h3 className="font-bold text-slate-700 flex items-center"><History className="w-4 h-4 mr-2"/> Payment History</h3>
                              </div>
                              {loadingPayments ? (
                                 <div className="p-8 text-center">
                                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-600 mb-2" />
                                    <p className="text-slate-500 text-sm">Loading payments...</p>
                                 </div>
                              ) : payments.length === 0 ? (
                                 <div className="p-8 text-center text-slate-500 text-sm">
                                    <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                    <p>No payment history available.</p>
                                 </div>
                              ) : (
                                 <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                       <tr>
                                          <th className="px-6 py-3 font-medium">Date</th>
                                          <th className="px-6 py-3 font-medium">Type</th>
                                          <th className="px-6 py-3 font-medium">Amount</th>
                                          <th className="px-6 py-3 font-medium">Status</th>
                                          <th className="px-6 py-3 font-medium text-right">Receipt</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                       {payments.map((payment) => (
                                          <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                                             <td className="px-6 py-4 text-slate-600">{new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                             <td className="px-6 py-4 text-slate-800 font-medium">{payment.type}</td>
                                             <td className="px-6 py-4 text-slate-800 font-bold">${payment.amount.toFixed(2)}</td>
                                             <td className="px-6 py-4">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                  {payment.status}
                                                </span>
                                             </td>
                                             <td className="px-6 py-4 text-right">
                                                {payment.status === 'Paid' && (
                                                  <button onClick={() => downloadReceipt(payment.id)} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Download Receipt">
                                                     <Download className="w-4 h-4" />
                                                  </button>
                                                )}
                                             </td>
                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                              )}
                           </div>

                           <div className="space-y-6">
                              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-6 text-white shadow-lg">
                                 <p className="text-indigo-200 text-sm font-medium mb-1">Total Balance</p>
                                 <p className="text-4xl font-bold mb-6">${residentBalance}.00</p>
                                 <div className="space-y-3">
                                    <div className="flex justify-between text-sm border-b border-indigo-500/30 pb-2">
                                       <span>Rent (Nov)</span>
                                       <span>$1,800.00</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-b border-indigo-500/30 pb-2">
                                       <span>Utility: Water</span>
                                       <span>$50.00</span>
                                    </div>
                                 </div>
                                 <button onClick={() => setShowPaymentModal(true)} className="w-full mt-6 py-3 bg-white text-indigo-900 font-bold rounded-lg hover:bg-indigo-50 transition-colors">
                                    Pay Now
                                 </button>
                              </div>
                              <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-600">
                                 <p className="font-semibold text-slate-800 mb-2">Auto-Pay</p>
                                 <p className="mb-3">Set up automatic payments to avoid late fees.</p>
                                 <button className="text-indigo-600 font-medium hover:underline">Configure Auto-Pay &rarr;</button>
                              </div>
                           </div>
                        </div>
                     )}

                     {paymentSubTab === 'payment-options' && (
                        <div className="space-y-6">
                           {/* Header */}
                           <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                              <h3 className="text-xl font-bold text-slate-800 mb-2">How to Pay Your Rent</h3>
                              <p className="text-slate-600">Choose a payment method below to see detailed instructions.</p>
                           </div>

                           {/* Payment Method Categories */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Digital Payments Section */}
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                 <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                                    <Smartphone className="w-5 h-5 mr-2 text-indigo-600" />
                                    Digital Payments
                                 </h4>
                                 <div className="grid grid-cols-2 gap-3">
                                    <button
                                       onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'zelle' ? null : 'zelle')}
                                       className={`p-4 rounded-lg border-2 text-left transition-all ${
                                          selectedPaymentMethod === 'zelle'
                                             ? 'border-indigo-500 bg-indigo-50'
                                             : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                       }`}
                                    >
                                       <div className="font-semibold text-slate-800">Zelle</div>
                                       <div className="text-xs text-slate-500 mt-1">Bank transfer</div>
                                    </button>
                                    <button
                                       onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'cashapp' ? null : 'cashapp')}
                                       className={`p-4 rounded-lg border-2 text-left transition-all ${
                                          selectedPaymentMethod === 'cashapp'
                                             ? 'border-indigo-500 bg-indigo-50'
                                             : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                       }`}
                                    >
                                       <div className="font-semibold text-slate-800">CashApp</div>
                                       <div className="text-xs text-slate-500 mt-1">Mobile payment</div>
                                    </button>
                                    <button
                                       onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'venmo' ? null : 'venmo')}
                                       className={`p-4 rounded-lg border-2 text-left transition-all ${
                                          selectedPaymentMethod === 'venmo'
                                             ? 'border-indigo-500 bg-indigo-50'
                                             : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                       }`}
                                    >
                                       <div className="font-semibold text-slate-800">Venmo</div>
                                       <div className="text-xs text-slate-500 mt-1">Social payment</div>
                                    </button>
                                    <button
                                       onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'applepay' ? null : 'applepay')}
                                       className={`p-4 rounded-lg border-2 text-left transition-all ${
                                          selectedPaymentMethod === 'applepay'
                                             ? 'border-indigo-500 bg-indigo-50'
                                             : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                       }`}
                                    >
                                       <div className="font-semibold text-slate-800">Apple Pay</div>
                                       <div className="text-xs text-slate-500 mt-1">Apple device</div>
                                    </button>
                                    <button
                                       onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'ach' ? null : 'ach')}
                                       className={`p-4 rounded-lg border-2 text-left transition-all ${
                                          selectedPaymentMethod === 'ach'
                                             ? 'border-indigo-500 bg-indigo-50'
                                             : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                       }`}
                                    >
                                       <div className="font-semibold text-slate-800">ACH</div>
                                       <div className="text-xs text-slate-500 mt-1">Bank account</div>
                                    </button>
                                    <button
                                       onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'card' ? null : 'card')}
                                       className={`p-4 rounded-lg border-2 text-left transition-all ${
                                          selectedPaymentMethod === 'card'
                                             ? 'border-indigo-500 bg-indigo-50'
                                             : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                       }`}
                                    >
                                       <div className="font-semibold text-slate-800">Card</div>
                                       <div className="text-xs text-slate-500 mt-1">Credit/Debit</div>
                                    </button>
                                 </div>
                              </div>

                              {/* Cash Payment Section */}
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                 <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                                    <DollarSign className="w-5 h-5 mr-2 text-emerald-600" />
                                    Cash Payments
                                 </h4>
                                 <button
                                    onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === 'cash' ? null : 'cash')}
                                    className={`w-full p-6 rounded-lg border-2 text-left transition-all ${
                                       selectedPaymentMethod === 'cash'
                                          ? 'border-emerald-500 bg-emerald-50'
                                          : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                                    }`}
                                 >
                                    <div className="font-semibold text-slate-800 text-lg mb-1">Cash</div>
                                    <div className="text-sm text-slate-500">Physical cash payment instructions</div>
                                 </button>
                              </div>
                           </div>

                           {/* Payment Instructions */}
                           {selectedPaymentMethod && (
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                                 <div className="flex items-start justify-between mb-4">
                                    <h4 className="text-xl font-bold text-slate-800">
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
                                       className="text-slate-400 hover:text-slate-600"
                                    >
                                       <X className="w-5 h-5" />
                                    </button>
                                 </div>

                                 {renderPaymentInstructions(selectedPaymentMethod)}
                              </div>
                           )}
                        </div>
                     )}
                  </div>
                )}

                {/* 3. MAINTENANCE TAB */}
                {activeTab === 'maintenance' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center">
                       <h2 className="text-xl font-bold text-slate-800">Maintenance Requests</h2>
                       <button 
                         onClick={() => {
                           if (showMaintenanceForm) {
                             // Clear form when cancelling
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
                         className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                       >
                          {showMaintenanceForm ? <X className="w-4 h-4 mr-2"/> : <PenTool className="w-4 h-4 mr-2" />}
                          {showMaintenanceForm ? 'Cancel' : 'New Request'}
                       </button>
                     </div>

                     {showMaintenanceForm && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2 border-l-4 border-l-indigo-500">
                           <h3 className="font-bold text-slate-800 mb-4">Submit New Ticket</h3>
                           <div className="space-y-4 max-w-2xl">
                              <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">Describe the issue</label>
                                 <textarea 
                                    value={maintenanceDesc}
                                    onChange={(e) => setMaintenanceDesc(e.target.value)}
                                    rows={3} 
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                                    placeholder="e.g., Leaking faucet in master bath..."
                                 />
                                 <button 
                                    onClick={handleAnalyzeIssue}
                                    disabled={isAnalyzingMaintenance || !maintenanceDesc}
                                    className="mt-2 text-sm text-indigo-600 font-medium flex items-center hover:text-indigo-800"
                                 >
                                    {isAnalyzingMaintenance ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : "✨ Auto-detect urgency with AI"}
                                 </button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                    <select 
                                      value={maintenanceCategory}
                                      onChange={(e) => setMaintenanceCategory(e.target.value as any)}
                                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                                    >
                                       <option value="Plumbing">Plumbing</option>
                                       <option value="Electrical">Electrical</option>
                                       <option value="HVAC">HVAC</option>
                                       <option value="Appliance">Appliance</option>
                                       <option value="General">General</option>
                                    </select>
                                 </div>
                                 <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Urgency</label>
                                    <select 
                                      value={maintenanceUrgency}
                                      onChange={(e) => setMaintenanceUrgency(e.target.value as any)}
                                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                                    >
                                       <option value="Low">Low (Cosmetic)</option>
                                       <option value="Medium">Normal (Standard repair)</option>
                                       <option value="High">High (Affects daily life)</option>
                                       <option value="Emergency">Emergency (Safety/Water)</option>
                                    </select>
                                 </div>
                              </div>

                              <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Photos <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                                 </label>
                                 <div 
                                    onClick={handleImageUploadClick}
                                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors"
                                 >
                                    <ImageIcon className="w-6 h-6 mb-2" />
                                    <span className="text-sm">Click to upload images</span>
                                    <input 
                                       ref={fileInputRef}
                                       type="file" 
                                       className="hidden" 
                                       multiple 
                                       accept="image/*"
                                       onChange={handleImageChange}
                                    />
                                 </div>
                                 
                                 {/* Image Previews */}
                                 {maintenanceImagePreviews.length > 0 && (
                                    <div className="mt-3 grid grid-cols-3 gap-3">
                                       {maintenanceImagePreviews.map((preview, index) => (
                                          <div key={index} className="relative group">
                                             <img 
                                                src={preview} 
                                                alt={`Preview ${index + 1}`}
                                                className="w-full h-24 object-cover rounded-lg border border-slate-200"
                                             />
                                             <button
                                                onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleRemoveImage(index);
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                             >
                                                <X className="w-3 h-3" />
                                             </button>
                                             <p className="text-xs text-slate-500 mt-1 truncate">
                                                {maintenanceImages[index]?.name}
                                             </p>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                              </div>

                              {/* Error/Success Messages */}
                              {maintenanceError && (
                                 <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-sm">
                                    {maintenanceError}
                                 </div>
                              )}
                              {maintenanceSuccess && (
                                 <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-sm">
                                    {maintenanceSuccess}
                                 </div>
                              )}

                              <div className="pt-4">
                                 <button 
                                   onClick={handleMaintenanceSubmit} 
                                   disabled={isSubmittingMaintenance || !maintenanceDesc || !(currentTenant?.id || tenantId)}
                                   className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                   type="button"
                                 >
                                    {isSubmittingMaintenance ? (
                                       <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
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

                     <div className="space-y-4">
                        {myTickets.length === 0 && !showMaintenanceForm && (
                           <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
                              <p className="text-slate-500">No maintenance requests yet.</p>
                           </div>
                        )}
                        {myTickets.map((ticket) => (
                           <div key={ticket.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                              <div className="flex justify-between items-start mb-4">
                                 <div>
                                    <div className="flex items-center gap-2 mb-1">
                                       <span className="font-bold text-slate-800">{ticket.category}</span>
                                       <span className="text-slate-400 text-sm">• {ticket.createdAt}</span>
                                    </div>
                                    <p className="text-slate-600">{ticket.description}</p>
                                    {ticket.assignedTo && (
                                       <p className="text-xs text-slate-500 mt-1">
                                          Assigned to: <span className="font-medium">{ticket.assignedTo}</span>
                                       </p>
                                    )}
                                 </div>
                                 <div className="flex flex-col items-end">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold mb-2 
                                       ${ticket.status === MaintenanceStatus.OPEN ? 'bg-rose-100 text-rose-700' : 
                                         ticket.status === MaintenanceStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700' : 
                                         ticket.status === MaintenanceStatus.RESOLVED ? 'bg-emerald-100 text-emerald-700' :
                                         'bg-slate-100 text-slate-700'}`}>
                                       {ticket.status}
                                    </span>
                                 </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="relative pt-4 pb-2">
                                 <div className="flex mb-2 items-center justify-between text-xs font-medium text-slate-500">
                                    <span className={ticket.status !== MaintenanceStatus.OPEN ? 'text-indigo-600' : ''}>Received</span>
                                    <span className={ticket.status === MaintenanceStatus.IN_PROGRESS ? 'text-indigo-600' : ''}>In Progress</span>
                                    <span className={ticket.status === MaintenanceStatus.RESOLVED ? 'text-indigo-600' : ''}>Resolved</span>
                                 </div>
                                 <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                       className="h-full bg-indigo-500 transition-all duration-500" 
                                       style={{ 
                                         width: ticket.status === MaintenanceStatus.OPEN ? '10%' : 
                                                ticket.status === MaintenanceStatus.IN_PROGRESS ? '50%' : 
                                                ticket.status === MaintenanceStatus.RESOLVED || ticket.status === MaintenanceStatus.CLOSED ? '100%' : '10%'
                                       }}
                                    ></div>
                                 </div>
                              </div>

                              {/* Updates */}
                              {ticket.updates && ticket.updates.length > 0 && (
                                 <div className="mt-4 bg-slate-50 p-3 rounded-lg text-sm border border-slate-100">
                                    <p className="font-semibold text-slate-700 text-xs uppercase mb-2">Latest Update</p>
                                    {ticket.updates.map((u, idx) => (
                                       <div key={idx} className="flex gap-2 text-slate-600">
                                          <span className="text-slate-400">{u.date}:</span>
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

                {/* 4. DOCUMENTS TAB */}
                {activeTab === 'documents' && (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                      <div className="lg:col-span-2 space-y-6">
                         <h3 className="font-bold text-slate-700">Official Documents & Notices</h3>
                         {loadingDocuments ? (
                           <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                             <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-600 mb-2" />
                             <p className="text-slate-500 text-sm">Loading documents...</p>
                           </div>
                         ) : documents.length === 0 ? (
                           <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 text-sm">
                             <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                             <p>No documents available at this time.</p>
                           </div>
                         ) : (
                           <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                              {documents.map((doc) => {
                                const docDate = doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                                const docType = doc.type || 'Document';
                                const docName = doc.type === 'Lease Agreement' ? 
                                  (doc.status === 'Signed' ? 'Signed Lease Agreement' : 'Lease Agreement') : 
                                  doc.type || 'Document';
                                // Prefer signed PDF if available, otherwise use draft PDF
                                const pdfUrl = doc.signed_pdf_url || doc.pdf_url;
                                const isSigned = doc.status === 'Signed' && doc.signed_pdf_url;
                                
                                return (
                                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                     <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded ${isSigned ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                           <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                           <div className="flex items-center gap-2">
                                              <p className="font-medium text-slate-800">{docName}</p>
                                              {isSigned && (
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                                  Signed
                                                </span>
                                              )}
                                              {doc.status === 'Sent' && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                                  Pending Signature
                                                </span>
                                              )}
                                           </div>
                                           <p className="text-xs text-slate-500">
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
                                         className="text-slate-400 hover:text-indigo-600 transition-colors"
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

                         <h3 className="font-bold text-slate-700 pt-4">Notice Archive</h3>
                         <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center text-slate-500 text-sm">
                            <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p>You have no active compliance notices or lease violations.</p>
                         </div>
                      </div>

                      <div className="space-y-6">
                         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Mail className="w-4 h-4 mr-2"/> Contact Manager</h3>
                            <div className="space-y-3">
                               <textarea 
                                  className="w-full p-3 border border-slate-300 rounded-lg text-sm h-32 resize-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900" 
                                  placeholder="Type your message here..."
                               ></textarea>
                               <button className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 text-sm">
                                  Send Message
                               </button>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                               <p className="mb-1 font-semibold">Office Hours:</p>
                               <p>Mon-Fri: 9am - 6pm</p>
                               <p>Sat: 10am - 4pm</p>
                               <p className="mt-2 text-indigo-600">(512) 555-0199</p>
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
