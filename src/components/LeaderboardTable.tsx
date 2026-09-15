import { cn } from '../lib/utils';
import { CrewIcon } from '../icons/CustomIcons';

export interface LeaderboardEntry { id: string; rank: number; team: string; progress: number; total: number; elapsedTime: string; isCurrentTeam?: boolean; }
interface LeaderboardTableProps { entries: LeaderboardEntry[]; }

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return <div className="w-full border border-gold/30 rounded bg-void/80 overflow-hidden shadow-lg">
    <div className="grid grid-cols-[3rem_1fr_4rem_4rem] text-xs font-sans tracking-widest uppercase text-muted border-b border-gold/30 bg-void"><div className="p-3 text-center">Rank</div><div className="p-3">Crew</div><div className="p-3 text-center">Clues</div><div className="p-3 text-right">Time</div></div>
    <div className="divide-y divide-gold/10">{entries.map(entry => <div key={entry.id} className={cn('grid grid-cols-[3rem_1fr_4rem_4rem] items-center text-sm font-sans transition-colors', entry.isCurrentTeam ? 'bg-gold/10 text-offwhite font-medium' : 'text-muted hover:bg-white/5')}>
      <div className="p-3 text-center font-display text-gold">{entry.rank}</div><div className="p-3 flex items-center gap-2 overflow-hidden"><CrewIcon className={cn('w-4 h-4 shrink-0', entry.isCurrentTeam ? 'text-gold' : 'opacity-50')} /><span className="truncate uppercase">{entry.team}</span></div><div className="p-3 text-center tabular-nums">{entry.progress}/{entry.total}</div><div className="p-3 text-right tabular-nums text-xs opacity-70">{entry.elapsedTime}</div>
    </div>)}</div>
  </div>;
}
