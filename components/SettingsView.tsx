import React, { useState, useEffect } from 'react';
import { 
  Building2, FileText, DollarSign, Palette, Save, Plus, Trash2, Upload,
  Check, AlertCircle, LayoutTemplate, Calendar, Home, Sliders, Mail, X, Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { Property } from '../types';

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'properties' | 'templates' | 'finance' | 'branding'>('properties');

  // Properties - Real API Data
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPropName, setNewPropName] = useState('');
  const [newPropPrice, setNewPropPrice] = useState<string>('');
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    units: 1,
    price: undefined as number | undefined,
    image: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Templates
  const [appConfig, setAppConfig] = useState({
    requireEmployment: true,
    requireReferences: true,
    requireSSN: false,
    applicationFee: 45,
    consentText: "I authorize Neela Capital Investment to perform background checks...",
  });
  const [leaseTemplate, setLeaseTemplate] = useState(`RESIDENTIAL LEASE AGREEMENT

This agreement is made on {{date}} between:
Landlord: {{company_name}}
Tenant: {{tenant_name}}

Property: {{property_address}}
Rent: $\{{rent_amount}} due on the {{due_day}} of each month.
Term: {{lease_term}} months beginning on {{start_date}}.

1. PAYMENT
Tenant agrees to pay rent by the due date. Late fees apply as follows: $\{{late_fee_initial}} initial + $\{{late_fee_daily}}/day.

2. MAINTENANCE
Tenant agrees to maintain the property in good condition.

Signatures:
________________________ Landlord
________________________ Tenant`);

  // Finance
  const [finance, setFinance] = useState({
    dueDay: 1,
    gracePeriod: 3,
    lateFeeInitial: 50,
    lateFeeDaily: 10,
    currency: 'USD'
  });

  // Branding
  const [branding, setBranding] = useState({
    companyName: 'Neela Capital Investment',
    primaryColor: '#4f46e5',
    logoUrl: '',
  });

  // Fetch properties on mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getProperties();
        setProperties(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch properties');
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

  const handleAddProperty = async () => {
    if(!newPropName.trim()) return;
    try {
      setIsSaving(true);
      setError(null);
      const newProperty = await api.createProperty({
        name: newPropName,
        address: 'TBD',
        city: 'Austin',
        state: 'TX',
        units: 1,
        price: newPropPrice ? parseFloat(newPropPrice) : undefined,
      });
      setProperties([...properties, newProperty]);
      setNewPropName('');
      setNewPropPrice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create property');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
      setIsSaving(true);
      setError(null);
      await api.deleteProperty(id);
      setProperties(properties.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete property');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (property: Property) => {
    setEditingProperty(property);
    setEditFormData({
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state,
      units: property.units,
      price: property.price,
      image: property.image || '',
    });
    setImageFile(null);
    setImagePreview(null);
    
    // Logic: Always use upload mode, but show existing image as preview
    // Since we removed the URL option, we just set the preview if an image exists.
    if (property.image) {
        setImagePreview(property.image);
    }

    setIsEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingProperty) return;
    if (!editFormData.name.trim() || !editFormData.address.trim() || !editFormData.city.trim() || !editFormData.state.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      const updated = await api.updateProperty(editingProperty.id, {
        ...editFormData,
        image: imageFile ? undefined : (editFormData.image.trim() || undefined),
      }, imageFile);
      setProperties(properties.map(p => p.id === editingProperty.id ? updated : p));
      setIsEditModalOpen(false);
      setEditingProperty(null);
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update property');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCancel = () => {
    setIsEditModalOpen(false);
    setEditingProperty(null);
    setEditFormData({ name: '', address: '', city: '', state: '', units: 1, price: undefined, image: '' });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setImageFile(file);
      setError(null);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear URL input when file is selected
      setEditFormData({...editFormData, image: ''});
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // --- SUB-COMPONENTS ---

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`
        flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors
        ${activeTab === id 
          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50'}
      `}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Setup & Configuration</h2>
          <p className="text-slate-500">Manage properties, templates, and system preferences.</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm">
          <Save className="w-4 h-4 mr-2" /> Save Changes
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <TabButton id="properties" label="Properties & Units" icon={Building2} />
          <TabButton id="templates" label="Application & Lease" icon={FileText} />
          <TabButton id="finance" label="Payment Rules" icon={DollarSign} />
          <TabButton id="branding" label="Branding & Look" icon={Palette} />
        </div>

        <div className="p-6 flex-1 bg-slate-50/50">
          
          {/* 1. PROPERTIES TAB */}
          {activeTab === 'properties' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Property Portfolio</h3>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 mb-6">
                      {properties.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <Home className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                          <p>No properties yet. Add your first property below.</p>
                        </div>
                      ) : (
                        properties.map(prop => (
                          <div key={prop.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-400">
                                <Home className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800">{prop.name}</h4>
                                <p className="text-sm text-slate-500">{prop.address}, {prop.city}, {prop.state} • <span className="font-medium text-indigo-600">{prop.units} Units</span></p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEditClick(prop)}
                                className="px-3 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteProperty(prop.id)} 
                                disabled={isSaving}
                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex gap-3">
                        <input 
                          type="text" 
                          placeholder="New Property Name" 
                          className="flex-1 p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-500"
                          value={newPropName}
                          onChange={(e) => setNewPropName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isSaving) {
                              handleAddProperty();
                            }
                          }}
                          disabled={isSaving}
                        />
                        <input 
                          type="number" 
                          placeholder="Price($) (Optional)" 
                          className="w-32 p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-500"
                          value={newPropPrice}
                          onChange={(e) => setNewPropPrice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isSaving) {
                              handleAddProperty();
                            }
                          }}
                          step="0.01"
                          min="0"
                          disabled={isSaving}
                        />
                        <button 
                          onClick={handleAddProperty} 
                          disabled={isSaving || !newPropName.trim()}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium text-sm hover:bg-indigo-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Add Property
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 2. TEMPLATES TAB */}
          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Application Settings */}
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm h-fit">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Application Template</h3>
                    <p className="text-xs text-slate-500">Configure what applicants see.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                      <p className="font-medium text-slate-700">Employment History</p>
                      <p className="text-xs text-slate-500">Require current employer details</p>
                    </div>
                    <input 
                      type="checkbox" checked={appConfig.requireEmployment} 
                      onChange={(e) => setAppConfig({...appConfig, requireEmployment: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                      <p className="font-medium text-slate-700">Personal References</p>
                      <p className="text-xs text-slate-500">Require at least 2 non-relatives</p>
                    </div>
                    <input 
                      type="checkbox" checked={appConfig.requireReferences} 
                      onChange={(e) => setAppConfig({...appConfig, requireReferences: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                      <p className="font-medium text-slate-700">SSN / ID Verification</p>
                      <p className="text-xs text-slate-500">Collect full SSN (High Security)</p>
                    </div>
                    <input 
                      type="checkbox" checked={appConfig.requireSSN} 
                      onChange={(e) => setAppConfig({...appConfig, requireSSN: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                  </div>
                  
                  <div className="pt-3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Application Fee ($)</label>
                    <input 
                      type="number" 
                      value={appConfig.applicationFee}
                      onChange={(e) => setAppConfig({...appConfig, applicationFee: Number(e.target.value)})}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900" 
                    />
                  </div>
                </div>
              </div>

              {/* Lease Template Editor */}
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[600px]">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">Lease Agreement</h3>
                        <p className="text-xs text-slate-500">Standard template for new tenants.</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                       Use {'{{variable}}'} to insert data
                    </div>
                 </div>
                 
                 <div className="flex-1 relative">
                    <textarea 
                      value={leaseTemplate}
                      onChange={(e) => setLeaseTemplate(e.target.value)}
                      className="w-full h-full p-4 border border-slate-300 rounded-lg font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                    />
                 </div>

                 <div className="mt-4 flex gap-2 overflow-x-auto py-2">
                    {['{{tenant_name}}', '{{rent_amount}}', '{{start_date}}', '{{due_day}}'].map(v => (
                      <span key={v} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-200" title="Click to copy">
                        {v}
                      </span>
                    ))}
                 </div>
              </div>
            </div>
          )}

          {/* 3. FINANCE TAB */}
          {activeTab === 'finance' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-indigo-600" /> Rent Collection Rules
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rent Due Day</label>
                    <select 
                      value={finance.dueDay}
                      onChange={(e) => setFinance({...finance, dueDay: Number(e.target.value)})}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                    >
                      {[1, 2, 3, 4, 5, 15].map(d => (
                        <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of the month</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Grace Period (Days)</label>
                    <input 
                      type="number" 
                      value={finance.gracePeriod}
                      onChange={(e) => setFinance({...finance, gracePeriod: Number(e.target.value)})}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                    <p className="text-xs text-slate-500 mt-1">Late fees trigger after this many days.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-rose-600" /> Late Fee Configuration
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Initial Late Fee ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input 
                        type="number" 
                        value={finance.lateFeeInitial}
                        onChange={(e) => setFinance({...finance, lateFeeInitial: Number(e.target.value)})}
                        className="w-full pl-8 p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Daily Late Fee ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input 
                        type="number" 
                        value={finance.lateFeeDaily}
                        onChange={(e) => setFinance({...finance, lateFeeDaily: Number(e.target.value)})}
                        className="w-full pl-8 p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Added every day until paid.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. BRANDING TAB */}
          {activeTab === 'branding' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm h-fit">
                 <h3 className="text-lg font-semibold text-slate-800 mb-6">Company Branding</h3>
                 
                 <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
                      <input 
                        type="text" 
                        value={branding.companyName}
                        onChange={(e) => setBranding({...branding, companyName: e.target.value})}
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Brand Color</label>
                      <div className="flex gap-3">
                        <input 
                          type="color" 
                          value={branding.primaryColor}
                          onChange={(e) => setBranding({...branding, primaryColor: e.target.value})}
                          className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                        />
                        <div className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600 flex items-center">
                           {branding.primaryColor}
                        </div>
                      </div>
                    </div>

                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
                       <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">
                          <Upload className="w-8 h-8 mb-2 text-slate-400" />
                          <span className="text-sm font-medium">Click to upload logo</span>
                          <span className="text-xs text-slate-400 mt-1">PNG, JPG (Max 2MB)</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Preview Card */}
              <div className="bg-slate-100 p-8 rounded-xl border border-slate-200 flex items-center justify-center">
                 <div className="w-full max-w-xs bg-white rounded-xl shadow-lg overflow-hidden pointer-events-none select-none transform scale-95 origin-top">
                    <div className="h-32 bg-slate-800 relative">
                       {/* Simulated Banner */}
                       <div className="absolute inset-0 opacity-50" style={{ backgroundColor: branding.primaryColor }}></div>
                       <div className="absolute bottom-4 left-4 text-white">
                          <h4 className="font-bold text-lg">{branding.companyName}</h4>
                          <p className="text-xs opacity-80">Tenant Portal</p>
                       </div>
                    </div>
                    <div className="p-4 space-y-3">
                       <div className="h-2 w-20 bg-slate-200 rounded"></div>
                       <div className="h-20 bg-slate-50 rounded border border-slate-100"></div>
                       <div 
                          className="w-full py-2 text-white rounded text-center text-xs font-bold"
                          style={{ backgroundColor: branding.primaryColor }}
                       >
                          Login
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Edit Property Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 pb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Edit Property</h3>
              <button 
                onClick={handleEditCancel}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Property Name *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                  placeholder="Sunset Apartments"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                  placeholder="101 Sunset Blvd"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    placeholder="Austin"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({...editFormData, state: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    placeholder="TX"
                    maxLength={2}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Number of Units</label>
                  <input
                    type="number"
                    value={editFormData.units}
                    onChange={(e) => setEditFormData({...editFormData, units: parseInt(e.target.value) || 1})}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price($) (Optional)</label>
                  <input
                    type="number"
                    value={editFormData.price || ''}
                    onChange={(e) => setEditFormData({...editFormData, price: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Property Image (Optional)</label>
                
                {/* File Upload Input */}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                      id="image-upload-input"
                    />
                    <label
                      htmlFor="image-upload-input"
                      className="block w-full p-4 border-2 border-dashed border-slate-300 rounded-lg text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                    >
                      <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">
                        {imageFile ? imageFile.name : 'Click to upload new image'}
                      </span>
                      <span className="block text-xs text-slate-500 mt-1">JPG, PNG, WebP (Max 5MB)</span>
                    </label>
                    {imagePreview && (
                      <div className="mt-3 relative">
                        <p className="text-xs text-slate-500 mb-1 font-medium">Current / Selected Image:</p>
                        <img 
                          src={imagePreview} 
                          alt="Property preview" 
                          className="w-full h-32 object-cover rounded-lg border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-6 right-2 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600"
                          title="Remove Image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
              </div>
              </div>
            </div>
            
            {/* Fixed Footer */}
            <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t border-slate-200">
              <button
                onClick={handleEditCancel}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;