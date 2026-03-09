import React, { useState, useEffect, useMemo } from 'react';
import { Listing, Property } from '../types';
import { api } from '../services/api';
import {
  MapPin, BedDouble, Bath, Maximize, Building2, Loader2, Clock, Minus, Plus, X
} from 'lucide-react';

const QUICK_LOCATIONS = ['Downtown Houston', 'Houston Airport', 'Galleria', 'University of Houston'];

const LISTING_AREAS = [
  'Avenue Q',
  'Sherman St',
  'Avenue H',
  '70th Street',
  'Wooding St',
  'Bella Jess Dr',
  'Magnolia Dr',
  'Westlock Dr',
];

/** Derive group heading from property: use property.area if it matches a known area, else detect from address/name/city/state. */
function getAreaGroupForProperty(property: Property): string {
  const text = [property.address, property.name, property.city, property.state]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (property.area?.trim()) {
    const trimmed = property.area.trim();
    const match = LISTING_AREAS.find(
      (a) => a.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) return match;
  }
  // Match known areas in address text (longer names first so "Avenue Q" doesn't match "Avenue H")
  const byLength = [...LISTING_AREAS].sort((a, b) => b.length - a.length);
  for (const area of byLength) {
    if (text.includes(area.toLowerCase())) return area;
  }
  if (text.includes('wooding st.')) return 'Wooding St';
  return 'Other';
}

interface ListingsProps {
  setView: (view: string) => void;
  setLoginType: (type: 'admin' | 'tenant' | null) => void;
  handleApply: (listing: Listing) => void;
  propertyToListing: (property: Property) => Listing;
}

