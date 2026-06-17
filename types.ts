
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
  deliveryMethod?: 'Email' | 'Certified Mail' | 'Hand Delivered' | 'Portal' | 'In-House';
  trackingNumber?: string;
  pdfUrl?: string;
  signedPdfUrl?: string;
  signedAt?: string;
}

export type LeaseFieldType = 'checkbox' | 'text' | 'signature';

export interface LeaseSigningField {
  id: string;
  type: LeaseFieldType;
  label: string;
  page: number;
  /**
   * Normalized coordinates (0-1) relative to the page.
   * These make the overlay fully responsive across devices.
   */
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
}

export interface LeaseSigningMetadata {
  id: string;
  tenantId: string;
  type: string;
  status: string;
  pdfUrl: string;
  fields: LeaseSigningField[];
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
  status?: 'vacant' | 'occupied' | 'coming_soon';
  furnishingType?: string;
  furnishingsBreakdown?: string[];
}

export type PropertyStatus = 'vacant' | 'occupied' | 'coming_soon';

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
  status?: PropertyStatus;
  furnishingType?: string;
  furnishingsBreakdown?: string[];
  area?: string;
  shortStayEnabled?: boolean;
  shortStayNightlyRate?: number;
  shortStayMaxGuests?: number;
  effectiveNightlyRate?: number;
  effectiveMaxGuests?: number;
  effectiveCleaningFee?: number;
  effectiveCheckInTime?: string;
  effectiveCheckOutTime?: string;
  shortStayCheckInTime?: string;
  shortStayCheckOutTime?: string;
  shortStayCleaningFee?: number;
  shortStayListingTitle?: string;
  shortStayListingDescription?: string;
  shortStayListingArea?: string;
  shortStayListingLocation?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OperatingExpense {
  id: string;
  property?: string | null;
  propertyName?: string;
  unit?: string | null;
  unitLabel?: string;
  amount: number;
  category: 'utilities' | 'maintenance' | 'taxes' | 'insurance' | 'management' | 'cleaning' | 'hoa' | 'advertising' | 'legal' | 'supplies' | 'transportation' | 'bank_charges' | 'mortgage_interest' | 'mortgage_principal' | 'depreciation' | 'other';
  visibility?: 'operating' | 'admin_only';
  date: string;
  notes?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface PropertyFinancials {
  purchasePrice: number;
  downPayment: number;
  closingCost: number;
  loanAmount: number;
  interestRate: number;
  loanTermYears?: number | null;
  monthlyMortgagePayment: number;
  landValue: number;
  annualDepreciationYears: number;
  escrowNotes?: string;
}

export interface IncomeStatementUnitRow {
  unitId: string;
  propertyId: string;
  label: string;
  monthlyRent: number;
  status: string;
  rentIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export interface IncomeStatementRow {
  propertyId: string;
  propertyName: string;
  address?: string;
  city?: string;
  state?: string;
  unitsCount?: number;
  imageUrl?: string | null;
  rentIncome: number;
  shortStayIncome: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  units?: IncomeStatementUnitRow[];
  financials?: PropertyFinancials | null;
}

export interface IncomeStatementSummary {
  year: number;
  isAdminView?: boolean;
  portfolio: {
    rentIncome: number;
    shortStayIncome: number;
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
  };
  byProperty: IncomeStatementRow[];
  byUnit?: IncomeStatementUnitRow[];
  expensesByCategory: Record<string, number>;
  monthly: { month: number; income: number; expenses: number; net: number }[];
}

export interface PropertyUnit {
  id: string;
  property: string;
  propertyName?: string;
  label: string;
  monthlyRent: number;
  status: 'occupied' | 'vacant' | 'coming_soon';
  sortOrder?: number;
}

export type ShortStayBookingStatus = 'pending_payment' | 'proof_submitted' | 'confirmed' | 'cancelled';

export interface ShortStayBooking {
  id: string;
  property: string;
  propertyName?: string;
  propertyAddress?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  nights: number;
  nightlyRate: number;
  discountPercent: number;
  cleaningFee?: number;
  totalAmount: number;
  paymentMethod: string;
  status: ShortStayBookingStatus;
  proofOfPaymentFiles?: { filename: string; path: string; size?: number; url?: string }[];
  guestIdFiles?: { filename: string; path: string; size?: number; url?: string }[];
  notes?: string;
  accessPin?: string;
  createdAt?: string;
}

export interface ShortStayBlockedDate {
  id: string;
  property: string;
  propertyName?: string;
  startDate: string;
  endDate: string;
  reason?: string;
  createdAt?: string;
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
  currentAddressStreet: string;
  currentAddressCity: string;
  currentAddressState: string;
  currentAddressZip: string;
  
  // Occupants
  otherOccupantsList: { name: string; age: string }[];
  hasOtherAdults: boolean | null;
  photoIdFiles: File[];
  
  // Employment/Income
  currentEmployer: string;
  monthlyIncome: string;
  incomeVerificationFiles: File[];
  
  // Rental History
  hasRentedRecently: boolean | null;
  previousAddress: string;
  landlordName: string;
  landlordContact: string;
  hasEvictionOrFelony: boolean | null;
  evictionFelonyExplanation: string;
  
  // Policies & Agreement
  agreesToPolicy: boolean;
  desiredMoveInDate: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
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
