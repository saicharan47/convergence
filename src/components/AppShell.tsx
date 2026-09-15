import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { SlideOverMenu } from './SlideOverMenu';

interface AppShellProps {
  children: ReactNode;
  showBack?: boolean;
  showMenu?: boolean;
  title?: string;
  className?: string;
}

export function AppShell({ children, showBack, showMenu, title, className }: AppShellProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={cn("mobile-app-container flex flex-col relative w-full", className)}>
      <div className="flex flex-col flex-1 relative w-full max-w-md mx-auto z-10">
        <header className="safe-pt px-4 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="w-10 flex justify-start">
            {showBack && <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gold hover:text-gold-hover transition-colors"><ArrowLeft className="w-6 h-6" /></button>}
          </div>
          <div className="flex-1 text-center"><h1 className="font-display text-xl md:text-2xl text-offwhite tracking-widest uppercase">{title || "THE CONVERGENCE"}</h1></div>
          <div className="w-10 flex justify-end">
            {showMenu && <button onClick={() => setMenuOpen(true)} className="p-2 -mr-2 text-gold hover:text-gold-hover transition-colors"><Menu className="w-6 h-6" /></button>}
          </div>
        </header>
        <main className={cn("flex-1 flex flex-col px-6 pb-24 relative z-10", className)}>{children}</main>
        <div className="absolute inset-x-0 bottom-0 h-64 pointer-events-none z-0 compass-watermark" />
        <SlideOverMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    </div>
  );
}
