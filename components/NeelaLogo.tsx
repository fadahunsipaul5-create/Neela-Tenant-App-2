import React from 'react';
import { NEELA_BRAND_NAME, NEELA_LOGO_SRC } from '../constants/branding';

/** Full wordmark — height + max-width so text stays readable on every breakpoint */
const FULL_CLASS: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'h-7 min-h-[1.75rem] max-w-[8.5rem] sm:max-w-[9rem]',
  sm: 'h-9 min-h-[2.25rem] max-w-[10.5rem] sm:max-w-[11.5rem]',
  md: 'h-10 min-h-[2.5rem] max-w-[11rem] sm:max-w-[12rem]',
  lg: 'h-11 min-h-[2.75rem] max-w-[12.5rem] sm:max-w-[13.5rem] lg:max-w-[14rem]',
  xl: 'h-12 min-h-[3rem] max-w-[13rem] sm:max-w-[14.5rem] lg:max-w-[15.5rem]',
};

/** Icon mark — square crop of the pillar graphic */
const MARK_CLASS: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'w-9 h-9 min-w-[2.25rem] min-h-[2.25rem]',
  sm: 'w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] sm:w-11 sm:h-11',
  md: 'w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] sm:w-12 sm:h-12',
  lg: 'w-12 h-12 min-w-[3rem] min-h-[3rem] sm:w-[3.25rem] sm:h-[3.25rem]',
  xl: 'w-14 h-14 min-w-[3.5rem] min-h-[3.5rem]',
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
