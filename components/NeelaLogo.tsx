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
}

const NeelaLogo: React.FC<NeelaLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
}) => {
  if (variant === 'mark') {
    return (
      <div
        className={`overflow-hidden rounded-lg bg-black flex-shrink-0 ${MARK_WIDTH[size]} ${HEIGHT[size]} ${className}`}
        aria-hidden
      >
        <img
          src={NEELA_LOGO_SRC}
          alt=""
          className={`${HEIGHT[size]} w-auto max-w-none object-left object-contain`}
          style={{ width: '220%' }}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <img
      src={NEELA_LOGO_SRC}
      alt={NEELA_BRAND_NAME}
      className={`${HEIGHT[size]} w-auto max-w-full object-contain bg-black rounded-lg ${className}`}
      draggable={false}
    />
  );
};

export default NeelaLogo;
