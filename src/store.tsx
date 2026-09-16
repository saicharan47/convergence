import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getTeamState, subscribeToTeamProgress } from './lib/db';

export interface TeamProgress {
  team_id: string;
  current_clue: number;
  start_time: string | null;
  finish_time: string | null;
  hunt_started: boolean;
  disqualified: boolean;
}

interface AppState {
  roomCode: string | null;
  teamId: string | null;
  teamName: string | null;
  trackId: string | null;
  sessionToken: string | null;
  realtimeKey: string | null;
  progress: TeamProgress | null;
  setRoomCode: (code: string | null) => void;
  setTeamLogin: (teamId: string, teamName: string, trackId: string, token: string, realtimeKey: string) => void;
  logout: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [roomCode, setRoomCode] = useState<string | null>(() => localStorage.getItem('roomCode'));
  const [teamId, setTeamId] = useState<string | null>(() => localStorage.getItem('teamId'));
  const [teamName, setTeamName] = useState<string | null>(() => localStorage.getItem('teamName'));
  const [trackId, setTrackId] = useState<string | null>(() => localStorage.getItem('trackId'));
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('sessionToken'));
  const [realtimeKey, setRealtimeKey] = useState<string | null>(() => localStorage.getItem('realtimeKey'));
  const [progress, setProgress] = useState<TeamProgress | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    let refreshInterval: number | undefined;

    const refresh = async () => {
      if (!sessionToken) return;
      const state = await getTeamState(sessionToken);
      if (cancelled) return;
      if (!state) {
        setSessionToken(null);
        setRealtimeKey(null);
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('realtimeKey');
        setProgress(null);
        return;
      }
      setTeamId(state.team_id);
      setTeamName(state.name);
      setTrackId(state.track_id);
      setRealtimeKey(state.realtime_key);
      setProgress(state.progress as TeamProgress | null);
      localStorage.setItem('teamId', state.team_id);
      localStorage.setItem('teamName', state.name);
      localStorage.setItem('trackId', state.track_id);
      localStorage.setItem('realtimeKey', state.realtime_key);
      if (!unsubscribe && state.realtime_key) {
        // Broadcast is only a wake-up signal. Never trust client-supplied progress;
        // re-fetch the authoritative state through the token-protected RPC.
        unsubscribe = subscribeToTeamProgress(state.realtime_key, () => {
          if (!cancelled) void refresh();
        });
      }
    };

    if (sessionToken) {
      void refresh();
      refreshInterval = window.setInterval(() => void refresh(), 5000);
    }

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (refreshInterval) window.clearInterval(refreshInterval);
    };
  }, [sessionToken]);

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
    setRoomCode(null);
    setTeamId(null);
    setTeamName(null);
    setTrackId(null);
    setSessionToken(null);
    setRealtimeKey(null);
    setProgress(null);
    localStorage.removeItem('roomCode');
    localStorage.removeItem('teamId');
    localStorage.removeItem('teamName');
    localStorage.removeItem('trackId');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('realtimeKey');
  };

  const handleSetRoomCode = (code: string | null) => {
    setRoomCode(code);
    if (code) localStorage.setItem('roomCode', code);
    else localStorage.removeItem('roomCode');
  };

  return <AppContext.Provider value={{ roomCode, teamId, teamName, trackId, sessionToken, realtimeKey, progress, setRoomCode: handleSetRoomCode, setTeamLogin, logout }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
