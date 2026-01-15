import React, { useState, useEffect } from 'react';
import { 
  DollarSign, CreditCard, Plus, Download, Mail, Filter, 
  AlertCircle, CheckCircle, Clock, FileText, Search, 
  MoreVertical, ArrowUpRight, ArrowDownLeft, Wallet, Trash2
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
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'transactions'>('overview');
  
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
  
  // Send Notice State
  const [selectedNoticeType, setSelectedNoticeType] = useState<string>('Notice of Late Rent');
  const [isSendingNotice, setIsSendingNotice] = useState(false);

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
  
  const totalOverdue = invoices
    .filter(i => i.status === 'Overdue')
    .reduce((acc, i) => acc + i.amount, 0);

  const recentActivity = [...initialPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const overdueTenants = initialTenants.filter(t => t.balance > 0);

  // Handlers
  const handleCreateInvoice = () => {
    if (!selectedTenantId || !amount) return;
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      tenantId: selectedTenantId,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      amount: Number(amount),
      period: description || 'Manual Charge',
      status: 'Pending',
      items: [{ description: description || 'Miscellaneous Charge', amount: Number(amount) }]
    };
    setInvoices([newInvoice, ...invoices]);
    setShowCreateInvoice(false);
    resetForms();
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

  const handleAdjustment = (type: 'Charge' | 'Waive') => {
    // Logic to adjust tenant balance would go here
    // For demo visual, we'll just close modal
    setShowAdjustment(false);
    setModalState({
      isOpen: true,
      title: 'Adjustment Applied',
      message: `${type} applied to account!`,
      type: 'success',
    });
  };

  const handleReceipt = (paymentId: string) => {
    setModalState({
      isOpen: true,
      title: 'Receipt Generated',
      message: `Generating receipt for Payment #${paymentId}... Sent to tenant.`,
      type: 'success',
    });
  };

  const handleSendNotice = async () => {
    if (!selectedTenantId || !selectedNoticeType) return;
    
    setIsSendingNotice(true);
    try {
      // Generate and send the legal notice with tenant details automatically filled in
      const response = await api.generateLegalNotice(selectedTenantId, selectedNoticeType);
      
      setModalState({
        isOpen: true,
        title: 'Notice Sent',
        message: `Notice sent successfully to tenant! Document ID: ${response.id}`,
        type: 'success',
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
           <h3 className="text-3xl font-bold text-slate-800">$3,850.00</h3>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'invoices', 'transactions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {tab}
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
                 <table className="w-full text-sm text-left">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                       <tr>
                          <th className="px-6 py-3 font-medium">Tenant</th>
                          <th className="px-6 py-3 font-medium">Unit</th>
                          <th className="px-6 py-3 font-medium">Balance</th>
                          <th className="px-6 py-3 font-medium text-right">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {overdueTenants.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50">
                             <td className="px-6 py-4 font-medium text-slate-800">{t.name}</td>
                             <td className="px-6 py-4 text-slate-600">{t.propertyUnit}</td>
                             <td className="px-6 py-4 text-rose-600 font-bold">${t.balance.toLocaleString()}</td>
                             <td className="px-6 py-4 text-right flex justify-end gap-2">
                                <button 
                                  onClick={() => { setSelectedTenantId(t.id); setShowAdjustment(true); }}
                                  className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2 py-1 hover:bg-indigo-50 rounded"
                                >
                                  Adjust
                                </button>
                                <button 
                                  onClick={() => { setSelectedTenantId(t.id); setShowSendNotice(true); }}
                                  className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1 hover:bg-rose-50 rounded border border-rose-200"
                                >
                                  Send Notice
                                </button>
                             </td>
                          </tr>
                       ))}
                       {overdueTenants.length === 0 && (
                          <tr><td colSpan={4} className="p-6 text-center text-slate-400">All caught up! No overdue balances.</td></tr>
                       )}
                    </tbody>
                 </table>
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
                             <button className="text-slate-400 hover:text-slate-600 p-1">
                                <MoreVertical className="w-4 h-4" />
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
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
               <h3 className="text-lg font-bold text-slate-800 mb-4">Balance Adjustment</h3>
               <p className="text-sm text-slate-500 mb-4">
                  Adjust balance for <strong>{tenantsMap[selectedTenantId]?.name}</strong>.
               </p>
               <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Type</label>
                      <select className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900">
                         <option>Late Fee (Charge)</option>
                         <option>Maintenance Charge</option>
                         <option>Waive Fee (Credit)</option>
                         <option>Security Deposit Return</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                      <input type="number" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" placeholder="0.00" />
                   </div>
                   <div className="grid grid-cols-2 gap-3 mt-6">
                      <button 
                        onClick={() => handleAdjustment('Waive')}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                      >
                         Apply Credit
                      </button>
                      <button 
                        onClick={() => handleAdjustment('Charge')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                      >
                         Add Charge
                      </button>
                   </div>
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