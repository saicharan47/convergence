import { X, LogOut, Navigation, Award, Users, FileText, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store';
import { cn } from '../lib/utils';

interface SlideOverMenuProps { isOpen: boolean; onClose: () => void; }
export function SlideOverMenu({ isOpen, onClose }: SlideOverMenuProps) {
  const navigate = useNavigate();
  const { teamName, trackId, logout } = useAppContext();
  const handleLogout = () => { logout(); onClose(); navigate('/'); };
  const navItems = [
    { label: 'Dashboard', icon: Navigation, path: '/dashboard' },
    { label: 'Leaderboard', icon: Award, path: '/leaderboard' },
    { label: 'Team Info', icon: Users, path: '/profile' },
    { label: 'Rules', icon: FileText, path: '#' },
    { label: 'Support', icon: HelpCircle, path: '#' },
  ];
  return <><>{isOpen && <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />}</><div className={cn('fixed top-0 right-0 h-full w-4/5 max-w-sm bg-void/95 border-l border-gold/30 z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl', isOpen ? 'translate-x-0' : 'translate-x-full')}>
    <div className="safe-pt px-6 py-4 flex justify-end"><button onClick={onClose} className="p-2 text-gold hover:text-gold-hover transition-colors"><X className="w-6 h-6" /></button></div>
    <div className="px-6 pb-8 border-b border-gold/30 flex flex-col items-center"><div className="w-20 h-20 rounded-full overflow-hidden border border-gold/30 mb-4 shadow-[0_0_15px_rgba(201,162,75,0.2)]"><img src="/images/ship-avatar.jpg" alt="Team Avatar" className="w-full h-full object-cover" /></div><h2 className="text-xl font-display text-offwhite text-center mb-1">{teamName || 'GUEST CREW'}</h2><div className="text-xs uppercase tracking-widest text-gold opacity-80">{trackId ? `Track: ${trackId}` : 'No Track Assigned'}</div></div>
    <div className="flex-1 py-6 flex flex-col gap-2 px-4 overflow-y-auto">{navItems.map((item, i) => <button key={i} onClick={() => { if (item.path !== '#') { navigate(item.path); onClose(); } }} className="flex items-center gap-4 px-4 py-3 rounded text-muted hover:text-offwhite hover:bg-void/50 transition-colors text-left"><item.icon className="w-5 h-5 text-gold" /><span className="font-sans text-sm uppercase tracking-wider">{item.label}</span></button>)}</div>
    <div className="safe-pb p-6"><button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors"><LogOut className="w-5 h-5" /><span className="font-sans text-sm uppercase tracking-wider">Abandon Ship</span></button></div>
  </div></>;
}
