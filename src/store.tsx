import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getTeamProgress, subscribeToTeamProgress } from './lib/db';

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
  progress: TeamProgress | null;
  setRoomCode: (code: string | null) => void;
  setTeamLogin: (teamId: string, teamName: string, trackId: string, token: string) => void;
  logout: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [roomCode, setRoomCode] = useState<string | null>(() => localStorage.getItem('roomCode'));
  const [teamId, setTeamId] = useState<string | null>(() => localStorage.getItem('teamId'));
  const [teamName, setTeamName] = useState<string | null>(() => localStorage.getItem('teamName'));
  const [trackId, setTrackId] = useState<string | null>(() => localStorage.getItem('trackId'));
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('sessionToken'));
  
  const [progress, setProgress] = useState<TeamProgress | null>(null);

  // Initialize progress and subscription if logged in
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (sessionToken && teamId) {
      // Fetch initial state
      getTeamProgress(teamId).then((data) => {
        if (data) setProgress(data as TeamProgress);
      });

      // Subscribe to changes
      unsubscribe = subscribeToTeamProgress(teamId, (newProgress) => {
        setProgress(newProgress as TeamProgress);
      });
    } else {
      setProgress(null);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionToken, teamId]);

  const setTeamLogin = (id: string, name: string, track: string, token: string) => {
    setTeamId(id);
    setTeamName(name);
    setTrackId(track);
    setSessionToken(token);
    
    localStorage.setItem('teamId', id);
    localStorage.setItem('teamName', name);
    localStorage.setItem('trackId', track);
    localStorage.setItem('sessionToken', token);
  };

  const logout = () => {
    setRoomCode(null);
    setTeamId(null);
    setTeamName(null);
    setTrackId(null);
    setSessionToken(null);
    setProgress(null);
    localStorage.clear();
  };

  const handleSetRoomCode = (code: string | null) => {
    setRoomCode(code);
    if (code) localStorage.setItem('roomCode', code);
    else localStorage.removeItem('roomCode');
  };

  return (
    <AppContext.Provider
      value={{
        roomCode,
        teamId,
        teamName,
        trackId,
        sessionToken,
        progress,
        setRoomCode: handleSetRoomCode,
        setTeamLogin,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
