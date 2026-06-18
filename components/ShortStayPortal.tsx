import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Property } from '../types';
import { api } from '../services/api';
import {
  ArrowLeft, BedDouble, Bath, Building2, Loader2, MapPin, Home,
  Calendar, Users, Upload, CheckCircle, X, Sparkles, Clock,
  MessageSquare, Shield, AlertTriangle, ChevronLeft, ChevronRight,
  Minus, Plus, Filter, ArrowUpDown
} from 'lucide-react';
import { FloatingPillSwitch } from './FloatingPillSwitch';
import { shortStayArea, shortStayDescription, shortStayLocation, shortStayTitle } from '../utils/shortStayListings';

const PAYMENT_OPTIONS = [
  { id: 'Zelle', label: 'Zelle', payTo: 'payments@neelacapital.com', desc: 'Bank transfer' },
  { id: 'Venmo', label: 'Venmo', payTo: '@NeelaCapital', desc: 'Social payment' },
  { id: 'CashApp', label: 'CashApp', payTo: '$NeelaCapital', desc: 'Mobile payment' },
  { id: 'PayPal', label: 'PayPal', payTo: 'neelacapital@paypal.com', desc: 'PayPal app or web' },
  { id: 'Apple Pay', label: 'Apple Pay', payTo: 'payments@neelacapital.com', desc: 'Apple device' },
  { id: 'ACH', label: 'ACH', payTo: 'payments@neelacapital.com', desc: 'Bank account transfer' },
  { id: 'Card', label: 'Credit/Debit Card', payTo: 'Contact host for secure link', desc: 'Card payment' },
  { id: 'Cash', label: 'Cash', payTo: 'Pay at check-in', desc: 'In person only' },
] as const;

const CANCELLATION_RULES = [
  'Free cancellation up to 7 days before check-in.',
  '50% refund if cancelled 3–6 days before check-in.',
  'No refund within 72 hours of check-in.',
  'Date changes subject to availability and may incur a fee.',
];

type BookedRange = { checkIn: string; checkOut: string; status: string };

const LISTING_AREAS = [
  'East Houston', 'Southeast Houston', 'Inner Loop', 'North Houston',
  'West Houston', 'Central Houston', 'South Houston', 'Medical Center Area',
  'Greater Houston', 'East End', 'Near Downtown', 'Midtown Houston',
  'Third Ward', 'Heights Area', 'Southwest Houston',
];

const PRICE_BUCKETS = [
  { id: '', label: 'Any price' },
  { id: 'under150', label: 'Under $150/night' },
  { id: '150-250', label: '$150 – $250/night' },
  { id: 'over250', label: 'Over $250/night' },
] as const;

type SortOption = 'price-asc' | 'price-desc' | 'beds-desc' | 'guests-desc';

function getAreaForProperty(p: Property): string {
  const guestArea = shortStayArea(p);
  if (guestArea) return guestArea;
  return 'Greater Houston';
}

function matchesPriceBucket(rate: number, bucket: string): boolean {
  if (!bucket) return true;
  if (bucket === 'under150') return rate < 150;
  if (bucket === '150-250') return rate >= 150 && rate <= 250;
  if (bucket === 'over250') return rate > 250;
  return true;
}

function isDateInRange(dateStr: string, start: string, end: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  return d >= s && d < e;
}

function isDateBooked(dateStr: string, bookings: BookedRange[]) {
  return bookings.some((b) => isDateInRange(dateStr, b.checkIn, b.checkOut));
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangeHasBookedConflict(start: string, end: string, bookings: BookedRange[]) {
  let current = start;
  while (current < end) {
    if (isDateBooked(current, bookings)) return true;
    current = addDays(current, 1);
  }
  return false;
}

/** Resize large ID photos client-side so uploads finish faster */
async function prepareIdImageFiles(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (file) => {
      if (!file.type.startsWith('image/') || file.size < 350_000) return file;
      try {
        const bitmap = await createImageBitmap(file);
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, w, h);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
        );
        bitmap.close();
        if (!blob || blob.size >= file.size) return file;
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg' });
      } catch {
        return file;
      }
    })
  );
}

