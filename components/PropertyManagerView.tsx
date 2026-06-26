import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, CreditCard, Receipt, LogOut, Menu, X, Home, Plus,
  MapPin, Wallet, Calendar, FileText, Tag, Wrench, ChevronRight, AlertCircle,
  Sparkles, TrendingUp, Mail, Loader2, CheckCircle, XCircle, MessageSquare,
} from 'lucide-react';
import NeelaLogo from './NeelaLogo';
import MaintenanceView from './MaintenanceView';
import { isAuthenticated, getCurrentUser, logout } from '../services/auth';
import { api } from '../services/api';
import { Property, Tenant, Payment, OperatingExpense, MaintenanceRequest, TenantStatus } from '../types';
import {
  CATEGORY_LABELS,
  groupPropertiesForSelect,
  MANAGER_EXPENSE_CATEGORIES,
  resolvePropertyIdForExpense,
} from '../utils/propertyGrouping';
import { SEO_PAGES, usePageMeta } from '../utils/seo';

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
  headerClassName = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <div className={`rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/70 shadow-sm shadow-slate-200/40 overflow-hidden ${className}`}>
      <div className={`flex items-start sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white ${headerClassName}`}>
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

function PageHeader({
  title,
  subtitle,
  icon: Icon,
  accent = 'from-emerald-600 via-teal-600 to-cyan-700',
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br ${accent} text-white p-5 sm:p-7 shadow-lg shadow-emerald-900/10`}>
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl" aria-hidden />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/10 rounded-full blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-4">
        <div className="hidden sm:flex p-3 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 flex-shrink-0">
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-white/85 text-sm sm:text-base mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function TenantAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-800 font-bold text-sm flex-shrink-0 ring-2 ring-white shadow-sm">
      {initials || '?'}
    </div>
  );
}

function paymentStatusClass(status: string) {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
    case 'Overdue':
      return 'bg-rose-100 text-rose-800 ring-rose-200';
    case 'Pending':
      return 'bg-amber-100 text-amber-800 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function EmptyState({ message, icon: Icon }: { message: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-4 rounded-2xl bg-slate-100/80 text-slate-400 mb-3">
        <Icon className="w-8 h-8" />
      </div>
      <p className="text-sm text-slate-500 font-medium max-w-xs">{message}</p>
    </div>
  );
}

const PropertyManagerView: React.FC = () => {
  const navigate = useNavigate();
  usePageMeta(SEO_PAGES.managerPortal);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [noticeSending, setNoticeSending] = useState<string | null>(null);
  const [noticeFeedback, setNoticeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expenseSuccessPopup, setExpenseSuccessPopup] = useState<OperatingExpense | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [messageTenant, setMessageTenant] = useState<Tenant | null>(null);
  const [messageText, setMessageText] = useState('');
  const [markPaidTarget, setMarkPaidTarget] = useState<{ payment?: Payment; tenant: Tenant } | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<'Cash' | 'Zelle' | 'Check' | 'Money Order'>('Cash');
  const [markPaidReference, setMarkPaidReference] = useState('');
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
          api.getManagerMe(),
          api.getProperties(),
          api.getTenants(),
          api.getPayments(),
          api.getOperatingExpenses({ year, limit: 100 }),
          api.getMaintenanceRequests(),
        ]);
        setManagedIds(meRes.managed_property_ids);
        // Backend already scopes lists for property managers; avoid double-filtering to empty.
        setProperties(props);
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

  // Tenant/payment/maintenance lists are already scoped by the backend for property managers.
  const myTenants = tenants;

  const applicants = useMemo(() => myTenants.filter((t) => t.status === 'Applicant'), [myTenants]);
  const approvedTenants = useMemo(() => myTenants.filter((t) => t.status === TenantStatus.APPROVED), [myTenants]);
  const residents = useMemo(() => myTenants.filter((t) => t.status === 'Active'), [myTenants]);

  const refreshMaintenance = useCallback(async () => {
    try {
      const data = await api.getMaintenanceRequests();
      setMaintenance(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshTenants = useCallback(async () => {
    try {
      const data = await api.getTenants();
      setTenants(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshPayments = useCallback(async () => {
    try {
      const data = await api.getPayments();
      setPayments(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const showActionFeedback = (type: 'success' | 'error', text: string) => {
    setNoticeFeedback({ type, text });
  };

  const handleTenantStatus = async (tenant: Tenant, newStatus: TenantStatus) => {
    const key = `status-${tenant.id}-${newStatus}`;
    setActionLoading(key);
    setNoticeFeedback(null);
    try {
      await api.updateTenant(tenant.id, { status: newStatus });
      await refreshTenants();
      showActionFeedback('success', `${tenant.name} updated to ${newStatus}.`);
    } catch (e: unknown) {
      showActionFeedback('error', e instanceof Error ? e.message : 'Could not update tenant.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTenantMessage = async () => {
    if (!messageTenant || !messageText.trim()) return;
    const key = `msg-${messageTenant.id}`;
    setActionLoading(key);
    try {
      const res = await api.sendTenantMessage(messageTenant.id, messageText.trim());
      showActionFeedback('success', res.message || 'Message sent.');
      setMessageTenant(null);
      setMessageText('');
    } catch (e: unknown) {
      showActionFeedback('error', e instanceof Error ? e.message : 'Could not send message.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return;
    const key = `paid-${markPaidTarget.tenant.id}`;
    setActionLoading(key);
    try {
      if (markPaidTarget.payment) {
        await api.markPaymentReceived(markPaidTarget.payment.id, markPaidMethod, markPaidReference || undefined);
      } else {
        await api.recordTenantPayment({
          tenantId: markPaidTarget.tenant.id,
          amount: markPaidTarget.tenant.rentAmount || markPaidTarget.tenant.balance || 0,
          method: markPaidMethod,
          reference: markPaidReference || undefined,
        });
      }
      await Promise.all([refreshPayments(), refreshTenants()]);
      showActionFeedback('success', `Payment recorded for ${markPaidTarget.tenant.name}.`);
      setMarkPaidTarget(null);
      setMarkPaidReference('');
      setMarkPaidMethod('Cash');
    } catch (e: unknown) {
      showActionFeedback('error', e instanceof Error ? e.message : 'Could not record payment.');
    } finally {
      setActionLoading(null);
    }
  };

  const myPayments = payments;

  const delinquentResidents = useMemo(() => {
    return residents.filter((t) => {
      const hasBalance = (t.balance || 0) > 0;
      const hasOpenRent = myPayments.some(
        (p) => p.tenantId === t.id && p.type === 'Rent' && p.status !== 'Paid',
      );
      return hasBalance || hasOpenRent;
    });
  }, [residents, myPayments]);

  const latestOpenRentPayment = useCallback(
    (tenantId: string) =>
      myPayments
        .filter((p) => p.tenantId === tenantId && p.type === 'Rent' && p.status !== 'Paid')
        .sort((a, b) => b.date.localeCompare(a.date))[0],
    [myPayments],
  );

  const handleSendRentReminder = async (tenant: Tenant) => {
    const payment = latestOpenRentPayment(tenant.id);
    const key = `reminder-${tenant.id}`;
    setNoticeSending(key);
    setNoticeFeedback(null);
    try {
      if (payment) {
        const res = await api.sendPaymentReminder(payment.id);
        setNoticeFeedback({ type: 'success', text: res.message || `Reminder sent to ${tenant.name}.` });
      } else {
        const res = await api.sendTenantRentNotice(tenant.id, 'Rent Reminder');
        setNoticeFeedback({ type: 'success', text: res.message || `Rent reminder sent to ${tenant.name}.` });
      }
    } catch (e: unknown) {
      setNoticeFeedback({
        type: 'error',
        text: e instanceof Error ? e.message : 'Could not send rent reminder.',
      });
    } finally {
      setNoticeSending(null);
    }
  };

  const handleSendLateNotice = async (tenant: Tenant) => {
    const key = `late-${tenant.id}`;
    setNoticeSending(key);
    setNoticeFeedback(null);
    try {
      const res = await api.sendTenantRentNotice(tenant.id, 'Notice of Late Rent');
      setNoticeFeedback({ type: 'success', text: res.message || `Late notice sent to ${tenant.name}.` });
    } catch (e: unknown) {
      setNoticeFeedback({
        type: 'error',
        text: e instanceof Error ? e.message : 'Could not send late notice.',
      });
    } finally {
      setNoticeSending(null);
    }
  };

  const myMaintenance = maintenance;

  const openMaintenanceCount = useMemo(
    () => myMaintenance.filter((m) => m.status !== 'Resolved').length,
    [myMaintenance],
  );

  const propertyGroups = useMemo(() => groupPropertiesForSelect(properties), [properties]);

  const selectedGroup = useMemo(
    () => propertyGroups.find((g) => g.groupKey === expenseForm.groupKey),
    [propertyGroups, expenseForm.groupKey],
  );

  /** Manager-entered costs only — hide Excel P&L import rows from this portal. */
  const managerRecordedExpenses = useMemo(
    () => expenses.filter((e) => !e.notes?.startsWith('excel-import-')),
    [expenses],
  );

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthExpenseTotal = useMemo(
    () => managerRecordedExpenses
      .filter((e) => e.date?.startsWith(currentMonthKey))
      .reduce((sum, e) => sum + (e.amount || 0), 0),
    [managerRecordedExpenses, currentMonthKey],
  );

  const refreshExpenses = useCallback(async () => {
    const year = new Date().getFullYear();
    const data = await api.getOperatingExpenses({ year, limit: 100 });
    setExpenses(data);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/manager/login', { replace: true });
  };

  const addExpense = async () => {
    if (!expenseForm.amount || !expenseForm.groupKey) {
      showActionFeedback('error', 'Select a property and enter an amount.');
      return;
    }
    const propertyId = resolvePropertyIdForExpense(
      propertyGroups,
      expenseForm.groupKey,
      expenseForm.unitLabel,
    );
    if (!propertyId) {
      showActionFeedback('error', 'Could not match that property. Pick a unit if the building has several.');
      return;
    }
    setSaving(true);
    setNoticeFeedback(null);
    try {
      const created = await api.createOperatingExpense({
        property: propertyId,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        date: expenseForm.date,
        notes: expenseForm.notes,
        visibility: 'operating',
      });
      setExpenses((prev) => {
        const withoutDup = prev.filter((e) => e.id !== created.id);
        return [created, ...withoutDup];
      });
      setExpenseForm((f) => ({ ...f, amount: '', notes: '' }));
      setExpenseSuccessPopup(created);
      showActionFeedback(
        'success',
        `Expense recorded — ${formatMoney(created.amount)} for ${created.propertyName || 'property'}${created.unitLabel ? ` · ${created.unitLabel}` : ''}.`,
      );
      void refreshExpenses();
    } catch (e: unknown) {
      showActionFeedback('error', e instanceof Error ? e.message : 'Could not record expense.');
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
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <PageHeader
              icon={Building2}
              title="My Properties"
              subtitle={`${properties.length} assigned propert${properties.length === 1 ? 'y' : 'ies'} under your management`}
              accent="from-teal-600 via-emerald-600 to-cyan-700"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="group rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/70 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-200/60 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="relative h-44 sm:h-48 overflow-hidden bg-slate-200">
                    <img
                      src={p.image || FALLBACK_PROPERTY_IMAGE}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/15 to-transparent" />
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/90 text-white backdrop-blur-sm capitalize shadow-lg">
                      {p.status || 'active'}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-800 transition-colors">{p.name}</h3>
                    <p className="text-sm text-slate-500 flex items-start gap-1.5 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                      {p.address}, {p.city}
                    </p>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                        <Home className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">
                        {p.units} unit{p.units === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {properties.length === 0 && (
                <div className="col-span-full">
                  <SectionCard title="No properties yet">
                    <EmptyState icon={Building2} message="No properties assigned yet. Contact admin to get buildings linked to your account." />
                  </SectionCard>
                </div>
              )}
            </div>
          </div>
        );
      case 'applications':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <PageHeader
              icon={Users}
              title="Tenants & Leases"
              subtitle={`${applicants.length} pending application${applicants.length === 1 ? '' : 's'} · ${residents.length} active resident${residents.length === 1 ? '' : 's'}`}
              accent="from-violet-600 via-indigo-600 to-blue-700"
            />

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <ManagerStatCard label="Applications" value={applicants.length} icon={FileText} accent="from-amber-500 to-orange-500" onClick={() => {}} />
              <ManagerStatCard label="Residents" value={residents.length} icon={Users} accent="from-emerald-500 to-teal-600" onClick={() => {}} />
            </div>

            <SectionCard
              title="Tenant Applications"
              subtitle="Review new applicants for your properties"
              headerClassName="from-amber-50/80 to-white"
            >
              {applicants.length === 0 ? (
                <EmptyState icon={FileText} message="No pending applications right now." />
              ) : (
                <div className="space-y-3 -m-1">
                  {applicants.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-amber-50/30 p-4 hover:border-amber-200/80 hover:shadow-md hover:shadow-amber-500/5 transition-all duration-200"
                    >
                      <TenantAvatar name={t.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                        <p className="text-sm text-slate-500 truncate">{t.email}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0 text-amber-600" />
                          {t.propertyUnit}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => handleTenantStatus(t, TenantStatus.APPROVED)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {actionLoading === `status-${t.id}-${TenantStatus.APPROVED}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => handleTenantStatus(t, TenantStatus.DECLINED)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {actionLoading === `status-${t.id}-${TenantStatus.DECLINED}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {approvedTenants.length > 0 && (
              <SectionCard
                title="Approved — awaiting move-in"
                subtitle="Mark tenants active when they move in"
                headerClassName="from-blue-50/80 to-white"
              >
                <div className="space-y-3 -m-1">
                  {approvedTenants.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4"
                    >
                      <TenantAvatar name={t.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                        <p className="text-xs text-slate-500 truncate">{t.propertyUnit}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => handleTenantStatus(t, TenantStatus.ACTIVE)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading === `status-${t.id}-${TenantStatus.ACTIVE}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Move in (Active)
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard
              title="Active Residents"
              subtitle="Current tenants on your assigned properties"
              headerClassName="from-emerald-50/80 to-white"
            >
              {residents.length === 0 ? (
                <EmptyState icon={Users} message="No active residents on your properties yet." />
              ) : (
                <div className="space-y-3 -m-1">
                  {residents.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-emerald-50/30 p-4 hover:border-emerald-200/80 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-200"
                    >
                      <TenantAvatar name={t.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                        <p className="text-sm text-slate-500 truncate">{t.email}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                          {t.propertyUnit}
                        </p>
                        {(t.balance || 0) > 0 && (
                          <p className="text-xs font-semibold text-rose-600 mt-1">{formatMoney(t.balance)} due</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setMessageTenant(t); setMessageText(''); }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Message
                        </button>
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => handleTenantStatus(t, TenantStatus.PAST)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                        >
                          Move out
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        );
      case 'maintenance':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <PageHeader
              icon={Wrench}
              title="Maintenance"
              subtitle={`${openMaintenanceCount} open ticket${openMaintenanceCount === 1 ? '' : 's'} across your properties`}
              accent="from-amber-600 via-emerald-700 to-teal-700"
            />
            <div className="rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/70 shadow-sm overflow-hidden p-4 sm:p-6">
              <MaintenanceView
                requests={maintenance}
                tenants={myTenants}
                onMaintenanceChange={refreshMaintenance}
              />
            </div>
          </div>
        );
      case 'payments':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <PageHeader
              icon={CreditCard}
              title="Rent & Payments"
              subtitle="Follow up on overdue rent — send reminders or formal late notices by email"
              accent="from-emerald-600 via-teal-600 to-cyan-700"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <ManagerStatCard label="Overdue" value={delinquentResidents.length} icon={AlertCircle} accent="from-rose-500 to-pink-600" onClick={() => {}} />
              <ManagerStatCard label="Payments" value={myPayments.length} icon={CreditCard} accent="from-emerald-500 to-teal-600" onClick={() => {}} />
              <ManagerStatCard label="Collected" value={myPayments.filter((p) => p.status === 'Paid').length} icon={TrendingUp} accent="from-violet-500 to-indigo-600" onClick={() => {}} />
            </div>

            {noticeFeedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                  noticeFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {noticeFeedback.type === 'success' ? (
                  <TrendingUp className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {noticeFeedback.text}
              </div>
            )}

            <SectionCard
              title="Needs follow-up"
              subtitle="Tenants with balance due or unpaid rent"
              headerClassName="from-amber-50/90 to-orange-50/50"
            >
              {delinquentResidents.length === 0 ? (
                <EmptyState icon={CreditCard} message="No overdue rent on your properties — you're all caught up." />
              ) : (
                <div className="space-y-3 -m-1">
                  {delinquentResidents.map((tenant) => {
                    const openPayment = latestOpenRentPayment(tenant.id);
                    const reminderKey = `reminder-${tenant.id}`;
                    const lateKey = `late-${tenant.id}`;
                    return (
                      <div
                        key={tenant.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-100/80 bg-gradient-to-r from-white to-amber-50/40 p-4 hover:shadow-md hover:shadow-amber-500/5 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <TenantAvatar name={tenant.name} />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{tenant.name}</p>
                            <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {tenant.propertyUnit}
                            </p>
                            <p className="text-sm font-bold text-rose-700 mt-1">
                              {formatMoney(tenant.balance || 0)} due
                              {openPayment ? (
                                <span className="font-medium text-slate-500 text-xs ml-1">
                                  · {openPayment.status} {formatMoney(openPayment.amount)}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0 sm:pl-2">
                          <button
                            type="button"
                            disabled={!!actionLoading}
                            onClick={() => {
                              setMarkPaidTarget({ payment: openPayment, tenant });
                              setMarkPaidMethod('Cash');
                              setMarkPaidReference('');
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark paid
                          </button>
                          <button
                            type="button"
                            disabled={!!noticeSending}
                            onClick={() => handleSendRentReminder(tenant)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-md shadow-emerald-600/20 transition-all"
                          >
                            {noticeSending === reminderKey ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                            Rent reminder
                          </button>
                          <button
                            type="button"
                            disabled={!!noticeSending}
                            onClick={() => handleSendLateNotice(tenant)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 shadow-md shadow-amber-500/20 transition-all"
                          >
                            {noticeSending === lateKey ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            Late notice
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Recent payments" subtitle="Latest rent and fee activity">
              {myPayments.length === 0 ? (
                <EmptyState icon={CreditCard} message="No payments recorded yet." />
              ) : (
                <div className="divide-y divide-slate-100 -mx-1 rounded-xl overflow-hidden border border-slate-100">
                  {myPayments.slice(0, 20).map((p) => {
                    const tenant = myTenants.find((t) => t.id === p.tenantId);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white hover:bg-emerald-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-800 truncate">{tenant?.name || 'Tenant'}</p>
                            <p className="text-xs text-slate-500">{p.date} · {p.type}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 space-y-1">
                          <p className="font-bold text-slate-900">{formatMoney(p.amount)}</p>
                          <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ring-1 ${paymentStatusClass(p.status)}`}>
                            {p.status}
                          </span>
                          {p.status !== 'Paid' && tenant && (
                            <button
                              type="button"
                              onClick={() => {
                                setMarkPaidTarget({ payment: p, tenant });
                                setMarkPaidMethod('Cash');
                                setMarkPaidReference('');
                              }}
                              className="block mt-2 text-[10px] font-semibold text-emerald-700 hover:text-emerald-900"
                            >
                              Mark paid
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        );
      case 'expenses':
        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-4xl">
            <PageHeader
              icon={Receipt}
              title="Record Expenses"
              subtitle="Log day-to-day operating costs — repairs, utilities, cleaning, and supplies for your properties"
              accent="from-violet-600 via-purple-600 to-indigo-700"
            />

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <ManagerStatCard label="This month" value={formatMoney(monthExpenseTotal)} icon={Receipt} accent="from-violet-500 to-indigo-600" onClick={() => {}} />
              <ManagerStatCard label="Recorded" value={managerRecordedExpenses.length} icon={TrendingUp} accent="from-teal-500 to-emerald-600" onClick={() => {}} />
            </div>

            {noticeFeedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                  noticeFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {noticeFeedback.type === 'success' ? (
                  <TrendingUp className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {noticeFeedback.text}
              </div>
            )}

            {propertyGroups.length > 0 && (
              <SectionCard title="Your properties" subtitle="Quick reference for expense assignment">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 -m-1">
                  {propertyGroups.map((group) => (
                    <div
                      key={group.groupKey}
                      className="flex gap-3 rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/80 p-3 hover:border-emerald-200/60 hover:shadow-sm transition-all"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 ring-2 ring-white shadow-sm">
                        <img
                          src={group.image || FALLBACK_PROPERTY_IMAGE}
                          alt={group.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <p className="font-bold text-sm text-slate-900 truncate">{group.label}</p>
                        {group.address && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                            {group.address}
                          </p>
                        )}
                        {group.units.length > 1 && (
                          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                            {group.units.length} units
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <div className="rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/70 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-5 sm:px-6 py-5 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" aria-hidden />
                <div className="relative flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/15 ring-1 ring-white/20">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">New expense</h3>
                    <p className="text-emerald-100 text-sm mt-0.5">Choose property, category, and amount</p>
                  </div>
                </div>
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
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/25 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {saving ? 'Recording…' : 'Record Expense'}
                </button>
              </div>
            </div>

            <SectionCard title="Recent expenses" subtitle="Your latest operating cost entries">
              {managerRecordedExpenses.length === 0 ? (
                <EmptyState icon={Receipt} message="No expenses recorded yet. Log your first one above." />
              ) : (
                <div className="space-y-2 -m-1">
                  {managerRecordedExpenses.slice(0, 15).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-violet-50/20 p-4 hover:border-violet-200/60 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-violet-100 text-violet-700 flex-shrink-0">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">
                            {e.propertyName || 'Property'}
                            {e.unitLabel ? ` · ${e.unitLabel}` : ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            {CATEGORY_LABELS[e.category] || e.category}
                            {e.notes ? ` · ${e.notes}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {e.date}
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-base text-rose-700 ml-3 flex-shrink-0 tabular-nums">{formatMoney(e.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        );
      default: {
        const overviewGroups = propertyGroups.slice(0, 4);
        const recentApplicants = applicants.slice(0, 3);
        const openTickets = myMaintenance.filter((m) => m.status !== 'Resolved').slice(0, 3);
        const recentPayments = myPayments.slice(0, 5);

        return (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 text-white p-6 sm:p-8 lg:p-10 shadow-2xl shadow-emerald-900/20">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80')] opacity-15 bg-cover bg-center" />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-300/15 rounded-full blur-3xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  Will&apos;s Manager Portal
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Welcome Will
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
              <ManagerStatCard label="Expenses (month)" value={formatMoney(monthExpenseTotal)} icon={Receipt} accent="from-violet-500 to-indigo-600" onClick={() => setActiveTab('expenses')} />
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

            <SectionCard
              title="Recent Expenses"
              action={
                <button type="button" onClick={() => setActiveTab('expenses')} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  View all
                </button>
              }
            >
              {managerRecordedExpenses.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No expenses recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 -mx-1 rounded-xl overflow-hidden border border-slate-100">
                  {managerRecordedExpenses.slice(0, 5).map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-3.5 bg-white hover:bg-violet-50/30 transition-colors text-sm">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-4 h-4 text-violet-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">
                            {e.propertyName || 'Property'}
                            {e.unitLabel ? ` · ${e.unitLabel}` : ''}
                          </p>
                          <p className="text-xs text-slate-500">{CATEGORY_LABELS[e.category] || e.category} · {e.date}</p>
                        </div>
                      </div>
                      <p className="font-bold text-rose-700 flex-shrink-0 ml-3">{formatMoney(e.amount)}</p>
                    </div>
                  ))}
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
          {noticeFeedback && activeTab !== 'expenses' && activeTab !== 'payments' && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                noticeFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {noticeFeedback.type === 'success' ? (
                <TrendingUp className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {noticeFeedback.text}
            </div>
          )}
          {renderContent()}
        </main>
      </div>

      {messageTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900">Message {messageTenant.name}</h3>
            <p className="text-xs text-slate-500 mt-1">Sent by email to {messageTenant.email}</p>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={5}
              placeholder="Move-in instructions, parking, keys, rent follow-up..."
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button type="button" onClick={() => setMessageTenant(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancel
              </button>
              <button
                type="button"
                disabled={!messageText.trim() || !!actionLoading}
                onClick={handleSendTenantMessage}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading === `msg-${messageTenant.id}` ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {markPaidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900">Mark rent received</h3>
            <p className="text-sm text-slate-500 mt-1">{markPaidTarget.tenant.name}</p>
            <label className="block mt-4 text-xs font-semibold text-slate-600">Payment method</label>
            <select
              value={markPaidMethod}
              onChange={(e) => setMarkPaidMethod(e.target.value as typeof markPaidMethod)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            >
              <option value="Cash">Cash</option>
              <option value="Zelle">Zelle</option>
              <option value="Check">Check</option>
              <option value="Money Order">Money Order</option>
            </select>
            <label className="block mt-3 text-xs font-semibold text-slate-600">Reference (optional)</label>
            <input
              value={markPaidReference}
              onChange={(e) => setMarkPaidReference(e.target.value)}
              placeholder="Check #, Zelle memo..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button type="button" onClick={() => setMarkPaidTarget(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancel
              </button>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={handleMarkPaid}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm paid
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseSuccessPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-emerald-100 p-6 text-center animate-fade-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Expense recorded</h3>
            <p className="text-2xl font-bold text-rose-700 mt-2">{formatMoney(expenseSuccessPopup.amount)}</p>
            <p className="text-sm text-slate-600 mt-2">
              {expenseSuccessPopup.propertyName || 'Property'}
              {expenseSuccessPopup.unitLabel ? ` · ${expenseSuccessPopup.unitLabel}` : ''}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {CATEGORY_LABELS[expenseSuccessPopup.category] || expenseSuccessPopup.category} · {expenseSuccessPopup.date}
            </p>
            <p className="text-xs text-emerald-700 mt-3 font-medium">Synced to admin income statement &amp; monthly totals</p>
            <button
              type="button"
              onClick={() => setExpenseSuccessPopup(null)}
              className="mt-5 w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyManagerView;
