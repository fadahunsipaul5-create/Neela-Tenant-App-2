import { useEffect } from 'react';
import { Property } from '../types';
import { shortStayArea, shortStayDescription, shortStayTitle } from './shortStayListings';

export const SITE_NAME = 'Neela Capital Investments';

const DEFAULT_DESCRIPTION =
  'Neela Capital Investments — Houston apartment rentals, furnished homes, and Airbnb-style short stays. Browse listings, apply online, or book nightly getaways.';

export function getSiteUrl(): string {
  const env = import.meta.env.VITE_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://neelacapital.com';
}

export type PageMetaOptions = {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(data: PageMetaOptions['jsonLd']) {
  const id = 'neela-json-ld';
  document.getElementById(id)?.remove();
  if (!data) return;
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function setPageMeta(options: PageMetaOptions) {
  const fullTitle = options.title ? `${options.title} | ${SITE_NAME}` : SITE_NAME;
  const description = options.description || DEFAULT_DESCRIPTION;
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const canonical = options.canonical || `${getSiteUrl()}${path}`;
  const ogImage = options.ogImage || `${getSiteUrl()}/neela-logo.webp`;

  document.title = fullTitle;
  upsertMeta('description', description);
  if (options.keywords) upsertMeta('keywords', options.keywords);
  upsertMeta('robots', options.robots || 'index, follow');
  upsertLink('canonical', canonical);

  upsertMeta('og:title', fullTitle, 'property');
  upsertMeta('og:description', description, 'property');
  upsertMeta('og:site_name', SITE_NAME, 'property');
  upsertMeta('og:type', options.ogType || 'website', 'property');
  upsertMeta('og:url', canonical, 'property');
  upsertMeta('og:image', ogImage, 'property');
  upsertMeta('og:locale', 'en_US', 'property');

  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:title', fullTitle);
  upsertMeta('twitter:description', description);
  upsertMeta('twitter:image', ogImage);

  upsertJsonLd(options.jsonLd);
}

export function usePageMeta(options: PageMetaOptions) {
  useEffect(() => {
    setPageMeta(options);
  }, [
    options.title,
    options.description,
    options.keywords,
    options.canonical,
    options.ogImage,
    options.ogType,
    options.robots,
    options.jsonLd,
  ]);
}

export const SEO_PAGES = {
  home: {
    description:
      'Find furnished and unfurnished apartments for rent in Houston, TX. Browse Neela Capital listings, check availability, and apply online.',
    keywords:
      'Houston apartments for rent, Houston rentals, furnished apartments Houston, Neela Capital, apartment listings Houston TX',
    canonical: `${getSiteUrl()}/`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: SITE_NAME,
      url: getSiteUrl(),
      areaServed: { '@type': 'City', name: 'Houston', addressRegion: 'TX' },
      description: DEFAULT_DESCRIPTION,
    },
  },
  shortStaysBrowse: {
    title: 'Short Stays & Airbnb-Style Getaways in Houston',
    description:
      'Book Airbnb-style short stays in Houston. Nightly rentals with flexible check-in — East Houston, Inner Loop, Medical Center, and more. No platform fees, book direct with Neela Capital.',
    keywords:
      'short stay Houston, Airbnb Houston, Houston vacation rental, nightly rental Houston, furnished short term rental Houston, Houston Airbnb alternative, book short stay Houston TX',
    canonical: `${getSiteUrl()}/short-stays`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Short Stays in Houston',
      description: 'Browse and book Airbnb-style short-term stays across Houston.',
      url: `${getSiteUrl()}/short-stays`,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: getSiteUrl() },
    },
  },
  adminLogin: {
    title: 'Admin Login',
    description: 'Secure admin portal for Neela Capital property management.',
    robots: 'noindex, nofollow',
  },
  tenantLogin: {
    title: 'Tenant Portal Login',
    description: 'Resident login for Neela Capital tenant portal — pay rent, submit maintenance, and manage your lease.',
    keywords: 'Neela Capital tenant portal, Houston tenant login, pay rent online',
    canonical: `${getSiteUrl()}/tenant`,
  },
  managerLogin: {
    title: 'Property Manager Login',
    description: 'Property manager portal for Neela Capital.',
    robots: 'noindex, nofollow',
  },
  managerPortal: {
    title: 'Property Manager Portal',
    description: 'Property manager dashboard for Neela Capital.',
    robots: 'noindex, nofollow',
  },
  signLease: {
    title: 'Sign Lease',
    description: 'Sign your Neela Capital lease agreement online.',
    robots: 'noindex, nofollow',
  },
} as const satisfies Record<string, PageMetaOptions>;

export function shortStayListingMeta(property: Property): PageMetaOptions {
  const title = shortStayTitle(property);
  const area = shortStayArea(property);
  const desc = shortStayDescription(property);
  const rate = property.shortStayNightlyRate;
  const metaTitle = `${title} — Short Stay in ${area}, Houston`;
  const metaDesc =
    `${desc.slice(0, 140)}${desc.length > 140 ? '…' : ''} Book this Houston short stay from $${
      rate ?? '115'
    }/night.`;
  const canonical = `${getSiteUrl()}/short-stays/${property.id}`;
  const image = property.image || `${getSiteUrl()}/neela-logo.webp`;

  return {
    title: metaTitle,
    description: metaDesc,
    keywords: `short stay ${area} Houston, Airbnb ${area}, Houston vacation rental, nightly rental Houston, ${title}`,
    canonical,
    ogImage: image,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VacationRental',
      name: title,
      description: desc,
      url: canonical,
      image,
      address: {
        '@type': 'PostalAddress',
        addressLocality: property.city || 'Houston',
        addressRegion: property.state || 'TX',
        addressCountry: 'US',
      },
      numberOfRooms: property.bedrooms,
      occupancy: {
        '@type': 'QuantitativeValue',
        maxValue: property.shortStayMaxGuests ?? 4,
      },
      ...(rate
        ? {
            offers: {
              '@type': 'Offer',
              price: rate,
              priceCurrency: 'USD',
              unitText: 'NIGHT',
            },
          }
        : {}),
    },
  };
}

export function adminTabMeta(tab: string): PageMetaOptions {
  const labels: Record<string, string> = {
    dashboard: 'Admin Dashboard',
    tenants: 'Tenants & Applicants',
    payments: 'Rent & Payments',
    maintenance: 'Maintenance',
    'short-stays': 'Short Stays Management',
    'income-statement': 'Income Statement',
    legal: 'Legal & Compliance',
    settings: 'Settings',
    documents: 'Documents',
  };
  return {
    title: labels[tab] || 'Admin Portal',
    description: 'Neela Capital admin property management portal.',
    robots: 'noindex, nofollow',
  };
}
