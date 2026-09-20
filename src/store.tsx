import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getConvergenceState, subscribeToConvergenceState } from './lib/db';
import type { ConvergenceState } from './lib/db';

export interface TeamProgress {
  team_id: string;
  current_clue: number;
  start_time: string | null;
  finish_time: string | null;
  hunt_started: boolean;
  disqualified: boolean;
}

interface AppState {
  teamId: string | null;
  teamName: string | null;
  trackId: string | null;
  sessionToken: string | null;
  realtimeKey: string | null;
  progress: TeamProgress | null;
  convergenceState: ConvergenceState | null;
  convergenceLoadError: string | null;
  setTeamLogin: (teamId: string, teamName: string, trackId: string, token: string, realtimeKey: string) => void;
  logout: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [teamId, setTeamId] = useState<string | null>(() => localStorage.getItem('teamId'));
  const [teamName, setTeamName] = useState<string | null>(() => localStorage.getItem('teamName'));
  const [trackId, setTrackId] = useState<string | null>(() => localStorage.getItem('trackId'));
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('sessionToken'));
  const [realtimeKey, setRealtimeKey] = useState<string | null>(() => localStorage.getItem('realtimeKey'));
  const [progress, setProgress] = useState<TeamProgress | null>(null);
  const [convergenceState, setConvergenceState] = useState<ConvergenceState | null>(null);
  const [convergenceLoadError, setConvergenceLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let refreshInterval: number | undefined;

    const refresh = async () => {
      if (!sessionToken || cancelled) return;
      try {
        const convergence = await getConvergenceState(sessionToken);
        if (cancelled) return;
        if (!convergence) {
          setConvergenceLoadError('Your team session has expired. Please log in again.');
          setConvergenceState(null);
          return;
        }

        setTeamId(convergence.team_id);
        setTeamName(convergence.name);
        setTrackId(convergence.track_id);
        setConvergenceState(convergence);
        setConvergenceLoadError(null);

        localStorage.setItem('teamId', convergence.team_id);
        localStorage.setItem('teamName', convergence.name);
        localStorage.setItem('trackId', convergence.track_id);
      } catch (error) {
        if (!cancelled) {
          console.error('[Convergence] live state refresh failed', error);
          setConvergenceLoadError('Live route sync is unavailable. Retrying automatically…');
        }
      }
    };

    let unsubscribeRealtime = () => undefined;
    if (sessionToken) {
      void refresh();
      // Broadcast gives immediate updates; the polling loop is a recovery path for missed
      // WebSocket events and network reconnects.
      if (realtimeKey) {
        unsubscribeRealtime = subscribeToConvergenceState(realtimeKey, () => void refresh());
      }
      refreshInterval = window.setInterval(() => void refresh(), 5000);
    }

    return () => {
      cancelled = true;
      unsubscribeRealtime();
      if (refreshInterval) window.clearInterval(refreshInterval);
    };
  }, [sessionToken, realtimeKey]);

  const setTeamLogin = (id: string, name: string, track: string, token: string, key: string) => {
    setTeamId(id);
    setTeamName(name);
    setTrackId(track);
    setSessionToken(token);
    setRealtimeKey(key);
    localStorage.setItem('teamId', id);
    localStorage.setItem('teamName', name);
    localStorage.setItem('trackId', track);
    localStorage.setItem('sessionToken', token);
    localStorage.setItem('realtimeKey', key);
  };

  const logout = () => {
    setTeamId(null);
    setTeamName(null);
    setTrackId(null);
    setSessionToken(null);
    setRealtimeKey(null);
    setProgress(null);
    setConvergenceState(null);
    localStorage.removeItem('teamId');
    localStorage.removeItem('teamName');
    localStorage.removeItem('trackId');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('realtimeKey');
    localStorage.removeItem('roomCode');
  };

  return <AppContext.Provider value={{ teamId, teamName, trackId, sessionToken, realtimeKey, progress, convergenceState, convergenceLoadError, setTeamLogin, logout }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
