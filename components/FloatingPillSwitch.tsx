import React from 'react';
import { Building2, Sparkles } from 'lucide-react';

export type ListingMode = 'rentals' | 'short-stay';

interface FloatingPillSwitchProps {
  mode: ListingMode;
  onSelectRentals: () => void;
  onSelectShortStay: () => void;
  className?: string;
}

export const FloatingPillSwitch: React.FC<FloatingPillSwitchProps> = ({
  mode,
  onSelectRentals,
  onSelectShortStay,
  className = '',
}) => (
  <div className={`flex justify-center ${className}`}>
    <div
      className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/95 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur-md"
      role="tablist"
      aria-label="Listing type"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'rentals'}
        onClick={onSelectRentals}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
          mode === 'rentals'
            ? 'bg-slate-900 text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Building2 className="h-4 w-4" />
        Browse Listings
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'short-stay'}
        onClick={onSelectShortStay}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
          mode === 'short-stay'
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25'
            : 'text-slate-600 hover:bg-amber-50 hover:text-amber-700'
        }`}
      >
        <Sparkles className="h-4 w-4" />
        Short Stays
      </button>
    </div>
  </div>
);
