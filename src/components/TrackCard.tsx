import React from 'react';
import { cn } from '../lib/utils';
import { CompassIcon, ChestIcon, CrewIcon } from '../icons/CustomIcons';

interface TrackCardProps {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}

export function TrackCard({ id, name, subtitle, selected, onClick }: TrackCardProps) {
  // Map IDs to specific tailwind colors
  const styles: Record<string, { bg: string, border: string }> = {
    'A': { bg: 'bg-crimson/90', border: 'border-crimson-border' },
    'B': { bg: 'bg-azure/90', border: 'border-azure-border' },
    'C': { bg: 'bg-verdant/90', border: 'border-verdant-border' },
    'D': { bg: 'bg-sands/90', border: 'border-sands-border' }
  };
  
  const currentStyle = styles[id] || { bg: 'bg-void/90', border: 'border-gold/40' };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full flex items-center p-4 border rounded overflow-hidden text-left transition-all duration-200",
        currentStyle.bg,
        selected 
          ? `border-gold shadow-[0_0_15px_rgba(201,162,75,0.4)] transform scale-[1.02]` 
          : `${currentStyle.border} opacity-80 hover:opacity-100`
      )}
    >
      <div className="flex-1 pr-4 relative z-10">
        <h3 className="font-display text-lg text-offwhite uppercase tracking-widest">{name}</h3>
        <p className="text-xs text-offwhite/70 mt-1 font-medium">{subtitle}</p>
      </div>
      <div className={cn(
        "w-12 h-12 shrink-0 flex items-center justify-center rounded-full border bg-void/50 relative z-10 transition-colors",
        selected ? "border-gold text-gold" : "border-offwhite/20 text-offwhite/50"
      )}>
        <CompassIcon className="w-6 h-6" />
      </div>
    </button>
  );
}
