import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { LogOut, LayoutDashboard, List, Trophy, Users } from 'lucide-react';

interface OrganizerLayoutProps { children: React.ReactNode; className?: string; title?: string; }

export function OrganizerLayout({ children, className, title }: OrganizerLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = [
    { label: 'Dashboard', path: '/organizer/dashboard', icon: LayoutDashboard },
    { label: 'Participant Teams', path: '/organizer/teams', icon: Users },
    { label: 'Clues', path: '/organizer/clues', icon: List },
    { label: 'Leaderboard', path: '/organizer/leaderboard', icon: Trophy },
  ];
  return (
    <div className={cn('flex min-h-[100dvh] w-full bg-[#0a0a0a] text-gray-200 font-sans', className)}>
      <div className="w-64 bg-[#111] border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-800"><h1 className="font-display text-xl text-gold uppercase tracking-widest">Convergence</h1><p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Organizer Panel</p></div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => { const isActive = location.pathname === item.path; const Icon = item.icon; return <button key={item.path} onClick={() => navigate(item.path)} className={cn('w-full flex items-center gap-3 px-6 py-3 text-sm transition-colors', isActive ? 'bg-gold/10 text-gold border-r-2 border-gold' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50')}><Icon className="w-4 h-4" />{item.label}</button>; })}
        </nav>
        <div className="p-4 border-t border-gray-800"><button onClick={() => navigate('/organizer')} className="w-full flex items-center gap-3 px-2 py-2 text-sm text-gray-400 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" />Logout</button></div>
      </div>
      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden">
        {title && <header className="px-8 py-6 border-b border-gray-800 shrink-0 bg-[#0a0a0a]"><h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2></header>}
        <main className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">{children}</main>
      </div>
    </div>
  );
}
