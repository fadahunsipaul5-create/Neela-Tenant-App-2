import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Property, ShortStayBooking, ShortStayBookingStatus } from '../types';
import { api } from '../services/api';
import {
  Loader2, Calendar, Users, CheckCircle, XCircle, Clock, Bell, AlertTriangle,
  DollarSign, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Eye, Download,
  Ban, RefreshCw, X, Filter, Home, Trash2
} from 'lucide-react';

type TabId = 'requests' | 'calendar' | 'pricing';

const STATUS_LABEL: Record<ShortStayBookingStatus, string> = {
  pending_payment: 'Pending',
  proof_submitted: 'Paid',
  confirmed: 'Approved',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<ShortStayBookingStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-800',
  proof_submitted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

const STATUS_FILTERS: { id: 'all' | ShortStayBookingStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_payment', label: 'Pending' },
  { id: 'proof_submitted', label: 'Paid' },
  { id: 'confirmed', label: 'Approved' },
  { id: 'cancelled', label: 'Cancelled' },
];

function isDateInRange(dateStr: string, start: string, end: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  return d >= s && d < e;
}

function formatDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const AdminCalendar: React.FC<{
  month: Date;
  onMonthChange: (d: Date) => void;
  bookings: { checkIn: string; checkOut: string; status: string; guestName?: string }[];
  blocked: { startDate: string; endDate: string; reason?: string }[];
}> = ({ month, onMonthChange, bookings, blocked }) => {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const startPad = firstDay.getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  const getDayState = (dateStr: string) => {
    const block = blocked.find((b) => isDateInRange(dateStr, b.startDate, b.endDate));
    if (block) return { type: 'blocked' as const, label: block.reason || 'Blocked' };
    const booking = bookings.find((b) => isDateInRange(dateStr, b.checkIn, b.checkOut));
    if (booking) return { type: 'booked' as const, label: booking.guestName || booking.status };
    return { type: 'free' as const, label: '' };
  };

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startPad; i++) cells.push(<div key={`pad-${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const state = getDayState(dateStr);
    cells.push(
      <div
        key={dateStr}
        title={state.label}
        className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium border ${
          state.type === 'blocked' ? 'bg-slate-200 border-slate-400 text-slate-700' :
          state.type === 'booked' ? 'bg-rose-100 border-rose-300 text-rose-800' :
          'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}
      >
        <span>{day}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => onMonthChange(new Date(year, m - 1, 1))} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h4 className="font-bold text-slate-800">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h4>
        <button type="button" onClick={() => onMonthChange(new Date(year, m + 1, 1))} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-300" /> Booked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 border border-slate-400" /> Blocked</span>
      </div>
    </div>
  );
};

const ShortStaysView: React.FC = () => {
  const [tab, setTab] = useState<TabId>('requests');
  const [bookings, setBookings] = useState<ShortStayBooking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ShortStayBookingStatus>('all');
  const [selectedBooking, setSelectedBooking] = useState<ShortStayBooking | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const [calendarPropertyId, setCalendarPropertyId] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarBookings, setCalendarBookings] = useState<{ checkIn: string; checkOut: string; status: string; guestName?: string }[]>([]);
  const [calendarBlocked, setCalendarBlocked] = useState<{ id: number; startDate: string; endDate: string; reason: string }[]>([]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  const [pricingEdits, setPricingEdits] = useState<Record<string, Partial<Property>>>({});
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [bookingData, propertyData] = await Promise.all([
        api.getShortStayBookings(),
        api.getProperties(),
      ]);
      setBookings(bookingData);
      setProperties(propertyData);
      if (!calendarPropertyId && propertyData.length > 0) {
        setCalendarPropertyId(propertyData[0].id);
      }
    } catch (e) {
      console.error(e);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [calendarPropertyId]);

  useEffect(() => { load(); }, [load]);

  const loadCalendar = useCallback(async () => {
    if (!calendarPropertyId) return;
    try {
      const data = await api.getShortStayBookedDates(calendarPropertyId);
      setCalendarBookings(data.bookings);
      setCalendarBlocked(data.blocked);
    } catch {
      setCalendarBookings([]);
      setCalendarBlocked([]);
    }
  }, [calendarPropertyId]);

  useEffect(() => {
    if (tab === 'calendar') loadCalendar();
  }, [tab, loadCalendar]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'all') return bookings;
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const notifications = useMemo(() => {
    const items: { id: string; type: 'new' | 'paid' | 'conflict'; title: string; subtitle: string; bookingId?: string }[] = [];
    bookings.filter((b) => b.status === 'proof_submitted').forEach((b) => {
      items.push({ id: `paid-${b.id}`, type: 'paid', title: 'Payment proof uploaded', subtitle: `${b.guestName} — ${b.propertyName}`, bookingId: b.id });
    });
    bookings.filter((b) => b.status === 'pending_payment').forEach((b) => {
      items.push({ id: `pending-${b.id}`, type: 'new', title: 'New booking request', subtitle: `${b.guestName} — ${formatDate(b.checkIn)}`, bookingId: b.id });
    });
    const active = bookings.filter((b) => ['pending_payment', 'proof_submitted', 'confirmed'].includes(b.status));
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (a.property !== b.property) continue;
        if (a.checkIn < b.checkOut && a.checkOut > b.checkIn) {
          items.push({
            id: `conflict-${a.id}-${b.id}`,
            type: 'conflict',
            title: 'Date conflict detected',
            subtitle: `${a.propertyName}: ${a.guestName} overlaps ${b.guestName}`,
          });
        }
      }
    }
    return items;
  }, [bookings]);

  const stats = useMemo(() => ({
    pending: bookings.filter((b) => b.status === 'pending_payment').length,
    paid: bookings.filter((b) => b.status === 'proof_submitted').length,
    approved: bookings.filter((b) => b.status === 'confirmed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  }), [bookings]);

  const mergeBookingUpdate = (prev: ShortStayBooking, patch: Partial<ShortStayBooking> & { id: string }): ShortStayBooking => ({
    ...prev,
    status: patch.status ?? prev.status,
    accessPin: patch.accessPin !== undefined ? patch.accessPin : prev.accessPin,
    notes: patch.notes !== undefined ? patch.notes : prev.notes,
  });

  const updateStatus = async (id: string, status: ShortStayBookingStatus, notes?: string) => {
    setUpdatingId(id);
    setActionError(null);
    try {
      const patch = await api.updateShortStayBooking(id, { status, ...(notes ? { notes } : {}) });
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? mergeBookingUpdate(b, patch) : b))
      );
      if (selectedBooking?.id === id) {
        setSelectedBooking((prev) => (prev ? mergeBookingUpdate(prev, patch) : prev));
      }
      if (tab === 'calendar') loadCalendar();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBlockDates = async () => {
    if (!calendarPropertyId || !blockStart || !blockEnd) return;
    setBlocking(true);
    setActionError(null);
    try {
      await api.createShortStayBlock({
        propertyId: calendarPropertyId,
        startDate: blockStart,
        endDate: blockEnd,
        reason: blockReason,
      });
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      await loadCalendar();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to block dates');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (id: number) => {
    try {
      await api.deleteShortStayBlock(String(id));
      await loadCalendar();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to unblock');
    }
  };

  const getPropertyEdit = (p: Property) => pricingEdits[p.id] || {};

  const savePropertyPricing = async (p: Property) => {
    const edits = getPropertyEdit(p);
    setSavingPropertyId(p.id);
    setActionError(null);
    try {
      await api.updateProperty(p.id, {
        shortStayEnabled: edits.shortStayEnabled ?? p.shortStayEnabled,
        shortStayNightlyRate: edits.shortStayNightlyRate ?? p.shortStayNightlyRate ?? p.effectiveNightlyRate,
        shortStayCleaningFee: edits.shortStayCleaningFee ?? p.shortStayCleaningFee ?? 75,
        shortStayMaxGuests: edits.shortStayMaxGuests ?? p.shortStayMaxGuests ?? p.effectiveMaxGuests,
        shortStayCheckInTime: edits.shortStayCheckInTime ?? p.shortStayCheckInTime,
        shortStayCheckOutTime: edits.shortStayCheckOutTime ?? p.shortStayCheckOutTime,
      });
      setPricingEdits((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to save pricing');
    } finally {
      setSavingPropertyId(null);
    }
  };

  const toggleAvailability = async (p: Property) => {
    const next = !(getPropertyEdit(p).shortStayEnabled ?? p.shortStayEnabled !== false);
    setPricingEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], shortStayEnabled: next } }));
    setSavingPropertyId(p.id);
    try {
      await api.updateProperty(p.id, { shortStayEnabled: next });
      await load();
      setPricingEdits((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update availability');
    } finally {
      setSavingPropertyId(null);
    }
  };

  const openBooking = (b: ShortStayBooking) => {
    setSelectedBooking(b);
    setActionError(null);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'requests', label: 'Booking Requests' },
    { id: 'calendar', label: 'Calendar Manager' },
    { id: 'pricing', label: 'Pricing & Availability' },
  ];

  const renderBookingActions = (b: ShortStayBooking, compact = false) => (
    <div className={`flex ${compact ? 'flex-wrap' : 'justify-end'} gap-2`}>
      {(b.status === 'proof_submitted' || b.status === 'pending_payment') && (
        <button
          disabled={updatingId === b.id}
          onClick={() => updateStatus(b.id, 'confirmed')}
          className={`inline-flex items-center gap-1 ${compact ? 'flex-1 justify-center' : ''} px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50`}
        >
          {updatingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
          Approve
        </button>
      )}
      {b.status !== 'cancelled' && b.status !== 'confirmed' && (
        <button
          disabled={updatingId === b.id}
          onClick={() => updateStatus(b.id, 'cancelled')}
          className={`inline-flex items-center gap-1 ${compact ? 'flex-1 justify-center' : ''} px-2.5 py-1.5 border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50`}
        >
          <XCircle className="w-3 h-3" /> Reject
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Short Stays</h2>
          <p className="text-slate-500">Manage booking requests, calendar blocks, pricing, and payment proof.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load()} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" title="Refresh">
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications((v) => !v)}
              className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-20">
                <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-800">Notifications</div>
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No new notifications.</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (n.bookingId) {
                          const b = bookings.find((x) => x.id === n.bookingId);
                          if (b) openBooking(b);
                        }
                        setShowNotifications(false);
                        setTab('requests');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-start gap-2">
                        {n.type === 'conflict' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : n.type === 'paid' ? (
                          <DollarSign className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500">{n.subtitle}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-amber-600 bg-amber-50' },
          { label: 'Paid', value: stats.paid, color: 'text-blue-600 bg-blue-50' },
          { label: 'Approved', value: stats.approved, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-slate-600 bg-slate-50' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3 sm:p-4 ${s.color}`}>
            <p className="text-xl sm:text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {actionError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 text-rose-700 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : tab === 'requests' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          <div className="xl:col-span-2 space-y-4 order-2 xl:order-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    statusFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredBookings.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                No bookings match this filter.
              </div>
            ) : (
              <>
              <div className="md:hidden space-y-3">
                {filteredBookings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => openBooking(b)}
                    className={`w-full text-left bg-white rounded-xl border p-4 space-y-3 transition-colors ${
                      selectedBooking?.id === b.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{b.guestName}</p>
                        <p className="text-xs text-slate-500 truncate">{b.guestEmail}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold ${STATUS_COLOR[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{b.propertyName}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} night(s)
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">${b.totalAmount.toLocaleString()}</p>
                      <div onClick={(e) => e.stopPropagation()}>{renderBookingActions(b, true)}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">Guest</th>
                        <th className="px-4 py-3 font-medium">Property</th>
                        <th className="px-4 py-3 font-medium">Dates</th>
                        <th className="px-4 py-3 font-medium">Total</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBookings.map((b) => (
                        <tr
                          key={b.id}
                          className={`hover:bg-slate-50/50 cursor-pointer ${selectedBooking?.id === b.id ? 'bg-indigo-50/50' : ''}`}
                          onClick={() => openBooking(b)}
                        >
                          <td className="px-4 py-4">
                            <p className="font-medium text-slate-900">{b.guestName}</p>
                            <p className="text-xs text-slate-500">{b.guestEmail}</p>
                          </td>
                          <td className="px-4 py-4 text-slate-700">{b.propertyName}</td>
                          <td className="px-4 py-4 text-slate-700">
                            {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                            <p className="text-xs text-slate-500">{b.nights} night(s) · {b.numGuests} guests</p>
                          </td>
                          <td className="px-4 py-4 font-bold">${b.totalAmount.toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[b.status]}`}>
                              {STATUS_LABEL[b.status]}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {renderBookingActions(b)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 h-fit xl:sticky xl:top-4 order-1 xl:order-2">
            <h3 className="font-bold text-slate-800 mb-4">Guest Details</h3>
            {!selectedBooking ? (
              <p className="text-sm text-slate-500">Select a booking to view guest details and payment proof.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-bold text-slate-900">{selectedBooking.guestName}</p>
                  <p className="text-sm text-slate-600">{selectedBooking.guestEmail}</p>
                  <p className="text-sm text-slate-600">{selectedBooking.guestPhone}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-700"><Home className="w-4 h-4" /> {selectedBooking.propertyName}</div>
                  <div className="flex items-center gap-2 text-slate-700"><Calendar className="w-4 h-4" /> {formatDate(selectedBooking.checkIn)} → {formatDate(selectedBooking.checkOut)}</div>
                  <div className="flex items-center gap-2 text-slate-700"><Users className="w-4 h-4" /> {selectedBooking.numGuests} guest(s)</div>
                </div>
                <div className="border-t border-slate-100 pt-3 text-sm space-y-1">
                  <p><span className="text-slate-500">Nightly rate:</span> ${selectedBooking.nightlyRate}/night</p>
                  {selectedBooking.discountPercent > 0 && <p><span className="text-slate-500">Discount:</span> {selectedBooking.discountPercent}%</p>}
                  {selectedBooking.cleaningFee != null && <p><span className="text-slate-500">Cleaning fee:</span> ${selectedBooking.cleaningFee}</p>}
                  <p className="font-bold text-slate-900">Total: ${selectedBooking.totalAmount.toLocaleString()}</p>
                  {selectedBooking.paymentMethod && <p><span className="text-slate-500">Payment:</span> {selectedBooking.paymentMethod}</p>}
                </div>
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[selectedBooking.status]}`}>
                  {STATUS_LABEL[selectedBooking.status]}
                </span>

                {(selectedBooking.proofOfPaymentFiles?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Payment Proof</p>
                    <div className="space-y-2">
                      {selectedBooking.proofOfPaymentFiles!.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="truncate flex-1 text-slate-600">{file.filename}</span>
                          <a
                            href={api.getShortStayDocumentUrl(selectedBooking.id, file.path, file.filename)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-indigo-600"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                          <a
                            href={api.getShortStayDocumentUrl(selectedBooking.id, file.path, file.filename, true)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-indigo-600"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedBooking.guestIdFiles?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Guest ID</p>
                    <div className="space-y-2">
                      {selectedBooking.guestIdFiles!.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="truncate flex-1 text-slate-600">{file.filename}</span>
                          <a
                            href={api.getShortStayDocumentUrl(selectedBooking.id, file.path, file.filename)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-indigo-600"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBooking.status === 'confirmed' && selectedBooking.accessPin && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Guest portal code</p>
                    <p className="mt-1 text-3xl font-bold tracking-[0.35em] text-emerald-800">{selectedBooking.accessPin}</p>
                    <p className="mt-2 text-xs text-emerald-700/80">Emailed to guest · used on in-home iPad portal</p>
                  </div>
                )}

                {selectedBooking.notes && (
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedBooking.notes}</p>
                )}

                <div className="flex gap-2 pt-2">
                  {(selectedBooking.status === 'proof_submitted' || selectedBooking.status === 'pending_payment') && (
                    <>
                      <button
                        disabled={updatingId === selectedBooking.id}
                        onClick={() => updateStatus(selectedBooking.id, 'confirmed')}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {updatingId === selectedBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve Stay
                      </button>
                      <button
                        disabled={updatingId === selectedBooking.id}
                        onClick={() => updateStatus(selectedBooking.id, 'cancelled')}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 border border-rose-300 text-rose-700 text-sm font-bold rounded-lg hover:bg-rose-50 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : tab === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Property</label>
            <select
              value={calendarPropertyId}
              onChange={(e) => setCalendarPropertyId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-6"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
              ))}
            </select>
            <AdminCalendar
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              bookings={calendarBookings}
              blocked={calendarBlocked}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Ban className="w-4 h-4" /> Block Dates</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Start</label>
                    <input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">End</label>
                    <input type="date" value={blockEnd} min={blockStart} onChange={(e) => setBlockEnd(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={blocking || !blockStart || !blockEnd}
                  onClick={handleBlockDates}
                  className="w-full py-2.5 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {blocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Block Dates
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-3">Blocked Periods</h3>
              {calendarBlocked.length === 0 ? (
                <p className="text-sm text-slate-500">No admin blocks for this property.</p>
              ) : (
                <ul className="space-y-2">
                  {calendarBlocked.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 text-sm p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">{formatDate(b.startDate)} → {formatDate(b.endDate)}</p>
                        {b.reason && <p className="text-xs text-slate-500">{b.reason}</p>}
                      </div>
                      <button type="button" onClick={() => handleUnblock(b.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg" title="Unblock">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-3">Active Bookings</h3>
              {calendarBookings.length === 0 ? (
                <p className="text-sm text-slate-500">No active bookings.</p>
              ) : (
                <ul className="space-y-2">
                  {calendarBookings.map((b, i) => (
                    <li key={i} className="text-sm p-3 bg-rose-50 rounded-lg">
                      <p className="font-medium text-slate-800">{b.guestName || 'Guest'}</p>
                      <p className="text-xs text-slate-600">{formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {STATUS_LABEL[b.status as ShortStayBookingStatus] || b.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Set nightly rates, cleaning fees, and toggle short-stay availability per property. Discounts: 3+ nights 5%, 7+ nights 10%, 14+ nights 15%.</p>
          {properties.map((p) => {
            const edits = getPropertyEdit(p);
            const enabled = edits.shortStayEnabled ?? p.shortStayEnabled !== false;
            const nightly = edits.shortStayNightlyRate ?? p.shortStayNightlyRate ?? p.effectiveNightlyRate ?? 165;
            const cleaning = edits.shortStayCleaningFee ?? p.shortStayCleaningFee ?? 75;
            const maxGuests = edits.shortStayMaxGuests ?? p.shortStayMaxGuests ?? p.effectiveMaxGuests ?? 4;
            const checkIn = edits.shortStayCheckInTime ?? p.shortStayCheckInTime ?? p.effectiveCheckInTime ?? (Math.max(1, p.bedrooms ?? 2) >= 3 ? '4:00 PM' : '3:00 PM');
            const checkOut = edits.shortStayCheckOutTime ?? p.shortStayCheckOutTime ?? p.effectiveCheckOutTime ?? (Math.max(1, p.bedrooms ?? 2) >= 3 ? '10:00 AM' : '11:00 AM');
            const hasEdits = Object.keys(edits).length > 0;

            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.address}, {p.city}</p>
                  </div>
                  <button
                    type="button"
                    disabled={savingPropertyId === p.id}
                    onClick={() => toggleAvailability(p)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${
                      enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    {enabled ? 'Available for short stays' : 'Unavailable'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nightly rate ($)</label>
                    <input
                      type="number"
                      min={1}
                      value={nightly}
                      onChange={(e) => setPricingEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], shortStayNightlyRate: Number(e.target.value) } }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cleaning fee ($)</label>
                    <input
                      type="number"
                      min={0}
                      value={cleaning}
                      onChange={(e) => setPricingEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], shortStayCleaningFee: Number(e.target.value) } }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Max guests</label>
                    <input
                      type="number"
                      min={1}
                      value={maxGuests}
                      onChange={(e) => setPricingEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], shortStayMaxGuests: Number(e.target.value) } }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Check-in time</label>
                    <input
                      type="text"
                      value={checkIn}
                      onChange={(e) => setPricingEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], shortStayCheckInTime: e.target.value } }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Check-out time</label>
                    <input
                      type="text"
                      value={checkOut}
                      onChange={(e) => setPricingEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], shortStayCheckOutTime: e.target.value } }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                {hasEdits && (
                  <button
                    type="button"
                    disabled={savingPropertyId === p.id}
                    onClick={() => savePropertyPricing(p)}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {savingPropertyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                    Save Pricing
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShortStaysView;
