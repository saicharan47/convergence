import React from 'react';
import { cn } from '../lib/utils';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'dark' | 'parchment';
}

export function PrimaryButton({ children, className, disabled, variant = 'dark', ...props }: PrimaryButtonProps) {
  const isDark = variant === 'dark';
  
  return (
    <button
      className={cn(
        "relative w-full py-4 px-6 rounded transition-all duration-200 overflow-hidden group border",
        isDark 
          ? "bg-void text-gold border-gold/40 shadow-md hover:bg-ink/80" 
          : "bg-parchment-texture text-ink border-ink/40 shadow-md",
        disabled 
          ? "opacity-50 cursor-not-allowed grayscale-[0.5]" 
          : isDark 
            ? "hover:shadow-[0_0_15px_rgba(201,162,75,0.3)] active:scale-[0.98]"
            : "hover:shadow-lg active:scale-[0.98]",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {/* Inner hairline border */}
      <div className={cn(
        "absolute inset-1 border rounded-sm pointer-events-none",
        isDark ? "border-gold/10" : "border-ink/10"
      )} />
      
      <span className="relative z-10 font-display font-bold tracking-widest uppercase text-sm md:text-base flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