const AvailabilityCalendar: React.FC<{
  month: Date;
  onMonthChange: (d: Date) => void;
  bookings: BookedRange[];
  checkIn?: string;
  checkOut?: string;
  onDateClick?: (dateStr: string) => void;
}> = ({ month, onMonthChange, bookings, checkIn, checkOut, onDateClick }) => {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const startPad = firstDay.getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startPad; i++) cells.push(<div key={`pad-${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const booked = isDateBooked(dateStr, bookings);
    const isPast = dateStr < today;
    const disabled = booked || isPast;
    const inSelection = checkIn && checkOut && isDateInRange(dateStr, checkIn, checkOut);
    const isStart = dateStr === checkIn;
    const isEnd = dateStr === checkOut;
    const isCheckInPending = checkIn && !checkOut && isStart;

    cells.push(
      <button
        key={dateStr}
        type="button"
        disabled={disabled}
        onClick={() => onDateClick?.(dateStr)}
        className={`aspect-square flex items-center justify-center text-xs rounded-lg border transition-colors ${
          booked
            ? 'bg-rose-100 border-rose-200 text-rose-700 line-through cursor-not-allowed'
            : isPast
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : inSelection || isCheckInPending
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-100 cursor-pointer'
            : dateStr === today
            ? 'border-amber-400 bg-amber-50 hover:bg-amber-100 cursor-pointer'
            : 'border-slate-100 text-slate-700 hover:bg-slate-100 hover:border-slate-300 cursor-pointer'
        } ${isStart || isEnd ? 'ring-2 ring-emerald-500' : ''}`}
        title={booked ? 'Booked' : isPast ? 'Past date' : 'Click to select'}
      >
        {day}
      </button>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => onMonthChange(new Date(year, m - 1, 1))} className="p-1 hover:bg-slate-200 rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="font-semibold text-slate-800">{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        <button type="button" onClick={() => onMonthChange(new Date(year, m + 1, 1))} className="p-1 hover:bg-slate-200 rounded">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-2">Click a date for check-in, then another for check-out.</p>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-500 mb-1 text-center font-medium">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>
      <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-200" /> Booked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300" /> Your dates</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-200" /> Available</span>
      </div>
    </div>
  );
};

const PriceBreakdown: React.FC<{ quote: any }> = ({ quote }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-2">
    <p className="font-semibold text-slate-900">Price breakdown</p>
    <div className="flex justify-between">
      <span>{quote.nights} night(s) × ${quote.nightly_rate}</span>
      <span>${quote.lodging_subtotal?.toFixed(2) ?? (quote.nights * quote.nightly_rate).toFixed(2)}</span>
    </div>
    {quote.discount_percent > 0 && (
      <div className="flex justify-between text-emerald-700">
        <span>{quote.discount_percent}% multi-night discount</span>
        <span>-${quote.discount_amount?.toFixed(2)}</span>
      </div>
    )}
    {quote.extra_guests > 0 && (
      <div className="flex justify-between text-slate-700">
        <span>
          {quote.extra_guests} extra guest{quote.extra_guests > 1 ? 's' : ''} × ${quote.extra_guest_fee_per_night}/night × {quote.nights} night(s)
        </span>
        <span>${quote.extra_guest_fee?.toFixed(2)}</span>
      </div>
    )}
    <div className="flex justify-between"><span>Cleaning fee</span><span>${quote.cleaning_fee?.toFixed(2)}</span></div>
    <p className="text-xs text-slate-500">Base rate includes {quote.included_guests ?? 2} guests.</p>
    <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-amber-200 text-base">
      <span>Total</span><span>${quote.total_amount?.toFixed(2)}</span>
    </div>
  </div>
);

interface ShortStayPortalProps {
  onBack: () => void;
}

const FAB_SIZE = 56;

/** Mirror backend bedroom baselines for display when API fields are missing. */
const bedroomNightlyFallback = (bedrooms?: number) => {
  const br = Math.max(1, bedrooms || 2);
  const rates: Record<number, number> = { 1: 115, 2: 165, 3: 215, 4: 275, 5: 340 };
  return rates[br] ?? 340 + (br - 5) * 45;
};

const propertyNightlyRate = (p: Property) =>
  p.effectiveNightlyRate ?? p.shortStayNightlyRate ?? bedroomNightlyFallback(p.bedrooms);

const propertyMaxGuests = (p: Property) =>
  p.effectiveMaxGuests ?? p.shortStayMaxGuests ?? Math.max(2, (p.bedrooms || 2) + 2);

const propertyCheckIn = (p: Property) =>
  p.effectiveCheckInTime ?? p.shortStayCheckInTime ?? ((p.bedrooms ?? 2) >= 3 ? '4:00 PM' : '3:00 PM');

const propertyCheckOut = (p: Property) =>
  p.effectiveCheckOutTime ?? p.shortStayCheckOutTime ?? ((p.bedrooms ?? 2) >= 3 ? '10:00 AM' : '11:00 AM');

const FloatingHomeButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [pos, setPos] = useState(() => ({
    x: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 400) - FAB_SIZE - 24),
    y: Math.max(16, (typeof window !== 'undefined' ? window.innerHeight : 700) - FAB_SIZE - 24),
  }));
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const clamp = (x: number, y: number) => ({
    x: Math.max(12, Math.min(window.innerWidth - FAB_SIZE - 12, x)),
    y: Math.max(12, Math.min(window.innerHeight - FAB_SIZE - 12, y)),
  });

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true;
    setPos(clamp(dragRef.current.origX + dx, dragRef.current.origY + dy));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current && !dragRef.current.moved) onClick();
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div
      className="fixed z-[70] touch-none select-none"
      style={{ left: pos.x, top: pos.y, width: FAB_SIZE, height: FAB_SIZE }}
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-full bg-indigo-400/50 blur-xl scale-150 animate-pulse pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute inset-[-6px] rounded-full bg-violet-500/25 blur-md pointer-events-none"
        style={{ boxShadow: '0 0 28px 8px rgba(99, 102, 241, 0.55), 0 0 56px 16px rgba(139, 92, 246, 0.25)' }}
      />
      <button
        type="button"
        aria-label="Back to long-term rentals"
        title="Back to long-term rentals — drag to move"
        className="relative w-full h-full rounded-full bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 text-white ring-4 ring-white/90 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-grab active:cursor-grabbing"
        style={{ boxShadow: '0 0 20px 4px rgba(99, 102, 241, 0.65), 0 4px 16px rgba(67, 56, 202, 0.35)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Home className="w-6 h-6 pointer-events-none" strokeWidth={2.25} />
      </button>
    </div>
  );
};

export const ShortStayPromoPopup: React.FC<{ onExplore: () => void; onDismiss: () => void }> = ({ onExplore, onDismiss }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative animate-in zoom-in-95">
      <button onClick={onDismiss} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" aria-label="Close">
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-amber-100 rounded-xl text-amber-600"><Sparkles className="w-6 h-6" /></div>
        <h3 className="text-xl font-bold text-slate-900">Looking for a short stay?</h3>
      </div>
      <p className="text-slate-600 mb-6 leading-relaxed">
        Need an Airbnb-style getaway for a few nights? Browse our properties, pick your dates, and book a short stay.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onExplore} className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg transition-all">
          Explore Short Stays
        </button>
        <button onClick={onDismiss} className="flex-1 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50">Maybe later</button>
      </div>
    </div>
  </div>
);

const ShortStayPortal: React.FC<ShortStayPortalProps> = ({ onBack }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [step, setStep] = useState<'browse' | 'book' | 'success'>('browse');

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [numGuests, setNumGuests] = useState(1);
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_OPTIONS[0].id);
  const [notes, setNotes] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);

  const [filterBeds, setFilterBeds] = useState(0);
  const [filterBaths, setFilterBaths] = useState(0);
  const [filterArea, setFilterArea] = useState('');
  const [filterPrice, setFilterPrice] = useState('');
  const [filterGuests, setFilterGuests] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('price-asc');
  const [appliedBeds, setAppliedBeds] = useState<number | null>(null);
  const [appliedBaths, setAppliedBaths] = useState<number | null>(null);
  const [appliedArea, setAppliedArea] = useState('');
  const [appliedPrice, setAppliedPrice] = useState('');
  const [appliedGuests, setAppliedGuests] = useState<number | null>(null);
  const [appliedSort, setAppliedSort] = useState<SortOption>('price-asc');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getProperties();
        setProperties(data.filter((p) => p.shortStayEnabled !== false));
      } catch {
        setProperties([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedProperty) return;
    api.getShortStayBookedDates(selectedProperty.id).then((data) => {
      const fromBookings = data.bookings.map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut, status: b.status }));
      const fromBlocks = data.blocked.map((b) => ({ checkIn: b.startDate, checkOut: b.endDate, status: 'blocked' }));
      setBookedRanges([...fromBookings, ...fromBlocks]);
    }).catch(() => setBookedRanges([]));
  }, [selectedProperty]);

  useEffect(() => {
    if (!selectedProperty || !checkIn || !checkOut) {
      setQuote(null);
      setAvailabilityStatus('idle');
      setAvailabilityError(null);
      setQuoteLoading(false);
      return;
    }

    if (checkOut <= checkIn) {
      setQuote(null);
      setAvailabilityStatus('unavailable');
      setAvailabilityError('Check-out must be after check-in.');
      setQuoteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      setAvailabilityStatus('checking');
      setAvailabilityError(null);
      try {
        const q = await api.getShortStayQuote(
          selectedProperty.id,
          checkIn,
          checkOut,
          numGuests,
          controller.signal,
        );
        if (q.error && !q.available) {
          setAvailabilityStatus('unavailable');
          setAvailabilityError(q.error);
          setQuote(null);
          return;
        }
        if (!q.available) {
          setAvailabilityStatus('unavailable');
          setAvailabilityError(q.conflict_reason || 'These dates are not available. Please choose different dates.');
          setQuote(null);
          return;
        }
        setQuote(q);
        setAvailabilityStatus('available');
      } catch (e) {
        if (e instanceof Error && e.message === 'Quote request cancelled') return;
        setAvailabilityStatus('unavailable');
        setAvailabilityError(e instanceof Error ? e.message : 'Could not verify availability');
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedProperty, checkIn, checkOut, numGuests]);

  const nightlyRate = selectedProperty ? propertyNightlyRate(selectedProperty) : 0;
  const maxGuests = selectedProperty ? propertyMaxGuests(selectedProperty) : 4;
  const checkInTime = quote?.check_in_time || (selectedProperty ? propertyCheckIn(selectedProperty) : '3:00 PM');
  const checkOutTime = quote?.check_out_time || (selectedProperty ? propertyCheckOut(selectedProperty) : '11:00 AM');

  const areaOptions = useMemo(() => {
    const fromProps = properties.map((p) => getAreaForProperty(p)).filter((a) => a !== 'Other');
    return [...new Set([...LISTING_AREAS, ...fromProps])].sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const applyFilters = () => {
    setAppliedBeds(filterBeds > 0 ? filterBeds : null);
    setAppliedBaths(filterBaths > 0 ? filterBaths : null);
    setAppliedArea(filterArea);
    setAppliedPrice(filterPrice);
    setAppliedGuests(filterGuests > 0 ? filterGuests : null);
    setAppliedSort(sortBy);
  };

  const clearFilters = () => {
    setFilterBeds(0);
    setFilterBaths(0);
    setFilterArea('');
    setFilterPrice('');
    setFilterGuests(0);
    setSortBy('price-asc');
    setAppliedBeds(null);
    setAppliedBaths(null);
    setAppliedArea('');
    setAppliedPrice('');
    setAppliedGuests(null);
    setAppliedSort('price-asc');
  };

  const removeFilter = (which: 'beds' | 'baths' | 'area' | 'price' | 'guests') => {
    if (which === 'beds') { setAppliedBeds(null); setFilterBeds(0); }
    if (which === 'baths') { setAppliedBaths(null); setFilterBaths(0); }
    if (which === 'area') { setAppliedArea(''); setFilterArea(''); }
    if (which === 'price') { setAppliedPrice(''); setFilterPrice(''); }
    if (which === 'guests') { setAppliedGuests(null); setFilterGuests(0); }
  };

  const filteredProperties = useMemo(() => {
    let list = [...properties];
    if (appliedBeds != null) {
      list = list.filter((p) => Math.round(Number(p.bedrooms ?? 2)) >= appliedBeds);
    }
    if (appliedBaths != null) {
      list = list.filter((p) => Math.round(Number(p.bathrooms ?? 1)) >= appliedBaths);
    }
    if (appliedArea) {
      list = list.filter((p) => getAreaForProperty(p) === appliedArea);
    }
    if (appliedPrice) {
      list = list.filter((p) => matchesPriceBucket(propertyNightlyRate(p), appliedPrice));
    }
    if (appliedGuests != null) {
      list = list.filter((p) => propertyMaxGuests(p) >= appliedGuests);
    }
    list.sort((a, b) => {
      switch (appliedSort) {
        case 'price-desc':
          return propertyNightlyRate(b) - propertyNightlyRate(a);
        case 'beds-desc':
          return (b.bedrooms ?? 0) - (a.bedrooms ?? 0);
        case 'guests-desc':
          return propertyMaxGuests(b) - propertyMaxGuests(a);
        default:
          return propertyNightlyRate(a) - propertyNightlyRate(b);
      }
    });
    return list;
  }, [properties, appliedBeds, appliedBaths, appliedArea, appliedPrice, appliedGuests, appliedSort]);

  const hasActiveFilters = appliedBeds != null || appliedBaths != null || appliedArea || appliedPrice || appliedGuests != null;

  const similarStays = useMemo(() => {
    if (!selectedProperty) return [];
    return properties
      .filter((p) => p.id !== selectedProperty.id && (
        (p.area && selectedProperty.area && p.area === selectedProperty.area) ||
        p.city === selectedProperty.city
      ))
      .slice(0, 3);
  }, [properties, selectedProperty]);

  const selectedPayOption = useMemo(
    () => PAYMENT_OPTIONS.find((p) => p.id === paymentMethod) || PAYMENT_OPTIONS[0],
    [paymentMethod]
  );

  const guestFullName = useMemo(
    () => `${guestFirstName.trim()} ${guestLastName.trim()}`.trim(),
    [guestFirstName, guestLastName]
  );

  const canSubmit = Boolean(
    quote &&
    availabilityStatus === 'available' &&
    guestFirstName.trim() &&
    guestLastName.trim() &&
    guestEmail.trim() &&
    guestPhone.trim() &&
    proofFiles.length > 0
  );

  const handleContactHost = async () => {
    if (!contactMessage.trim() || !selectedProperty) return;
    setContactSending(true);
    setContactSuccess(null);
    try {
      await api.sendContactManagerMessage({
        message: `[Short Stay Inquiry — ${shortStayTitle(selectedProperty)}]\n${contactMessage.trim()}${checkIn ? `\nDates: ${checkIn} to ${checkOut}` : ''}`,
        sender_name: guestFullName || undefined,
        sender_email: guestEmail || undefined,
      });
      setContactSuccess('Message sent! The host will reach out soon.');
      setContactMessage('');
    } catch {
      setContactSuccess('Could not send message. Please try again.');
    } finally {
      setContactSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProperty || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const [preparedProof, preparedId] = await Promise.all([
        prepareIdImageFiles(proofFiles),
        prepareIdImageFiles(idFiles),
      ]);
      await api.createShortStayBooking({
        propertyId: selectedProperty.id,
        guestName: guestFullName,
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        checkIn,
        checkOut,
        numGuests,
        paymentMethod,
        notes,
        proofFiles: preparedProof,
        idFiles: preparedId,
      });
      setStep('success');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCalendarDateClick = (dateStr: string) => {
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr < today || isDateBooked(dateStr, bookedRanges)) return;

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dateStr);
      setCheckOut('');
      setAvailabilityError(null);
      return;
    }

    if (dateStr <= checkIn) {
      setCheckIn(dateStr);
      setCheckOut('');
      setAvailabilityError(null);
      return;
    }

    if (rangeHasBookedConflict(checkIn, dateStr, bookedRanges)) {
      setAvailabilityError('Some nights in that range are already booked. Try different dates.');
      setCheckOut('');
      return;
    }

    setCheckOut(dateStr);
    setAvailabilityError(null);
  };

  const openPropertyBooking = (p: Property) => {
    setSelectedProperty(p);
    setStep('book');
    setCheckIn('');
    setCheckOut('');
    setGuestFirstName('');
    setGuestLastName('');
    setGuestEmail('');
    setGuestPhone('');
    setIdImages([]);
    setQuote(null);
    setAvailabilityStatus('idle');
    setCalendarMonth(new Date());
    setSubmitError(null);
  };

  if (step === 'success') {
    return (
      <>
        <div className="max-w-lg mx-auto px-4 py-16 text-center animate-fade-in">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Request Received!</h2>
          <p className="text-slate-600 mb-6">Thank you! Our team will review your payment proof and reach out shortly to confirm your short stay.</p>
          <button onClick={onBack} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700">Back to Home</button>
        </div>
        <FloatingHomeButton onClick={onBack} />
      </>
    );
  }

  if (selectedProperty && step === 'book') {
    return (
      <>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-8 animate-fade-in">
        <button onClick={() => { setSelectedProperty(null); setStep('browse'); }} className="flex items-center text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to properties
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{shortStayTitle(selectedProperty)}</h2>
                  <p className="text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-4 h-4" />{shortStayLocation(selectedProperty)}</p>
                  <p className="text-slate-600 text-sm mt-3 leading-relaxed">{shortStayDescription(selectedProperty)}</p>
                  <p className="text-amber-600 font-bold mt-2">${nightlyRate}/night · Max {maxGuests} guests</p>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-emerald-600" /> Check-in from {checkInTime}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-rose-500" /> Checkout by {checkOutTime}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 text-sm font-semibold shrink-0"
                >
                  <MessageSquare className="w-4 h-4" /> Contact Host
                </button>
              </div>

              <div className="p-6 space-y-5">
                <AvailabilityCalendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  bookings={bookedRanges}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onDateClick={handleCalendarDateClick}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Check-in date</label>
                    <input type="date" value={checkIn} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setCheckIn(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Check-out date</label>
                    <input type="date" value={checkOut} min={checkIn || new Date().toISOString().slice(0, 10)} onChange={(e) => setCheckOut(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                  </div>
                </div>

                {(quoteLoading || availabilityStatus !== 'idle') && checkIn && checkOut && (
                  <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${
                    availabilityStatus === 'checking' ? 'bg-slate-100 text-slate-600' :
                    availabilityStatus === 'available' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-rose-50 text-rose-700'
                  }`}>
                    {quoteLoading || availabilityStatus === 'checking' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Checking availability...</>
                    ) : availabilityStatus === 'available' ? (
                      <><CheckCircle className="w-4 h-4" /> Dates available — you're good to book!</>
                    ) : (
                      <><AlertTriangle className="w-4 h-4" /> {availabilityError || 'Not available'}</>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Number of guests</label>
                  <input type="number" min={1} max={maxGuests} value={numGuests} onChange={(e) => setNumGuests(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                  <p className="text-xs text-slate-500 mt-1">Base rate covers 2 guests. Each additional guest adds a per-night fee.</p>
                </div>

                {quote && availabilityStatus === 'available' && <PriceBreakdown quote={quote} />}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                    <input
                      value={guestFirstName}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      autoComplete="given-name"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                    <input
                      value={guestLastName}
                      onChange={(e) => setGuestLastName(e.target.value)}
                      autoComplete="family-name"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      autoComplete="tel"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Photo ID (optional)
                  </label>
                  <input type="file" accept="image/*,.pdf" multiple onChange={(e) => setIdFiles(Array.from(e.target.files || []))} className="w-full text-sm" />
                  <p className="text-xs text-slate-500 mt-1">Upload a government-issued ID to speed up verification.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          paymentMethod === opt.id
                            ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-sm font-semibold">{opt.label}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-slate-800">{selectedPayOption.label}</p>
                    <p className="text-slate-600 mt-1">
                      Pay to: <span className="font-mono font-medium">{selectedPayOption.payTo}</span>
                    </p>
                    {quote && (
                      <p className="text-slate-600 mt-1">
                        Amount: <span className="font-bold">${quote.total_amount?.toFixed(2)}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      Include your name and stay dates in the payment memo, then upload proof below.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload proof of payment</label>
                  <input type="file" accept="image/*,.pdf" multiple onChange={(e) => setProofFiles(Array.from(e.target.files || []))} className="w-full text-sm" />
                </div>

                {submitError && <p className="text-sm text-rose-600">{submitError}</p>}

                <button
                  disabled={submitting || !canSubmit}
                  onClick={handleSubmit}
                  className="w-full py-3.5 min-h-[48px] bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-base sm:text-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {proofFiles.length > 0 ? 'Uploading & submitting…' : 'Submitting…'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Cancellation policy</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {CANCELLATION_RULES.map((rule) => (
                  <li key={rule} className="flex gap-2"><span className="text-amber-500">•</span>{rule}</li>
                ))}
              </ul>
            </div>

            {similarStays.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900 mb-3">Similar stays nearby</h3>
                <div className="space-y-3">
                  {similarStays.map((p) => (
                    <button key={p.id} type="button" onClick={() => openPropertyBooking(p)} className="w-full text-left flex gap-3 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                        {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-8 h-8 m-4 text-slate-300" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{shortStayTitle(p)}</p>
                        <p className="text-xs text-slate-500">{shortStayLocation(p)}</p>
                        <p className="text-sm font-bold text-amber-600 mt-0.5">${propertyNightlyRate(p)}/night</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">Contact Host</h3>
                <button onClick={() => setShowContactModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <textarea
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Ask about availability, amenities, or special requests..."
                rows={4}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
              />
              {contactSuccess && <p className="text-sm text-emerald-600 mb-2">{contactSuccess}</p>}
              <button
                disabled={contactSending || !contactMessage.trim()}
                onClick={handleContactHost}
                className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {contactSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Send Message
              </button>
            </div>
          </div>
        )}
      </div>
      <FloatingHomeButton onClick={onBack} />
      </>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-8 pb-24 sm:pb-8">
      <FloatingPillSwitch
        mode="short-stay"
        onSelectRentals={onBack}
        onSelectShortStay={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="sticky top-4 z-30 mb-8"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Short Stays & Airbnb-Style Getaways</h1>
        <p className="text-slate-600">Browse properties and book your stay by the night.</p>
      </div>

      {!loading && properties.length > 0 && (
        <div className="mb-6 p-4 sm:p-5 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">Filter stays</h3>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Bedrooms</label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setFilterBeds(Math.max(0, filterBeds - 1))} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                  <Minus className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-slate-800">{filterBeds || 'Any'}</span>
                <button type="button" onClick={() => setFilterBeds(filterBeds + 1)} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Bathrooms</label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setFilterBaths(Math.max(0, filterBaths - 1))} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                  <Minus className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-slate-800">{filterBaths || 'Any'}</span>
                <button type="button" onClick={() => setFilterBaths(filterBaths + 1)} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Guests</label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setFilterGuests(Math.max(0, filterGuests - 1))} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                  <Minus className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-slate-800">{filterGuests || 'Any'}</span>
                <button type="button" onClick={() => setFilterGuests(filterGuests + 1)} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>
            <div className="min-w-[130px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Area</label>
              <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-sm bg-white">
                <option value="">Any area</option>
                {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Price</label>
              <select value={filterPrice} onChange={(e) => setFilterPrice(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-sm bg-white">
                {PRICE_BUCKETS.map((b) => <option key={b.id || 'any'} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-sm bg-white">
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="beds-desc">Most bedrooms</option>
                <option value="guests-desc">Most guests</option>
              </select>
            </div>
            <button type="button" onClick={applyFilters} className="px-4 py-1.5 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600">
              Apply
            </button>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 underline">
                Clear all
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3">
              {appliedBeds != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700">
                  {appliedBeds}+ beds <button type="button" onClick={() => removeFilter('beds')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {appliedBaths != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700">
                  {appliedBaths}+ baths <button type="button" onClick={() => removeFilter('baths')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {appliedGuests != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700">
                  {appliedGuests}+ guests <button type="button" onClick={() => removeFilter('guests')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {appliedArea && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700">
                  {appliedArea} <button type="button" onClick={() => removeFilter('area')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {appliedPrice && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700">
                  {PRICE_BUCKETS.find((b) => b.id === appliedPrice)?.label} <button type="button" onClick={() => removeFilter('price')}><X className="w-3 h-3" /></button>
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-800">
                <ArrowUpDown className="w-3 h-3" />
                {appliedSort === 'price-asc' ? 'Price ↑' : appliedSort === 'price-desc' ? 'Price ↓' : appliedSort === 'beds-desc' ? 'Bedrooms' : 'Guests'}
              </span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
      ) : properties.length === 0 ? (
        <p className="text-center text-slate-500 py-12">No short-stay properties available right now.</p>
      ) : filteredProperties.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-3">No properties match your filters.</p>
          <button type="button" onClick={clearFilters} className="text-amber-600 font-semibold hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredProperties.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-48">
                {p.image ? <img src={p.image} alt={shortStayTitle(p)} className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Building2 className="w-12 h-12 text-slate-300" /></div>
                )}
                <div className="absolute top-3 right-3 bg-white/95 px-3 py-1 rounded-full text-sm font-bold text-amber-600">
                  ${propertyNightlyRate(p)}/night
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-slate-900">{shortStayTitle(p)}</h3>
                <p className="text-sm text-slate-500 flex items-start gap-1 mt-1"><MapPin className="w-4 h-4 shrink-0" />{shortStayLocation(p)}</p>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{shortStayDescription(p)}</p>
                <div className="flex gap-4 text-sm text-slate-600 mt-3">
                  <span className="flex items-center gap-1"><BedDouble className="w-4 h-4" />{p.bedrooms ?? 2}</span>
                  <span className="flex items-center gap-1"><Bath className="w-4 h-4" />{p.bathrooms ?? 1}</span>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" />Max {propertyMaxGuests(p)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Check-in from {propertyCheckIn(p)} · Checkout by {propertyCheckOut(p)}
                </p>
                <button onClick={() => openPropertyBooking(p)} className="w-full mt-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-md transition-all">
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <FloatingHomeButton onClick={onBack} />
    </>
  );
};

export default ShortStayPortal;
