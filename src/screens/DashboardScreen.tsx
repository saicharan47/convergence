import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ProgressDots } from '../components/ProgressDots';
import { ClueGrid } from '../components/ClueGrid';
import { useAppContext } from '../store';

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

export function DashboardScreen() {
  const navigate = useNavigate();
  const { teamName, trackId, progress } = useAppContext();
  
  const [elapsed, setElapsed] = useState<string>('00:00:00');

  useEffect(() => {
    if (!progress?.hunt_started) {
      navigate('/waiting', { replace: true });
    } else if (progress.current_clue > 9) {
      navigate('/treasure', { replace: true });
    }
  }, [progress, navigate]);

  useEffect(() => {
    if (!progress?.start_time) return;

    const startMs = new Date(progress.start_time).getTime();

    const tick = () => {
      const endMs = progress.finish_time ? new Date(progress.finish_time).getTime() : Date.now();
      const diff = Math.max(0, endMs - startMs);
      setElapsed(formatTime(diff));
    };

    tick(); // initial
    if (!progress.finish_time) {
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }
  }, [progress?.start_time, progress?.finish_time]);

  return (
    <AppShell title="THE CONVERGENCE" showMenu>
      <div className="flex flex-col items-center pt-6">
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border border-gold/40 shadow-[0_0_20px_rgba(201,162,75,0.2)]">
            <img src="/images/ship-avatar.jpg" alt="Team Avatar" className="w-full h-full object-cover" />
          </div>
          <h2 className="font-display text-2xl text-offwhite uppercase tracking-widest mb-1 text-glow">
            {teamName || "GUEST CREW"}
          </h2>
          <div className="flex items-center justify-center gap-4 mt-2">
            <p className="text-gold text-xs uppercase tracking-[0.2em] opacity-90">
              Track {trackId || "A"}
            </p>
            <div className="w-1 h-1 bg-gold/50 rounded-full" />
            <p className="text-gold text-xs font-mono tracking-widest opacity-90">
              {elapsed}
            </p>
          </div>
        </div>

        <div className="mb-10 w-full max-w-[320px]">
          <ProgressDots total={9} current={progress ? progress.current_clue - 1 : 0} />
        </div>

        <div className="w-full">
          <ClueGrid total={9} currentClue={progress ? progress.current_clue : 1} />
        </div>
      </div>
    </AppShell>
  );
}
