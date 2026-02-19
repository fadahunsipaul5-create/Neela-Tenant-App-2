/**
 * Onboarding tour step definitions.
 * Each step targets an element via data-onboarding attribute.
 */

export type ResidentTab = 'overview' | 'payments' | 'maintenance' | 'documents';
export type PaymentSubTab = 'history' | 'payment-options';

export interface OnboardingStep {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  tab?: ResidentTab;
  paymentSubTab?: PaymentSubTab;
}

export const ONBOARDING_STORAGE_KEY = 'tenant_onboarding_completed';

export function getOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(completed: boolean): void {
  try {
    if (completed) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** Base steps for Overview tab. Rent alert step is conditional. */
export const ONBOARDING_STEPS_BASE: OnboardingStep[] = [
  {
    id: 'welcome',
    targetSelector: '[data-onboarding="welcome-header"]',
    title: 'Welcome to Your Portal',
    body: 'This is your tenant dashboard. Use this tour to learn how to manage payments, maintenance, and documents.',
    tab: 'overview',
  },
  {
    id: 'notifications-bell',
    targetSelector: '[data-onboarding="notifications-bell"]',
    title: 'Notifications',
    body: 'Tap here to jump to your notifications and see rent reminders, updates, and messages.',
    tab: 'overview',
  },
  {
    id: 'logout',
    targetSelector: '[data-onboarding="logout-button"]',
    title: 'Log Out',
    body: 'Use this button to safely sign out of your account.',
    tab: 'overview',
  },
  {
    id: 'overview-tab',
    targetSelector: '[data-onboarding="overview-tab"]',
    title: 'Overview Tab',
    body: "This is your main dashboard. You'll see your balance, lease status, and quick actions here.",
    tab: 'overview',
  },
  {
    id: 'rent-alert',
    targetSelector: '[data-onboarding="rent-alert"]',
    title: 'Rent Due Alert',
    body: 'When rent is due soon or overdue, an alert appears here with a quick "Pay Now" action.',
    tab: 'overview',
  },
  {
    id: 'current-balance',
    targetSelector: '[data-onboarding="current-balance"]',
    title: 'Current Balance',
    body: 'Your total balance (rent and utilities) is shown here. Use "Make Payment" to pay online.',
    tab: 'overview',
  },
  {
    id: 'lease-status',
    targetSelector: '[data-onboarding="lease-status"]',
    title: 'Lease Status',
    body: 'Your lease status (Draft, Sent, Signed) is here. Use the button to view or sign your lease.',
    tab: 'overview',
  },
  {
    id: 'quick-actions-request-repair',
    targetSelector: '[data-onboarding="quick-actions-request-repair"]',
    title: 'Request Repair',
    body: 'Use this to submit a repair or maintenance request.',
    tab: 'overview',
  },
  {
    id: 'quick-actions-message-manager',
    targetSelector: '[data-onboarding="quick-actions-message-manager"]',
    title: 'Message Manager',
    body: 'Opens the Documents tab where you can send a message to your property manager.',
    tab: 'overview',
  },
  {
    id: 'quick-actions-upload-proof',
    targetSelector: '[data-onboarding="quick-actions-upload-proof"]',
    title: 'Upload Proof of Payment',
    body: 'Use this after making a payment to upload a screenshot or receipt for verification.',
    tab: 'overview',
  },
  {
    id: 'notifications-section',
    targetSelector: '[data-onboarding="notifications-section"]',
    title: 'Notifications',
    body: 'All your updates and alerts appear here. Scroll to this section to stay informed.',
    tab: 'overview',
  },
  // Phase 3: Payments tab
  {
    id: 'payments-tab',
    targetSelector: '[data-onboarding="payments-tab"]',
    title: 'Payments Tab',
    body: 'Switch here to manage all payment-related tasks.',
    tab: 'payments',
  },
  {
    id: 'payment-history-subtab',
    targetSelector: '[data-onboarding="payment-history-subtab"]',
    title: 'Payment History',
    body: 'View past payments, dates, amounts, and statuses. Download receipts for paid items.',
    tab: 'payments',
    paymentSubTab: 'history',
  },
  {
    id: 'payment-options-subtab',
    targetSelector: '[data-onboarding="payment-options-subtab"]',
    title: 'Payment Options',
    body: 'See how to pay (Zelle, CashApp, Venmo, etc.) and upload proof after paying.',
    tab: 'payments',
    paymentSubTab: 'payment-options',
  },
  {
    id: 'total-balance-payments',
    targetSelector: '[data-onboarding="total-balance-payments"]',
    title: 'Total Balance & Pay Now',
    body: 'Your balance summary. Use "Pay Now" to open the payment modal or upload proof.',
    tab: 'payments',
    paymentSubTab: 'history',
  },
  {
    id: 'payment-history-table',
    targetSelector: '[data-onboarding="payment-history-table"]',
    title: 'Payment List',
    body: 'All your rent and utility payments. Paid items have a receipt download button.',
    tab: 'payments',
    paymentSubTab: 'history',
  },
  {
    id: 'digital-payments-section',
    targetSelector: '[data-onboarding="digital-payments-section"]',
    title: 'Digital Payments',
    body: 'Instructions for Zelle, CashApp, Venmo, Apple Pay, ACH, and card payments.',
    tab: 'payments',
    paymentSubTab: 'payment-options',
  },
  {
    id: 'cash-payments-section',
    targetSelector: '[data-onboarding="cash-payments-section"]',
    title: 'Cash Payments',
    body: 'Instructions for paying with cash at the office.',
    tab: 'payments',
    paymentSubTab: 'payment-options',
  },
  {
    id: 'upload-proof-section',
    targetSelector: '[data-onboarding="upload-proof-section"]',
    title: 'Upload Proof',
    body: 'After paying, attach a screenshot or receipt here. The manager will review and confirm.',
    tab: 'payments',
    paymentSubTab: 'payment-options',
  },
  // Phase 4: Maintenance tab
  {
    id: 'maintenance-tab',
    targetSelector: '[data-onboarding="maintenance-tab"]',
    title: 'Maintenance Tab',
    body: 'Switch here for repair and maintenance requests.',
    tab: 'maintenance',
  },
  {
    id: 'new-request-button',
    targetSelector: '[data-onboarding="new-request-button"]',
    title: 'New Request',
    body: 'Click to open the form for submitting a repair or maintenance ticket.',
    tab: 'maintenance',
  },
  {
    id: 'maintenance-form',
    targetSelector: '[data-onboarding="maintenance-form"]',
    title: 'Submit a Ticket',
    body: 'Describe the issue, pick a category and urgency, add photos, and submit. AI can suggest urgency.',
    tab: 'maintenance',
  },
  {
    id: 'my-tickets-list',
    targetSelector: '[data-onboarding="my-tickets-list"]',
    title: 'Your Tickets',
    body: 'See status of all your maintenance requests: Open, In Progress, or Resolved.',
    tab: 'maintenance',
  },
  // Phase 5: Documents tab
  {
    id: 'documents-tab',
    targetSelector: '[data-onboarding="documents-tab"]',
    title: 'Documents Tab',
    body: 'Switch here for leases, notices, and other documents.',
    tab: 'documents',
  },
  {
    id: 'official-documents-section',
    targetSelector: '[data-onboarding="official-documents-section"]',
    title: 'Official Documents',
    body: 'View and download your lease, notices, and other documents from the management.',
    tab: 'documents',
  },
  {
    id: 'document-list',
    targetSelector: '[data-onboarding="document-list"]',
    title: 'Document List',
    body: 'Each document shows type and date. Click to download or view the PDF.',
    tab: 'documents',
  },
  {
    id: 'notice-archive',
    targetSelector: '[data-onboarding="notice-archive"]',
    title: 'Notice Archive',
    body: 'Active compliance notices and lease violations appear here when applicable.',
    tab: 'documents',
  },
  {
    id: 'contact-manager-section',
    targetSelector: '[data-onboarding="contact-manager-section"]',
    title: 'Contact Manager',
    body: 'Send messages to your property manager. Office hours and phone number are listed here.',
    tab: 'documents',
  },
];

/** Returns steps with conditional rent-alert and maintenance-form. */
export function getOnboardingSteps(
  daysUntilDue: number,
  residentBalance: number,
  showMaintenanceForm?: boolean
): OnboardingStep[] {
  const showRentAlert = daysUntilDue <= 3 && residentBalance > 0;
  return ONBOARDING_STEPS_BASE.filter((s) => {
    if (s.id === 'rent-alert') return showRentAlert;
    if (s.id === 'maintenance-form') return showMaintenanceForm === true;
    return true;
  });
}

