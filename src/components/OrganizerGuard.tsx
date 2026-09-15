import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isOrganizerAuthenticated } from '../lib/db';

export function OrganizerGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    void isOrganizerAuthenticated().then((allowed) => {
      if (!cancelled) setState(allowed ? 'allowed' : 'denied');
    });
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return <div className="min-h-[100dvh] bg-[#0a0a0a] text-gray-400 flex items-center justify-center">Authenticating organizer session…</div>;
  }

  if (state === 'denied') return <Navigate to="/organizer" replace />;
  return <>{children}</>;
}
