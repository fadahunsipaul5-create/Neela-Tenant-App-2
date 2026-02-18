import React, { useState, useEffect } from 'react';
import { 
  DollarSign, CreditCard, Plus, Download, Mail, Filter, 
  AlertCircle, CheckCircle, Clock, FileText, Search, 
  MoreVertical, ArrowUpRight, ArrowDownLeft, Wallet, Trash2, X, Eye, Loader2
} from 'lucide-react';
import { Tenant, Payment, Invoice } from '../types';
import { api } from '../services/api';
import Modal from './Modal';

interface PaymentsViewProps {
  tenants: Tenant[];
  payments: Payment[];
  invoices: Invoice[];
  onDataChange?: () => void; // Callback to refresh data after payment is recorded
}

const PaymentsView: React.FC<PaymentsViewProps> = ({ 
  tenants: initialTenants, 
  payments: initialPayments, 
  invoices: initialInvoices,
  onDataChange
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'transactions' | 'pending-proof'>('overview');
  
  // Mutable State for Demo
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  
  // Modals State
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [showSendNotice, setShowSendNotice] = useState(false);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State (Generic holders)
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // Adjustment State
  const [adjustmentType, setAdjustmentType] = useState<string>('Late Fee (Charge)');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [pendingAdjustments, setPendingAdjustments] = useState<{ adjustmentType: string; amount: number; chargeOrCredit: 'Charge' | 'Waive' }[]>([]);
  const [isApplyingAdjustments, setIsApplyingAdjustments] = useState(false);
  
  // Send Notice State
  const [selectedNoticeType, setSelectedNoticeType] = useState<string>('Notice of Late Rent');
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);

  // Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info' | 'warning',
  });

  const tenantsMap = initialTenants.reduce((acc, t) => ({ ...acc, [t.id]: t }), {} as Record<string, Tenant>);

  // Derived Data - Use props directly to ensure reactivity
  const totalCollected = initialPayments
    .filter(p => p.status === 'Paid' && new Date(p.date).getMonth() === new Date().getMonth())
    .reduce((acc, p) => acc + p.amount, 0);
  
  // Total Overdue: Sum of tenant balances (more accurate than just invoices)
  const totalOverdue = initialTenants
    .filter(t => t.balance > 0)
    .reduce((acc, t) => acc + t.balance, 0);
  
  // Projected Revenue: Sum of all active tenants' rent amounts
  const projectedRevenue = initialTenants
    .filter(t => t.status === 'Active')
    .reduce((acc, t) => acc + (t.rentAmount || 0), 0);

  const recentActivity = [...initialPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const overdueTenants = initialTenants.filter(t => t.balance > 0);

  const pendingPaymentsWithProof = initialPayments.filter(
    p => p.status === 'Pending' && p.proofOfPaymentFiles && p.proofOfPaymentFiles.length > 0
  );

  const getMediaUrl = (path: string) => `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/media/${path}`;

  // Handlers
  const handleCreateInvoice = async () => {
    if (!selectedTenantId || !amount) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select a tenant and enter an amount.',
        type: 'error',
      });
      return;
    }
    
    const invoiceAmount = parseFloat(amount);
    if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please enter a valid positive amount.',
        type: 'error',
      });
      return;
    }
    
    try {
      // Create a Payment object which will trigger the invoice email automatically
      const newPayment: Partial<Payment> = {
        tenantId: selectedTenantId,
        amount: invoiceAmount,
        date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        type: 'Rent', // Default type, can be customized based on description
        method: 'Invoice', // Indicates this is an invoice
        reference: description || 'Manual Invoice',
      };
      
      // Save payment to backend - this will attempt to send invoice email
      const created = await api.createPayment(newPayment);
      
      // Create local invoice object for display
      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        tenantId: selectedTenantId,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        amount: invoiceAmount,
        period: description || 'Manual Charge',
        status: 'Pending',
        items: [{ description: description || 'Miscellaneous Charge', amount: invoiceAmount }]
      };
      setInvoices([newInvoice, ...invoices]);
      
      // Refresh data to get updated balances
      if (onDataChange) {
        await onDataChange();
      }
      
      setShowCreateInvoice(false);
      const tenantName = tenantsMap[selectedTenantId]?.name ?? 'tenant';
      setModalState({
        isOpen: true,
        title: 'Invoice Created',
        message: created.invoice_email_sent === false
          ? `Invoice created successfully, but the email could not be sent to ${tenantName}. Please check email configuration (e.g. SendGrid API key and from-address).`
          : `Invoice created successfully and email sent to ${tenantName}!`,
        type: created.invoice_email_sent === false ? 'info' : 'success',
      });
      resetForms();
    } catch (error) {
      console.error('Error creating invoice:', error);
      setModalState({
        isOpen: true,
        title: 'Invoice Error',
        message: error instanceof Error ? error.message : 'Failed to create invoice',
        type: 'error',
      });
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    setConfirmingPaymentId(paymentId);
    try {
      await api.updatePayment(paymentId, { status: 'Paid' });
      setModalState({
        isOpen: true,
        title: 'Payment Confirmed',
        message: 'Payment has been confirmed. Tenant balance has been updated and a receipt email has been sent.',
        type: 'success',
      });
      if (onDataChange) await onDataChange();
    } catch (error) {
      setModalState({
        isOpen: true,
        title: 'Confirm Failed',
        message: error instanceof Error ? error.message : 'Failed to confirm payment',
        type: 'error',
      });
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedTenantId || !amount) return;
    
    try {
      const newPayment: Partial<Payment> = {
        tenantId: selectedTenantId,
        amount: Number(amount),
        date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        type: 'Rent', // Simplification
        method: 'Check', // Simplification
      };
      
      // Save payment to the backend
      await api.createPayment(newPayment);
      
      // Refresh data to get updated tenant balances
      if (onDataChange) {
        await onDataChange();
      }
      
      setShowRecordPayment(false);
      resetForms();
    } catch (error) {
      console.error('Error recording payment:', error);
      setModalState({
        isOpen: true,
        title: 'Payment Error',
        message: error instanceof Error ? error.message : 'Failed to record payment',
        type: 'error',
      });
    }
  };

  const handleAddAdjustmentToList = (chargeOrCredit: 'Charge' | 'Waive') => {
    if (!selectedTenantId || !adjustmentAmount) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please enter an amount for the adjustment.',
        type: 'error',
      });
      return;
    }
    const adjustmentValue = parseFloat(adjustmentAmount);
    if (isNaN(adjustmentValue) || adjustmentValue <= 0) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please enter a valid positive amount.',
        type: 'error',
      });
      return;
    }
    setPendingAdjustments(prev => [...prev, { adjustmentType, amount: adjustmentValue, chargeOrCredit }]);
    setAdjustmentAmount('');
  };

  const handleRemovePendingAdjustment = (index: number) => {
    setPendingAdjustments(prev => prev.filter((_, i) => i !== index));
  };

  const handleApplyAllAdjustments = async () => {
    if (!selectedTenantId || pendingAdjustments.length === 0) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Add at least one charge or credit before applying.',
        type: 'error',
      });
      return;
    }
    const currentTenant = initialTenants.find(t => t.id === selectedTenantId);
    if (!currentTenant) {
      setModalState({ isOpen: true, title: 'Error', message: 'Tenant not found', type: 'error' });
      return;
    }
    const backendTypeMap: Record<string, string> = {
      'Late Fee (Charge)': 'Late Fee',
      'Maintenance Charge': 'Late Fee',
      'Waive Fee (Credit)': 'Rent',
      'Security Deposit Return': 'Deposit',
    };
    const count = pendingAdjustments.length;
    setIsApplyingAdjustments(true);
    try {
      for (const item of pendingAdjustments) {
        const backendType = backendTypeMap[item.adjustmentType] ?? 'Rent';
        await api.createPayment({
          tenantId: selectedTenantId,
          amount: item.amount,
          date: new Date().toISOString().split('T')[0],
          status: item.chargeOrCredit === 'Charge' ? 'Pending' : 'Paid',
          type: backendType,
          method: 'Adjustment',
          reference: `Adjustment: ${item.adjustmentType}`,
        });
      }
      if (onDataChange) await onDataChange();
      setShowAdjustment(false);
      setPendingAdjustments([]);
      resetForms();
      setModalState({
        isOpen: true,
        title: 'Adjustments Applied',
        message: `${count} adjustment(s) applied successfully. Balance has been updated.`,
        type: 'success',
      });
    } catch (error) {
      setModalState({
        isOpen: true,
        title: 'Adjustment Error',
        message: error instanceof Error ? error.message : 'Failed to apply adjustments',
        type: 'error',
      });
    } finally {
      setIsApplyingAdjustments(false);
    }
  };

  const handleReceipt = async (paymentId: string) => {
    try {
      const result = await api.sendPaymentReceipt(paymentId);
      setModalState({
        isOpen: true,
        title: result.receipt_email_sent === false ? 'Receipt Email Not Sent' : 'Receipt Sent',
        message: result.receipt_email_sent === false
          ? 'Receipt email could not be sent to the resident. Please check email configuration (e.g. SendGrid API key and from-address).'
          : 'Receipt email sent successfully to tenant!',
        type: result.receipt_email_sent === false ? 'info' : 'success',
      });
    } catch (error) {
      console.error('Error sending receipt:', error);
      setModalState({
        isOpen: true,
        title: 'Send Receipt Error',
        message: error instanceof Error ? error.message : 'Failed to send receipt email',
        type: 'error',
      });
    }
  };

  const handleViewDownloadInvoice = (invoice: Invoice) => {
    // For now, show a message. In production, this would generate/download the invoice PDF
    setModalState({
      isOpen: true,
      title: 'Invoice Download',
      message: `Downloading invoice ${invoice.id} for ${tenantsMap[invoice.tenantId]?.name || 'tenant'}...`,
      type: 'info',
    });
  };

  const handleSendNotice = async () => {
    if (!selectedTenantId || !selectedNoticeType) return;
    
    setIsSendingNotice(true);
    try {
      const response = await api.generateLegalNotice(selectedTenantId, selectedNoticeType);
      setModalState({
        isOpen: true,
        title: response.notice_email_sent === false ? 'Notice Created, Email Not Sent' : 'Notice Sent',
        message: response.notice_email_sent === false
          ? `Notice was created (Document ID: ${response.id}) but the email could not be delivered to the resident. Please check email configuration (e.g. SendGrid API key and from-address).`
          : `Notice sent successfully to tenant! Document ID: ${response.id}`,
        type: response.notice_email_sent === false ? 'info' : 'success',
      });
      setShowSendNotice(false);
      resetForms();
    } catch (error) {
      console.error('Error sending notice:', error);
      setModalState({
        isOpen: true,
        title: 'Send Notice Error',
        message: error instanceof Error ? error.message : 'Failed to send notice',
        type: 'error',
      });
    } finally {
      setIsSendingNotice(false);
    }
  };

  const resetForms = () => {
    setSelectedTenantId('');
    setAmount('');
    setDescription('');
    setAdjustmentType('Late Fee (Charge)');
    setAdjustmentAmount('');
    setPendingAdjustments([]);
  };

  const closeAdjustmentModal = () => {
    setShowAdjustment(false);
    setPendingAdjustments([]);
  };

  // Debug: Log when tenants prop changes
  useEffect(() => {
    console.log('PaymentsView - Tenants updated:', initialTenants.length, 'tenants');
    console.log('PaymentsView - Overdue tenants:', overdueTenants.length);
  }, [initialTenants]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Rent & Payments</h2>
          <p className="text-slate-500">Manage invoices, transactions, and financial reporting.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowRecordPayment(true)}
            className="flex items-center px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium shadow-sm"
          >
            <Wallet className="w-4 h-4 mr-2" /> Record Payment
          </button>
          <button 
            onClick={() => setShowCreateInvoice(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Invoice
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                 <DollarSign className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded">This Month</span>
           </div>
           <p className="text-slate-600 text-sm font-medium">Collected Revenue</p>
           <h3 className="text-3xl font-bold text-slate-800">${totalCollected.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                 <AlertCircle className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium bg-rose-100 text-rose-700 px-2 py-1 rounded">{overdueTenants.length} Tenants</span>
           </div>
           <p className="text-slate-600 text-sm font-medium">Total Overdue</p>
           <h3 className="text-3xl font-bold text-slate-800">${totalOverdue.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                 <CreditCard className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">Auto-Pay Active</span>
           </div>
           <p className="text-slate-600 text-sm font-medium">Projection</p>
           <h3 className="text-3xl font-bold text-slate-800">${projectedRevenue.toLocaleString()}</h3>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'invoices', label: 'Invoices' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'pending-proof', label: 'Proof to Confirm', badge: pendingPaymentsWithProof.length },
          ].map(({ id, label, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Areas */}
      <div className="min-h-[400px]">
        
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Attention Needed</h3>
                 </div>
                 {/* Mobile: Card layout */}
                 <div className="md:hidden divide-y divide-slate-100">
                    {overdueTenants.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">All caught up! No overdue balances.</div>
                    ) : (
                      overdueTenants.map(t => (
                        <div key={t.id} className="p-4 sm:p-5 flex flex-col gap-3 hover:bg-slate-50/50">
                          <div className="flex flex-col gap-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                            <p className="text-sm text-slate-600 truncate">{t.propertyUnit}</p>
                            <p className="text-rose-600 font-bold text-lg">${t.balance.toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button 
                              onClick={() => { setSelectedTenantId(t.id); setShowAdjustment(true); }}
                              className="flex-1 min-w-[100px] py-2.5 text-indigo-600 hover:text-indigo-800 text-sm font-bold hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
                            >
                              Adjust
                            </button>
                            <button 
                              onClick={() => { setSelectedTenantId(t.id); setShowSendNotice(true); }}
                              className="flex-1 min-w-[100px] py-2.5 text-rose-600 hover:text-rose-800 text-sm font-bold hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                            >
                              Send Notice
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                 </div>
                 {/* Desktop: Table layout */}
                 <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[500px]">
                       <thead className="bg-white text-slate-500 border-b border-slate-100">
                          <tr>
                             <th className="px-4 lg:px-6 py-3 font-medium">Tenant</th>
                             <th className="px-4 lg:px-6 py-3 font-medium">Unit</th>
                             <th className="px-4 lg:px-6 py-3 font-medium">Balance</th>
                             <th className="px-4 lg:px-6 py-3 font-medium text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {overdueTenants.map(t => (
                             <tr key={t.id} className="hover:bg-slate-50">
                                <td className="px-4 lg:px-6 py-4 font-medium text-slate-800">{t.name}</td>
                                <td className="px-4 lg:px-6 py-4 text-slate-600">{t.propertyUnit}</td>
                                <td className="px-4 lg:px-6 py-4 text-rose-600 font-bold">${t.balance.toLocaleString()}</td>
                                <td className="px-4 lg:px-6 py-4 text-right">
                                   <div className="flex justify-end gap-2 flex-wrap">
                                      <button 
                                        onClick={() => { setSelectedTenantId(t.id); setShowAdjustment(true); }}
                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-3 py-1.5 hover:bg-indigo-50 rounded"
                                      >
                                        Adjust
                                      </button>
                                      <button 
                                        onClick={() => { setSelectedTenantId(t.id); setShowSendNotice(true); }}
                                        className="text-rose-600 hover:text-rose-800 text-xs font-bold px-3 py-1.5 hover:bg-rose-50 rounded border border-rose-200"
                                      >
                                        Send Notice
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                          {overdueTenants.length === 0 && (
                             <tr><td colSpan={4} className="p-6 text-center text-slate-400">All caught up! No overdue balances.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                 <h3 className="font-bold text-slate-800 mb-4">Recent Activity</h3>
                 <div className="space-y-4">
                    {recentActivity.map((p) => (
                       <div key={p.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-full ${p.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {p.status === 'Paid' ? <ArrowDownLeft className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
                             </div>
                             <div>
                                <p className="text-sm font-medium text-slate-800">{tenantsMap[p.tenantId]?.name || 'Unknown'}</p>
                                <p className="text-xs text-slate-500">{p.date} • {p.type}</p>
                             </div>
                          </div>
                          <span className="font-bold text-slate-700">+${p.amount}</span>
                       </div>
                    ))}
                 </div>
                 <button onClick={() => setActiveTab('transactions')} className="w-full mt-6 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors">
                    View All Transactions
                 </button>
              </div>
           </div>
        )}

        {/* 2. INVOICES TAB */}
        {activeTab === 'invoices' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-slate-50">
                 <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                       type="text" 
                       placeholder="Search by invoice # or tenant..."
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-500"
                    />
                 </div>
                 <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select className="border-none bg-transparent text-sm font-medium text-slate-600 focus:ring-0">
                       <option>All Statuses</option>
                       <option>Paid</option>
                       <option>Overdue</option>
                       <option>Pending</option>
                    </select>
                 </div>
              </div>
              <table className="w-full text-sm text-left">
                 <thead className="bg-white text-slate-500 border-b border-slate-100">
                    <tr>
                       <th className="px-6 py-3 font-medium">Invoice ID</th>
                       <th className="px-6 py-3 font-medium">Tenant</th>
                       <th className="px-6 py-3 font-medium">Period</th>
                       <th className="px-6 py-3 font-medium">Due Date</th>
                       <th className="px-6 py-3 font-medium">Amount</th>
                       <th className="px-6 py-3 font-medium">Status</th>
                       <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                       <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{inv.id}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{tenantsMap[inv.tenantId]?.name}</td>
                          <td className="px-6 py-4 text-slate-600">{inv.period}</td>
                          <td className="px-6 py-4 text-slate-600">{inv.dueDate}</td>
                          <td className="px-6 py-4 font-bold text-slate-800">${inv.amount}</td>
                          <td className="px-6 py-4">
                             <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                                  inv.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : 
                                  'bg-amber-100 text-amber-700'}`}>
                                {inv.status}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button 
                               onClick={() => handleViewDownloadInvoice(inv)}
                               className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors text-xs font-medium"
                             >
                                <Download className="w-4 h-4" />
                                View/Download
                             </button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        )}

        {/* 3. TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
               <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-slate-800">Payment Ledger</h3>
               </div>
               <table className="w-full text-sm text-left">
                 <thead className="bg-white text-slate-500 border-b border-slate-100">
                    <tr>
                       <th className="px-6 py-3 font-medium">Date</th>
                       <th className="px-6 py-3 font-medium">Tenant</th>
                       <th className="px-6 py-3 font-medium">Type</th>
                       <th className="px-6 py-3 font-medium">Method</th>
                       <th className="px-6 py-3 font-medium">Amount</th>
                       <th className="px-6 py-3 font-medium">Receipt</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {initialPayments.map((pay) => (
                       <tr key={pay.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-slate-600">{pay.date}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{tenantsMap[pay.tenantId]?.name}</td>
                          <td className="px-6 py-4 text-slate-600">{pay.type}</td>
                          <td className="px-6 py-4 text-slate-600">{pay.method}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">+${pay.amount}</td>
                          <td className="px-6 py-4">
                             <button onClick={() => handleReceipt(pay.id)} className="flex items-center text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1 rounded transition-colors text-xs font-medium">
                                <Mail className="w-3 h-3 mr-1" /> Send
                             </button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        )}

        {/* 4. PENDING PROOF TAB */}
        {activeTab === 'pending-proof' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
               <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-slate-800">Payments with Proof Awaiting Confirmation</h3>
                  <p className="text-sm text-slate-600 mt-1">Review proof of payment and confirm to update tenant balance.</p>
               </div>
               {pendingPaymentsWithProof.length === 0 ? (
                 <div className="p-12 text-center text-slate-500">
                   No pending payments with proof. Tenants will appear here after they upload proof of payment.
                 </div>
               ) : (
               <table className="w-full text-sm text-left">
                 <thead className="bg-white text-slate-500 border-b border-slate-100">
                    <tr>
                       <th className="px-6 py-3 font-medium">Date</th>
                       <th className="px-6 py-3 font-medium">Tenant</th>
                       <th className="px-6 py-3 font-medium">Method</th>
                       <th className="px-6 py-3 font-medium">Amount</th>
                       <th className="px-6 py-3 font-medium">Proof</th>
                       <th className="px-6 py-3 font-medium text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {pendingPaymentsWithProof.map((pay) => (
                       <tr key={pay.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-slate-600">{pay.date}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{tenantsMap[pay.tenantId]?.name}</td>
                          <td className="px-6 py-4 text-slate-600">{pay.method}</td>
                          <td className="px-6 py-4 font-bold text-slate-800">${pay.amount}</td>
                          <td className="px-6 py-4">
                             <div className="flex flex-wrap gap-2">
                               {pay.proofOfPaymentFiles?.map((file: any, idx: number) => (
                                 <div key={idx} className="flex items-center gap-1.5">
                                   <a
                                     href={getMediaUrl(file.path)}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded text-xs font-medium"
                                     title="View"
                                   >
                                     <Eye className="w-3.5 h-3.5" />
                                     {file.filename || 'Proof'}
                                   </a>
                                   <a
                                     href={getMediaUrl(file.path)}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     download
                                     className="text-slate-400 hover:text-slate-600 p-1"
                                     title="Download"
                                   >
                                     <Download className="w-3.5 h-3.5" />
                                   </a>
                                 </div>
                               ))}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button
                               onClick={() => handleConfirmPayment(pay.id)}
                               disabled={confirmingPaymentId === pay.id}
                               className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                               {confirmingPaymentId === pay.id ? (
                                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
                               ) : (
                                 <CheckCircle className="w-3.5 h-3.5" />
                               )}
                               Confirm
                             </button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
               )}
           </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Create Invoice Modal */}
      {showCreateInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Create Manual Invoice</h3>
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tenant</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                    >
                       <option value="">Select Tenant...</option>
                       {initialTenants.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.propertyUnit})</option>
                       ))}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (Period)</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" 
                      placeholder="e.g. June 2024 Rent"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" 
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                 </div>
                 <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setShowCreateInvoice(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700">Cancel</button>
                    <button onClick={handleCreateInvoice} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Create Invoice</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Record Manual Payment</h3>
              <p className="text-sm text-slate-500 mb-4">Log cash, check, or external payments manually.</p>
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tenant</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                    >
                       <option value="">Select Tenant...</option>
                       {initialTenants.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.propertyUnit})</option>
                       ))}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                       <select className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900">
                          <option>Check</option>
                          <option>Cash</option>
                          <option>Money Order</option>
                          <option>Bank Transfer</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                       <input 
                          type="number" 
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" 
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                       />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Reference / Check #</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" placeholder="Optional" />
                 </div>
                 <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setShowRecordPayment(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700">Cancel</button>
                    <button onClick={handleRecordPayment} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">Record Payment</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustment && (
         <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={closeAdjustmentModal}
         >
            <div 
               className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95"
               onClick={(e) => e.stopPropagation()}
            >
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Balance Adjustment</h3>
                  <button 
                     onClick={closeAdjustmentModal}
                     className="text-slate-400 hover:text-slate-600 transition-colors"
                     aria-label="Close modal"
                  >
                     <X className="w-5 h-5" />
                  </button>
               </div>
               <p className="text-sm text-slate-500 mb-4">
                  Adjust balance for <strong>{tenantsMap[selectedTenantId]?.name}</strong>.
               </p>
               <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Type</label>
                      <select 
                        value={adjustmentType}
                        onChange={(e) => setAdjustmentType(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                      >
                         <option>Late Fee (Charge)</option>
                         <option>Maintenance Charge</option>
                         <option>Waive Fee (Credit)</option>
                         <option>Security Deposit Return</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                      <input 
                        type="number" 
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" 
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleAddAdjustmentToList('Waive')}
                        disabled={!adjustmentAmount || parseFloat(adjustmentAmount) <= 0}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                         Add Credit
                      </button>
                      <button 
                        onClick={() => handleAddAdjustmentToList('Charge')}
                        disabled={!adjustmentAmount || parseFloat(adjustmentAmount) <= 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                         Add Charge
                      </button>
                   </div>
                   {pendingAdjustments.length > 0 && (
                     <div className="mt-4 pt-4 border-t border-slate-200">
                       <p className="text-sm font-medium text-slate-700 mb-2">Pending ({pendingAdjustments.length})</p>
                       <ul className="space-y-2 max-h-40 overflow-y-auto">
                         {pendingAdjustments.map((item, idx) => (
                           <li key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm">
                             <span>
                               {item.adjustmentType} - ${item.amount.toFixed(2)} ({item.chargeOrCredit === 'Charge' ? 'Charge' : 'Credit'})
                             </span>
                             <button
                               type="button"
                               onClick={() => handleRemovePendingAdjustment(idx)}
                               className="text-slate-400 hover:text-rose-600 p-1"
                               aria-label="Remove"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </li>
                         ))}
                       </ul>
                       <button
                         onClick={handleApplyAllAdjustments}
                         disabled={isApplyingAdjustments}
                         className="w-full mt-3 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                       >
                         {isApplyingAdjustments ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                         Apply All ({pendingAdjustments.length})
                       </button>
                     </div>
                   )}
               </div>
            </div>
         </div>
      )}

      {/* Send Notice Modal */}
      {showSendNotice && selectedTenantId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Send Legal Notice</h3>
              <p className="text-sm text-slate-600 mb-4">
                Send a legal notice to <strong>{tenantsMap[selectedTenantId]?.name}</strong> regarding their outstanding balance of <strong className="text-rose-600">${tenantsMap[selectedTenantId]?.balance}</strong>.
              </p>
              <div className="space-y-4">
                  <div>
                     <label className="block text-sm font-medium text-slate-700 mb-2">Notice Type</label>
                     <select 
                        value={selectedNoticeType}
                        onChange={(e) => setSelectedNoticeType(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                     >
                        <option value="Notice of Late Rent">Late Fee Reminder (Friendly)</option>
                        <option value="3-Day Notice to Vacate">3-Day Notice to Vacate (Texas)</option>
                        <option value="30-Day Lease Termination">30-Day Lease Termination</option>
                        <option value="Lease Violation Notice">Lease Violation Notice</option>
                     </select>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                     <p className="text-xs text-blue-800">
                        <strong>Auto-populated details:</strong> The notice will automatically include the tenant's name, property unit, balance amount, and other relevant information.
                     </p>
                  </div>
               </div>

               <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => { setShowSendNotice(false); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                    disabled={isSendingNotice}
                  >
                     Cancel
                  </button>
                  <button 
                    onClick={handleSendNotice}
                    disabled={isSendingNotice}
                    className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                     {isSendingNotice ? 'Sending...' : 'Send Notice'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />

    </div>
  );
};

export default PaymentsView;