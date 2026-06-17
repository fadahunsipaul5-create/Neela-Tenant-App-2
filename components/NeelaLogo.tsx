import React from 'react';
import { NEELA_BRAND_NAME, NEELA_LOGO_SRC } from '../constants/branding';

/** Full wordmark — height + max-width so text stays readable on every breakpoint */
const FULL_CLASS: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'h-6 max-w-[7.5rem] sm:max-w-[8rem]',
  sm: 'h-8 max-w-[9.5rem] sm:max-w-[10.5rem]',
  md: 'h-10 max-w-[11rem] sm:max-w-[12rem]',
  lg: 'h-11 max-w-[12.5rem] sm:max-w-[13.5rem] lg:max-w-[14rem]',
  xl: 'h-12 max-w-[13rem] sm:max-w-[14.5rem] lg:max-w-[15.5rem]',
};

/** Icon mark — square crop of the pillar graphic */
const MARK_CLASS: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-9 h-9 sm:w-10 sm:h-10',
  md: 'w-10 h-10 sm:w-11 sm:h-11',
  lg: 'w-11 h-11 sm:w-12 sm:h-12',
  xl: 'w-12 h-12 sm:w-14 sm:h-14',
};

export interface NeelaLogoProps {
  variant?: 'full' | 'mark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showGlow?: boolean;
}

const NeelaLogo: React.FC<NeelaLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showGlow = false,
}) => {
  if (variant === 'mark') {
    return (
      <div className={`relative inline-flex shrink-0 ${className}`}>
        {showGlow && (
          <div className="absolute -inset-0.5 rounded-lg logo-glow blur-sm" aria-hidden />
        )}
        <div
          className={`logo-surface logo-surface--mark relative overflow-hidden rounded-lg flex-shrink-0 ring-1 ring-white/10 ${MARK_CLASS[size]}`}
          aria-hidden
        >
          <img
            src={NEELA_LOGO_SRC}
            alt=""
            className="logo-img logo-img--mark absolute left-0 top-1/2 -translate-y-1/2 h-full w-auto max-w-none object-left"
            draggable={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex shrink-0 max-w-full ${className}`}>
      {showGlow && (
        <div className="absolute -inset-1 rounded-xl logo-glow blur-sm" aria-hidden />
      )}
      <div className="logo-surface logo-surface--full relative overflow-hidden rounded-lg px-1.5 py-0.5 sm:px-2 ring-1 ring-white/10 leading-none max-w-full">
        <img
          src={NEELA_LOGO_SRC}
          alt={NEELA_BRAND_NAME}
          className={`logo-img w-auto ${FULL_CLASS[size]}`}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default NeelaLogo;
