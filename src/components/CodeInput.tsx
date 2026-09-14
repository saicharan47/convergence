import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface CodeInputProps {
  value: string;
  onChange: (val: string) => void;
  error?: boolean;
}

export function CodeInput({ value, onChange, error }: CodeInputProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (error) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.slice(-1).toUpperCase();
    const chars = value.split('').concat(Array(5).fill(' ')).slice(0, 5);
    if (/^[A-Z0-9]$/.test(char) || char === '') {
      chars[i] = char === '' ? ' ' : char;
      const newValue = chars.join('');
      onChange(newValue);
      
      if (char !== '' && i < 4) {
        inputsRef.current[i + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && value[i] === ' ' && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  return (
    <div className={cn("flex justify-between gap-2 max-w-[280px] mx-auto", shake && "animate-shake")}>
      {[0, 1, 2, 3, 4].map((i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          maxLength={2}
          value={value[i] !== ' ' && value[i] !== undefined ? value[i] : ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex(null)}
          className={cn(
            "w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-display text-offwhite bg-void/80 border border-gold/40 rounded focus:outline-none transition-all",
            focusedIndex === i ? "border-gold text-glow" : "",
            error ? "border-red-500/50 bg-red-950/20" : ""
          )}
        />
      ))}
    </div>
  );
}
