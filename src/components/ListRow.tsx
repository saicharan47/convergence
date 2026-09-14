import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { CrewIcon } from '../icons/CustomIcons';

interface ListRowProps {
  label: string;
  selected?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function ListRow({ label, selected, onClick, icon }: ListRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-4 bg-void/80 border rounded text-left transition-all duration-200",
        selected 
          ? "border-gold bg-ink shadow-[0_0_10px_rgba(201,162,75,0.2)]" 
          : "border-gold/30 hover:bg-void"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", selected ? "border-gold text-gold" : "border-gold/30 text-muted")}>
          {icon || <CrewIcon className="w-4 h-4" />}
        </div>
        <span className={cn("font-sans tracking-wide uppercase text-sm", selected ? "text-offwhite font-medium" : "text-muted")}>
          {label}
        </span>
      </div>
      <ChevronRight className={cn("w-5 h-5 transition-transform", selected ? "text-gold translate-x-1" : "text-muted/50")} />
    </button>
  );
}
