import React from 'react';

type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  showGlow?: boolean;
}

const sizeMap: Record<BrandLogoSize, string> = {
  xs: 'h-7',
  sm: 'h-9',
  md: 'h-11',
  lg: 'h-14',
};

/**
 * Neela logo ships with a baked-in black background. mix-blend-screen removes
 * the black on our brand gradient so white lettering stays crisp — no white or flat black box.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', className = '', showGlow = true }) => {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {showGlow && (
        <div
          className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500/40 via-violet-500/30 to-blue-600/40 blur-md"
          aria-hidden
        />
      )}
      <div className="relative rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-700 px-2.5 py-1.5 shadow-lg shadow-indigo-500/25 ring-1 ring-white/10">
        <img
          src="/neela-logo.webp"
          alt="Neela Capital Investments"
          className={`${sizeMap[size]} w-auto object-contain mix-blend-screen`}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default BrandLogo;
