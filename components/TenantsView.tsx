
import React, { useState, useEffect } from 'react';
import { Tenant, TenantStatus } from '../types';
import { api } from '../services/api';
import { 
  Search, UserPlus, MoreVertical, CheckCircle, AlertCircle, Clock, 
  FileText, X, Briefcase, Shield, MessageSquare, Download, ChevronRight, Loader2,
  Check, Sparkles, Send, PenTool, Printer, Edit, Trash2, Save, RefreshCw, Eye
} from 'lucide-react';
import Modal from './Modal';

interface TenantsProps {
  tenants: Tenant[];
  initialTab?: 'residents' | 'applicants';
  onTenantsChange?: () => void;
}

const TenantsView: React.FC<TenantsProps> = ({ tenants, initialTab = 'residents', onTenantsChange }) => {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [activeTab, setActiveTab] = useState<'residents' | 'applicants'>(initialTab);
  const [selectedApplicant, setSelectedApplicant] = useState<Tenant | null>(null);
  const [applicantModalTab, setApplicantModalTab] = useState<'overview' | 'screening' | 'notes' | 'lease'>('overview');
  
  // Application Review State
  const [simulatingCheck, setSimulatingCheck] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  
  // Lease Generation State
  const [leaseTemplates, setLeaseTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [generatedLease, setGeneratedLease] = useState('');
  const [generatedLeaseDoc, setGeneratedLeaseDoc] = useState<any>(null);
  const [isGeneratingLease, setIsGeneratingLease] = useState(false);
  const [leaseStatus, setLeaseStatus] = useState<'Draft' | 'Sent' | 'Signed'>('Draft');
  const [isSending, setIsSending] = useState(false);
  const [isEditingLease, setIsEditingLease] = useState(false);
  const [editedLeaseContent, setEditedLeaseContent] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Add/Edit Resident Modal State
  const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Tenant>>({
    name: '',
    email: '',
    phone: '',
    status: TenantStatus.ACTIVE,
    propertyUnit: '',
    leaseStart: '',
    leaseEnd: '',
    rentAmount: 0,
    deposit: 0,
    balance: 0,
    creditScore: undefined,
    backgroundCheckStatus: undefined,
  });

  // Document Preview Modal (Screening & ID)
  const [documentPreview, setDocumentPreview] = useState<{ url: string; filename: string; isImage: boolean } | null>(null);

  // Filter Lists
  const residents = tenants.filter(t => t.status !== TenantStatus.APPLICANT && t.status !== TenantStatus.DECLINED);
  const applicants = tenants.filter(t => t.status === TenantStatus.APPLICANT || t.status === TenantStatus.DECLINED);
  const declined = tenants.filter(t => t.status === TenantStatus.DECLINED);

  const getStatusColor = (status: TenantStatus) => {
    switch (status) {
      case TenantStatus.ACTIVE: return 'bg-emerald-100 text-emerald-700';
      case TenantStatus.EVICTION_PENDING: return 'bg-rose-100 text-rose-700';
      case TenantStatus.APPLICANT: return 'bg-blue-100 text-blue-700';
      case TenantStatus.APPROVED: return 'bg-purple-100 text-purple-700';
      case TenantStatus.DECLINED: return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getMediaUrl = (path: string) => `${import.meta.env.VITE_API_URL || 'https://neela-backend.onrender.com'}/media/${path}`;
  const isImageFile = (filename: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(filename || '');
  /** Get preview/download URL from file object (path, file, or url). */
  const getFilePreviewUrl = (file: any): string | null => {
    if (!file) return null;
    const path = file.path || file.file;
    if (path) return getMediaUrl(path);
    if (file.url) return file.url;
    return null;
  };

  const handleStatusChange = async (tenantId: string, newStatus: TenantStatus) => {
    setIsSaving(true);
    setProcessingAction(newStatus === TenantStatus.DECLINED ? 'decline' : 'update');
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await api.updateTenant(tenantId, { status: newStatus });
      setSuccessMessage(`Application ${String(newStatus) === 'Declined' ? 'declined' : 'status updated'} successfully.`);
      
      // Update local state if selected
      if (selectedApplicant && selectedApplicant.id === tenantId) {
        setSelectedApplicant({ ...selectedApplicant, status: newStatus });
      }
      
      // Refresh list
      if (onTenantsChange) onTenantsChange();
      
      // Close modal after brief delay if declined
      if (newStatus === TenantStatus.DECLINED || newStatus === TenantStatus.PAST) {
        setTimeout(() => setSelectedApplicant(null), 1500);
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update application status');
    } finally {
      setIsSaving(false);
      setProcessingAction(null);
    }
  };

  const handleApproveApplication = async () => {
    if (!selectedApplicant) return;
    
    setIsSaving(true);
    setProcessingAction('approve');
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await api.updateTenant(selectedApplicant.id, {
        status: TenantStatus.APPROVED
      });
      
      // Auto-generate lease
      try {
        const templates = await api.getLeaseTemplates();
        // Prefer "Standard Residential Lease" or first available
        const templateToUse = templates.find(t => t.name === 'Standard Residential Lease') || templates[0];
        
        if (templateToUse) {
           await api.generateLease(selectedApplicant.id, templateToUse.id);
           setSuccessMessage('Application approved! Lease generated and email notification sent.');
        } else {
           setSuccessMessage('Application approved! Email notification sent. Please generate a lease template.');
        }
      } catch (leaseError) {
        console.error('Failed to auto-generate lease:', leaseError);
        setSuccessMessage('Application approved, but lease auto-generation failed. Please generate manually.');
      }
      
      // Refresh tenant list
      if (onTenantsChange) {
        onTenantsChange();
      }
      
      // Update selected applicant status
      setSelectedApplicant({
        ...selectedApplicant,
        status: TenantStatus.APPROVED
      });
      
      // Transition to Lease Generation tab instead of closing
      setSuccessMessage('Application approved! You can now review and send the lease.');
      setApplicantModalTab('lease');
      
      // Fetch the generated lease immediately
      fetchLeaseDocument(selectedApplicant.id);

    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to approve application');
    } finally {
      setIsSaving(false);
      setProcessingAction(null);
    }
  };

  const handleFinalizeMoveIn = async () => {
    if (!selectedApplicant) return;
    
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await api.updateTenant(selectedApplicant.id, {
        status: TenantStatus.ACTIVE
      });
      
      setSuccessMessage('Move-in finalized! Applicant is now an active resident.');
      
      // Refresh tenant list
      if (onTenantsChange) {
        onTenantsChange();
      }
      
      // Update selected applicant status locally
      setSelectedApplicant({
        ...selectedApplicant,
        status: TenantStatus.ACTIVE
      });
      
      // Close modal after a short delay and switch tab
      setTimeout(() => {
        setSelectedApplicant(null);
        setSuccessMessage(null);
        setActiveTab('residents');
      }, 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to finalize move-in');
    } finally {
      setIsSaving(false);
    }
  };

  // Load lease templates when component mounts
  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      setTemplateError(null);
      try {
        const templates = await api.getLeaseTemplates();
        
        // Filter out "Notice" type templates from the Lease dropdown
        const leaseOnlyTemplates = templates.filter(t => 
            !t.name.includes('Notice') && 
            !t.name.includes('Termination')
        );
        
        setLeaseTemplates(leaseOnlyTemplates);
        if (leaseOnlyTemplates.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(String(leaseOnlyTemplates[0].id));
        }
      } catch (error) {
        console.error('Failed to load lease templates:', error);
        setTemplateError('Failed to load templates');
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, []);

  const handleCreateDefaultTemplate = async () => {
    setIsCreatingTemplate(true);
    setErrorMessage(null);
    try {
      const defaultTemplate = {
        name: 'Standard Residential Lease',
        content: `RESIDENTIAL LEASE AGREEMENT

This Lease Agreement ("Lease") is entered into on {{current_date}} between {{property_manager}} ("Landlord") and {{tenant_name}} ("Tenant").

1. PROPERTY
Landlord leases to Tenant the property located at {{property_unit}} (the "Property").

2. TERM
The lease term begins on {{lease_start_date}} and ends on {{lease_end_date}}.

3. RENT
Tenant agrees to pay Landlord monthly rent of {{rent_amount}} per month, due on the first day of each month.

4. SECURITY DEPOSIT
Tenant has paid a security deposit of {{deposit_amount}} which will be held by Landlord as security for the performance of Tenant's obligations under this Lease.

5. TENANT INFORMATION
Tenant Name: {{tenant_name}}
Email: {{tenant_email}}
Phone: {{tenant_phone}}
Employer: {{employer}}
Job Title: {{job_title}}
Monthly Income: {{monthly_income}}

6. OBLIGATIONS
Tenant agrees to:
- Pay rent on time
- Keep the Property clean and in good condition
- Not disturb other tenants
- Comply with all applicable laws and regulations

7. DEFAULT
If Tenant fails to pay rent or breaches any term of this Lease, Landlord may terminate this Lease.

8. SIGNATURES
By signing below, both parties agree to the terms of this Lease.

_________________________          _________________________
Landlord                            Tenant
{{current_date}}                    {{current_date}}`,
        is_active: true
      };

      const newTemplate = await api.createLeaseTemplate(defaultTemplate);
      setLeaseTemplates(prev => [...prev, newTemplate]);
      setSelectedTemplateId(String(newTemplate.id));
      setSuccessMessage('Default lease template created successfully!');
    } catch (error) {
      console.error('Failed to create default template:', error);
      setErrorMessage('Failed to create default lease template');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const fetchLeaseDocument = async (tenantId: string) => {
    try {
      const docs = await api.getLegalDocuments(tenantId);
      // Filter for lease agreements
      const leaseDocs = docs.filter((d: any) => d.type === 'Lease Agreement');
      
      if (leaseDocs.length > 0) {
        // Use the most recent one (assuming last in list or we could sort)
        const leaseDoc = leaseDocs[leaseDocs.length - 1];
        setGeneratedLeaseDoc(leaseDoc);
        setLeaseStatus(leaseDoc.status || 'Draft');
        
        // If we have content, set it for preview
        if (leaseDoc.generatedContent) {
          setGeneratedLease(leaseDoc.generatedContent);
        }
        
        // If it's Sent, auto-check status to see if it's been signed since we last looked
        if (leaseDoc.status === 'Sent') {
           // Don't await this, let it run in background
           handleCheckStatus(leaseDoc.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch lease documents:', error);
    }
  };

  const handleCheckStatus = async (docId?: string) => {
    const idToCheck = docId || generatedLeaseDoc?.id;
    if (!idToCheck) return;
    
    setIsCheckingStatus(true);
    try {
      const updatedDoc = await api.checkLeaseStatus(idToCheck);
      setGeneratedLeaseDoc(updatedDoc);
      
      const newStatus = updatedDoc.status || 'Sent';
      setLeaseStatus(newStatus);
      
      if (newStatus === 'Signed') {
         setSuccessMessage("Lease status updated: Signed! Document captured.");
         // Update tenant list locally to reflect status change
         if (onTenantsChange) onTenantsChange();
      }
    } catch (error) {
      console.error('Failed to check lease status:', error);
      // Don't show error message to user on auto-check, only on manual
      if (!docId) {
        setErrorMessage('Failed to check status with Dropbox Sign');
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const openApplicationReview = (applicant: Tenant) => {
    setSelectedApplicant(applicant);
    setInternalNotes(applicant.applicationData?.internalNotes || '');
    setApplicantModalTab('overview');
    
    // Reset local state
    setGeneratedLease('');
    setGeneratedLeaseDoc(null);
    setLeaseStatus(applicant.leaseStatus || 'Draft');
    
    // Fetch latest lease document info
    fetchLeaseDocument(applicant.id);
  };

  const runBackgroundCheck = () => {
    setSimulatingCheck(true);
    setTimeout(() => {
      setSimulatingCheck(false);
      if (selectedApplicant) {
        const updated = { ...selectedApplicant, backgroundCheckStatus: 'Clear' as const, creditScore: 715 };
        setSelectedApplicant(updated);
      }
    }, 2000);
  };

  const handleGenerateLease = async () => {
    if (!selectedApplicant) return;
    setIsGeneratingLease(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      // Generate lease via API - include custom content if editing
      const customContent = isEditingLease && editedLeaseContent ? editedLeaseContent : undefined;
      const leaseDoc = await api.generateLease(selectedApplicant.id, selectedTemplateId || undefined, customContent);
      setGeneratedLeaseDoc(leaseDoc);
      setGeneratedLease(leaseDoc.generated_content || '');
      setLeaseStatus(leaseDoc.status || 'Draft');
      setIsEditingLease(false);
      setEditedLeaseContent('');
      setSuccessMessage('Lease generated successfully!');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate lease');
    } finally {
      setIsGeneratingLease(false);
    }
  };

  const handleEditLeaseContent = () => {
    if (generatedLease) {
      setEditedLeaseContent(generatedLease);
      setIsEditingLease(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingLease(false);
    setEditedLeaseContent('');
  };

  const handleSendDocuSign = async () => {
    if (!generatedLeaseDoc?.id) {
      setErrorMessage('No lease document available. Please generate the lease first.');
      return;
    }
    
    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      // Check if this is "Wills Lease Packet"
      const isWillsPacket = leaseTemplates.find(t => String(t.id) === selectedTemplateId)?.name === 'Wills Lease Packet';
      
      const response = await api.sendLeaseDocuSign(generatedLeaseDoc.id, isWillsPacket);
      
      // If we got a sender view URL, open it in new tab
      if (response.sender_view_url) {
          window.open(response.sender_view_url, '_blank');
          setSuccessMessage('Dropbox Sign draft created! Please review and add checkboxes in the opened tab.');
      } else {
          setSuccessMessage('Lease sent via Dropbox Sign! The tenant will receive an email to sign.');
      }
      
      // Refresh doc status
      const updatedDoc = await api.getLegalDocuments(selectedApplicant!.id);
      const leaseDocs = updatedDoc.filter((d: any) => d.type === 'Lease Agreement');
      if (leaseDocs.length > 0) {
          setGeneratedLeaseDoc(leaseDocs[leaseDocs.length - 1]);
          setLeaseStatus(leaseDocs[leaseDocs.length - 1].status || 'Sent');
      }
      
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send lease via Dropbox Sign');
    } finally {
      setIsSending(false);
    }
  };

  const handleSimulateSignature = () => {
    // Demo utility to fast-forward the signing process
    setLeaseStatus('Signed');
  };

  // Add/Edit Resident Handlers
  const openAddResidentModal = () => {
    setEditingTenant(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: TenantStatus.ACTIVE,
      propertyUnit: '',
      leaseStart: '',
      leaseEnd: '',
      rentAmount: 0,
      deposit: 0,
      balance: 0,
      creditScore: undefined,
      backgroundCheckStatus: undefined,
    });
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResidentModalOpen(true);
  };

  const openEditResidentModal = (tenant: Tenant) => {
    const current = tenants.find(t => t.id === tenant.id) ?? tenant;
    setEditingTenant(current);
    setFormData({
      name: current.name,
      email: current.email,
      phone: current.phone,
      status: current.status,
      propertyUnit: current.propertyUnit,
      leaseStart: current.leaseStart,
      leaseEnd: current.leaseEnd,
      rentAmount: current.rentAmount,
      deposit: current.deposit,
      balance: current.balance,
      creditScore: current.creditScore,
      backgroundCheckStatus: current.backgroundCheckStatus,
      applicationData: current.applicationData,
      leaseStatus: current.leaseStatus,
      signedLeaseUrl: current.signedLeaseUrl,
    });
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResidentModalOpen(true);
  };

  const handleSaveResident = async () => {
    // Validation
    if (!formData.name || !formData.email || !formData.phone || !formData.propertyUnit) {
      setErrorMessage('Please fill in all required fields (Name, Email, Phone, Property Unit)');
      return;
    }
    if (formData.rentAmount === undefined || formData.rentAmount < 0) {
      setErrorMessage('Rent amount must be a valid number');
      return;
    }
    if (formData.deposit === undefined || formData.deposit < 0) {
      setErrorMessage('Deposit must be a valid number');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (editingTenant) {
        // Update existing tenant
        console.log('Updating tenant:', editingTenant.id, 'with data:', formData);
        const updatedTenant = await api.updateTenant(editingTenant.id, formData);
        console.log('Tenant updated, new balance:', updatedTenant.balance);
        setSuccessMessage('Resident updated successfully!');
      } else {
        // Create new tenant
        console.log('Creating new tenant with data:', formData);
        await api.createTenant(formData);
        setSuccessMessage('Resident added successfully!');
      }
      
      // Refresh tenant list and wait for it to complete
      if (onTenantsChange) {
        console.log('Refreshing tenant list...');
        await onTenantsChange();
        console.log('Tenant list refreshed');
      }
      
      // Close modal after a short delay
      setTimeout(() => {
        setIsResidentModalOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save resident');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteResident = async (tenant: Tenant) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Tenant',
      message: `Are you sure you want to delete ${tenant.name}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.deleteTenant(tenant.id);
          setTenants(tenants.filter(t => t.id !== tenant.id));
          if (onTenantsChange) {
            onTenantsChange();
          }
          setSuccessMessage(`${tenant.name} deleted successfully`);
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to delete resident');
          setTimeout(() => setErrorMessage(null), 5000);
        }
      },
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-full sm:w-auto">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800">
            {activeTab === 'residents' ? 'Current Residents' : 'Application Management'}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            {activeTab === 'residents' 
              ? 'Manage leases, balances, and tenant profiles.' 
              : 'Review, screen, and approve incoming applications.'}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
           <div className="flex bg-white p-0.5 sm:p-1 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto">
             <button 
                onClick={() => setActiveTab('residents')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${activeTab === 'residents' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}
             >
                Residents
             </button>
             <button 
                onClick={() => setActiveTab('applicants')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${activeTab === 'applicants' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}
             >
                <span className="hidden sm:inline">Applications </span>({applicants.length})
             </button>
           </div>
           {activeTab === 'residents' && (
             <button
               onClick={openAddResidentModal}
               className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
             >
               <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
               <span className="hidden sm:inline">Add Resident</span>
               <span className="sm:hidden">Add</span>
             </button>
           )}
        </div>
      </div>

      {/* APPLICATION REVIEW MODAL */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-slate-50">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg sm:text-xl flex-shrink-0">
                   {selectedApplicant.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 truncate">{selectedApplicant.name}</h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-500">
                     <span className="truncate">{selectedApplicant.email}</span>
                     <span className="hidden sm:inline">•</span>
                     <span className="truncate">Applying for: {selectedApplicant.propertyUnit}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                 <div className={`px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${getStatusColor(selectedApplicant.status)}`}>
                    {selectedApplicant.status}
                 </div>
                 <button onClick={() => setSelectedApplicant(null)} className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors" aria-label="Close modal">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                 </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-full sm:w-48 lg:w-64 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 p-3 sm:p-4 flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto">
                 {[
                   { id: 'overview', label: 'Application Details', shortLabel: 'Details', icon: FileText },
                   { id: 'screening', label: 'Screening & ID', shortLabel: 'Screening', icon: Shield },
                   { id: 'notes', label: 'Internal Notes', shortLabel: 'Notes', icon: MessageSquare },
                   { id: 'lease', label: 'Lease Generation', shortLabel: 'Lease', icon: Sparkles },
                 ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setApplicantModalTab(tab.id as any)}
                      className={`
                        flex items-center sm:w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 sm:flex-shrink
                        ${applicantModalTab === tab.id 
                          ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}
                      `}
                    >
                       <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-3 flex-shrink-0" />
                       <span className="hidden sm:inline">{tab.label}</span>
                       <span className="sm:hidden">{tab.shortLabel}</span>
                       {tab.id === 'lease' && leaseStatus === 'Signed' && (
                         <CheckCircle className="w-3 h-3 ml-auto text-emerald-500 flex-shrink-0" />
                       )}
                    </button>
                 ))}

                 {/* Action Buttons */}
                 <div className="mt-auto space-y-2 pt-4 sm:pt-6 border-t border-slate-200 hidden sm:block">
                    {leaseStatus === 'Signed' ? (
                       <button 
                         onClick={handleFinalizeMoveIn}
                         disabled={isSaving}
                         className="w-full py-2 sm:py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2 disabled:bg-emerald-400 disabled:cursor-not-allowed text-sm"
                       >
                         {isSaving ? (
                           <>
                             <Loader2 className="w-4 h-4 animate-spin" /> Finalizing...
                           </>
                         ) : (
                           <>
                             <UserPlus className="w-4 h-4" /> Finalize Move-In
                           </>
                         )}
                       </button>
                    ) : (
                      <>
                        <button 
                          onClick={handleApproveApplication}
                          disabled={isSaving}
                          className="w-full py-2 sm:py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed text-sm"
                        >
                          {isSaving && processingAction === 'approve' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Approving...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" /> Approve Application
                            </>
                          )}
                        </button>
                        <button 
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Decline Application',
                              message: 'Are you sure you want to decline this application?',
                              onConfirm: () => {
                                handleStatusChange(selectedApplicant.id, TenantStatus.DECLINED);
                              },
                            });
                          }}
                          disabled={isSaving}
                          className="w-full py-2 sm:py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           {isSaving && processingAction === 'decline' ? (
                             <>
                               <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Declining...
                             </>
                           ) : 'Decline'}
                        </button>
                      </>
                    )}
                 </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                 {/* Success/Error Messages */}
                 {successMessage && (
                   <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">
                     {successMessage}
                   </div>
                 )}
                 {errorMessage && (
                   <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-sm">
                     {errorMessage}
                   </div>
                 )}
                 {applicantModalTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
                       {/* Basic Information Section - Always Show */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Basic Information</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Email</p>
                                   <p className="text-slate-800">{selectedApplicant.email}</p>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Phone</p>
                                   <p className="text-slate-800">{selectedApplicant.phone || 'N/A'}</p>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Property Unit</p>
                                   <p className="text-slate-800">{selectedApplicant.propertyUnit}</p>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Status</p>
                                   <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedApplicant.status)}`}>
                                      {selectedApplicant.status}
                                   </span>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Financial Summary - Show if applicationData exists */}
                       {selectedApplicant.applicationData?.monthlyIncome || selectedApplicant.applicationData?.employment?.monthlyIncome ? (
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex justify-between items-center">
                             <div>
                                <p className="text-xs font-bold text-indigo-600 uppercase">Monthly Income</p>
                                <p className="text-2xl font-bold text-indigo-900">
                                   ${(selectedApplicant.applicationData?.monthlyIncome || selectedApplicant.applicationData?.employment?.monthlyIncome || 0).toLocaleString()}
                                </p>
                             </div>
                             <div className="text-right">
                                <p className="text-xs font-bold text-indigo-600 uppercase">Rent-to-Income</p>
                                <p className="text-2xl font-bold text-indigo-900">
                                   {Math.round((selectedApplicant.rentAmount / (selectedApplicant.applicationData?.monthlyIncome || selectedApplicant.applicationData?.employment?.monthlyIncome || 1)) * 100)}%
                                </p>
                             </div>
                          </div>
                       ) : (
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                             <p className="text-sm text-slate-600">No financial information available</p>
                          </div>
                       )}

                       {/* Property Preferences */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Property Preferences</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Interested Property</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.propertyAddress || 'N/A'}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Bedrooms Desired</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.bedroomsDesired && selectedApplicant.applicationData.bedroomsDesired.length > 0 ? selectedApplicant.applicationData.bedroomsDesired.join(', ') : 'N/A'}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Bathrooms Desired</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.bathroomsDesired && selectedApplicant.applicationData.bathroomsDesired.length > 0 ? selectedApplicant.applicationData.bathroomsDesired.join(', ') : 'N/A'}</p>
                             </div>
                          </div>
                       </div>

                       {/* Personal Information */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Personal Information</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <p className="text-xs text-slate-500 font-medium">Date of Birth</p>
                                   <p className="text-slate-800">{selectedApplicant.applicationData?.dateOfBirth || selectedApplicant.applicationData?.dob || 'N/A'}</p>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 font-medium">Phone</p>
                                   <p className="text-slate-800">{selectedApplicant.phone}</p>
                                </div>
                             </div>
                             {selectedApplicant.applicationData?.currentAddress && (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium">Current Address</p>
                                   <p className="text-slate-800">{selectedApplicant.applicationData.currentAddress}</p>
                                </div>
                             )}
                          </div>
                       </div>

                       {/* Occupants */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Occupants</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Other Occupants</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.otherOccupants || 'N/A'}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Other Adults (18+)</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.hasOtherAdults !== undefined ? (selectedApplicant.applicationData.hasOtherAdults ? 'Yes' : 'No') : 'N/A'}</p>
                             </div>
                          </div>
                       </div>

                       {/* Employment Section */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Employment</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                             <p className="text-slate-800 font-medium">{selectedApplicant.applicationData?.currentEmployer || selectedApplicant.applicationData?.employment?.employer || 'N/A'}</p>
                             {selectedApplicant.applicationData?.employment?.jobTitle && (
                                <p className="text-slate-600">{selectedApplicant.applicationData.employment.jobTitle}</p>
                             )}
                             <p className="text-sm text-slate-500">Employed for: {selectedApplicant.applicationData?.employment?.duration || 'N/A'}</p>
                          </div>
                       </div>

                       {/* Rental History */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Rental History</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Rented in Past 2 Years</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.hasRentedRecently !== undefined ? (selectedApplicant.applicationData.hasRentedRecently ? 'Yes' : 'No') : 'N/A'}</p>
                             </div>
                             {selectedApplicant.applicationData?.previousLandlordInfo && (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium">Previous Landlord</p>
                                   <p className="text-slate-800">{selectedApplicant.applicationData.previousLandlordInfo}</p>
                                </div>
                             )}
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Eviction/Felony History</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.hasEvictionOrFelony !== undefined ? (selectedApplicant.applicationData.hasEvictionOrFelony ? 'Yes' : 'No') : 'N/A'}</p>
                             </div>
                             {selectedApplicant.applicationData?.evictionFelonyExplanation && (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium">Explanation</p>
                                   <p className="text-slate-800">{selectedApplicant.applicationData.evictionFelonyExplanation}</p>
                                </div>
                             )}
                          </div>
                       </div>

                       {/* Policies & Preferences */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Additional Information</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Agrees to No-Smoking/No-Pet Policy</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.agreesToPolicy !== undefined ? (selectedApplicant.applicationData.agreesToPolicy ? 'Yes' : 'No') : 'N/A'}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Desired Move-In Date</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.desiredMoveInDate || 'N/A'}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500 font-medium">Emergency Contact</p>
                                <p className="text-slate-800">{selectedApplicant.applicationData?.emergencyContact || 'N/A'}</p>
                             </div>
                             {selectedApplicant.applicationData?.additionalNotes && (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium">Additional Notes</p>
                                   <p className="text-slate-800">{selectedApplicant.applicationData.additionalNotes}</p>
                                </div>
                             )}
                          </div>
                       </div>

                       {/* Documents Section */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Uploaded Documents</h4>
                          <div className="space-y-3">
                             {/* Photo ID Files */}
                             {selectedApplicant.photoIdFiles && selectedApplicant.photoIdFiles.length > 0 ? (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-2">Photo IDs</p>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {selectedApplicant.photoIdFiles.map((file: any, idx: number) => (
                                         <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                                            <div className="flex items-center gap-3">
                                               <div className="p-2 bg-slate-100 rounded text-slate-500">
                                                  <FileText className="w-4 h-4" />
                                               </div>
                                               <div>
                                                  <p className="text-sm font-medium text-slate-800">{file.filename || 'Photo ID'}</p>
                                                  <p className="text-xs text-slate-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</p>
                                               </div>
                                            </div>
                                            {file.path && (
                                               <a href={`${import.meta.env.VITE_API_URL || 'https://neela-backend.onrender.com'}/media/${file.path}`} target="_blank" rel="noopener noreferrer">
                                                  <Download className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                                               </a>
                                            )}
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ) : null}
                             
                             {/* Income Verification Files */}
                             {selectedApplicant.incomeVerificationFiles && selectedApplicant.incomeVerificationFiles.length > 0 ? (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-2">Income Verification</p>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {selectedApplicant.incomeVerificationFiles.map((file: any, idx: number) => (
                                         <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                                            <div className="flex items-center gap-3">
                                               <div className="p-2 bg-slate-100 rounded text-slate-500">
                                                  <FileText className="w-4 h-4" />
                                               </div>
                                               <div>
                                                  <p className="text-sm font-medium text-slate-800">{file.filename || 'Income Document'}</p>
                                                  <p className="text-xs text-slate-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</p>
                                               </div>
                                            </div>
                                            {file.path && (
                                               <a href={`${import.meta.env.VITE_API_URL || 'https://neela-backend.onrender.com'}/media/${file.path}`} target="_blank" rel="noopener noreferrer">
                                                  <Download className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                                               </a>
                                            )}
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ) : null}
                             
                             {/* Background Check Files */}
                             {selectedApplicant.backgroundCheckFiles && selectedApplicant.backgroundCheckFiles.length > 0 ? (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-2">Background Check Report</p>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {selectedApplicant.backgroundCheckFiles.map((file: any, idx: number) => (
                                         <div key={idx} className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100">
                                            <div className="flex items-center gap-3">
                                               <div className="p-2 bg-green-200 rounded text-green-700">
                                                  <FileText className="w-4 h-4" />
                                               </div>
                                               <div>
                                                  <p className="text-sm font-medium text-slate-800">{file.filename || 'Background Check'}</p>
                                                  <p className="text-xs text-slate-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</p>
                                               </div>
                                            </div>
                                            {file.path && (
                                               <a href={`${import.meta.env.VITE_API_URL || 'https://neela-backend.onrender.com'}/media/${file.path}`} target="_blank" rel="noopener noreferrer">
                                                  <Download className="w-4 h-4 text-green-600 hover:text-green-800" />
                                               </a>
                                            )}
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ) : null}
                             
                             {/* Legacy Documents */}
                             {selectedApplicant.applicationData?.documents && selectedApplicant.applicationData.documents.length > 0 ? (
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-2">Other Documents</p>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {selectedApplicant.applicationData.documents.map((doc: any, idx: number) => (
                                         <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <div className="flex items-center gap-3">
                                               <div className="p-2 bg-slate-100 rounded text-slate-500">
                                                  <FileText className="w-4 h-4" />
                                               </div>
                                               <div>
                                                  <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                                                  <p className="text-xs text-slate-500">{doc.type}</p>
                                               </div>
                                            </div>
                                            <Download className="w-4 h-4 text-slate-400" />
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ) : null}
                             
                             {!selectedApplicant.photoIdFiles?.length && !selectedApplicant.incomeVerificationFiles?.length && !selectedApplicant.backgroundCheckFiles?.length && !selectedApplicant.applicationData?.documents?.length && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                   <p className="text-sm text-slate-600">No documents uploaded</p>
                                </div>
                             )}
                          </div>
                       </div>

                       {/* Additional Information */}
                       <div>
                          <h4 className="font-bold text-slate-800 mb-3">Lease Information</h4>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Lease Start</p>
                                   <p className="text-slate-800">{selectedApplicant.leaseStart || 'Not set'}</p>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Lease End</p>
                                   <p className="text-slate-800">{selectedApplicant.leaseEnd || 'Not set'}</p>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Rent Amount</p>
                                   <p className="text-slate-800">${selectedApplicant.rentAmount?.toLocaleString() || '0'}/month</p>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 font-medium mb-1">Deposit</p>
                                   <p className="text-slate-800">${selectedApplicant.deposit?.toLocaleString() || '0'}</p>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 )}

                 {applicantModalTab === 'screening' && (
                    <div className="space-y-8 animate-fade-in">
                       <h3 className="font-bold text-slate-800 text-lg">Screening & ID Documents</h3>
                       
                       {/* Uploaded ID Documents */}
                       <div className="space-y-4">
                          <h4 className="font-semibold text-slate-700 text-base">Uploaded Documents</h4>
                          
                          {/* Government-Issued Photo IDs */}
                          <div>
                             <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Government-Issued Photo ID
                             </h4>
                             {selectedApplicant.photoIdFiles && selectedApplicant.photoIdFiles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                   {selectedApplicant.photoIdFiles.map((file: any, idx: number) => {
                                      const fileUrl = getFilePreviewUrl(file);
                                      return (
                                      <div key={idx} className="flex items-center justify-between gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50/80 bg-white shadow-sm">
                                         <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="p-2.5 bg-indigo-100 rounded-lg text-indigo-600 shrink-0">
                                               <FileText className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                               <p className="text-sm font-medium text-slate-800 truncate">{file.filename || 'Photo ID'}</p>
                                               <p className="text-xs text-slate-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</p>
                                            </div>
                                         </div>
                                         <div className="flex items-center gap-2 shrink-0">
                                            {fileUrl ? (
                                               <>
                                                 <button
                                                   type="button"
                                                   onClick={() => setDocumentPreview({
                                                     url: fileUrl,
                                                     filename: file.filename || 'Photo ID',
                                                     isImage: isImageFile(file.filename)
                                                   })}
                                                   className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                                   title="Preview document"
                                                 >
                                                   <Eye className="w-4 h-4" /> Preview
                                                 </button>
                                                 <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors" title="Download">
                                                   <Download className="w-4 h-4" /> Download
                                                 </a>
                                               </>
                                            ) : (
                                               <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">Preview unavailable</span>
                                            )}
                                         </div>
                                      </div>
                                   ); })}
                                </div>
                             ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                   <p className="text-sm text-slate-600">No photo IDs uploaded</p>
                                </div>
                             )}
                          </div>
                          
                          {/* Income Verification Documents */}
                          <div>
                             <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Pay Stubs / Bank Statements
                             </h4>
                             {selectedApplicant.incomeVerificationFiles && selectedApplicant.incomeVerificationFiles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                   {selectedApplicant.incomeVerificationFiles.map((file: any, idx: number) => {
                                      const fileUrl = getFilePreviewUrl(file);
                                      return (
                                      <div key={idx} className="flex items-center justify-between gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50/80 bg-white shadow-sm">
                                         <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="p-2.5 bg-green-100 rounded-lg text-green-600 shrink-0">
                                               <FileText className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                               <p className="text-sm font-medium text-slate-800 truncate">{file.filename || 'Income Document'}</p>
                                               <p className="text-xs text-slate-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</p>
                                            </div>
                                         </div>
                                         <div className="flex items-center gap-2 shrink-0">
                                            {fileUrl ? (
                                               <>
                                                 <button
                                                   type="button"
                                                   onClick={() => setDocumentPreview({
                                                     url: fileUrl,
                                                     filename: file.filename || 'Income Document',
                                                     isImage: isImageFile(file.filename)
                                                   })}
                                                   className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                                   title="Preview document"
                                                 >
                                                   <Eye className="w-4 h-4" /> Preview
                                                 </button>
                                                 <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors" title="Download">
                                                   <Download className="w-4 h-4" /> Download
                                                 </a>
                                               </>
                                            ) : (
                                               <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">Preview unavailable</span>
                                            )}
                                         </div>
                                      </div>
                                   ); })}
                                </div>
                             ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                   <p className="text-sm text-slate-600">No income verification documents uploaded</p>
                                </div>
                             )}
                          </div>
                          
                          {/* Background Check Report */}
                          <div>
                             <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Background Check Report
                             </h4>
                             {selectedApplicant.backgroundCheckFiles && selectedApplicant.backgroundCheckFiles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                   {selectedApplicant.backgroundCheckFiles.map((file: any, idx: number) => {
                                      const fileUrl = getFilePreviewUrl(file);
                                      return (
                                      <div key={idx} className="flex items-center justify-between gap-3 p-4 border border-green-200 bg-green-50/50 rounded-xl hover:bg-green-50 shadow-sm">
                                         <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="p-2.5 bg-green-200 rounded-lg text-green-700 shrink-0">
                                               <Shield className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                               <p className="text-sm font-medium text-slate-800 truncate">{file.filename || 'Background Check'}</p>
                                               <p className="text-xs text-slate-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</p>
                                            </div>
                                         </div>
                                         <div className="flex items-center gap-2 shrink-0">
                                            {fileUrl ? (
                                               <>
                                                 <button
                                                   type="button"
                                                   onClick={() => setDocumentPreview({
                                                     url: fileUrl,
                                                     filename: file.filename || 'Background Check',
                                                     isImage: isImageFile(file.filename)
                                                   })}
                                                   className="flex items-center gap-1.5 px-3 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors shadow-sm"
                                                   title="Preview document"
                                                 >
                                                   <Eye className="w-4 h-4" /> Preview
                                                 </button>
                                                 <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 border border-green-300 text-green-800 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors" title="Download">
                                                   <Download className="w-4 h-4" /> Download
                                                 </a>
                                               </>
                                            ) : (
                                               <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">Preview unavailable</span>
                                            )}
                                         </div>
                                      </div>
                                   ); })}
                                </div>
                             ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                   <p className="text-sm text-slate-600">No background check report uploaded</p>
                                </div>
                             )}
                          </div>
                       </div>
                    </div>
                 )}

                 {applicantModalTab === 'notes' && (
                    <div className="h-full flex flex-col animate-fade-in">
                       <h3 className="font-bold text-slate-800 mb-4">Internal Notes</h3>
                       <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 mb-4 flex items-start gap-3">
                          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-800">These notes are only visible to property managers and staff. Applicants cannot see this.</p>
                       </div>
                       <textarea
                          className="flex-1 p-4 border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                          placeholder="Add notes about interactions, showing feedback, or exceptions..."
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                       ></textarea>
                       <div className="mt-4 flex justify-end">
                          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Save Notes</button>
                       </div>
                    </div>
                 )}

                 {applicantModalTab === 'lease' && (
                    <div className="animate-fade-in h-full flex flex-col">
                       <div className="flex items-center justify-between mb-6">
                          <h3 className="font-bold text-slate-800">Lease Generation & Signing</h3>
                          <div className="flex items-center gap-2 flex-wrap">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold border
                                ${leaseStatus === 'Draft' ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                                  leaseStatus === 'Sent' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                  'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                {leaseStatus.toUpperCase()}
                             </span>
                             {generatedLeaseDoc?.signedAt && (
                               <span className="text-xs text-slate-500">
                                 Signed {new Date(generatedLeaseDoc.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                               </span>
                             )}
                             {(generatedLeaseDoc?.dropboxSignSignatureRequestId || generatedLeaseDoc?.docusignEnvelopeId) && (
                               <span className="text-xs text-slate-500">
                                 Dropbox Sign: {(generatedLeaseDoc.dropboxSignSignatureRequestId || generatedLeaseDoc.docusignEnvelopeId).substring(0, 8)}...
                               </span>
                             )}
                          </div>
                       </div>

                       {/* Control Bar */}
                       {!generatedLease ? (
                          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
                             <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                   <label className="block text-sm font-medium text-slate-700 mb-1">Lease Template</label>
                                   <select 
                                     className="w-full p-2 border border-slate-300 rounded-lg"
                                     value={selectedTemplateId || ''}
                                     onChange={(e) => setSelectedTemplateId(e.target.value)}
                                     disabled={isLoadingTemplates || !!templateError}
                                   >
                                      {isLoadingTemplates ? (
                                        <option value="">Loading templates...</option>
                                      ) : templateError ? (
                                        <option value="">Error loading templates</option>
                                      ) : leaseTemplates.length === 0 ? (
                                        <option value="">No templates available</option>
                                      ) : (
                                        leaseTemplates.map(template => (
                                          <option key={template.id} value={template.id}>
                                            {template.name}
                                          </option>
                                        ))
                                      )}
                                   </select>
                                   {leaseTemplates.length === 0 && !isLoadingTemplates && !templateError && (
                                      <button 
                                        onClick={handleCreateDefaultTemplate}
                                        disabled={isCreatingTemplate}
                                        className="mt-2 text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
                                      >
                                        {isCreatingTemplate ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                                        Create Default Template
                                      </button>
                                   )}
                                </div>
                                <div>
                                   <label className="block text-sm font-medium text-slate-700 mb-1">Lease Term</label>
                                   <div className="flex items-center text-sm text-slate-600 p-2 bg-slate-50 rounded-lg border border-slate-200">
                                      {selectedApplicant.leaseStart} to {selectedApplicant.leaseEnd}
                                   </div>
                                </div>
                             </div>
                             <button 
                                onClick={handleGenerateLease}
                                disabled={isGeneratingLease || !selectedTemplateId}
                                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                             >
                                {isGeneratingLease ? <Loader2 className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
                                {isGeneratingLease ? 'Generating Lease PDF...' : 'Generate Lease PDF'}
                             </button>
                          </div>
                       ) : (
                          <div className="flex items-center gap-2 mb-4">
                             {leaseStatus === 'Draft' && (
                               <>
                                 <button 
                                    onClick={() => setGeneratedLease('')} 
                                    className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                                 >
                                    Back to Config
                                 </button>
                                 {!isEditingLease && generatedLeaseDoc?.pdfUrl && (
                                   <button 
                                      onClick={handleEditLeaseContent}
                                      className="px-3 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 flex items-center gap-2"
                                   >
                                      <Edit className="w-4 h-4" /> Edit Content
                                   </button>
                                 )}
                                 {isEditingLease && (
                                   <>
                                     <button 
                                        onClick={handleCancelEdit}
                                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                                     >
                                        Cancel
                                     </button>
                                     <button 
                                        onClick={handleGenerateLease}
                                        disabled={isGeneratingLease}
                                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"
                                     >
                                        {isGeneratingLease ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4"/>}
                                        {isGeneratingLease ? 'Regenerating...' : 'Save & Regenerate PDF'}
                                     </button>
                                   </>
                                 )}
                               </>
                             )}
                             <div className="flex-1"></div>
                             {leaseStatus === 'Draft' && !isEditingLease && (
                               <button 
                                  onClick={handleSendDocuSign}
                                  disabled={isSending}
                                  className={`px-4 py-2 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg ${
                                      leaseTemplates.find(t => String(t.id) === selectedTemplateId)?.name === 'Wills Lease Packet'
                                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                  }`}
                               >
                                  {isSending ? <Loader2 className="animate-spin w-4 h-4"/> : (
                                      leaseTemplates.find(t => String(t.id) === selectedTemplateId)?.name === 'Wills Lease Packet' 
                                      ? <PenTool className="w-4 h-4"/> 
                                      : <Send className="w-4 h-4"/>
                                  )}
                                  {isSending ? 'Processing...' : (
                                      leaseTemplates.find(t => String(t.id) === selectedTemplateId)?.name === 'Wills Lease Packet'
                                      ? 'Review & Tag in Dropbox Sign'
                                      : 'Send via Dropbox Sign'
                                  )}
                               </button>
                             )}
                             {leaseStatus === 'Sent' && (
                                <button 
                                  onClick={handleSimulateSignature}
                                  className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-sm font-bold hover:bg-amber-200 flex items-center gap-2"
                                >
                                   <Clock className="w-4 h-4" /> Simulate Tenant Signature
                                </button>
                             )}
                             {leaseStatus === 'Draft' && generatedLeaseDoc?.pdfUrl && !isEditingLease && (
                                <a 
                                  href={generatedLeaseDoc.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2"
                                >
                                   <Download className="w-4 h-4" /> Download PDF
                                </a>
                             )}
                             {leaseStatus === 'Signed' && generatedLeaseDoc?.signedPdfUrl && (
                                <a 
                                  href={generatedLeaseDoc.signedPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-200"
                                >
                                   <Download className="w-4 h-4" /> Download Executed PDF
                                </a>
                             )}
                          </div>
                       )}

                       {/* Lease Status Messages */}
                       {leaseStatus === 'Sent' && (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                <div>
                                   <p className="text-sm font-bold text-blue-800">Waiting for Signature</p>
                                   <p className="text-xs text-blue-600">Envelope sent to {selectedApplicant.email}</p>
                                </div>
                             </div>
                             <div className="flex gap-3">
                               <button 
                                 onClick={() => handleCheckStatus()}
                                 disabled={isCheckingStatus}
                                 className="text-xs text-blue-700 font-bold hover:text-blue-900 flex items-center gap-1 bg-blue-100 px-2 py-1 rounded"
                               >
                                 <RefreshCw className={`w-3 h-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                                 {isCheckingStatus ? 'Checking...' : 'Refresh Status'}
                               </button>
                               <button className="text-xs text-blue-600 underline hover:text-blue-800">Resend Link</button>
                             </div>
                          </div>
                       )}
                       {leaseStatus === 'Signed' && (
                          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                             <CheckCircle className="w-5 h-5 text-emerald-600" />
                             <div>
                                <p className="text-sm font-bold text-emerald-800">Lease Signed & Executed!</p>
                                <p className="text-xs text-emerald-600">Document stored in Tenant Profile.</p>
                             </div>
                          </div>
                       )}

                       {/* Editor / Preview */}
                       {generatedLease && (
                          <div className="flex-1 relative border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
                             <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                  {generatedLeaseDoc?.pdfUrl ? 'PDF Preview' : 'Document Editor'}
                                </span>
                                <div className="flex gap-2">
                                   {generatedLeaseDoc?.pdfUrl && (
                                     <a 
                                       href={generatedLeaseDoc.pdfUrl}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="p-1.5 hover:bg-slate-200 rounded text-slate-500"
                                       title="Download PDF"
                                     >
                                       <Download className="w-4 h-4"/>
                                     </a>
                                   )}
                                   <button className="p-1.5 hover:bg-slate-200 rounded text-slate-500"><Printer className="w-4 h-4"/></button>
                                </div>
                             </div>
                             {isEditingLease ? (
                               <textarea 
                                 value={editedLeaseContent}
                                 onChange={(e) => setEditedLeaseContent(e.target.value)}
                                 className="flex-1 p-8 font-serif text-sm text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full border-2 border-indigo-200"
                                 placeholder="Edit lease content here..."
                               />
                             ) : generatedLeaseDoc?.pdfUrl ? (
                               <iframe 
                                 src={generatedLeaseDoc.pdfUrl}
                                 className="flex-1 w-full"
                                 title="Lease PDF Preview"
                               />
                             ) : (
                               <textarea 
                                 value={generatedLease}
                                 onChange={(e) => setGeneratedLease(e.target.value)}
                                 readOnly={leaseStatus !== 'Draft'}
                                 className="flex-1 p-8 font-serif text-sm text-slate-800 leading-relaxed resize-none focus:outline-none w-full"
                               />
                             )}
                          </div>
                       )}
                       
                       {!generatedLease && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                             <FileText className="w-16 h-16 text-slate-200 mb-4" />
                             <p className="text-slate-400">Select a template and click Generate to draft the lease.</p>
                          </div>
                       )}
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT RESIDENT MODAL */}
      {isResidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingTenant ? 'Edit Resident' : 'Add New Resident'}
              </h3>
              <button 
                onClick={() => setIsResidentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Success/Error Messages */}
              {successMessage && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                  {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">
                  {errorMessage}
                </div>
              )}

              {/* Form */}
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="Full Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        autoComplete="off"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Phone <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        autoComplete="off"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status || TenantStatus.ACTIVE}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as TenantStatus })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      >
                        <option value={TenantStatus.ACTIVE}>Active</option>
                        <option value={TenantStatus.APPLICANT}>Applicant</option>
                        <option value={TenantStatus.APPROVED}>Approved</option>
                        <option value={TenantStatus.PAST}>Past</option>
                        <option value={TenantStatus.EVICTION_PENDING}>Eviction Pending</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Property Information */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-4">Property Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Property Unit <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.propertyUnit || ''}
                        onChange={(e) => setFormData({ ...formData, propertyUnit: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="Unit 101"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Credit Score
                      </label>
                      <input
                        type="number"
                        value={formData.creditScore || ''}
                        onChange={(e) => setFormData({ ...formData, creditScore: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="700"
                        min="300"
                        max="850"
                      />
                    </div>
                  </div>
                </div>

                {/* Lease Information */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-4">Lease Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Lease Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.leaseStart || ''}
                        onChange={(e) => setFormData({ ...formData, leaseStart: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Lease End Date
                      </label>
                      <input
                        type="date"
                        value={formData.leaseEnd || ''}
                        onChange={(e) => setFormData({ ...formData, leaseEnd: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-4">Financial Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Rent Amount <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.rentAmount || ''}
                          onChange={(e) => setFormData({ ...formData, rentAmount: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          placeholder="0.00"
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Deposit <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.deposit || ''}
                          onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          placeholder="0.00"
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {editingTenant ? 'Current balance (from payments)' : 'Current Balance (Preview)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input
                          type="text"
                          value={editingTenant
                            ? (formData.balance ?? 0).toFixed(2)
                            : ((formData.rentAmount || 0) - (formData.deposit || 0)).toFixed(2)}
                          disabled
                          className={`w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 cursor-not-allowed ${
                            (editingTenant ? (formData.balance ?? 0) : ((formData.rentAmount || 0) - (formData.deposit || 0))) < 0
                              ? 'text-green-600 font-medium'
                              : (editingTenant ? (formData.balance ?? 0) : ((formData.rentAmount || 0) - (formData.deposit || 0))) > 0
                              ? 'text-rose-600 font-medium'
                              : 'text-slate-600'
                          }`}
                          title={editingTenant ? 'Calculated from rent, deposit, and payments' : 'Automatically calculated from rent amount and deposit'}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {editingTenant
                          ? 'Calculated from rent, deposit, and payments. Recalculated after save.'
                          : 'Initial balance (Rent - Deposit). Will be recalculated when payments are recorded.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsResidentModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResident}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingTenant ? 'Update Resident' : 'Add Resident'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TABLE CONTENT */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 bg-slate-50">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder={activeTab === 'residents' ? "Search residents..." : "Search applicants..."}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 placeholder-slate-500 text-sm sm:text-base"
            />
          </div>
          {activeTab === 'residents' && (
             <button 
               onClick={openAddResidentModal}
               className="flex items-center justify-center px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base font-medium"
             >
               <UserPlus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Add Resident</span><span className="sm:hidden">Add</span>
             </button>
          )}
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-2 sm:px-0">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">{activeTab === 'residents' ? 'Tenant' : 'Applicant'}</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">Status</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden sm:table-cell">Unit</th>
                  {activeTab === 'residents' ? (
                     <>
                       <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell">Balance</th>
                       <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell">Lease End</th>
                     </>
                  ) : (
                     <>
                       <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell">Submitted</th>
                       <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell">Credit</th>
                       <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell">Income</th>
                     </>
                  )}
                  <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeTab === 'residents' ? residents : applicants).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-slate-800 truncate">{t.name}</span>
                        <span className="text-xs text-slate-500 truncate">{t.email}</span>
                        <span className="text-xs text-slate-500 sm:hidden mt-0.5">{t.propertyUnit}</span>
                        {activeTab === 'residents' && (
                          <>
                            <span className="text-xs text-slate-500 md:hidden mt-0.5">Balance: ${t.balance.toLocaleString()}</span>
                            <span className="text-xs text-slate-500 lg:hidden mt-0.5">Lease End: {t.leaseEnd}</span>
                          </>
                        )}
                        {activeTab === 'applicants' && (
                          <>
                            <span className="text-xs text-slate-500 md:hidden mt-0.5">Submitted: {t.applicationData?.submissionDate || 'N/A'}</span>
                            <span className="text-xs text-slate-500 lg:hidden mt-0.5">
                              {t.backgroundCheckStatus === 'Clear' ? (
                                <span className="text-emerald-600 font-bold">Credit: {t.creditScore}</span>
                              ) : (
                                <span className="text-slate-400">Credit: Pending</span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                      <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-slate-600 hidden sm:table-cell">{t.propertyUnit}</td>
                    
                    {activeTab === 'residents' ? (
                      <>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell">
                          <span className={`font-medium ${t.balance > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                            ${t.balance.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-slate-500 hidden lg:table-cell">{t.leaseEnd}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right">
                           <div className="flex items-center justify-end gap-1 sm:gap-2">
                             <button 
                               onClick={() => openEditResidentModal(t)}
                               className="p-1.5 sm:p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                               title="Edit"
                               aria-label="Edit resident"
                             >
                               <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             </button>
                             <button 
                               onClick={() => handleDeleteResident(t)}
                               className="p-1.5 sm:p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                               title="Delete"
                               aria-label="Delete resident"
                             >
                               <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             </button>
                           </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-slate-500 hidden md:table-cell">{t.applicationData?.submissionDate || 'N/A'}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell">
                           {t.backgroundCheckStatus === 'Clear' ? (
                              <span className="flex items-center text-emerald-600 text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1"/> {t.creditScore}</span>
                           ) : (
                              <span className="flex items-center text-slate-400 text-xs"><Clock className="w-3 h-3 mr-1"/> Pending</span>
                           )}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-slate-600 font-medium hidden lg:table-cell">
                           {t.applicationData?.employment?.monthlyIncome 
                             ? `$${t.applicationData.employment.monthlyIncome.toLocaleString()}/mo`
                             : 'N/A'}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right">
                           <button 
                             onClick={() => openApplicationReview(t)}
                             className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 text-xs font-bold transition-all whitespace-nowrap"
                           >
                              Review
                           </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {(activeTab === 'residents' ? residents : applicants).length === 0 && (
                   <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                         No {activeTab} found.
                      </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        type="confirm"
        onConfirm={confirmModal.onConfirm}
        confirmText="Confirm"
        cancelText="Cancel"
      />

      {/* Document Preview Modal (Screening & ID) */}
      {documentPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setDocumentPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200 shrink-0 bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Document preview</p>
                <h3 className="font-semibold text-slate-800 truncate pr-2">{documentPreview.filename}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={documentPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={() => setDocumentPreview(null)}
                  className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 min-h-[480px] flex items-center justify-center bg-slate-200">
              {documentPreview.isImage ? (
                <img
                  src={documentPreview.url}
                  alt={documentPreview.filename}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-md"
                />
              ) : (
                <iframe
                  src={documentPreview.url}
                  title={documentPreview.filename}
                  className="w-full min-h-[75vh] border-0 rounded-lg shadow-md bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantsView;

