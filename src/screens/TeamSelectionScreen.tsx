import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ParchmentCard } from '../components/ParchmentCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppContext } from '../store';
import { authenticateTeam } from '../lib/db';
import { cn } from '../lib/utils';

export function TeamSelectionScreen() {
  const navigate = useNavigate();
  const { roomCode, setTeamLogin } = useAppContext();
  const [teamId, setTeamId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!roomCode || !teamId || !password || isLoading) return;
    setIsLoading(true);
    setError(false);
    try {
      const teamData = await authenticateTeam(roomCode, teamId, password);
      if (teamData) {
        setTeamLogin(teamData.team_id, teamData.name, teamData.track_id, teamData.token, teamData.realtime_key);
        navigate('/waiting');
      } else {
        setError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell showBack title="THE CONVERGENCE">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <ParchmentCard variant="dark" className={cn("w-full max-w-sm p-8 text-center", error && "animate-shake")}>
          <h2 className="font-display text-2xl text-offwhite uppercase tracking-widest mb-2 text-glow">Crew Login</h2>
          <p className="font-sans text-sm text-offwhite/70 italic mb-8">Identify yourselves and provide the secret.</p>
          <div className="space-y-4 mb-8">
            <input
              type="text"
              value={teamId}
              onChange={(e) => { setTeamId(e.target.value); setError(false); }}
              placeholder="Team ID (e.g. TEAM-123)"
              autoCapitalize="characters"
              autoCorrect="off"
              className={cn("w-full bg-void/50 border rounded p-4 text-center font-display text-lg text-offwhite uppercase tracking-widest outline-none transition-colors focus:border-gold", error ? "border-red-900/50 focus:border-red-500" : "border-gold/30")}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Password"
              autoComplete="current-password"
              className={cn("w-full bg-void/50 border rounded p-4 text-center font-display text-lg text-offwhite uppercase tracking-widest outline-none transition-colors focus:border-gold", error ? "border-red-900/50 focus:border-red-500" : "border-gold/30")}
            />
            {error && <p className="text-red-500 text-xs uppercase tracking-widest font-sans mt-2">Invalid Credentials</p>}
          </div>
          <PrimaryButton variant="parchment" disabled={!roomCode || !teamId || !password || isLoading} onClick={handleContinue}>
            {isLoading ? 'Boarding...' : 'Board Ship'}
          </PrimaryButton>
        </ParchmentCard>
      </div>
    </AppShell>
  );
}
