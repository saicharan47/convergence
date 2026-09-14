import React from 'react';
import { cn } from '../lib/utils';

interface ProgressDotsProps {
  total: number;
  current: number; // 0-indexed. If current is 3, dots 0,1,2 are filled.
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-500",
              i < current ? "bg-gold shadow-[0_0_5px_rgba(201,162,75,0.8)]" : "bg-transparent border border-gold/30",
              i === current ? "animate-pulse border border-gold" : ""
            )}
          />
        ))}
      </div>
      <div className="font-sans text-xs tracking-widest text-muted uppercase">
        {current} / {total}
      </div>
    </div>
  );
}
