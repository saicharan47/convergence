import { supabase } from './supabase';
import type { LeaderboardEntry } from '../components/LeaderboardTable';

export interface RoomData {
  id: string;
  code: string;
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
  sticker_image_url?: string | null;
  clue_image_url?: string | null;
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
  clueNumber: number;
  title: string;
  riddle: string;
  instruction: string;
  stickerImageUrl?: string | null;
  clueImageUrl?: string | null;
}

export interface TeamState {
  team_id: string;
  name: string;
  track_id: string;
  realtime_key: string;
  progress: {
    team_id: string;
    current_clue: number;
    start_time: string | null;
    finish_time: string | null;
    hunt_started: boolean;
    disqualified: boolean;
  } | null;
}

export async function joinRoom(roomCode: string): Promise<RoomData | null> {
  const normalized = roomCode.trim();
  if (!/^\d{5}$/.test(normalized)) return null;
  const { data, error } = await supabase.rpc('join_room', { p_code: normalized });
  if (error || !data) {
    console.error('Join room error:', error);
    return null;
  }
  return {
    id: data.id,
    code: data.code,
    isActive: Boolean(data.isActive),
    isHuntStarted: Boolean(data.isHuntStarted),
    tracks: Array.isArray(data.tracks) ? data.tracks : []
  };
}

export async function authenticateTeam(
  roomCode: string,
  teamName: string,
  password: string
): Promise<{ token: string; realtime_key: string; team_id: string; name: string; track_id: string } | null> {
  const { data, error } = await supabase.rpc('login_team', {
    p_room_code: roomCode.trim(),
    p_team_name: teamName.trim(),
    p_password: password
  });
  if (error || !data) {
    console.error('Team login error:', error);
    return null;
  }
  return data;
}

export async function getTeamState(token: string): Promise<TeamState | null> {
  if (!token) return null;
  const { data, error } = await supabase.rpc('get_team_state', { p_token: token });
  if (error || !data) {
    console.error('Get team state error:', error);
    return null;
  }
  return data as TeamState;
}

export async function authenticateOrganizer(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    console.error('Organizer login error:', error);
    return false;
  }
  const { data: organizer, error: organizerError } = await supabase
    .from('organizers')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (organizerError || !organizer) {
    await supabase.auth.signOut();
    return false;
  }
  return true;
}

export async function isOrganizerAuthenticated(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.from('organizers').select('user_id').eq('user_id', user.id).maybeSingle();
  return !error && Boolean(data);
}

export async function logoutOrganizer() {
  await supabase.auth.signOut();
}

export async function verifyClueCode(token: string, enteredCode: string): Promise<{ ok: boolean; next_clue?: number }> {
  const { data, error } = await supabase.rpc('verify_clue_code', {
    p_token: token,
    p_code: enteredCode.trim()
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
    .select('id, track_id, clue_number, title, question, instruction, sticker_image_url, clue_image_url')
    .eq('track_id', trackId)
    .order('clue_number', { ascending: true });
  if (error) {
    console.error('Fetch clues error:', error);
    return [];
  }
  return (data || []) as MockClue[];
}

export async function getTeamProgress(teamId: string) {
  const { data, error } = await supabase
    .from('team_progress')
    .select('team_id, current_clue, start_time, finish_time, hunt_started, disqualified')
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
    .select('id, started, started_at')
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
    clueNumber: c.clue_number,
    title: c.title,
    riddle: c.question,
    instruction: c.instruction,
    stickerImageUrl: c.sticker_image_url,
    clueImageUrl: c.clue_image_url
  };
}

export async function updateClue(trackId: string, clueIndex: number, updates: Partial<ClueData>) {
  const { data: clue, error: lookupError } = await supabase
    .from('clues')
    .select('id')
    .eq('track_id', trackId)
    .eq('clue_number', clueIndex)
    .single();
  if (lookupError || !clue) throw lookupError || new Error('Clue not found');

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.riddle !== undefined) payload.question = updates.riddle;
  if (updates.instruction !== undefined) payload.instruction = updates.instruction;
  if (updates.stickerImageUrl !== undefined) payload.sticker_image_url = updates.stickerImageUrl;
  if (updates.clueImageUrl !== undefined) payload.clue_image_url = updates.clueImageUrl;

  const { error } = await supabase.from('clues').update(payload).eq('id', clue.id);
  if (error) throw error;
}

