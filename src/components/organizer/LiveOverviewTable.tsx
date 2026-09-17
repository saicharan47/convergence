import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import type { TeamData } from '../../lib/db';
import { Play, Pause, Square } from 'lucide-react';
import { TeamOverrideDrawer } from './TeamOverrideDrawer';

interface LiveOverviewTableProps { teams: TeamData[]; }
function formatTime(ms: number) { const totalSeconds = Math.floor(ms / 1000); const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; return `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`; }

export function LiveOverviewTable({ teams }: LiveOverviewTableProps) {
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="bg-[#111] rounded-lg border border-gray-800 flex flex-col h-full overflow-hidden">
    <div className="p-4 border-b border-gray-800 flex items-center justify-between"><h3 className="font-medium text-white">All Crews ({teams.length})</h3><input type="text" placeholder="Search crews..." value={search} onChange={e => setSearch(e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gold" /></div>
    <div className="flex-1 overflow-auto"><table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-[#151515] text-gray-500 uppercase tracking-wider text-xs sticky top-0 z-10"><tr><th className="px-4 py-3 font-medium">Crew</th><th className="px-4 py-3 font-medium text-center">Track</th><th className="px-4 py-3 font-medium text-center">Progress</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Elapsed</th></tr></thead>
    <tbody className="divide-y divide-gray-800/50">{filteredTeams.map(team => { const isActive = team.startedAt && !team.finishedAt; const isFinished = !!team.finishedAt; const isNotStarted = !team.startedAt; const elapsed = isActive ? formatTime(now - team.startedAt!) : isFinished ? formatTime(team.finishedAt! - team.startedAt!) : '--:--:--'; const lastActivity = team.checkpoints.length > 0 ? team.checkpoints[team.checkpoints.length - 1].completedAt : team.startedAt; const isStuck = isActive && !!lastActivity && now - lastActivity > 1200000; const trackColors: Record<string,string> = {A:'bg-[#7A2430]',B:'bg-[#1F4E63]',C:'bg-[#2E5439]',D:'bg-[#B8862E]'}; return <tr key={team.id} onClick={() => setSelectedTeam(team)} className={cn('hover:bg-[#1a1a1a] cursor-pointer transition-colors relative', isStuck && 'border-l-4 border-l-amber-500 bg-amber-900/10', team.disqualified && 'opacity-50 grayscale')}>
      <td className="px-4 py-4 font-medium text-gray-200">{team.name} {team.disqualified && <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">DQ</span>}{isStuck && <div className="text-xs text-amber-500 mt-1">Stuck (&gt;20m)</div>}</td><td className="px-4 py-4 text-center"><span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white', trackColors[team.track] || 'bg-gray-700')}>{team.track}</span></td><td className="px-4 py-4"><div className="flex flex-col items-center gap-1"><span className="font-mono text-gold">{team.unlockedClueIndex} <span className="text-gray-600">/ 9</span></span><div className="flex gap-0.5">{Array.from({length:9}).map((_,i)=><div key={i} className={cn('w-1.5 h-1.5 rounded-full', i < team.unlockedClueIndex ? 'bg-gold' : 'bg-gray-800')} />)}</div></div></td><td className="px-4 py-4"><div className="flex items-center gap-2">{isNotStarted && <Square className="w-4 h-4 text-gray-600" fill="currentColor" />}{isActive && <Play className="w-4 h-4 text-green-500" fill="currentColor" />}{isFinished && <Pause className="w-4 h-4 text-gold" fill="currentColor" />}<span className={cn('text-xs uppercase tracking-wider font-semibold', isNotStarted && 'text-gray-500', isActive && 'text-green-500', isFinished && 'text-gold')}>{isNotStarted ? 'Waiting' : isActive ? 'Active' : 'Finished'}</span></div></td><td className="px-4 py-4 text-right font-mono text-gray-400">{elapsed}</td>
    </tr>; })}</tbody></table></div>
    {selectedTeam && <TeamOverrideDrawer team={selectedTeam} onClose={() => setSelectedTeam(null)} />}
  </div>;
}
