import { supabase } from './supabase';
import type { LeaderboardEntry } from '../components/LeaderboardTable';

export interface RoomData {
  id: string;
  isActive: boolean;
  isHuntStarted: boolean;
  tracks: string[];
}

export interface MockTeam {
  id: string;
  name: string;
  track_id: string;
}

export interface MockClue {
  id: string;
  track_id: string;
  clue_number: number;
  sticker_image_url?: string;
  clue_image_url?: string;
  title: string;
  question: string;
  instruction: string;
}

export interface TeamData {
  id: string;
  name: string;
  track: string;
  secretCode: string;
  unlockedClueIndex: number;
  checkpoints: { clueId: string; completedAt: number }[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  disqualified?: boolean;
}

export interface ClueData {
  id: string;
  riddle: string;
  instruction: string;
  imageUrl?: string;
}

export async function joinRoom(roomCode: string): Promise<RoomData | null> {
  // We can just return a hardcoded valid room for now since room codes aren't deeply tracked in Supabase schema yet
  if (!roomCode) return null;
  return {
    id: roomCode.toUpperCase(),
    isActive: true,
    isHuntStarted: false,
    tracks: ['A', 'B', 'C']
  };
}

// ------------------------------------------------------------------
// AUTHENTICATION
// ------------------------------------------------------------------

export async function authenticateTeam(teamName: string, password: string): Promise<{ token: string, team_id: string, name: string, track_id: string } | null> {
  const { data: token, error } = await supabase.rpc('login_team', {
    team_name: teamName,
    password: password
  });
  
  if (error || !token) {
    console.error('Login error:', error);
    return null;
  }

  // Fetch team details using the token
  // Assuming RLS allows us to read team_sessions and teams if we have the token
  // If RLS is stricter, you'd need another RPC to fetch team details.
  const { data: sessionData } = await supabase
    .from('team_sessions')
    .select('team_id, teams(id, name, track_id)')
    .eq('token', token)
    .single();

  if (!sessionData || !sessionData.teams) return null;
  
  const team = Array.isArray(sessionData.teams) ? sessionData.teams[0] : sessionData.teams;

  return {
    token,
    team_id: team.id,
    name: team.name,
    track_id: team.track_id
  };
}

export async function authenticateOrganizer(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    console.error('Organizer login error:', error);
    return false;
  }
  return true;
}

export async function logoutOrganizer() {
  await supabase.auth.signOut();
}

// ------------------------------------------------------------------
// PLAYER (TEAM) ACTIONS
// ------------------------------------------------------------------

export async function verifyClueCode(token: string, enteredCode: string): Promise<{ok: boolean, next_clue?: number}> {
  const { data, error } = await supabase.rpc('verify_clue_code', {
    p_token: token,
    p_code: enteredCode
  });
  if (error || !data) {
    console.error('Verify error:', error);
    return { ok: false };
  }
  return data as { ok: boolean; next_clue?: number };
}

export async function getClues(trackId: string): Promise<MockClue[]> {
  const { data, error } = await supabase
    .from('clues')
    .select('*')
    .eq('track_id', trackId)
    .order('clue_number', { ascending: true });
    
  if (error) {
    console.error('Fetch clues error:', error);
    return [];
  }
  return data || [];
}

export async function getTeamProgress(teamId: string) {
  const { data, error } = await supabase
    .from('team_progress')
    .select('*')
    .eq('team_id', teamId)
    .single();
    
  if (error) {
    console.error('Fetch progress error:', error);
    return null;
  }
  return data;
}

export async function getHuntState() {
  const { data, error } = await supabase
    .from('hunt_state')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error) {
    console.error('Fetch hunt state error:', error);
    return null;
  }
  return data;
}

export async function getClue(trackId: string, clueIndex: number): Promise<ClueData | null> {
  const clues = await getClues(trackId);
  const c = clues.find(clue => clue.clue_number === clueIndex);
  if (!c) return null;
  return {
    id: c.id,
    riddle: c.question,
    instruction: c.instruction,
    imageUrl: c.clue_image_url || c.sticker_image_url || undefined
  };
}

export async function updateClue(trackId: string, clueIndex: number, updates: Partial<ClueData>) {
  // Mock function for organizer panel compatibility
  console.log('Update clue', trackId, clueIndex, updates);
}

// ------------------------------------------------------------------
// SUBSCRIPTIONS
// ------------------------------------------------------------------

