
export enum TenantStatus {
  APPLICANT = 'Applicant',
  APPROVED = 'Approved',
  ACTIVE = 'Active',
  PAST = 'Past',
  EVICTION_PENDING = 'Eviction Pending',
  DECLINED = 'Declined'
}

export interface ApplicationData {
  submissionDate: string;
  
  // Property Preferences
  propertyAddress?: string;
  bedroomsDesired?: number[];
  bathroomsDesired?: number[];
  
  // Personal Information
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  currentAddress?: string;
  
  // Occupants
  otherOccupants?: string;
  hasOtherAdults?: boolean;
  
  // Employment/Income
  currentEmployer?: string;
  monthlyIncome?: number;
  
  // Rental History
  hasRentedRecently?: boolean;
  previousLandlordInfo?: string;
  hasEvictionOrFelony?: boolean;
  evictionFelonyExplanation?: string;
  
  // Policies & Agreement
  agreesToPolicy?: boolean;
  desiredMoveInDate?: string;
  emergencyContact?: string;
  additionalNotes?: string;
  certificationAgreed?: boolean;
  
  // Legacy fields
  employment?: {
    employer: string;
    jobTitle: string;
    monthlyIncome: number;
    duration: string;
  };
  references?: {
    name: string;
    relation: string;
    phone: string;
  }[];
  documents?: {
    name: string;
    url: string;
    type: 'ID' | 'Income' | 'Other';
  }[];
  internalNotes?: string;
  backgroundCheckId?: string;
  ssnLast4?: string;
  dob?: string;
  jobTitle?: string;
  employer?: string;
  income?: string;
  consentBackgroundCheck?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: TenantStatus;
  propertyUnit: string;
  leaseStart: string;
  leaseEnd: string;
  rentAmount: number;
  deposit: number;
  balance: number;
  creditScore?: number; // Simulated TransUnion score
  backgroundCheckStatus?: 'Pending' | 'Clear' | 'Flagged';
  applicationData?: ApplicationData;
  leaseStatus?: 'Draft' | 'Sent' | 'Signed';
  signedLeaseUrl?: string;
  photoIdFiles?: any[];
  incomeVerificationFiles?: any[];
  backgroundCheckFiles?: any[];
}

export interface Payment {
  id: string;
  tenantId: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Failed';
  type: 'Rent' | 'Late Fee' | 'Deposit' | 'Application Fee';
  method: 'Stripe (ACH)' | 'Credit Card' | 'Cash' | 'Zelle' | 'Venmo' | 'CashApp' | 'Apple Pay' | 'Check';
  reference?: string;
  proofOfPaymentFiles?: { filename: string; path: string; size?: number }[];
}

export interface Invoice {
  id: string;
  tenantId: string;
  date: string;
  dueDate: string;
  amount: number;
  period: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  items?: { description: string; amount: number }[];
}

export interface PortalNotification {
  id: string;
  type: 'Rent' | 'Maintenance' | 'System' | 'Message';
  title: string;
  message: string;
  date: string;
  read: boolean;
  actionUrl?: string;
}

export enum MaintenanceStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  RESOLVED = 'Resolved',
  CLOSED = 'Closed'
}

export interface MaintenanceRequest {
  id: string;
  tenantId: string;
  category: 'Plumbing' | 'Electrical' | 'HVAC' | 'Appliance' | 'General';
  description: string;
  status: MaintenanceStatus;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  createdAt: string;
  images?: string[];
  updates?: { date: string; message: string; author: string }[];
  assignedTo?: string;
  completionAttachments?: { name: string; url: string }[];
}

export enum LegalNoticeType {
  NOTICE_TO_VACATE_3_DAY = '3-Day Notice to Vacate',
  LEASE_TERMINATION_30_DAY = '30-Day Lease Termination',
  EVICTION_FILING = 'Eviction Filing Packet',
  LATE_RENT_NOTICE = 'Notice of Late Rent',
  LEASE_VIOLATION = 'Lease Violation Notice'
}

export interface LegalDocument {
  id: string;
  tenantId: string;
  type: LegalNoticeType | 'Lease Agreement';
  generatedContent: string;
  createdAt: string;
  status: 'Draft' | 'Sent' | 'Delivered' | 'Filed' | 'Signed';
  deliveryMethod?: 'Email' | 'Certified Mail' | 'Hand Delivered' | 'Portal' | 'DocuSign';
  trackingNumber?: string;
  pdfUrl?: string;
  docusignEnvelopeId?: string;
  docusignSigningUrl?: string;
  signedPdfUrl?: string;
  signedAt?: string;
}

export interface LeaseTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeTemplate {
  id: string;
  name: string;
  type: LegalNoticeType;
  content: string;
  lastUpdated: string;
}

export interface Listing {
  id: string;
  title: string;
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  image: string;
  description: string;
  amenities: string[];
  furnishingType?: string;
  furnishingsBreakdown?: string[];
}

export interface Property {
  id: string;
  name: string;
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  city: string;
  state: string;
  units: number;
  price?: number;
  image?: string;
  furnishingType?: string;
  furnishingsBreakdown?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplicationForm {
  // Property Preferences
  propertyAddress: string;
  bedroomsDesired: number[];
  bathroomsDesired: number[];
  
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  currentAddress: string;
  
  // Occupants
  otherOccupants: string;
  hasOtherAdults: boolean | null;
  photoIdFiles: File[];
  
  // Employment/Income
  currentEmployer: string;
  monthlyIncome: string;
  incomeVerificationFiles: File[];
  
  // Rental History
  hasRentedRecently: boolean | null;
  previousLandlordInfo: string;
  hasEvictionOrFelony: boolean | null;
  evictionFelonyExplanation: string;
  
  // Policies & Agreement
  agreesToPolicy: boolean;
  desiredMoveInDate: string;
  emergencyContact: string;
  additionalNotes: string;
  certificationAgreed: boolean;
  backgroundCheckFile: File | null;
  
  // Legacy fields (for backward compatibility)
  dob?: string;
  employer?: string;
  jobTitle?: string;
  income?: string;
  ssnLast4?: string;
  references?: { name: string; relation: string; phone: string }[];
  consentBackgroundCheck?: boolean;
}
