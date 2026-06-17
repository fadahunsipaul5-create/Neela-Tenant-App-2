import React from 'react';
import { NEELA_BRAND_NAME, NEELA_LOGO_SRC } from '../constants/branding';

const HEIGHT: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'h-5',
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-11',
  xl: 'h-14',
};

const MARK_WIDTH: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'w-5',
  sm: 'w-7',
  md: 'w-9',
  lg: 'w-11',
  xl: 'w-14',
};

export interface NeelaLogoProps {
  /** `mark` = icon crop for compact spaces; `full` = horizontal wordmark */
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
          className={`logo-surface logo-surface--mark relative overflow-hidden rounded-md flex-shrink-0 ring-1 ring-white/10 ${MARK_WIDTH[size]} ${HEIGHT[size]}`}
          aria-hidden
        >
          <img
            src={NEELA_LOGO_SRC}
            alt=""
            className={`logo-img absolute left-0 top-1/2 -translate-y-1/2 ${HEIGHT[size]} w-auto max-w-none object-left`}
            style={{ width: '210%' }}
            draggable={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {showGlow && (
        <div className="absolute -inset-0.5 rounded-lg logo-glow blur-sm" aria-hidden />
      )}
      <div className="logo-surface relative overflow-hidden rounded-lg px-1 py-0 ring-1 ring-white/10 leading-none">
        <img
          src={NEELA_LOGO_SRC}
          alt={NEELA_BRAND_NAME}
          className={`logo-img ${HEIGHT[size]} w-auto`}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default NeelaLogo;
