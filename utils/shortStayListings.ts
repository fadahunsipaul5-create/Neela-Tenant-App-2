import { Property } from '../types';

/** Guest-facing short-stay listing helpers — never show real property names or street addresses. */
export function shortStayTitle(p: Property): string {
  return p.shortStayListingTitle || `Cozy ${p.bedrooms ?? 2}-Bed Retreat`;
}

export function shortStayDescription(p: Property): string {
  return (
    p.shortStayListingDescription ||
    'A welcoming, comfortable space designed for rest and relaxation during your Houston stay.'
  );
}

export function shortStayLocation(p: Property): string {
  if (p.shortStayListingLocation) return p.shortStayListingLocation;
  const area = p.shortStayListingArea || 'Greater Houston';
  const city = p.city || 'Houston';
  const state = p.state || 'TX';
  return `${area}, ${city}, ${state}`;
}

export function shortStayArea(p: Property): string {
  return p.shortStayListingArea || 'Greater Houston';
}
