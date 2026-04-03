import React from 'react';

export const Logo = ({ className = "", height = 32 }: { className?: string, height?: number }) => {
  return (
    <div className={`flex items-center gap-1 select-none ${className}`} style={{ height }}>
      <div className="flex items-baseline">
        <span 
          className="font-black tracking-tight text-[#0D0D0D]" 
          style={{ fontSize: `${height * 0.75}px` }}
        >
          Medi
        </span>
        <span 
          className="font-black tracking-tight text-[#00BCD4]" 
          style={{ fontSize: `${height * 0.75}px` }}
        >
          Queue
        </span>
      </div>
      
      {/* Precision Pulse Line Icon */}
      <div className="flex items-center ml-0.5 mt-0.5">
        <svg 
          width={height * 0.6} 
          height={height * 0.4} 
          viewBox="0 0 24 16" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="text-[#00BCD4]"
        >
          <path 
            d="M1 8H5L8 1L12 15L15 8H23" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

