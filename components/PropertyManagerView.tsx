import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, CreditCard, Receipt, LogOut, Menu, X, Home, Plus,
  MapPin, Wallet, Calendar, FileText, Tag, Wrench,
} from 'lucide-react';
import NeelaLogo from './NeelaLogo';
import MaintenanceView from './MaintenanceView';
import { isAuthenticated, getCurrentUser, logout } from '../services/auth';
import { api } from '../services/api';
import { Property, Tenant, Payment, OperatingExpense, MaintenanceRequest } from '../types';
import {
  CATEGORY_LABELS,
  groupPropertiesForSelect,
  MANAGER_EXPENSE_CATEGORIES,
  resolvePropertyIdForExpense,
} from '../utils/propertyGrouping';

const formatMoney = (v: number) =>
  `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FALLBACK_PROPERTY_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

type Tab = 'overview' | 'properties' | 'applications' | 'payments' | 'expenses' | 'maintenance';

const PropertyManagerView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [managedIds, setManagedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    groupKey: '',
    unitLabel: '',
    amount: '',
    category: 'maintenance' as OperatingExpense['category'],
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const user = getCurrentUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/manager/login', { replace: true });
      return;
    }
    const u = getCurrentUser();
    if (!u || u.role !== 'property_manager' || u.is_staff || u.is_superuser) {
      navigate('/manager/login', { replace: true });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const year = new Date().getFullYear();
        const [meRes, props, t, p, ex, m] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:8000')}/api/manager/me/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          }).then((r) => r.json()),
          api.getProperties(),
          api.getTenants(),
          api.getPayments(),
          api.getOperatingExpenses({ year, limit: 100 }),
          api.getMaintenanceRequests(),
        ]);
        const ids = (meRes.managed_property_ids || []).map(String);
        setManagedIds(ids);
        setProperties(props.filter((pr) => ids.includes(pr.id)));
        setTenants(t);
        setPayments(p);
        setExpenses(ex);
        setMaintenance(m);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const myTenants = useMemo(() => {
    return tenants.filter((t) => {
      const unit = (t.propertyUnit || '').toLowerCase();
      return properties.some((p) =>
        unit.includes(p.name.toLowerCase()) || unit.includes((p.address || '').toLowerCase())
      );
    });
  }, [tenants, properties]);

  const applicants = useMemo(() => myTenants.filter((t) => t.status === 'Applicant'), [myTenants]);
  const residents = useMemo(() => myTenants.filter((t) => t.status === 'Active'), [myTenants]);

  const refreshMaintenance = useCallback(async () => {
    try {
      const data = await api.getMaintenanceRequests();
      setMaintenance(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const myPayments = useMemo(() => {
    const tenantIds = new Set(myTenants.map((t) => t.id));
    return payments.filter((p) => tenantIds.has(p.tenantId));
  }, [payments, myTenants]);

  const propertyGroups = useMemo(() => groupPropertiesForSelect(properties), [properties]);

  const selectedGroup = useMemo(
    () => propertyGroups.find((g) => g.groupKey === expenseForm.groupKey),
    [propertyGroups, expenseForm.groupKey],
  );

  const myPropertyIds = useMemo(() => new Set(properties.map((p) => p.id)), [properties]);

  const myExpenses = useMemo(
    () => expenses.filter((e) => !e.property || myPropertyIds.has(e.property)),
    [expenses, myPropertyIds],
  );

  const handleLogout = () => {
    logout();
    navigate('/manager/login', { replace: true });
  };

  const addExpense = async () => {
    if (!expenseForm.amount || !expenseForm.groupKey) return;
    const propertyId = resolvePropertyIdForExpense(
      propertyGroups,
      expenseForm.groupKey,
      expenseForm.unitLabel,
    );
    if (!propertyId) return;
    setSaving(true);
    try {
      const year = new Date().getFullYear();
      await api.createOperatingExpense({
        property: propertyId,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        date: expenseForm.date,
        notes: expenseForm.notes,
        visibility: 'operating',
      });
      const ex = await api.getOperatingExpenses({ year, limit: 100 });
      setExpenses(ex);
      setExpenseForm((f) => ({ ...f, amount: '', notes: '' }));
    } finally {
      setSaving(false);
    }
  };

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'properties', label: 'My Properties', icon: Building2 },
    { id: 'applications', label: 'Tenants & Leases', icon: Users },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'payments', label: 'Rent & Payments', icon: CreditCard },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'properties':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">My Properties</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {properties.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                  <div className="h-36 bg-slate-200">
                    {p.image && <img src={p.image} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.address}, {p.city}</p>
                    <p className="text-sm mt-2"><span className="font-semibold">{p.units}</span> units · {p.status}</p>
                  </div>
                </div>
              ))}
              {properties.length === 0 && (
                <p className="text-slate-500 col-span-full text-center py-12">No properties assigned yet. Contact admin.</p>
              )}
            </div>
          </div>
        );
      case 'applications':
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">Tenant Applications</h2>
              <div className="space-y-3">
                {applicants.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{t.name}</p>
                      <p className="text-sm text-slate-500">{t.email} · {t.propertyUnit}</p>
                    </div>
                    <span className="inline-flex px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase">{t.status}</span>
                  </div>
                ))}
                {applicants.length === 0 && <p className="text-slate-500 text-center py-8">No pending applications.</p>}
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">Residents</h2>
              <div className="space-y-3">
                {residents.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{t.name}</p>
                      <p className="text-sm text-slate-500">{t.email} · {t.propertyUnit}</p>
                    </div>
                    <span className="inline-flex px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase">{t.status}</span>
                  </div>
                ))}
                {residents.length === 0 && <p className="text-slate-500 text-center py-8">No active residents on your properties.</p>}
              </div>
            </div>
          </div>
        );
      case 'maintenance':
        return (
          <MaintenanceView
            requests={maintenance}
            tenants={myTenants}
            onMaintenanceChange={refreshMaintenance}
          />
        );
      case 'payments':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Rent &amp; Payments</h2>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr><th className="p-3">Tenant</th><th className="p-3">Amount</th><th className="p-3">Date</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody>
                  {myPayments.slice(0, 20).map((p) => {
                    const tenant = myTenants.find((t) => t.id === p.tenantId);
                    return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 font-medium">{tenant?.name || 'Tenant'}</td>
                      <td className="p-3">{formatMoney(p.amount)}</td>
                      <td className="p-3">{p.date}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-semibold">{p.status}</span></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {myPayments.length === 0 && <p className="text-slate-500 text-center py-8">No payments yet.</p>}
            </div>
          </div>
        );
      case 'expenses':
        return (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Record Expenses</h2>
              <p className="text-sm text-slate-500 mt-1">
                Log operating costs for your properties. These feed the portfolio income statement — mortgage and financing stay admin-only.
              </p>
            </div>

            {propertyGroups.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-slate-600">Your properties</p>
                {propertyGroups.map((group) => (
                  <div
                    key={group.groupKey}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-3 sm:gap-4 items-center shadow-sm"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                      <img
                        src={group.image || FALLBACK_PROPERTY_IMAGE}
                        alt={group.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{group.label}</p>
                      {group.address && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          {group.address}
                        </p>
                      )}
                      {group.units.length > 1 && (
                        <p className="text-xs text-emerald-700 font-medium mt-1">
                          {group.units.length} units — {group.units.map((u) => u.label).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  <h3 className="font-bold text-lg">New expense</h3>
                </div>
                <p className="text-emerald-100 text-sm mt-1">Choose property, category, and amount.</p>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Property
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
                    value={expenseForm.groupKey}
                    onChange={(e) => setExpenseForm((f) => ({
                      ...f,
                      groupKey: e.target.value,
                      unitLabel: '',
                    }))}
                  >
                    <option value="">Select property</option>
                    {propertyGroups.map((g) => (
                      <option key={g.groupKey} value={g.groupKey}>{g.label}</option>
                    ))}
                  </select>
                </div>

                {selectedGroup && selectedGroup.units.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5" /> Unit
                    </label>
                    <select
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      value={expenseForm.unitLabel}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, unitLabel: e.target.value }))}
                    >
                      <option value="">All units / building-wide</option>
                      {selectedGroup.units.map((u) => (
                        <option key={u.propertyId} value={u.label}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Expense type
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value as OperatingExpense['category'] }))}
                  >
                    {MANAGER_EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" /> Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Date
                    </label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Notes <span className="font-normal normal-case text-slate-400">(optional)</span>
                  </label>
                  <input
                    placeholder="Vendor, invoice #, description…"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <button
                  type="button"
                  disabled={saving || !expenseForm.amount || !expenseForm.groupKey}
                  onClick={addExpense}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {saving ? 'Recording…' : 'Record Expense'}
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Recent expenses</h3>
              <div className="space-y-2">
                {myExpenses.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No expenses recorded yet.</p>
                ) : (
                  myExpenses.slice(0, 15).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">
                          {e.propertyName || 'Property'}
                          {e.unitLabel ? ` · ${e.unitLabel}` : ''}
                          {' · '}{CATEGORY_LABELS[e.category] || e.category}
                        </p>
                        <p className="text-xs text-slate-500">{e.date}{e.notes ? ` · ${e.notes}` : ''}</p>
                      </div>
                      <p className="font-bold text-sm text-rose-700 ml-3 flex-shrink-0">{formatMoney(e.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
              <h2 className="text-2xl sm:text-3xl font-bold">Welcome, {user?.first_name}!</h2>
              <p className="text-emerald-100 mt-2">You manage {properties.length} propert{properties.length === 1 ? 'y' : 'ies'}.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Properties', value: properties.length },
                { label: 'Applications', value: applicants.length },
                { label: 'Residents', value: myTenants.filter((t) => t.status === 'Active').length },
                { label: 'Expenses logged', value: myExpenses.length },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-emerald-700">{s.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform md:translate-x-0 md:static ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <NeelaLogo variant="mark" size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">Property Manager</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setMobileOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${activeTab === id ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
              <Icon className="w-5 h-5" /> {label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 text-sm font-semibold">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b px-4 py-3 flex items-center gap-3 md:hidden sticky top-0 z-40">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-slate-100">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <NeelaLogo variant="mark" size="sm" />
          <span className="font-bold text-slate-800 text-sm truncate">Property Manager</span>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">{renderContent()}</main>
      </div>
    </div>
  );
};

export default PropertyManagerView;
