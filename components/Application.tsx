import React, { useState, useEffect } from 'react';
import { ApplicationForm, Listing, Property, TenantStatus } from '../types';
import { api } from '../services/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Modal from './Modal';

export interface UseApplicationReturn {
  // Application state
  formData: ApplicationForm;
  setFormData: React.Dispatch<React.SetStateAction<ApplicationForm>>;
  selectedListing: Listing | null;
  setSelectedListing: (listing: Listing | null) => void;
  isSubmittingApplication: boolean;
  applicationError: string | null;
  applicationSuccess: string | null;
  draftSaveMessage: string | null;
  
  // Handlers
  handleApply: (listing: Listing, setView: (view: string) => void) => void;
  handleSubmitApplication: (setUserStatus: (status: 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident') => void, setView: (view: string) => void) => Promise<void>;
  handleSaveDraft: () => void;
  handleClearForm: () => void;
  
  // Utility
  propertyToListing: (property: Property) => Listing;
}

export const useApplication = (): UseApplicationReturn => {
  // Application Form State
  const [formData, setFormData] = useState<ApplicationForm>(() => {
    // Default form structure
    const defaultForm: ApplicationForm = {
      // Property Preferences
      propertyAddress: '',
      bedroomsDesired: [],
      bathroomsDesired: [],
      
      // Personal Information
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      currentAddress: '',
      
      // Occupants
      otherOccupants: '',
      hasOtherAdults: null,
      photoIdFiles: [],
      
      // Employment/Income
      currentEmployer: '',
      monthlyIncome: '',
      incomeVerificationFiles: [],
      
      // Rental History
      hasRentedRecently: null,
      previousLandlordInfo: '',
      hasEvictionOrFelony: null,
      evictionFelonyExplanation: '',
      
      // Policies & Agreement
      agreesToPolicy: false,
      desiredMoveInDate: '',
      emergencyContact: '',
      additionalNotes: '',
      certificationAgreed: false,
      backgroundCheckFile: null,
    };
    
    // Load draft from localStorage if available
    const savedDraft = localStorage.getItem('application_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        // Merge with defaults to ensure all fields exist
        return {
          ...defaultForm,
          ...parsed,
          // Ensure arrays are always arrays
          bedroomsDesired: Array.isArray(parsed.bedroomsDesired) ? parsed.bedroomsDesired : [],
          bathroomsDesired: Array.isArray(parsed.bathroomsDesired) ? parsed.bathroomsDesired : [],
          // Ensure File objects are not in localStorage (they can't be serialized)
          photoIdFiles: [],
          incomeVerificationFiles: [],
        };
      } catch (e) {
        console.error('Error parsing saved draft:', e);
      }
    }
    
    return defaultForm;
  });
  
  // Application Submission State
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [applicationSuccess, setApplicationSuccess] = useState<string | null>(null);
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

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
      beds: property.bedrooms || 2,
      baths: property.bathrooms || 2,
      sqft: property.square_footage || 1000,
      image: imageUrl,
      description: `Beautiful ${property.name} located in ${property.city}, ${property.state}. ${property.units} ${property.units === 1 ? 'unit' : 'units'} available.`,
      amenities: [] // Property model doesn't have amenities
    };
  };

  const handleApply = (listing: Listing, setView: (view: string) => void) => {
    setSelectedListing(listing);
    setView('application');
    // Reset form state when opening application
    setApplicationError(null);
    setApplicationSuccess(null);
    // Pre-fill property address
    setFormData(prev => ({
      ...prev,
      propertyAddress: listing.address || listing.title
    }));
  };

  const handleSubmitApplication = async (
    setUserStatus: (status: 'guest' | 'applicant_pending' | 'applicant_approved' | 'resident') => void,
    setView: (view: string) => void
  ) => {
    // Validation - Required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setApplicationError('Please fill in all required fields (First Name, Last Name, Email, Phone)');
      return;
    }
    
    if (!formData.dateOfBirth) {
      setApplicationError('Please provide your date of birth');
      return;
    }
    
    if (!formData.currentAddress) {
      setApplicationError('Please provide your current address');
      return;
    }
    
    if (!formData.monthlyIncome) {
      setApplicationError('Please provide your monthly income');
      return;
    }
    
    if (formData.hasOtherAdults === null) {
      setApplicationError('Please indicate if there are other adults (18+) living in the unit');
      return;
    }
    
    if (formData.hasRentedRecently === null) {
      setApplicationError('Please indicate if you have rented in the past 2 years');
      return;
    }
    
    if (formData.hasEvictionOrFelony === null) {
      setApplicationError('Please indicate if you have been evicted or convicted of a felony');
      return;
    }
    
    if (!formData.agreesToPolicy) {
      setApplicationError('You must agree to the no-smoking and no-pet policy');
      return;
    }
    
    if (!formData.desiredMoveInDate) {
      setApplicationError('Please provide your desired move-in date');
      return;
    }
    
    if (!formData.emergencyContact) {
      setApplicationError('Please provide emergency contact information');
      return;
    }
    
    if (!formData.certificationAgreed) {
      setApplicationError('You must certify that all information provided is true and complete');
      return;
    }
    
    if (!formData.backgroundCheckFile) {
      setApplicationError('Please upload your background check report from MySmartMove');
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
      const rentAmount = selectedListing?.price && selectedListing.price > 0 
        ? selectedListing.price 
        : 1000;
      
      const propertyUnit = selectedListing?.title || selectedListing?.address || 'Property Application';
      
      const tenantData = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        status: TenantStatus.APPLICANT,
        propertyUnit: propertyUnit,
        rentAmount: rentAmount,
        deposit: 500,
        balance: 0,
        applicationData: {
          submissionDate: new Date().toISOString(),
          
          // Property Preferences
          propertyAddress: formData.propertyAddress,
          bedroomsDesired: formData.bedroomsDesired,
          bathroomsDesired: formData.bathroomsDesired,
          
          // Personal Information
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          currentAddress: formData.currentAddress,
          
          // Occupants
          otherOccupants: formData.otherOccupants,
          hasOtherAdults: formData.hasOtherAdults,
          
          // Employment/Income
          currentEmployer: formData.currentEmployer,
          monthlyIncome: parseFloat(formData.monthlyIncome.replace(/[^0-9.]/g, '')) || 0,
          
          // Rental History
          hasRentedRecently: formData.hasRentedRecently,
          previousLandlordInfo: formData.previousLandlordInfo,
          hasEvictionOrFelony: formData.hasEvictionOrFelony,
          evictionFelonyExplanation: formData.evictionFelonyExplanation,
          
          // Policies & Agreement
          agreesToPolicy: formData.agreesToPolicy,
          desiredMoveInDate: formData.desiredMoveInDate,
          emergencyContact: formData.emergencyContact,
          additionalNotes: formData.additionalNotes,
          certificationAgreed: formData.certificationAgreed,
        },
        photoIdFiles: formData.photoIdFiles,
        incomeVerificationFiles: formData.incomeVerificationFiles,
        backgroundCheckFile: formData.backgroundCheckFile,
      };
      
      // Submit application with files (this will trigger admin email notification)
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

  const handleSaveDraft = () => {
    try {
      const draftData = { ...formData };
      // Remove File objects before saving to localStorage (they can't be serialized)
      draftData.photoIdFiles = [];
      draftData.incomeVerificationFiles = [];
      draftData.backgroundCheckFile = null;
      localStorage.setItem('application_draft', JSON.stringify(draftData));
      
      setDraftSaveMessage('Draft saved successfully!');
      setTimeout(() => setDraftSaveMessage(null), 3000);
    } catch (error) {
      setDraftSaveMessage('Failed to save draft');
      setTimeout(() => setDraftSaveMessage(null), 3000);
    }
  };

  const handleClearForm = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Form',
      message: 'Are you sure you want to clear all form fields? This action cannot be undone.',
      onConfirm: () => {
        // Reset to default form state
        setFormData({
        // Property Preferences
        propertyAddress: selectedListing?.address || selectedListing?.title || '',
        bedroomsDesired: [],
        bathroomsDesired: [],
        
        // Personal Information
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        currentAddress: '',
        
        // Occupants
        otherOccupants: '',
        hasOtherAdults: null,
        photoIdFiles: [],
        
        // Employment/Income
        currentEmployer: '',
        monthlyIncome: '',
        incomeVerificationFiles: [],
        
        // Rental History
        hasRentedRecently: null,
        previousLandlordInfo: '',
        hasEvictionOrFelony: null,
        evictionFelonyExplanation: '',
        
        // Policies & Agreement
        agreesToPolicy: false,
        desiredMoveInDate: '',
        emergencyContact: '',
        additionalNotes: '',
        certificationAgreed: false,
        backgroundCheckFile: null,
      });
      
      // Clear draft from localStorage
      localStorage.removeItem('application_draft');
      
      setDraftSaveMessage('Form cleared successfully');
      setTimeout(() => setDraftSaveMessage(null), 3000);
    }
  });
};

  // Auto-save effects - these will be set up by the component using the hook
  // The component needs to pass view state to know when to auto-save

  return {
    formData,
    setFormData,
    selectedListing,
    setSelectedListing,
    isSubmittingApplication,
    applicationError,
    applicationSuccess,
    draftSaveMessage,
    handleApply,
    handleSubmitApplication,
    handleSaveDraft,
    handleClearForm,
    propertyToListing,
    confirmModal,
    setConfirmModal,
  };
};