const ListingCard: React.FC<{
  listing: Listing;
  handleApply: (listing: Listing) => void;
  onViewDetails: (listing: Listing) => void;
  distanceKm?: number;
  driveMin?: number;
}> = ({ listing, handleApply, onViewDetails, distanceKm, driveMin }) => {
  const isOccupied = listing.status === 'occupied';
  const furnishingLabel = listing.furnishingType || (listing.furnishingsBreakdown && listing.furnishingsBreakdown.length > 0 ? 'Furnished' : null) || 'Unfurnished';
  return (
  <div className="bg-white rounded-2xl shadow-lg shadow-slate-500/10 border-2 border-slate-200/60 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 flex flex-col transform hover:-translate-y-1 group">
    <div className="relative h-64 group/image overflow-hidden">
      {listing.image ? (
      <img src={listing.image} alt={listing.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/image:scale-110" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <Building2 className="w-20 h-20 text-slate-400" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="absolute top-5 right-5 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl text-base font-bold text-indigo-600 shadow-xl shadow-indigo-500/20 border-2 border-indigo-100">
        ${listing.price}/mo
      </div>
    </div>
    <div className="p-7 flex-1 flex flex-col bg-white">
      <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">{listing.title}</h3>
      <div className="flex items-start text-slate-600 mb-3 text-sm font-medium">
        <MapPin className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0 text-indigo-500" />
        <span className="leading-relaxed">{listing.address}</span>
      </div>
      {(distanceKm != null || driveMin != null) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-sm text-slate-600">
          {distanceKm != null && <span className="font-medium">📍 {distanceKm.toFixed(1)} km away</span>}
          {driveMin != null && <span className="font-medium">🚗 {driveMin} min drive</span>}
        </div>
      )}
      <div className="flex items-center justify-between mb-4 text-sm text-slate-600 font-semibold bg-slate-50 rounded-xl p-4">
        <div className="flex items-center gap-2"><BedDouble className="w-5 h-5 text-indigo-500"/> <span>{listing.beds} Beds</span></div>
        <div className="flex items-center gap-2"><Bath className="w-5 h-5 text-indigo-500"/> <span>{listing.baths} Baths</span></div>
        <div className="flex items-center gap-2"><Maximize className="w-5 h-5 text-indigo-500"/> <span>{listing.sqft} sqft</span></div>
      </div>

      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="text-slate-600 font-medium capitalize">{furnishingLabel.replace(/-/g, ' ')}</span>
        <button
          type="button"
          onClick={() => onViewDetails(listing)}
          className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline focus:outline-none focus:ring-0"
        >
          View more details
        </button>
      </div>

      <div className="mt-auto pt-5 border-t-2 border-slate-100">
        {isOccupied && (
          <p className="text-xs font-semibold text-rose-600 mb-3 text-right tracking-wide">Occupied</p>
        )}
        <button 
          onClick={() => !isOccupied && handleApply(listing)}
          disabled={isOccupied}
          className={`w-full py-3.5 font-bold rounded-xl transition-all duration-300 flex justify-center items-center gap-2 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 ${
            isOccupied
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:shadow-xl hover:shadow-indigo-500/30 transform hover:-translate-y-0.5'
          }`}
          aria-label={isOccupied ? `${listing.title} is occupied` : `Apply for ${listing.title}`}
        >
          <span>{isOccupied ? 'Unavailable' : 'Apply Now'}</span>
          {!isOccupied && <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>}
        </button>
      </div>
    </div>
  </div>
  );
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export const Listings: React.FC<ListingsProps> = ({ setView, setLoginType, handleApply, propertyToListing }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [detailsListing, setDetailsListing] = useState<Listing | null>(null);

  const [filterBeds, setFilterBeds] = useState(0);
  const [filterBaths, setFilterBaths] = useState(0);
  const [nearLocation, setNearLocation] = useState('');
  const [filterArea, setFilterArea] = useState('');

  const [appliedBeds, setAppliedBeds] = useState<number | null>(null);
  const [appliedBaths, setAppliedBaths] = useState<number | null>(null);
  const [appliedNear, setAppliedNear] = useState('');
  const [appliedArea, setAppliedArea] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMap, setDistanceMap] = useState<Record<string, { distanceKm: number; driveMin: number }>>({});
  const [geocoding, setGeocoding] = useState(false);
  const [distanceUnavailable, setDistanceUnavailable] = useState(false);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoadingProperties(true);
        const propertiesData = await api.getProperties();
        setProperties(propertiesData);
      } catch (error) {
        console.error("Error fetching properties:", error);
        setProperties([]);
      } finally {
        setLoadingProperties(false);
      }
    };

    fetchProperties();
  }, []);

  const applyFilters = async () => {
    setAppliedBeds(filterBeds > 0 ? filterBeds : null);
    setAppliedBaths(filterBaths > 0 ? filterBaths : null);
    setAppliedNear(nearLocation.trim() || '');
    setAppliedArea(filterArea.trim() || '');

    if (nearLocation.trim()) {
      setGeocoding(true);
      setDistanceMap({});
      setDistanceUnavailable(false);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const placeRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nearLocation.trim())}&limit=1`,
          { headers: { 'Accept-Language': 'en' }, signal: controller.signal }
        );
        clearTimeout(timeoutId);
        const placeData = await placeRes.json();
        if (placeData?.[0]) {
          const lat = parseFloat(placeData[0].lat);
          const lon = parseFloat(placeData[0].lon);
          setLocationCoords({ lat, lng: lon });
          const map: Record<string, { distanceKm: number; driveMin: number }> = {};
          for (const p of properties) {
            const addr = [p.address, p.city, p.state].filter(Boolean).join(', ');
            await new Promise(r => setTimeout(r, 250));
            try {
              const c2 = new AbortController();
              const t2 = setTimeout(() => c2.abort(), 6000);
              const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`,
                { headers: { 'Accept-Language': 'en' }, signal: c2.signal }
              );
              clearTimeout(t2);
              const data = await res.json();
              if (data?.[0]) {
                const plat = parseFloat(data[0].lat);
                const plon = parseFloat(data[0].lon);
                const km = haversineKm(lat, lon, plat, plon);
                const driveMin = Math.round((km / 30) * 60);
                map[String(p.id)] = { distanceKm: km, driveMin };
              }
            } catch {
              // per-property failure: skip this property; rest of filters still work
            }
          }
          setDistanceMap(map);
          if (Object.keys(map).length === 0) setDistanceUnavailable(true);
        } else {
          setLocationCoords(null);
          setDistanceUnavailable(true);
        }
      } catch {
        setLocationCoords(null);
        setDistanceUnavailable(true);
      } finally {
        setGeocoding(false);
      }
    } else {
      setLocationCoords(null);
      setDistanceMap({});
      setDistanceUnavailable(false);
    }
  };

  const clearFilters = () => {
    setFilterBeds(0);
    setFilterBaths(0);
    setNearLocation('');
    setFilterArea('');
    setAppliedBeds(null);
    setAppliedBaths(null);
    setAppliedNear('');
    setAppliedArea('');
    setLocationCoords(null);
    setDistanceMap({});
    setDistanceUnavailable(false);
  };

  const removeFilter = (which: 'beds' | 'baths' | 'near' | 'area') => {
    if (which === 'beds') { setAppliedBeds(null); setFilterBeds(0); }
    if (which === 'baths') { setAppliedBaths(null); setFilterBaths(0); }
    if (which === 'near') { setAppliedNear(''); setNearLocation(''); setLocationCoords(null); setDistanceMap({}); setDistanceUnavailable(false); }
    if (which === 'area') { setAppliedArea(''); setFilterArea(''); }
  };

  const areaOptions = useMemo(() => {
    const fromProps = properties.map(p => p.area).filter((a): a is string => Boolean(a?.trim()));
    return [...new Set([...LISTING_AREAS, ...fromProps])].sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const filteredListings = useMemo(() => {
    let list = properties.map(p => ({ property: p, listing: propertyToListing(p) }));
    if (appliedBeds != null) list = list.filter(({ property }) => Math.round(Number(property.bedrooms ?? 2)) === appliedBeds);
    if (appliedBaths != null) list = list.filter(({ property }) => Math.round(Number(property.bathrooms ?? 2)) === appliedBaths);
    if (appliedArea) {
      const areaLower = appliedArea.toLowerCase();
      list = list.filter(({ property }) => {
        if (property.area && property.area.toLowerCase() === areaLower) return true;
        const full = [property.address, property.name, property.city, property.state].filter(Boolean).join(' ').toLowerCase();
        return full.includes(areaLower);
      });
    }
    if (appliedNear && Object.keys(distanceMap).length === 0 && !geocoding) {
      const q = appliedNear.toLowerCase();
      list = list.filter(({ property }) =>
        [property.address, property.city, property.state].some(s => s && String(s).toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => (a.listing.status === 'occupied' ? 1 : 0) - (b.listing.status === 'occupied' ? 1 : 0));
    if (appliedNear && Object.keys(distanceMap).length > 0) {
      list.sort((a, b) => {
        const da = distanceMap[String(a.property.id)]?.distanceKm ?? Infinity;
        const db = distanceMap[String(b.property.id)]?.distanceKm ?? Infinity;
        return da - db;
      });
    }
    return list;
  }, [properties, propertyToListing, appliedBeds, appliedBaths, appliedArea, appliedNear, distanceMap, geocoding]);

  const listingsByArea = useMemo(() => {
    const byArea = new Map<string, typeof filteredListings>();
    for (const item of filteredListings) {
      const area = getAreaGroupForProperty(item.property);
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area)!.push(item);
    }
    // Within each group: vacant/available first, then occupied
    const vacantFirst = (a: typeof filteredListings[0], b: typeof filteredListings[0]) =>
      (a.listing.status === 'occupied' ? 1 : 0) - (b.listing.status === 'occupied' ? 1 : 0);
    for (const arr of byArea.values()) arr.sort(vacantFirst);
    // Order: Avenue Q, Sherman St, Avenue H, 70th Street, Wooding St, Bella Jess Dr, Magnolia Dr, Westlock Dr, then Other
    const order = [...LISTING_AREAS, 'Other'];
    const groups: { areaLabel: string; items: typeof filteredListings }[] = [];
    for (const area of order) {
      if (byArea.has(area)) groups.push({ areaLabel: area, items: byArea.get(area)! });
    }
    return groups;
  }, [filteredListings]);

  return (
    <div className="space-y-0 pb-16">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-900 text-white py-20 md:py-28 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-20 bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-blue-900/80 to-indigo-900/80"></div>
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="max-w-3xl">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">Find your next home in Texas</h1>
              <p className="text-indigo-100 text-xl mb-10 leading-relaxed font-medium">Browse our curated selection of premium rentals with transparent pricing and instant applications.</p>
              
              <div className="flex flex-wrap items-center gap-4">
                 <button onClick={() => setView('check_status')} className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-2xl shadow-emerald-500/30 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-500/30">
                    <Clock className="w-5 h-5" /> Check Application Status
                 </button>
                 <button onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-bold rounded-xl border-2 border-white/30 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-white/30">
                   Browse Listings
                 </button>
              </div>
          </div>
        </div>
      </div>

      <div id="listings" className="max-w-7xl mx-auto px-6 md:px-10 w-full pt-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-10 tracking-tight">Available Properties</h2>

          {/* Filter */}
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 tracking-wide">Filter</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Bedrooms</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setFilterBeds(Math.max(0, filterBeds - 1))} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                    <Minus className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-slate-800">{filterBeds}</span>
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
                  <span className="w-6 text-center text-sm font-semibold text-slate-800">{filterBaths}</span>
                  <button type="button" onClick={() => setFilterBaths(filterBaths + 1)} className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100">
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Area</label>
                <select
                  value={filterArea}
                  onChange={e => setFilterArea(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-sm text-slate-800 bg-white"
                >
                  <option value="">Any area</option>
                  {areaOptions.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Near (location)</label>
                <input
                  type="text"
                  value={nearLocation}
                  onChange={e => setNearLocation(e.target.value)}
                  placeholder="e.g. Downtown Houston"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-sm text-slate-800 placeholder-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1 mb-0.5">Suggested:</p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_LOCATIONS.map(loc => (
                    <button key={loc} type="button" onClick={() => setNearLocation(loc)} className="text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-slate-600">
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={applyFilters} disabled={geocoding} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg text-xs">
                  {geocoding ? 'Calculating…' : 'Apply'}
                </button>
                {(appliedBeds != null || appliedBaths != null || appliedNear || appliedArea) && (
                  <button type="button" onClick={clearFilters} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-xs">
                    Clear
                  </button>
                )}
                {distanceUnavailable && (
                  <span className="text-xs text-amber-700 font-medium">Distance unavailable</span>
                )}
              </div>
            </div>
          </div>

          {/* Active filter tags */}
          {(appliedBeds != null || appliedBaths != null || appliedNear || appliedArea) && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {appliedBeds != null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
                  Bedrooms: {appliedBeds} <button type="button" onClick={() => removeFilter('beds')} aria-label="Remove"><X className="w-4 h-4" /></button>
                </span>
              )}
              {appliedBaths != null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
                  Bathrooms: {appliedBaths} <button type="button" onClick={() => removeFilter('baths')} aria-label="Remove"><X className="w-4 h-4" /></button>
                </span>
              )}
              {appliedArea && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
                  Area: {appliedArea} <button type="button" onClick={() => removeFilter('area')} aria-label="Remove"><X className="w-4 h-4" /></button>
                </span>
              )}
              {appliedNear && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
                  Near: {appliedNear} <button type="button" onClick={() => removeFilter('near')} aria-label="Remove"><X className="w-4 h-4" /></button>
                </span>
              )}
              {distanceUnavailable && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">Distance unavailable</span>
              )}
            </div>
          )}

          {loadingProperties ? (
            <div className="text-center py-20">
              <div className="relative mx-auto mb-6">
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-indigo-600" />
              </div>
              <p className="text-slate-600 font-semibold text-lg">Loading properties...</p>
              <p className="text-slate-500 text-sm mt-2">Please wait while we fetch the latest listings</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-slate-200">
              <div className="w-20 h-20 mx-auto mb-6 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Building2 className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No properties available</h3>
              <p className="text-slate-600 font-medium">Check back soon for new listings</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-slate-200">
              <div className="w-20 h-20 mx-auto mb-6 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Building2 className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No listings match your filters</h3>
              <p className="text-slate-600 font-medium">Try changing or clearing filters</p>
              <button type="button" onClick={clearFilters} className="mt-4 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl">Clear Filters</button>
            </div>
          ) : (
            <div className="space-y-12">
              {listingsByArea.map(({ areaLabel, items }) => (
                <section key={areaLabel} aria-labelledby={`heading-${areaLabel.replace(/\s+/g, '-')}`}>
                  <h3 id={`heading-${areaLabel.replace(/\s+/g, '-')}`} className="text-2xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">
                    {areaLabel === 'Other' ? 'Other' : `Properties in ${areaLabel}`}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map(({ property, listing }) => {
                      const dist = distanceMap[String(property.id)];
                      return (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          handleApply={handleApply}
                          onViewDetails={setDetailsListing}
                          distanceKm={dist?.distanceKm}
                          driveMin={dist?.driveMin}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
      </div>

      {detailsListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailsListing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex gap-4 p-5">
              <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                {detailsListing.image ? (
                  <img src={detailsListing.image} alt={detailsListing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-900 truncate">{detailsListing.title}</h3>
                <p className="text-sm text-slate-600 mt-1 capitalize">
                  {detailsListing.furnishingType || (detailsListing.furnishingsBreakdown?.length ? 'Furnished' : 'Unfurnished')}
                </p>
              </div>
            </div>
            {detailsListing.furnishingsBreakdown && detailsListing.furnishingsBreakdown.length > 0 && (
              <div className="px-5 pb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Details</p>
                <ul className="text-sm text-slate-700 space-y-1">
                  {detailsListing.furnishingsBreakdown.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => setDetailsListing(null)}
                className="w-full py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

