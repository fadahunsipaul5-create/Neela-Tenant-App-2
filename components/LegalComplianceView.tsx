import React, { useState } from 'react';
import { Tenant, LegalNoticeType, LegalDocument, NoticeTemplate } from '../types';
import { api } from '../services/api';
import { 
  AlertTriangle, FileText, Send, Printer, Loader2, History, 
  FileSignature, Download, CheckCircle2, Search, Mail, PenTool, Save, Plus
} from 'lucide-react';
import Modal from './Modal';

interface LegalComplianceProps {
  tenants: Tenant[];
}

const LegalComplianceView: React.FC<LegalComplianceProps> = ({ tenants }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'templates'>('generate');
  
  // Generate State
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [noticeType, setNoticeType] = useState<LegalNoticeType>(LegalNoticeType.NOTICE_TO_VACATE_3_DAY);
  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // History State
  const [history, setHistory] = useState<LegalDocument[]>([
    {
      id: 'doc-101',
      tenantId: 't2', // Bob Smith (from constants)
      type: LegalNoticeType.NOTICE_TO_VACATE_3_DAY,
      generatedContent: '...',
      createdAt: '2024-04-28',
      status: 'Delivered',
      deliveryMethod: 'Certified Mail',
      trackingNumber: '9400 1000 0000 0000 0000 01'
    },
    {
      id: 'doc-102',
      tenantId: 't1',
      type: LegalNoticeType.LEASE_TERMINATION_30_DAY,
      generatedContent: '...',
      createdAt: '2023-12-01',
      status: 'Filed',
      deliveryMethod: 'Portal'
    }
  ]);

  // Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info' | 'warning',
  });

  // Templates State
  const [templates, setTemplates] = useState<NoticeTemplate[]>([
    {
      id: 'tpl-1',
      name: 'Standard 3-Day Notice (Texas)',
      type: LegalNoticeType.NOTICE_TO_VACATE_3_DAY,
      content: `NOTICE TO VACATE FOR NON-PAYMENT OF RENT\n\nTo: {{Tenant Name}}\nAddress: {{Unit Address}}\n\nDate: {{Date}}\n\nDear {{Tenant Name}},\n\nYou are hereby notified that your rent is past due...`,
      lastUpdated: '2024-01-15'
    },
    {
      id: 'tpl-2',
      name: 'Late Fee Reminder',
      type: LegalNoticeType.LATE_RENT_NOTICE,
      content: `LATE RENT NOTICE\n\nDear {{Tenant Name}},\n\nThis is a friendly reminder that we have not received your rent payment for {{Month}}...`,
      lastUpdated: '2024-03-10'
    }
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [editingTemplateContent, setEditingTemplateContent] = useState('');

  const tenantsMap = tenants.reduce((acc, t) => ({ ...acc, [t.id]: t }), {} as Record<string, Tenant>);
  const delinquentTenants = tenants.filter(t => t.balance > 0 || t.status === 'Eviction Pending');

  // --- Actions ---

  const handleGenerate = async () => {
    if (!selectedTenantId) return;
    const tenant = tenants.find(t => t.id === selectedTenantId);
    if (!tenant) return;

    setIsGenerating(true);
    try {
      // Use the new generateLease API which now supports templates
      // NOTICE_TO_VACATE_3_DAY maps to our new "Texas 3-Day Notice to Pay or Quit" template in DB
      
      // First fetch templates to find the ID
      const templates = await api.getLeaseTemplates();
      let templateName = 'Standard Residential Lease';
      
      if (noticeType === LegalNoticeType.NOTICE_TO_VACATE_3_DAY) {
         templateName = 'Texas 3-Day Notice to Pay or Quit';
      } else if (noticeType === LegalNoticeType.LEASE_TERMINATION_30_DAY) {
         templateName = 'Texas Lease Termination Letter';
      }
          
      const templateToUse = templates.find(t => t.name === templateName) || templates[0];
      
      if (templateToUse) {
          const doc = await api.generateLease(tenant.id, templateToUse.id);
          setGeneratedDoc(doc.generated_content);
          // Also set history/state if needed
      } else {
         setGeneratedDoc("Template not found. Please contact support.");
      }
      
    } catch (e) {
      console.error(e);
      setGeneratedDoc("Error creating document. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendNotice = async (method: 'Email' | 'Certified Mail' | 'Portal') => {
    if (!selectedTenantId || !generatedDoc) return;

    // Use Dropbox Sign for "Certified Mail" or Email (send for signature)
    if (method === 'Certified Mail' || method === 'Email') {
        // Save document then send via Dropbox Sign
        
        try {
            // 1. Create Legal Document record
            // Since our generateLease API doesn't return the ID, we might need to rely on history or update API.
            // For now, let's assume we can generate AND save in one go if we pass a flag, 
            // OR we assume the generateLease call ALREADY saved a draft (it does in backend view: save_lease_document).
            
            // To get the ID of the document we just generated, we need to fetch the latest for this tenant.
            // This is a bit race-condition prone but works for MVP.
            const docs = await api.getLegalDocuments(selectedTenantId);
            const latestDoc = docs[docs.length - 1]; // Assuming it's the last one created
            
            if (latestDoc) {
                await api.sendLeaseDocuSign(latestDoc.id);
                setModalState({
                  isOpen: true,
                  title: 'Notice Sent',
                  message: 'Official Notice Sent via Dropbox Sign to Tenant & Landlord!',
                  type: 'success',
                });
                
                // Update local history
                const newDoc: LegalDocument = {
                  id: latestDoc.id,
                  tenantId: selectedTenantId,
                  type: noticeType,
                  generatedContent: generatedDoc,
                  createdAt: new Date().toISOString().split('T')[0],
                  status: 'Sent',
                  deliveryMethod: 'Dropbox Sign',
                  trackingNumber: 'DROPBOX-SIGN-TRACKING'
                };
                setHistory([newDoc, ...history]);
                setActiveTab('history');
                setGeneratedDoc('');
                setSelectedTenantId('');
                return;
            }
        } catch (e) {
            console.error(e);
            setModalState({
              isOpen: true,
              title: 'Send Notice Error',
              message: 'Failed to send notice via Dropbox Sign. Please try again.',
              type: 'error',
            });
            return;
        }
    }

    // Fallback for Portal / Mock
    const newDoc: LegalDocument = {
      id: `doc-${Date.now()}`,
      tenantId: selectedTenantId,
      type: noticeType,
      generatedContent: generatedDoc,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'Sent',
      deliveryMethod: method,
      trackingNumber: method === 'Certified Mail' ? 'PENDING-TRACKING' : undefined
    };

    setHistory([newDoc, ...history]);
    setActiveTab('history');
    setGeneratedDoc('');
    setSelectedTenantId('');
    setModalState({
      isOpen: true,
      title: 'Notice Sent',
      message: `Notice sent via ${method} successfully!`,
      type: 'success',
    });
  };

  const handleExportHistory = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,Date,Tenant,Type,Status,Delivery Method,Tracking\n"
      + history.map(h => `${h.id},${h.createdAt},${tenantsMap[h.tenantId]?.name},${h.type},${h.status},${h.deliveryMethod},${h.trackingNumber || ''}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "compliance_audit_log.csv");
    document.body.appendChild(link);
    link.click();
  };

  const handleSaveTemplate = () => {
    if (selectedTemplateId) {
      setTemplates(templates.map(t => t.id === selectedTemplateId ? { ...t, content: editingTemplateContent, lastUpdated: new Date().toISOString().split('T')[0] } : t));
    } else {
      // Create new
      const newTpl: NoticeTemplate = {
        id: `tpl-${Date.now()}`,
        name: 'New Custom Template',
        type: LegalNoticeType.LEASE_VIOLATION,
        content: editingTemplateContent,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      setTemplates([...templates, newTpl]);
      setSelectedTemplateId(newTpl.id);
    }
    setModalState({
      isOpen: true,
      title: 'Template Saved',
      message: 'Template saved!',
      type: 'success',
    });
  };

  // --- Renderers ---

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Legal Compliance Center</h2>
           <p className="text-slate-500">Texas Property Code Sec. 24.005 Compliant Tools</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
         {[
           { id: 'generate', label: 'Generate & Send', icon: FileSignature },
           { id: 'history', label: 'Notice History', icon: History },
           { id: 'templates', label: 'Templates', icon: FileText },
         ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
         ))}
      </div>

      <div className="flex-1">
        
        {/* 1. GENERATE TAB */}
        {activeTab === 'generate' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Config Panel */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6 h-fit">
                 <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
                    <div className="flex">
                       <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                       <div className="ml-3">
                          <p className="text-sm text-amber-800 font-medium">Legal Disclaimer</p>
                          <p className="text-xs text-amber-700 mt-1">Ensure all notices comply with current Texas laws. Standard eviction requires 3-day notice.</p>
                       </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Select Tenant</label>
                    <select
                       className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                       value={selectedTenantId}
                       onChange={(e) => setSelectedTenantId(e.target.value)}
                    >
                       <option value="">-- Select Tenant --</option>
                       {delinquentTenants.map(t => (
                          <option key={t.id} value={t.id}>
                             {t.name} (Due: ${t.balance})
                          </option>
                       ))}
                       <option disabled>---</option>
                       {tenants.filter(t => !delinquentTenants.includes(t)).map(t => (
                          <option key={t.id} value={t.id}>{t.name} (Good Standing)</option>
                       ))}
                    </select>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notice Type</label>
                    <div className="space-y-2">
                       {Object.values(LegalNoticeType).map((type) => (
                          <button
                             key={type}
                             onClick={() => setNoticeType(type)}
                             className={`
                                w-full text-left px-4 py-3 rounded-lg border transition-all text-sm font-medium
                                ${noticeType === type 
                                   ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-500' 
                                   : 'border-slate-200 hover:bg-slate-50 text-slate-600'}
                             `}
                          >
                             {type}
                          </button>
                       ))}
                    </div>
                 </div>

                 <button
                    onClick={handleGenerate}
                    disabled={!selectedTenantId || isGenerating}
                    className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-sm transition-all"
                 >
                    {isGenerating ? (
                       <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                       <><FileSignature className="w-4 h-4 mr-2" /> Draft Notice</>
                    )}
                 </button>
              </div>

              {/* Preview Panel */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                 <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="font-bold text-slate-800">Document Preview</h3>
                    {generatedDoc && (
                       <div className="flex gap-2">
                          <button className="p-2 text-slate-500 hover:bg-slate-200 rounded" title="Print PDF">
                             <Printer className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleSendNotice('Email')} className="p-2 text-slate-500 hover:bg-slate-200 rounded" title="Email PDF">
                             <Mail className="w-5 h-5" />
                          </button>
                          <button 
                             onClick={() => handleSendNotice('Certified Mail')}
                             className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm"
                          >
                             <Send className="w-4 h-4" /> Send Official Notice (Dropbox Sign)
                          </button>
                       </div>
                    )}
                 </div>
                 <div className="flex-1 bg-slate-100 p-8 overflow-y-auto">
                    {generatedDoc ? (
                       <div className="bg-white shadow-lg min-h-[600px] p-12 max-w-[800px] mx-auto text-slate-900 font-serif leading-relaxed whitespace-pre-wrap">
                          {generatedDoc}
                       </div>
                    ) : (
                       <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          <FileText className="w-16 h-16 mb-4 opacity-20" />
                          <p className="font-medium">Configure and generate a notice to view preview.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {/* 2. HISTORY TAB */}
        {activeTab === 'history' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                 <div>
                    <h3 className="font-bold text-slate-800 text-lg">Compliance Audit Log</h3>
                    <p className="text-sm text-slate-500">Track delivery status of all sent legal notices.</p>
                 </div>
                 <button 
                    onClick={handleExportHistory}
                    className="flex items-center px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium shadow-sm"
                 >
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                 </button>
              </div>
              <table className="w-full text-sm text-left">
                 <thead className="bg-white text-slate-500 border-b border-slate-100">
                    <tr>
                       <th className="px-6 py-4 font-medium">Date</th>
                       <th className="px-6 py-4 font-medium">Tenant</th>
                       <th className="px-6 py-4 font-medium">Document Type</th>
                       <th className="px-6 py-4 font-medium">Delivery Method</th>
                       <th className="px-6 py-4 font-medium">Status</th>
                       <th className="px-6 py-4 font-medium">Tracking #</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {history.map((doc) => (
                       <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-600">{doc.createdAt}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{tenantsMap[doc.tenantId]?.name || 'Unknown'}</td>
                          <td className="px-6 py-4 text-slate-800">{doc.type}</td>
                          <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                             {doc.deliveryMethod === 'Certified Mail' && <Mail className="w-3 h-3" />}
                             {doc.deliveryMethod === 'Email' && <Send className="w-3 h-3" />}
                             {doc.deliveryMethod}
                          </td>
                          <td className="px-6 py-4">
                             <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1
                                ${doc.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 
                                  doc.status === 'Filed' ? 'bg-purple-100 text-purple-700' : 
                                  'bg-amber-100 text-amber-700'}`}>
                                {doc.status === 'Delivered' && <CheckCircle2 className="w-3 h-3"/>}
                                {doc.status}
                             </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">
                             {doc.trackingNumber || '-'}
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
              {history.length === 0 && (
                 <div className="p-12 text-center text-slate-400">No history available. Generate a notice first.</div>
              )}
           </div>
        )}

        {/* 3. TEMPLATES TAB */}
        {activeTab === 'templates' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                 <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Saved Templates</h3>
                    <button onClick={() => { setSelectedTemplateId(''); setEditingTemplateContent(''); }} className="p-1 hover:bg-slate-200 rounded">
                       <Plus className="w-5 h-5 text-slate-600" />
                    </button>
                 </div>
                 <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {templates.map(t => (
                       <div 
                          key={t.id} 
                          onClick={() => { setSelectedTemplateId(t.id); setEditingTemplateContent(t.content); }}
                          className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedTemplateId === t.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                       >
                          <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{t.type}</p>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                 <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                       <PenTool className="w-4 h-4" /> 
                       {selectedTemplateId ? 'Edit Template' : 'Create New Template'}
                    </div>
                    <button 
                       onClick={handleSaveTemplate}
                       className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                    >
                       <Save className="w-3 h-3" /> Save Template
                    </button>
                 </div>
                 <div className="flex-1 bg-slate-50 p-4">
                    <textarea 
                       className="w-full h-full p-6 border border-slate-200 rounded-xl shadow-inner font-mono text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-slate-900"
                       value={editingTemplateContent}
                       onChange={(e) => setEditingTemplateContent(e.target.value)}
                       placeholder="Enter template content here... Use {{Tenant Name}} for variables."
                    />
                 </div>
                 <div className="p-2 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex gap-2">
                    <span className="font-bold">Variables:</span>
                    <span className="bg-white px-1 rounded border">{'{{Tenant Name}}'}</span>
                    <span className="bg-white px-1 rounded border">{'{{Address}}'}</span>
                    <span className="bg-white px-1 rounded border">{'{{Date}}'}</span>
                    <span className="bg-white px-1 rounded border">{'{{Amount}}'}</span>
                 </div>
              </div>
           </div>
        )}

      </div>

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

export default LegalComplianceView;