export interface ApplicationFormViewProps {
  formData: ApplicationForm;
  setFormData: React.Dispatch<React.SetStateAction<ApplicationForm>>;
  selectedListing: Listing | null;
  isSubmittingApplication: boolean;
  applicationError: string | null;
  applicationSuccess: string | null;
  draftSaveMessage: string | null;
  handleSubmitApplication: () => Promise<void>;
  handleSaveDraft: () => void;
  handleClearForm: () => void;
  setView: (view: string) => void;
  confirmModal: { isOpen: boolean; title: string; message: string; onConfirm: () => void };
  setConfirmModal: (state: { isOpen: boolean; title: string; message: string; onConfirm: () => void }) => void;
}

export const ApplicationFormView: React.FC<ApplicationFormViewProps> = ({
  formData,
  setFormData,
  selectedListing,
  isSubmittingApplication,
  applicationError,
  applicationSuccess,
  draftSaveMessage,
  handleSubmitApplication,
  handleSaveDraft,
  handleClearForm,
  setView,
}) => {
  // Save application draft to localStorage whenever formData changes
  useEffect(() => {
    localStorage.setItem('application_draft', JSON.stringify(formData));
  }, [formData]);

  // Auto-save form draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const draftData = { ...formData };
      // Remove File objects before saving to localStorage (they can't be serialized)
      draftData.photoIdFiles = [];
      draftData.incomeVerificationFiles = [];
      localStorage.setItem('application_draft', JSON.stringify(draftData));
      console.log('Application draft auto-saved');
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [formData]);

  return (
    <div className="max-w-3xl mx-auto w-full px-4 md:px-8 py-10">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl shadow-indigo-500/10 border-2 border-slate-200/60 overflow-hidden">
          <div className="p-8 border-b-2 border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex items-center gap-5">
             <button 
               onClick={() => setView('listings')} 
               className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
               aria-label="Go back to listings"
             >
               <ArrowLeft className="w-5 h-5"/>
             </button>
             <div className="flex-1">
               <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Application for {selectedListing?.title}</h2>
               <p className="text-sm text-slate-500 mt-1 font-medium">Complete all sections to submit your application</p>
             </div>
          </div>
          <div className="p-8 md:p-10">
             <div className="space-y-10">
                {/* Error/Success Messages */}
                {applicationError && (
                  <div className="bg-gradient-to-r from-red-50 via-red-100/50 to-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl text-sm font-semibold shadow-lg shadow-red-500/10 animate-shake">
                    {applicationError}
                  </div>
                )}
                {applicationSuccess && (
                  <div className="bg-gradient-to-r from-emerald-50 via-emerald-100/50 to-emerald-50 border-2 border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-500/10">
                    {applicationSuccess}
                  </div>
                )}
                {draftSaveMessage && (
                  <div className="bg-gradient-to-r from-blue-50 via-blue-100/50 to-blue-50 border-2 border-blue-200 text-blue-800 px-6 py-4 rounded-2xl text-sm font-semibold shadow-lg shadow-blue-500/10">
                    {draftSaveMessage}
                  </div>
                )}
                
                {/* 1. Property Preferences */}
                <div className="space-y-6 bg-slate-50/50 rounded-2xl p-7 border-2 border-slate-100">
                  <h3 className="font-bold text-slate-900 text-xl border-b-2 border-slate-200 pb-3 flex items-center gap-3">
                    <span className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">1</span>
                    Property Preferences
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      What is the address of the house/apartment you are interested in renting?
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-4 border-2 border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 shadow-sm hover:shadow-md" 
                      value={formData.propertyAddress}
                      onChange={(e) => setFormData({...formData, propertyAddress: e.target.value})}
                      placeholder="Property address"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      How many bedrooms do you desire? (Select all that apply)
                    </label>
                    <div className="flex gap-4">
                      {[1, 2, 3].map(num => (
                        <label key={num} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={(formData.bedroomsDesired || []).includes(num)}
                            onChange={(e) => {
                              const currentBedrooms = formData.bedroomsDesired || [];
                              if (e.target.checked) {
                                setFormData({...formData, bedroomsDesired: [...currentBedrooms, num]});
                              } else {
                                setFormData({...formData, bedroomsDesired: currentBedrooms.filter(n => n !== num)});
                              }
                            }}
                            className="w-5 h-5 text-indigo-600 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/30 transition-all duration-200"
                          />
                          <span className="text-slate-700 font-semibold group-hover:text-indigo-600 transition-colors">{num} Bedroom{num > 1 ? 's' : ''}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      How many bathrooms do you desire? (Select all that apply)
                    </label>
                    <div className="flex gap-4">
                      {[1, 2, 3].map(num => (
                        <label key={num} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={(formData.bathroomsDesired || []).includes(num)}
                            onChange={(e) => {
                              const currentBathrooms = formData.bathroomsDesired || [];
                              if (e.target.checked) {
                                setFormData({...formData, bathroomsDesired: [...currentBathrooms, num]});
                              } else {
                                setFormData({...formData, bathroomsDesired: currentBathrooms.filter(n => n !== num)});
                              }
                            }}
                            className="w-5 h-5 text-indigo-600 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/30 transition-all duration-200"
                          />
                          <span className="text-slate-700 font-semibold group-hover:text-indigo-600 transition-colors">{num} Bathroom{num > 1 ? 's' : ''}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* 2. Applicant Information */}
                <div className="space-y-6 bg-slate-50/50 rounded-2xl p-7 border-2 border-slate-100">
                  <h3 className="font-bold text-slate-900 text-xl border-b-2 border-slate-200 pb-3 flex items-center gap-3">
                    <span className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">2</span>
                    Applicant Information
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="email" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="tel" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="(555) 123-4567"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date of Birth <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Current Address (Street, City, State, Zip) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.currentAddress}
                      onChange={(e) => setFormData({...formData, currentAddress: e.target.value})}
                      placeholder="123 Main St, Austin, TX 78701"
                      required
                    />
                  </div>
                </div>
                
                {/* 3. Occupants */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800 text-lg border-b pb-2">Occupants</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Names of All Other Occupants (Include ages of minors) <span className="text-rose-500">*</span>
                    </label>
                    <textarea 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.otherOccupants}
                      onChange={(e) => setFormData({...formData, otherOccupants: e.target.value})}
                      placeholder="e.g., Jane Doe (age 5), John Doe (age 8)"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Are there any other adults (18+) who will live in the unit? <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="hasOtherAdults"
                          checked={formData.hasOtherAdults === true}
                          onChange={() => setFormData({...formData, hasOtherAdults: true})}
                          className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="hasOtherAdults"
                          checked={formData.hasOtherAdults === false}
                          onChange={() => setFormData({...formData, hasOtherAdults: false})}
                          className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">No</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Upload a valid government-issued photo ID (for yourself and all adult occupants) <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mb-2">Upload up to 5 files. Max 10 MB per file. Accepted: PDF, JPG, PNG</p>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setFormData({...formData, photoIdFiles: files});
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {formData.photoIdFiles.length > 0 && (
                      <div className="mt-2 text-sm text-slate-600">
                        {formData.photoIdFiles.length} file(s) selected
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 4. Employment/Income Verification */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800 text-lg border-b pb-2">Employment/Income Verification</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Current Employer
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.currentEmployer}
                      onChange={(e) => setFormData({...formData, currentEmployer: e.target.value})}
                      placeholder="Company name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Monthly Income (Pre-tax) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({...formData, monthlyIncome: e.target.value})}
                      placeholder="e.g., 5000"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Upload 2 Most Recent Pay Stubs or 2 Months of Bank Statements <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mb-2">Upload up to 5 files. Max 10 MB per file. Accepted: PDF, JPG, PNG</p>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setFormData({...formData, incomeVerificationFiles: files});
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {formData.incomeVerificationFiles.length > 0 && (
                      <div className="mt-2 text-sm text-slate-600">
                        {formData.incomeVerificationFiles.length} file(s) selected
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 5. Rental History */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800 text-lg border-b pb-2">Rental History</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Have you rented in the past 2 years? <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="hasRentedRecently"
                          checked={formData.hasRentedRecently === true}
                          onChange={() => setFormData({...formData, hasRentedRecently: true})}
                          className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="hasRentedRecently"
                          checked={formData.hasRentedRecently === false}
                          onChange={() => setFormData({...formData, hasRentedRecently: false})}
                          className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">No</span>
                      </label>
                    </div>
                  </div>
                  
                  {formData.hasRentedRecently && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        If yes, provide your previous address and landlord name/contact
                      </label>
                      <textarea 
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        value={formData.previousLandlordInfo}
                        onChange={(e) => setFormData({...formData, previousLandlordInfo: e.target.value})}
                        placeholder="Previous address and landlord contact"
                        rows={3}
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Have you ever been evicted or convicted of a felony? <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="hasEvictionOrFelony"
                          checked={formData.hasEvictionOrFelony === true}
                          onChange={() => setFormData({...formData, hasEvictionOrFelony: true})}
                          className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="hasEvictionOrFelony"
                          checked={formData.hasEvictionOrFelony === false}
                          onChange={() => setFormData({...formData, hasEvictionOrFelony: false})}
                          className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">No</span>
                      </label>
                    </div>
                  </div>
                  
                  {formData.hasEvictionOrFelony && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        If yes, please explain
                      </label>
                      <textarea 
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        value={formData.evictionFelonyExplanation}
                        onChange={(e) => setFormData({...formData, evictionFelonyExplanation: e.target.value})}
                        placeholder="Please provide details"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
                
                {/* 6. Policies & Agreement */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800 text-lg border-b pb-2">Policies & Agreement</h3>
                  
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.agreesToPolicy}
                        onChange={(e) => setFormData({...formData, agreesToPolicy: e.target.checked})}
                        className="w-4 h-4 mt-1 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">
                        Do you agree to a no-smoking and no-pet policy? <span className="text-rose-500">*</span>
                      </span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Desired Move-In Date <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.desiredMoveInDate}
                      onChange={(e) => setFormData({...formData, desiredMoveInDate: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Emergency Contact (Name, Relationship, Phone) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                      placeholder="e.g., Mary Smith, Sister, (555) 123-4567"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Additional Notes or Questions
                    </label>
                    <textarea 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.additionalNotes}
                      onChange={(e) => setFormData({...formData, additionalNotes: e.target.value})}
                      placeholder="Any additional information you'd like to share"
                      rows={4}
                    />
                  </div>
                                                
                  {/* Background Check Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <div>
                      <h5 className="font-semibold text-slate-800 mb-2">Background Check Required <span className="text-rose-500">*</span></h5>
                      <p className="text-sm text-slate-600 mb-3">
                        Please complete your background check through MySmartMove and upload the report below.
                      </p>
                      <a 
                        href="https://www.mysmartmove.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Complete Background Check on MySmartMove
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Upload Background Check Report <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-xs text-slate-500 mb-2">Accepted: PDF, JPG, PNG (Max 10 MB)</p>
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setFormData({...formData, backgroundCheckFile: file});
                        }}
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                      {formData.backgroundCheckFile && (
                        <div className="mt-2 text-sm text-green-600 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          File selected: {formData.backgroundCheckFile.name}
                        </div>
                      )}
                    </div>
                  </div>


                  {/* 8. Certification */}
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.certificationAgreed}
                        onChange={(e) => setFormData({...formData, certificationAgreed: e.target.checked})}
                        className="w-4 h-4 mt-1 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">
                        I certify that all information provided is true and complete. <span className="text-rose-500">*</span>
                      </span>
                    </label>
                  </div>
                </div>
                
                {/* Draft Save Message */}
                {draftSaveMessage && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {draftSaveMessage}
                  </div>
                )}
                
                {/* 7. Form Action Buttons */}
                <div className="space-y-3">
                  {/* Save Draft and Clear Form Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={handleSaveDraft}
                      className="py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save as Draft
                    </button>
                    
                    <button 
                      type="button"
                      onClick={handleClearForm}
                      className="py-2.5 bg-rose-50 text-rose-700 font-medium rounded-lg hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear Form
                    </button>
                  </div>
                  
                  {/* Submit Button */}
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
    </div>
  );
};


