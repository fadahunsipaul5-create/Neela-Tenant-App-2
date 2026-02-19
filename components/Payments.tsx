import React, { useState, useEffect } from 'react';
import { Payment, Tenant } from '../types';
import { api } from '../services/api';
import {
  ArrowLeft, X, CreditCard, Smartphone, DollarSign, Building2, Info, Download, History, Loader2, Upload
} from 'lucide-react';
import Modal from './Modal';

export type PaymentSubTab = 'history' | 'payment-options';
export type PaymentMethod = 'zelle' | 'cashapp' | 'venmo' | 'applepay' | 'ach' | 'card' | 'cash' | null;

export interface SubmitPaymentWithProofData {
  amount: number;
  method: string;
  type: string;
  reference?: string;
  date: string;
  proofFiles: File[];
}

export interface PaymentModalProps {
  showPaymentModal: boolean;
  setShowPaymentModal: (show: boolean) => void;
  manualPaymentMode: boolean;
  setManualPaymentMode: (mode: boolean) => void;
  residentBalance: number;
  daysUntilDue: number;
  tenantId?: string;
  renderPaymentInstructions: (method: string) => React.ReactNode;
  onSubmitPaymentWithProof?: (data: SubmitPaymentWithProofData) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  showPaymentModal,
  setShowPaymentModal,
  manualPaymentMode,
  setManualPaymentMode,
  residentBalance,
  daysUntilDue,
  tenantId,
  renderPaymentInstructions,
  onSubmitPaymentWithProof,
}) => {
  const [modalMethod, setModalMethod] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [manualPaymentType, setManualPaymentType] = useState('Personal Check');
  const [manualReference, setManualReference] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'info' | 'warning',
  });

  const resetForm = () => {
    setProofFiles([]);
    setManualReference('');
    setManualDate(new Date().toISOString().split('T')[0]);
    setSubmitError(null);
  };

  if (!showPaymentModal) return null;

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
               <div className="space-y-4">
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
                   <div className="pt-4 border-t border-slate-200">
                     <label className="block text-sm font-medium text-slate-700 mb-2">
                       <Upload className="w-4 h-4 inline mr-1.5" />
                       Attach proof of payment (screenshots/receipts)
                     </label>
                     <input
                       type="file"
                       accept=".pdf,.jpg,.jpeg,.png"
                       multiple
                       onChange={(e) => setProofFiles(Array.from(e.target.files || []))}
                       className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium hover:file:bg-indigo-100"
                     />
                     {proofFiles.length > 0 && <p className="mt-1 text-xs text-slate-500">{proofFiles.length} file(s) selected</p>}
                     <button
                       type="button"
                       disabled={!tenantId || !onSubmitPaymentWithProof || isSubmitting || residentBalance <= 0}
                       onClick={async () => {
                         if (!tenantId || !onSubmitPaymentWithProof || residentBalance <= 0) return;
                         setIsSubmitting(true);
                         setSubmitError(null);
                         try {
                           await onSubmitPaymentWithProof({
                             amount: residentBalance,
                             method: modalMethod,
                             type: 'Rent',
                             date: new Date().toISOString().split('T')[0],
                             proofFiles,
                           });
                           setAlertModal({ isOpen: true, title: 'Payment Submitted', message: 'Your proof of payment has been submitted. The property manager will review and confirm once verified.', type: 'success' });
                           setShowPaymentModal(false);
                           setManualPaymentMode(false);
                           setModalMethod(null);
                           resetForm();
                         } catch (e) {
                           setSubmitError(e instanceof Error ? e.message : 'Failed to submit');
                         } finally {
                           setIsSubmitting(false);
                         }
                       }}
                       className="w-full mt-3 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                       {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                       Submit proof of payment
                     </button>
                     {submitError && <p className="mt-2 text-sm text-rose-600">{submitError}</p>}
                   </div>
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
                  <select 
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    value={manualPaymentType}
                    onChange={(e) => setManualPaymentType(e.target.value)}
                  >
                    <option>Personal Check</option>
                    <option>Cashier's Check</option>
                    <option>Cash (Handed to Office)</option>
                    <option>Money Order</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check Number / Reference</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" 
                    placeholder="e.g. #1054" 
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date Handed Over</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" 
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Upload className="w-4 h-4 inline mr-1.5" />
                    Attach proof of payment (screenshots/receipts)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => setProofFiles(Array.from(e.target.files || []))}
                    className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium hover:file:bg-indigo-100"
                  />
                  {proofFiles.length > 0 && <p className="mt-1 text-xs text-slate-500">{proofFiles.length} file(s) selected</p>}
                </div>
                <button 
                  disabled={!tenantId || !onSubmitPaymentWithProof || isSubmitting || residentBalance <= 0}
                  onClick={async () => {
                    if (!tenantId || !onSubmitPaymentWithProof || residentBalance <= 0) return;
                    setIsSubmitting(true);
                    setSubmitError(null);
                    try {
                      await onSubmitPaymentWithProof({
                        amount: residentBalance,
                        method: manualPaymentType,
                        type: 'Rent',
                        reference: manualReference || undefined,
                        date: manualDate,
                        proofFiles,
                      });
                      setAlertModal({ isOpen: true, title: 'Payment Reported', message: 'Your payment has been reported with proof. The property manager will verify and update your balance.', type: 'success' });
                      setShowPaymentModal(false);
                      setManualPaymentMode(false);
                      resetForm();
                    } catch (e) {
                      setSubmitError(e instanceof Error ? e.message : 'Failed to submit');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit Report
                </button>
                {submitError && <p className="text-sm text-rose-600">{submitError}</p>}
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

export interface RenderPaymentInstructionsProps {
  method: string;
  residentBalance: number;
}

export const renderPaymentInstructions = ({ method, residentBalance }: RenderPaymentInstructionsProps): React.ReactNode => {
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

export interface UsePaymentsReturn {
  // Payment state
  showPaymentModal: boolean;
  setShowPaymentModal: (show: boolean) => void;
  manualPaymentMode: boolean;
  setManualPaymentMode: (mode: boolean) => void;
  payments: Payment[];
  loadingPayments: boolean;
  paymentSubTab: PaymentSubTab;
  setPaymentSubTab: (tab: PaymentSubTab) => void;
  selectedPaymentMethod: PaymentMethod;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;
  
  // Handlers
  downloadReceipt: (paymentId: string) => void;
  submitPaymentWithProof: (data: SubmitPaymentWithProofData) => Promise<void>;
}

export const usePayments = (currentTenant: Tenant | null, tenantId?: string): UsePaymentsReturn => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [manualPaymentMode, setManualPaymentMode] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSubTab, setPaymentSubTab] = useState<PaymentSubTab>('history');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(null);

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

  const submitPaymentWithProof = async (data: SubmitPaymentWithProofData) => {
    const tenantIdToUse = currentTenant?.id || tenantId;
    if (!tenantIdToUse) throw new Error('Tenant not found');
    await api.createPayment({
      tenantId: tenantIdToUse,
      amount: data.amount,
      date: data.date,
      status: 'Pending',
      type: data.type as any,
      method: data.method as any,
      reference: data.reference,
      proofFiles: data.proofFiles,
    });
  };

  const downloadReceipt = (paymentId: string) => {
    // Find the payment in the payments array
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
      // Note: Modal should be handled by the calling component
      // This function will just return early if payment not found
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

  return {
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
    submitPaymentWithProof,
  };
};







