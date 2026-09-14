import React from 'react';
import { cn } from '../lib/utils';

interface ParchmentCardProps {
  children: React.ReactNode;
  className?: string;
  withTornEdge?: boolean;
  variant?: 'light' | 'dark';
}

export function ParchmentCard({ children, className, withTornEdge = true, variant = 'light' }: ParchmentCardProps) {
  const isDark = variant === 'dark';

  return (
    <div className={cn("relative drop-shadow-xl", className)}>
      <div 
        className={cn(
          "p-6 md:p-8",
          isDark 
            ? "bg-void/90 border border-gold/30 text-offwhite" 
            : "bg-parchment-texture border border-gold/40 text-ink",
          withTornEdge ? "torn-edge rounded-sm" : "rounded-md"
        )}
      >
        {/* Inner Border for dark mode */}
        {isDark && (
           <div className="absolute inset-1 border border-gold/10 rounded-sm pointer-events-none" />
        )}

        {/* Burn marks / stains (only on light mode) */}
        {!isDark && (
          <>
            <div className="absolute top-0 left-0 w-16 h-16 bg-black/10 rounded-full blur-xl pointer-events-none mix-blend-multiply" />
            <div className="absolute bottom-4 right-4 w-24 h-24 bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')] opacity-30 pointer-events-none mix-blend-multiply" />
          </>
        )}
        
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
