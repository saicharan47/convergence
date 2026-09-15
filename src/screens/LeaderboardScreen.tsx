import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { LeaderboardTable } from '../components/LeaderboardTable';
import type { LeaderboardEntry } from '../components/LeaderboardTable';
import { useAppContext } from '../store';
import { subscribeToLeaderboard } from '../lib/db';
export function LeaderboardScreen() {
 const { teamName, trackId, teamId }=useAppContext(); const [entries,setEntries]=useState<LeaderboardEntry[]>([]);
 useEffect(()=>{if(trackId){const unsubscribe=subscribeToLeaderboard(trackId,teamId,newEntries=>{if(newEntries.length>0)setEntries(newEntries);});return()=>unsubscribe();}},[trackId,teamId]);
 const mockEntries:LeaderboardEntry[]=[{id:'1',rank:1,team:'Blackbeards',progress:9,total:9,elapsedTime:'01:12:45'},{id:'2',rank:2,team:teamName||'Guest Crew',progress:8,total:9,elapsedTime:'01:15:30',isCurrentTeam:true},{id:'3',rank:3,team:"Kraken's Wake",progress:7,total:9,elapsedTime:'01:05:22'},{id:'4',rank:4,team:'The Salty Dogs',progress:7,total:9,elapsedTime:'01:20:10'},{id:'5',rank:5,team:'Silver Corsairs',progress:6,total:9,elapsedTime:'00:58:14'},{id:'6',rank:6,team:'Tide Walkers',progress:4,total:9,elapsedTime:'01:10:05'}];
 const displayEntries=entries.length>0?entries:mockEntries;
 return <AppShell showBack showMenu title="THE CONVERGENCE"><div className="flex-1 flex flex-col pt-4"><div className="text-center mb-8"><h2 className="font-display text-2xl text-offwhite uppercase tracking-widest mb-2 text-glow">Leaderboard</h2><p className="text-muted text-sm italic">Only the swiftest claim the glory.</p></div><div className="flex-1 overflow-y-auto pb-8"><LeaderboardTable entries={displayEntries}/></div></div></AppShell>;
}
