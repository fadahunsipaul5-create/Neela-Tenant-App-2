import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, CreditCard, Receipt, LogOut, Menu, X, Home, Plus,
  MapPin, Wallet, Calendar, FileText, Tag, Wrench, ChevronRight, AlertCircle,
  Sparkles, TrendingUp,
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

function ManagerStatCard({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-sm border border-slate-200/70 p-4 sm:p-5 text-left shadow-sm shadow-slate-200/50 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-200/80 hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className={`absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br ${accent} opacity-[0.12] rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
      <div className={`relative inline-flex p-2.5 rounded-xl bg-gradient-to-br ${accent} text-white shadow-lg shadow-emerald-500/20 mb-3`}>
        <Icon className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" />
      </div>
      <p className="relative text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="relative text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{label}</p>
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/70 shadow-sm shadow-slate-200/40 overflow-hidden ${className}`}>
      <div className="flex items-start sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

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

  const myMaintenance = useMemo(() => {
    const tenantIds = new Set(myTenants.map((t) => t.id));
    return maintenance.filter((m) => tenantIds.has(m.tenantId));
  }, [maintenance, myTenants]);

  const openMaintenanceCount = useMemo(
    () => myMaintenance.filter((m) => m.status !== 'Resolved').length,
    [myMaintenance],
  );

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/30">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 opacity-20 animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'properties':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="pb-1 border-b border-slate-200/60">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-800 bg-clip-text text-transparent tracking-tight">
                My Properties
              </h2>
              <p className="text-sm text-slate-500 mt-1">{properties.length} assigned propert{properties.length === 1 ? 'y' : 'ies'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="group rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/70 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-200/60 transition-all duration-300"
                >
                  <div className="relative h-44 sm:h-48 overflow-hidden bg-slate-200">
                    <img
                      src={p.image || FALLBACK_PROPERTY_IMAGE}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
                    <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/90 text-slate-800 backdrop-blur-sm capitalize">
                      {p.status || 'active'}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-slate-900">{p.name}</h3>
                    <p className="text-sm text-slate-500 flex items-start gap-1.5 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                      {p.address}, {p.city}
                    </p>
                    <p className="text-sm mt-3 font-semibold text-emerald-700">
                      {p.units} unit{p.units === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              ))}
              {properties.length === 0 && (
                <p className="text-slate-500 col-span-full text-center py-16 bg-white/60 rounded-2xl border border-dashed border-slate-200">
                  No properties assigned yet.
                </p>
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
            <div className="pb-1 border-b border-slate-200/60 mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Record Expenses</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Log day-to-day operating costs for your assigned properties — repairs, utilities, cleaning, supplies, and similar.
                Portfolio profit &amp; loss is admin-only; your entries here feed those property books.
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
      default: {
        const overviewGroups = propertyGroups.slice(0, 4);
        const recentApplicants = applicants.slice(0, 3);
        const openTickets = myMaintenance.filter((m) => m.status !== 'Resolved').slice(0, 3);
        const recentPayments = myPayments.slice(0, 5);
        const greeting = user?.first_name || 'there';

        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 text-white p-6 sm:p-8 lg:p-10 shadow-2xl shadow-emerald-900/20">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80')] opacity-15 bg-cover bg-center" />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-300/15 rounded-full blur-3xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  Manager Portal
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Good to see you, {greeting}
                </h2>
                <p className="text-emerald-100/90 mt-2 sm:mt-3 max-w-xl text-sm sm:text-base leading-relaxed">
                  You oversee {properties.length} propert{properties.length === 1 ? 'y' : 'ies'}
                  {residents.length > 0 ? ` and ${residents.length} active resident${residents.length === 1 ? '' : 's'}` : ''}.
                  Here&apos;s what needs your attention today.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <ManagerStatCard label="Properties" value={properties.length} icon={Building2} accent="from-teal-500 to-emerald-600" onClick={() => setActiveTab('properties')} />
              <ManagerStatCard label="Applications" value={applicants.length} icon={FileText} accent="from-amber-500 to-orange-500" onClick={() => setActiveTab('applications')} />
              <ManagerStatCard label="Residents" value={residents.length} icon={Users} accent="from-emerald-500 to-teal-600" onClick={() => setActiveTab('applications')} />
              <ManagerStatCard label="Open Tickets" value={openMaintenanceCount} icon={Wrench} accent="from-rose-500 to-pink-600" onClick={() => setActiveTab('maintenance')} />
              <ManagerStatCard label="Expenses" value={myExpenses.length} icon={Receipt} accent="from-violet-500 to-indigo-600" onClick={() => setActiveTab('expenses')} />
            </div>

            <SectionCard
              title="Your Properties"
              subtitle="Assigned buildings and units"
              action={
                properties.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('properties')}
                    className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 shrink-0"
                  >
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                ) : undefined
              }
            >
              {overviewGroups.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No properties assigned yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 -m-1">
                  {overviewGroups.map((group) => (
                    <div
                      key={group.groupKey}
                      className="group flex gap-0 rounded-2xl border border-slate-100 overflow-hidden bg-slate-50/50 hover:shadow-lg hover:border-emerald-200/60 transition-all duration-300"
                    >
                      <div className="w-[38%] sm:w-[34%] flex-shrink-0 overflow-hidden bg-slate-200">
                        <img
                          src={group.image || FALLBACK_PROPERTY_IMAGE}
                          alt={group.label}
                          className="w-full h-full min-h-[6.5rem] object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="py-3.5 px-3.5 sm:px-4 min-w-0 flex-1 flex flex-col justify-center">
                        <p className="font-bold text-slate-900 truncate text-sm sm:text-base">{group.label}</p>
                        {group.address && (
                          <p className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                            {group.address}
                          </p>
                        )}
                        <p className="text-[11px] sm:text-xs text-emerald-700 font-semibold mt-2">
                          {group.units.length > 1
                            ? `${group.units.length} units`
                            : (properties.find((p) => p.id === group.propertyId)?.status || 'Active')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              <SectionCard
                title="Pending Applications"
                action={
                  <button type="button" onClick={() => setActiveTab('applications')} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                    View all
                  </button>
                }
              >
                {recentApplicants.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No pending applications.</p>
                ) : (
                  <div className="space-y-2.5 -m-1">
                    {recentApplicants.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3.5 hover:border-amber-200/80 transition-colors">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{t.name}</p>
                          <p className="text-xs text-slate-500 truncate">{t.propertyUnit}</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 flex-shrink-0">
                          Applicant
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Maintenance"
                action={
                  <button type="button" onClick={() => setActiveTab('maintenance')} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                    View all
                  </button>
                }
              >
                {openTickets.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No open maintenance requests.</p>
                ) : (
                  <div className="space-y-2.5 -m-1">
                    {openTickets.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3.5 hover:border-rose-200/80 transition-colors">
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-slate-800 truncate">{m.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{m.status} · {m.priority}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Recent Payments"
              action={
                <button type="button" onClick={() => setActiveTab('payments')} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  View all
                </button>
              }
            >
              {recentPayments.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No payments recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 -mx-1 rounded-xl overflow-hidden border border-slate-100">
                  {recentPayments.map((p) => {
                    const tenant = myTenants.find((t) => t.id === p.tenantId);
                    return (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3.5 bg-white hover:bg-emerald-50/30 transition-colors text-sm">
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{tenant?.name || 'Tenant'}</p>
                            <p className="text-xs text-slate-500">{p.date}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-bold text-emerald-700">{formatMoney(p.amount)}</p>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">{p.status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        );
      }
    }
  };

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label ?? 'Overview';

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(85vw,17.5rem)] flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white shadow-2xl shadow-black/30 border-r border-slate-800/50 transform transition-transform duration-300 ease-out md:translate-x-0 md:static md:inset-auto md:w-64 lg:w-72 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="manager-sidebar-logo flex flex-col items-center justify-center min-h-[4.75rem] px-4 py-5 border-b border-white/5">
          <NeelaLogo variant="full" size="sm" showGlow className="shrink-0" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/90 mt-3">
            Property Manager
          </p>
        </div>

        <div className="px-4 py-4 border-b border-slate-800/60">
          <p className="text-sm font-semibold text-white truncate">{user?.first_name} {user?.last_name}</p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
        </div>

        <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setActiveTab(id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 sm:p-4 border-t border-slate-800/60 bg-slate-950/40">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800/70 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="manager-mobile-header md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/70 px-3 py-2.5 sm:px-4 shadow-sm shadow-slate-200/40">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-700 flex-shrink-0"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <NeelaLogo variant="full" size="sm" className="shrink-0 min-w-0" />
            <div className="min-w-0 flex-1 text-right sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 truncate">
                {activeNavLabel}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default PropertyManagerView;
