import React, { useEffect, useState } from 'react';
import { UserCog, Plus, Loader2, Mail, Phone, Building2, X } from 'lucide-react';
import { api } from '../services/api';
import { Property, PropertyManagerProfile } from '../types';

const FALLBACK_PROPERTY_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

interface PropertyManagersPanelProps {
  properties: Property[];
}

const emptyForm = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  phone: '',
  propertyIds: [] as string[],
};

const PropertyManagersPanel: React.FC<PropertyManagersPanelProps> = ({ properties }) => {
  const [managers, setManagers] = useState<PropertyManagerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPropertyIds, setEditPropertyIds] = useState<string[]>([]);

  const loadManagers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPropertyManagers();
      setManagers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load property managers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagers();
  }, []);

  const toggleProperty = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.firstName || !form.lastName || !form.password) return;
    setSaving(true);
    setError(null);
    try {
      await api.createPropertyManager({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
        phone: form.phone.trim(),
        propertyIds: form.propertyIds,
      });
      setForm(emptyForm);
      setShowForm(false);
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create property manager');
    } finally {
      setSaving(false);
    }
  };

  const startEditAssignments = (manager: PropertyManagerProfile) => {
    setEditingId(manager.id);
    setEditPropertyIds([...manager.propertyIds]);
  };

  const saveAssignments = async (managerId: string) => {
    setSaving(true);
    setError(null);
    try {
      await api.updatePropertyManager(managerId, { propertyIds: editPropertyIds });
      setEditingId(null);
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assignments');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-indigo-600" />
            Property Managers
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            View managers, their assigned properties, and add new accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-sm"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Property Manager'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-800">New property manager</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">First name</label>
              <input
                required
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Last name</label>
              <input
                required
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
              <input
                type="email"
                required
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Phone</label>
              <input
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Temporary password</label>
              <input
                type="password"
                required
                minLength={8}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Assign properties</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-3 bg-slate-50">
              {properties.length === 0 ? (
                <p className="text-sm text-slate-500 col-span-full">No properties available yet.</p>
              ) : (
                properties.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.propertyIds.includes(p.id)}
                      onChange={() => setForm((f) => ({ ...f, propertyIds: toggleProperty(f.propertyIds, p.id) }))}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create account
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : managers.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <UserCog className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No property managers yet</p>
          <p className="text-sm text-slate-500 mt-1">Add a manager to assign properties and grant portal access.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {managers.map((manager) => (
            <div key={manager.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900 text-lg">{manager.userName || manager.userEmail}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {manager.userEmail}
                    </span>
                    {manager.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {manager.phone}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    editingId === manager.id ? setEditingId(null) : startEditAssignments(manager)
                  }
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 self-start"
                >
                  {editingId === manager.id ? 'Cancel' : 'Edit assignments'}
                </button>
              </div>

              {editingId === manager.id ? (
                <div className="p-5 bg-slate-50 border-b border-slate-100 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Select properties</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {properties.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editPropertyIds.includes(p.id)}
                          onChange={() => setEditPropertyIds((ids) => toggleProperty(ids, p.id))}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveAssignments(manager.id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Save assignments
                  </button>
                </div>
              ) : null}

              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Assigned properties ({manager.assignedProperties.length})
                </p>
                {manager.assignedProperties.length === 0 ? (
                  <p className="text-sm text-slate-500">No properties assigned.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {manager.assignedProperties.map((prop) => (
                      <div key={prop.id} className="flex gap-3 rounded-lg border border-slate-100 p-2 bg-slate-50/80">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                          <img
                            src={prop.image || FALLBACK_PROPERTY_IMAGE}
                            alt={prop.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{prop.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {prop.address}{prop.city ? `, ${prop.city}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyManagersPanel;
