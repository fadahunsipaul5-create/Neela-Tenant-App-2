import React, { useState, useEffect } from 'react';
import { Listing, Property } from '../types';
import { api } from '../services/api';
import {
  MapPin, BedDouble, Bath, Maximize, Building2, Loader2, Clock
} from 'lucide-react';

interface ListingsProps {
  setView: (view: string) => void;
  setLoginType: (type: 'admin' | 'tenant' | null) => void;
  handleApply: (listing: Listing) => void;
  propertyToListing: (property: Property) => Listing;
}

const ListingCard: React.FC<{ listing: Listing; handleApply: (listing: Listing) => void }> = ({ listing, handleApply }) => (
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
      <div className="flex items-start text-slate-600 mb-5 text-sm font-medium">
        <MapPin className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0 text-indigo-500" />
        <span className="leading-relaxed">{listing.address}</span>
      </div>
      
      <div className="flex items-center justify-between mb-7 text-sm text-slate-600 font-semibold bg-slate-50 rounded-xl p-4">
        <div className="flex items-center gap-2"><BedDouble className="w-5 h-5 text-indigo-500"/> <span>{listing.beds} Beds</span></div>
        <div className="flex items-center gap-2"><Bath className="w-5 h-5 text-indigo-500"/> <span>{listing.baths} Baths</span></div>
        <div className="flex items-center gap-2"><Maximize className="w-5 h-5 text-indigo-500"/> <span>{listing.sqft} sqft</span></div>
      </div>

      <div className="mt-auto pt-5 border-t-2 border-slate-100">
        <button 
          onClick={() => handleApply(listing)}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 flex justify-center items-center gap-2 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
          aria-label={`Apply for ${listing.title}`}
        >
          <span>Apply Now</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
        </button>
      </div>
    </div>
  </div>
);

export const Listings: React.FC<ListingsProps> = ({ setView, setLoginType, handleApply, propertyToListing }) => {
  // Properties State
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);

  // Fetch properties for listings
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
              
              <div className="flex flex-wrap gap-4">
                 <button onClick={() => setView('check_status')} className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-2xl shadow-emerald-500/30 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-500/30">
                    <Clock className="w-5 h-5" /> Check Application Status
                 </button>
                 <button onClick={() => setLoginType('tenant')} className="px-8 py-4 bg-white/95 text-indigo-900 font-bold rounded-xl hover:bg-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-white/30">
                   Resident Login
                 </button>
                 <button onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-bold rounded-xl border-2 border-white/30 transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-white/30">
                   Browse Listings
                 </button>
              </div>
          </div>
        </div>
      </div>

      <div id="listings" className="max-w-7xl mx-auto px-6 md:px-10 w-full pt-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-10 tracking-tight">Available Properties</h2>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.map(property => {
                const listing = propertyToListing(property);
                return <ListingCard key={listing.id} listing={listing} handleApply={handleApply} />;
              })}
            </div>
          )}
      </div>
    </div>
  );
};

