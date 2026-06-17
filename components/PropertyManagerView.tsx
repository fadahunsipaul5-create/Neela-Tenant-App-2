import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, CreditCard, Receipt, LogOut, Menu, X, Home, Plus,
} from 'lucide-react';
import NeelaLogo from './NeelaLogo';
import { isAuthenticated, getCurrentUser, logout } from '../services/auth';
import { api } from '../services/api';
import { Property, Tenant, Payment, OperatingExpense } from '../types';

const formatMoney = (v: number) =>
  `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Tab = 'overview' | 'properties' | 'applications' | 'payments' | 'expenses';

const EXPENSE_CATEGORIES: { value: OperatingExpense['category']; label: string }[] = [
  { value: 'maintenance', label: 'Repairs & Maintenance' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'advertising', label: 'Advertising / Leasing' },
  { value: 'legal', label: 'Legal & Professional' },
  { value: 'supplies', label: 'Supplies & Materials' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'other', label: 'Other' },
];

const PropertyManagerView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [managedIds, setManagedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    property: '',
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
        const [meRes, props, t, p, ex] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:8000')}/api/manager/me/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          }).then((r) => r.json()),
          api.getProperties(),
          api.getTenants(),
          api.getPayments(),
          api.getOperatingExpenses(),
        ]);
        const ids = (meRes.managed_property_ids || []).map(String);
        setManagedIds(ids);
        setProperties(props.filter((pr) => ids.includes(pr.id)));
        setTenants(t);
        setPayments(p);
        setExpenses(ex);
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

  const myPayments = useMemo(() => {
    const tenantIds = new Set(myTenants.map((t) => t.id));
    return payments.filter((p) => tenantIds.has(p.tenantId));
  }, [payments, myTenants]);

  const handleLogout = () => {
    logout();
    navigate('/manager/login', { replace: true });
  };

  const addExpense = async () => {
    if (!expenseForm.amount || !expenseForm.property) return;
    setSaving(true);
    try {
      await api.createOperatingExpense({
        property: expenseForm.property,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        date: expenseForm.date,
        notes: expenseForm.notes,
        visibility: 'operating',
      });
      const ex = await api.getOperatingExpenses();
      setExpenses(ex);
      setExpenseForm((f) => ({ ...f, amount: '', notes: '' }));
    } finally {
      setSaving(false);
    }
  };

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'properties', label: 'My Properties', icon: Building2 },
    { id: 'applications', label: 'Applications', icon: Users },
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
              {applicants.length === 0 && <p className="text-slate-500 text-center py-12">No pending applications.</p>}
            </div>
          </div>
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
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Record Operating Expense</h2>
            <p className="text-sm text-slate-500">Expenses you add here appear on the admin income statement. Mortgage and financing details are admin-only.</p>
            <div className="bg-white rounded-2xl border p-5 space-y-4 max-w-xl">
              <select className="w-full border rounded-xl px-3 py-2.5" value={expenseForm.property} onChange={(e) => setExpenseForm((f) => ({ ...f, property: e.target.value }))}>
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="w-full border rounded-xl px-3 py-2.5" value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value as OperatingExpense['category'] }))}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="0" step="0.01" placeholder="Amount" className="border rounded-xl px-3 py-2.5" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} />
                <input type="date" className="border rounded-xl px-3 py-2.5" value={expenseForm.date} onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <input placeholder="Notes" className="w-full border rounded-xl px-3 py-2.5" value={expenseForm.notes} onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))} />
              <button disabled={saving || !expenseForm.amount || !expenseForm.property} onClick={addExpense} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50">
                <Plus className="w-4 h-4" /> {saving ? 'Saving…' : 'Add Expense'}
              </button>
            </div>
            <div className="space-y-2">
              {expenses.slice(0, 10).map((e) => (
                <div key={e.id} className="bg-white border rounded-xl p-3 flex justify-between">
                  <div>
                    <p className="font-medium text-sm">{e.propertyName} · {e.category}</p>
                    <p className="text-xs text-slate-500">{e.date}</p>
                  </div>
                  <p className="font-bold text-rose-700">{formatMoney(e.amount)}</p>
                </div>
              ))}
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
                { label: 'Expenses logged', value: expenses.length },
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