export function subscribeToHuntState(callback: (started: boolean, startedAt?: number) => void) {
  // Initial fetch
  getHuntState().then(state => {
    if (state) callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined);
  });

  const channel = supabase
    .channel('hunt_state_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hunt_state', filter: 'id=eq.1' }, (payload) => {
      const state = payload.new as any;
      callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export function subscribeToTeamProgress(teamId: string, callback: (progress: any) => void) {
  const channel = supabase
    .channel(`team_progress_${teamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_progress', filter: `team_id=eq.${teamId}` }, (payload) => {
      callback(payload.new);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ------------------------------------------------------------------
// ORGANIZER ACTIONS
// ------------------------------------------------------------------

export function subscribeToAllTeams(callback: (teams: TeamData[]) => void) {
  let channel: any;
  let currentProgress: any[] = [];
  let teamsData: any[] = [];
  let tracksMap: any = {};

  const assembleTeams = () => {
    if (!teamsData.length) return [];
    return teamsData.map(t => {
      const p = currentProgress.find(pr => pr.team_id === t.id);
      return {
        id: t.id,
        name: t.name,
        track: tracksMap[t.track_id] || t.track_id,
        secretCode: '',
        unlockedClueIndex: p ? p.current_clue : 1,
        checkpoints: [],
        createdAt: 1,
        startedAt: p?.start_time ? new Date(p.start_time).getTime() : undefined,
        finishedAt: p?.finish_time ? new Date(p.finish_time).getTime() : undefined,
        disqualified: p?.disqualified || false
      };
    });
  };

  // Initial async fetch without blocking return
  (async () => {
    const { data: tData } = await supabase.from('teams').select('id, name, track_id');
    const { data: pData } = await supabase.from('team_progress').select('*');
    const { data: trData } = await supabase.from('tracks').select('id, name');
    
    if (trData) {
      tracksMap = trData.reduce((acc: any, t: any) => {
        acc[t.id] = t.name;
        return acc;
      }, {});
    }
    if (tData) teamsData = tData;
    if (pData) currentProgress = pData;
    
    callback(assembleTeams());
    
    channel = supabase
      .channel('all_team_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_progress' }, (payload) => {
        const newP = payload.new as any;
        currentProgress = currentProgress.map(p => p.team_id === newP.team_id ? newP : p);
        if (!currentProgress.find(p => p.team_id === newP.team_id)) {
          currentProgress.push(newP);
        }
        callback(assembleTeams());
      })
      .subscribe();
  })();

  return () => { if (channel) supabase.removeChannel(channel); };
}

export async function setGlobalHuntStatus(started: boolean, trackId?: string) {
  await supabase.from('hunt_state').upsert({
    id: 1,
    started: started,
    started_at: started ? new Date().toISOString() : null
  });
  
  // Update all teams if starting
  if (started) {
    await supabase.from('team_progress').update({ 
      hunt_started: true,
      start_time: new Date().toISOString()
    }).neq('team_id', '00000000-0000-0000-0000-000000000000'); // update all
  }
}

export async function resetGlobalHunt() {
  await setGlobalHuntStatus(false);
  await supabase.from('team_progress').update({
    current_clue: 1,
    hunt_started: false,
    start_time: null,
    finish_time: null,
    disqualified: false
  }).neq('team_id', '00000000-0000-0000-0000-000000000000');
}

export async function manuallyAdvanceClue(teamId: string) {
  const { data } = await supabase.from('team_progress').select('current_clue').eq('team_id', teamId).single();
  if (data && data.current_clue < 9) {
    const nextClue = data.current_clue + 1;
    const update: any = { current_clue: nextClue };
    if (nextClue > 9) update.finish_time = new Date().toISOString();
    await supabase.from('team_progress').update(update).eq('team_id', teamId);
  }
}

export async function manuallyRewindClue(teamId: string) {
  const { data } = await supabase.from('team_progress').select('current_clue').eq('team_id', teamId).single();
  if (data && data.current_clue > 1) {
    await supabase.from('team_progress').update({ 
      current_clue: data.current_clue - 1,
      finish_time: null 
    }).eq('team_id', teamId);
  }
}

export async function disqualifyTeam(teamId: string, dq: boolean) {
  await supabase.from('team_progress').update({ disqualified: dq }).eq('team_id', teamId);
}

export async function resetTeamProgress(teamId: string) {
  await supabase.from('team_progress').update({
    current_clue: 1,
    start_time: null,
    finish_time: null,
    disqualified: false
  }).eq('team_id', teamId);
}

export function subscribeToLeaderboard(trackId: string, currentTeamId: string | null, callback: (entries: LeaderboardEntry[]) => void) {
  // Simplified for now, just fetch initially
  const fetchLeaderboard = async () => {
    const { data: teamsData } = await supabase.from('teams').select('id, name').eq('track_id', trackId);
    const { data: progressData } = await supabase.from('team_progress').select('*');
    
    if (teamsData && progressData) {
      const entries: LeaderboardEntry[] = teamsData.map(t => {
        const p = progressData.find(pr => pr.team_id === t.id);
        
        let elapsed = 0;
        if (p?.start_time) {
          const end = p.finish_time ? new Date(p.finish_time).getTime() : Date.now();
          elapsed = Math.floor((end - new Date(p.start_time).getTime()) / 1000);
        }
        
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        const timeStr = [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');

        const entry = {
          id: t.id,
          rank: 0,
          team: t.name,
          progress: p ? Math.min(p.current_clue, 9) : 1,
          total: 9,
          elapsedTime: timeStr,
          isCurrentTeam: t.id === currentTeamId
        };
        // Use a hidden property for sorting
        (entry as any)._elapsedSeconds = elapsed;
        return entry;
      });

      // Sort by progress desc, then elapsed time asc
      entries.sort((a: any, b: any) => {
        if (a.progress !== b.progress) return b.progress - a.progress;
        return a._elapsedSeconds - b._elapsedSeconds;
      });
      
      entries.forEach((e, i) => e.rank = i + 1);
      callback(entries);
    }
  };
  
  fetchLeaderboard();
  const interval = setInterval(fetchLeaderboard, 10000);
  return () => clearInterval(interval);
}
