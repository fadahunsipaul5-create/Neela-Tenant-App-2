import React from 'react';
import { NEELA_BRAND_NAME, NEELA_LOGO_SRC } from '../constants/branding';

const HEIGHT: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
  xl: 'h-16',
};

const MARK_WIDTH: Record<NonNullable<NeelaLogoProps['size']>, string> = {
  xs: 'w-6',
  sm: 'w-8',
  md: 'w-10',
  lg: 'w-12',
  xl: 'w-16',
};

export interface NeelaLogoProps {
  /** `mark` = icon crop for compact spaces; `full` = horizontal wordmark */
  variant?: 'full' | 'mark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showGlow?: boolean;
}

/**
 * Logo ships with a baked-in black background. mix-blend-screen on a dark
 * charcoal surface removes the black box without using white behind the lettering.
 */
const NeelaLogo: React.FC<NeelaLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showGlow = false,
}) => {
  const img = (
    <img
      src={NEELA_LOGO_SRC}
      alt={variant === 'mark' ? '' : NEELA_BRAND_NAME}
      className={`${HEIGHT[size]} w-auto object-contain mix-blend-screen`}
      draggable={false}
    />
  );

  if (variant === 'mark') {
    return (
      <div className={`relative inline-flex shrink-0 ${className}`}>
        {showGlow && (
          <div className="absolute -inset-1 rounded-xl logo-glow blur-md" aria-hidden />
        )}
        <div
          className={`logo-surface relative overflow-hidden rounded-lg flex-shrink-0 ring-1 ring-white/10 ${MARK_WIDTH[size]} ${HEIGHT[size]}`}
          aria-hidden={variant === 'mark'}
        >
          <div className="absolute inset-0 flex items-center justify-start pl-0.5">
            <img
              src={NEELA_LOGO_SRC}
              alt=""
              className={`${HEIGHT[size]} w-auto max-w-none object-left object-contain mix-blend-screen`}
              style={{ width: '220%' }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {showGlow && (
        <div className="absolute -inset-1 rounded-2xl logo-glow blur-md" aria-hidden />
      )}
      <div className="logo-surface relative rounded-xl px-2.5 py-1.5 ring-1 ring-white/10">
        {img}
      </div>
    </div>
  );
};

export default NeelaLogo;
