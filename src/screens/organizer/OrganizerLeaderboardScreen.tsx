import React, { useState, useEffect } from 'react';
import { OrganizerLayout } from '../../layouts/OrganizerLayout';
import { subscribeToAllTeams, type TeamData } from '../../lib/db';
import { Download } from 'lucide-react';
import { cn } from '../../lib/utils';

export function OrganizerLeaderboardScreen() {
  const [teams, setTeams] = useState<TeamData[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAllTeams((newTeams) => {
      // Sort by clue index (desc), then by last activity (asc)
      const sorted = [...newTeams].sort((a, b) => {
        if (a.unlockedClueIndex !== b.unlockedClueIndex) {
          return b.unlockedClueIndex - a.unlockedClueIndex;
        }
        
        // If they are on the same clue, tie-breaker is who got there first
        const aLast = a.checkpoints.length > 0 ? a.checkpoints[a.checkpoints.length - 1].completedAt : a.createdAt;
        const bLast = b.checkpoints.length > 0 ? b.checkpoints[b.checkpoints.length - 1].completedAt : b.createdAt;
        
        return aLast - bLast;
      });
      setTeams(sorted);
    });
    return () => { unsubscribe(); };
  }, []);

  const exportCSV = () => {
    const headers = ['Rank', 'Crew Name', 'Track', 'Clue Reached', 'Started At', 'Finished At', 'Disqualified'];
    const rows = teams.map((t, index) => [
      index + 1,
      `"${t.name}"`,
      t.track,
      t.unlockedClueIndex,
      t.startedAt ? new Date(t.startedAt).toISOString() : '',
      t.finishedAt ? new Date(t.finishedAt).toISOString() : '',
      t.disqualified ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `convergence_leaderboard_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <OrganizerLayout title="Global Leaderboard">
      
      <div className="flex flex-col h-full bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
        
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#151515]">
          <div className="text-sm text-gray-400">
            Real-time standings across all tracks
          </div>
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500 uppercase tracking-wider text-xs border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium w-16 text-center">Rank</th>
                <th className="px-4 py-3 font-medium">Crew</th>
                <th className="px-4 py-3 font-medium text-center">Track</th>
                <th className="px-4 py-3 font-medium text-center">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {teams.map((team, index) => {
                const isTop3 = index < 3;
                return (
                  <tr 
                    key={team.id}
                    className={cn(
                      "transition-colors",
                      isTop3 ? "bg-gold/5" : "hover:bg-[#1a1a1a]",
                      team.disqualified && "opacity-50 grayscale"
                    )}
                  >
                    <td className="px-4 py-4 text-center">
                      <span className={cn(
                        "font-display text-xl",
                        index === 0 ? "text-yellow-400" :
                        index === 1 ? "text-gray-300" :
                        index === 2 ? "text-amber-700" : "text-gray-600 font-mono text-base"
                      )}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-200 text-lg">
                      {team.name}
                      {team.disqualified && <span className="ml-3 text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded align-middle">DQ</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1a] text-gray-400 font-bold border border-gray-800">
                        {team.track}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="font-mono text-xl text-gold">{team.unlockedClueIndex} <span className="text-sm text-gray-600">/ 9</span></div>
                    </td>
                  </tr>
                );
              })}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No teams found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </OrganizerLayout>
  );
}