export function subscribeToHuntState(callback: (started: boolean, startedAt?: number) => void) {
  let active = true;
  void getHuntState().then(state => {
    if (!active || !state) return;
    callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined);
  });

  const channel = supabase
    .channel('hunt_state_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hunt_state', filter: 'id=eq.1' }, payload => {
      const state = payload.new as { started: boolean; started_at: string | null };
      callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined);
    })
    .subscribe();
  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export function subscribeToTeamProgress(realtimeKey: string, callback: (progress: any) => void) {
  if (!realtimeKey) return () => undefined;
  const channel = supabase
    .channel(`team:${realtimeKey}`)
    .on('broadcast', { event: 'team_progress' }, payload => callback(payload.payload))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeToAllTeams(callback: (teams: TeamData[]) => void) {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let currentProgress: any[] = [];
  let teamsData: any[] = [];
  let tracksMap: Record<string, string> = {};
  let active = true;

  const assembleTeams = () => teamsData.map(t => {
    const p = currentProgress.find(pr => pr.team_id === t.id);
    return {
      id: t.id,
      name: t.name,
      track: tracksMap[t.track_id] || t.track_id,
      secretCode: '',
      unlockedClueIndex: p ? p.current_clue : 1,
      checkpoints: [],
      createdAt: new Date(t.created_at || Date.now()).getTime(),
      startedAt: p?.start_time ? new Date(p.start_time).getTime() : undefined,
      finishedAt: p?.finish_time ? new Date(p.finish_time).getTime() : undefined,
      disqualified: p?.disqualified || false
    };
  });

  (async () => {
    const [{ data: tData, error: tError }, { data: pData, error: pError }, { data: trData, error: trError }] = await Promise.all([
      supabase.from('teams').select('id, name, track_id, created_at'),
      supabase.from('team_progress').select('*'),
      supabase.from('tracks').select('id, name')
    ]);
    if (!active) return;
    if (tError || pError || trError) console.error('Organizer overview load error:', tError || pError || trError);
    teamsData = tData || [];
    currentProgress = pData || [];
    tracksMap = (trData || []).reduce((acc: Record<string, string>, t: any) => { acc[t.id] = t.name; return acc; }, {});
    callback(assembleTeams());

    channel = supabase.channel('all_team_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_progress' }, payload => {
        const next = payload.new as any;
        currentProgress = currentProgress.some(p => p.team_id === next.team_id)
          ? currentProgress.map(p => p.team_id === next.team_id ? next : p)
          : [...currentProgress, next];
        callback(assembleTeams());
      })
      .subscribe();
  })();

  return () => {
    active = false;
    if (channel) void supabase.removeChannel(channel);
  };
}

export async function setGlobalHuntStatus(started: boolean) {
  const { error } = await supabase.rpc('set_global_hunt_status', { p_started: started });
  if (error) throw error;
}

export async function resetGlobalHunt() {
  const { error } = await supabase.rpc('reset_global_hunt');
  if (error) throw error;
}

export async function manuallyAdvanceClue(teamId: string) {
  const { error } = await supabase.rpc('manually_advance_clue', { p_team_id: teamId });
  if (error) throw error;
}

export async function manuallyRewindClue(teamId: string) {
  const { error } = await supabase.rpc('manually_rewind_clue', { p_team_id: teamId });
  if (error) throw error;
}

export async function disqualifyTeam(teamId: string, dq: boolean) {
  const { error } = await supabase.rpc('disqualify_team', { p_team_id: teamId, p_disqualified: dq });
  if (error) throw error;
}

export async function resetTeamProgress(teamId: string) {
  const { error } = await supabase.rpc('reset_team_progress', { p_team_id: teamId });
  if (error) throw error;
}

export function subscribeToLeaderboard(trackId: string, currentTeamId: string | null, callback: (entries: LeaderboardEntry[]) => void) {
  const fetchLeaderboard = async () => {
    const { data, error } = await supabase.rpc('get_leaderboard', { p_track_id: trackId });
    if (error || !data) {
      console.error('Leaderboard error:', error);
      return;
    }
    const entries: LeaderboardEntry[] = data.map((row: any, index: number) => {
      const elapsed = Number(row.elapsed_seconds || 0);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      return {
        id: row.id,
        rank: index + 1,
        team: row.team,
        progress: Math.min(Number(row.progress || 1), 9),
        total: 9,
        elapsedTime: [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':'),
        isCurrentTeam: row.id === currentTeamId
      };
    });
    callback(entries);
  };
  void fetchLeaderboard();
  const interval = window.setInterval(fetchLeaderboard, 5000);
  return () => window.clearInterval(interval);
}
