import React, { useState, useEffect } from 'react';
import { OrganizerLayout } from '../../layouts/OrganizerLayout';
import { LiveOverviewTable } from '../../components/organizer/LiveOverviewTable';
import { subscribeToAllTeams, setGlobalHuntStatus, resetGlobalHunt, type TeamData } from '../../lib/db';
import { Play, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

export function OrganizerDashboardScreen() {
  const [teams, setTeams] = useState<TeamData[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAllTeams((newTeams) => {
      setTeams(newTeams);
    });
    return () => { unsubscribe(); };
  }, []);

  const handleGlobalStart = async () => {
    if (confirm("Start the hunt for all tracks?")) {
      await setGlobalHuntStatus(true);
      // Mock: we don't have a way to force all teams to startedAt right now in db.ts easily via global start without updating every team,
      // but in a real app this writes to `huntState/global.started = true`.
    }
  };

  const handleGlobalReset = async () => {
    const userInput = prompt('Type "RESET" to confirm resetting ALL teams to clue 1. This is destructive.');
    if (userInput === 'RESET') {
      await resetGlobalHunt();
    }
  };

  return (
    <OrganizerLayout title="Live Overview">
      
      <div className="flex flex-col gap-6 h-full">
        
        {/* Top Control Bar */}
        <div className="flex items-center gap-4 shrink-0">
          <button 
            onClick={handleGlobalStart}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition-colors font-medium text-sm tracking-wide uppercase"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            Start Hunt (Global)
          </button>
          
          <div className="flex-1" />
          
          <button 
            onClick={handleGlobalReset}
            className="flex items-center gap-2 bg-transparent border border-red-900 text-red-500 hover:bg-red-900/20 px-4 py-2 rounded transition-colors font-medium text-sm tracking-wide uppercase"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Hunt
          </button>
        </div>

        {/* Tracks Quick Start (Optional, as requested) */}
        <div className="flex gap-4 shrink-0">
          {(['A', 'B', 'C', 'D'] as const).map(track => {
            const trackColors = { A: 'bg-[#7A2430]', B: 'bg-[#1F4E63]', C: 'bg-[#2E5439]', D: 'bg-[#B8862E]' };
            return (
            <button 
              key={track}
              onClick={() => setGlobalHuntStatus(true, track)}
              className="flex-1 bg-[#151515] hover:bg-[#1a1a1a] border border-gray-800 p-3 rounded flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-3 h-3 rounded-full", trackColors[track])} />
                <span className="text-gray-300 font-medium">Track {track}</span>
              </div>
              <Play className="w-4 h-4 text-gray-600 group-hover:text-green-500 transition-colors" />
            </button>
          )})}
        </div>

        {/* Live Table */}
        <div className="flex-1 min-h-[400px]">
          <LiveOverviewTable teams={teams} />
        </div>
        
      </div>
      
    </OrganizerLayout>
  );
}
