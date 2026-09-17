import { supabase } from './supabase';
import type { LeaderboardEntry } from '../components/LeaderboardTable';

export interface RoomData { id: string; code: string; isActive: boolean; isHuntStarted: boolean; tracks: string[]; }
export interface MockTeam { id: string; name: string; track_id: string; }
export interface MockClue { id: string; track_id: string; clue_number: number; sticker_image_url?: string | null; clue_image_url?: string | null; title: string; question: string; instruction: string; }
export interface TeamData { id: string; name: string; track: string; secretCode: string; unlockedClueIndex: number; checkpoints: { clueId: string; completedAt: number }[]; createdAt: number; startedAt?: number; finishedAt?: number; disqualified?: boolean; }
export interface ClueData { id: string; clueNumber: number; title: string; riddle: string; instruction: string; stickerImageUrl?: string | null; clueImageUrl?: string | null; }
export interface TrackSchedule { enabled: boolean; starts_at: string | null; ends_at: string | null; active_now: boolean; }
export interface TeamState { team_id: string; name: string; track_id: string; realtime_key: string; progress: { team_id: string; current_clue: number; start_time: string | null; finish_time: string | null; hunt_started: boolean; disqualified: boolean } | null; track_schedule?: TrackSchedule; }
export interface OrganizerProfile { user_id: string; track_id: string | null; }

export async function authenticateTeam(teamName: string, password: string): Promise<{ token: string; realtime_key: string; team_id: string; name: string; track_id: string } | null> {
  const { data, error } = await supabase.rpc('login_team', { p_team_name: teamName.trim(), p_password: password });
  // Invalid credentials are an expected user-facing outcome; don't pollute the
  // browser console with a handled authentication error.
  if (error || !data) return null;
  return data;
}

export async function getTeamState(token: string): Promise<TeamState | null> {
  if (!token) return null;
  const { data, error } = await supabase.rpc('get_team_state', { p_token: token });
  if (error) throw error;
  if (!data) return null;
  return data as TeamState;
}

export async function authenticateOrganizer(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  // Invalid credentials are handled by the login screen; avoid expected auth
  // failures becoming noisy console errors.
  if (error || !data.user) return false;
  const { data: organizer, error: organizerError } = await supabase.rpc('get_organizer_profile');
  if (organizerError || !organizer || organizer.user_id !== data.user.id) {
    await supabase.auth.signOut();
    return false;
  }
  return true;
}

export async function isOrganizerAuthenticated(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc('get_organizer_profile');
  return !error && Boolean(data) && data.user_id === user.id;
}

export async function getOrganizerProfile(): Promise<OrganizerProfile | null> {
  const { data, error } = await supabase.rpc('get_organizer_profile');
  if (error || !data) return null;
  return data as OrganizerProfile;
}

export async function logoutOrganizer() { await supabase.auth.signOut(); }

export async function verifyClueCode(token: string, enteredCode: string): Promise<{ ok: boolean; next_clue?: number; reason?: string }> {
  const { data, error } = await supabase.rpc('verify_clue_code', { p_token: token, p_code: enteredCode.trim() });
  if (error || !data) return { ok: false };
  return data as { ok: boolean; next_clue?: number; reason?: string };
}

/** Organizer-only clue listing. Participants must use getCurrentClue with their session token. */
export async function getClues(trackId: string): Promise<MockClue[]> {
  const { data, error } = await supabase.from('clues').select('id, track_id, clue_number, title, question, instruction, sticker_image_url, clue_image_url').eq('track_id', trackId).order('clue_number', { ascending: true });
  if (error) return [];
  return (data || []) as MockClue[];
}

export async function getCurrentClue(token: string): Promise<MockClue | null> {
  if (!token) return null;
  const { data, error } = await supabase.rpc('get_team_current_clue', { p_token: token });
  if (error) throw error;
  return data ? data as MockClue : null;
}

export async function getTeamProgress(teamId: string) {
  const { data, error } = await supabase.from('team_progress').select('team_id, current_clue, start_time, finish_time, hunt_started, disqualified').eq('team_id', teamId).single();
  if (error) return null;
  return data;
}

export async function getHuntState() {
  const { data, error } = await supabase.from('hunt_state').select('id, started, started_at').eq('id', 1).single();
  if (error) return null;
  return data;
}

export async function getTrackHuntState(trackId: string): Promise<TrackSchedule | null> {
  const { data, error } = await supabase.rpc('get_track_hunt_state', { p_track_id: trackId });
  if (error || !data) return null;
  return data as TrackSchedule;
}

export async function setTrackHuntStatus(trackId: string, enabled: boolean) {
  const { error } = await supabase.rpc('set_track_hunt_status', { p_track_id: trackId, p_enabled: enabled });
  if (error) throw error;
}

export async function setTrackSchedule(trackId: string, startsAt: string | null, endsAt: string | null) {
  const { error } = await supabase.rpc('set_track_schedule', { p_track_id: trackId, p_starts_at: startsAt, p_ends_at: endsAt });
  if (error) throw error;
}

export async function getOrganizerOverview(trackId: string | null = null): Promise<TeamData[]> {
  const { data, error } = await supabase.rpc('get_organizer_overview', { p_track_id: trackId });
  if (error || !data) return [];
  return (data as any[]).map(t => ({ id: t.id, name: t.team, track: t.track_id, secretCode: '', unlockedClueIndex: t.progress, checkpoints: [], createdAt: Date.now(), startedAt: t.started_at ? new Date(t.started_at).getTime() : undefined, finishedAt: t.finished_at ? new Date(t.finished_at).getTime() : undefined, disqualified: Boolean(t.disqualified) }));
}

export async function getClue(trackId: string, clueIndex: number): Promise<ClueData | null> {
  const clues = await getClues(trackId);
  const c = clues.find(clue => clue.clue_number === clueIndex);
  if (!c) return null;
  return { id: c.id, clueNumber: c.clue_number, title: c.title, riddle: c.question, instruction: c.instruction, stickerImageUrl: c.sticker_image_url, clueImageUrl: c.clue_image_url };
}

export async function updateClue(trackId: string, clueIndex: number, updates: Partial<ClueData>) {
  const { data: clue, error: lookupError } = await supabase.from('clues').select('id').eq('track_id', trackId).eq('clue_number', clueIndex).single();
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
  void getHuntState().then(state => { if (!active || !state) return; callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined); }).catch(() => undefined);
  const channel = supabase.channel('hunt_state_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'hunt_state', filter: 'id=eq.1' }, payload => { const state = payload.new as { started: boolean; started_at: string | null }; callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined); }).subscribe();
  return () => { active = false; void supabase.removeChannel(channel); };
}

export function subscribeToTrackHuntState(trackId: string, callback: () => void) {
  if (!trackId) return () => undefined;
  const channel = supabase.channel(`track_hunt_state:${trackId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'track_hunt_state', filter: `track_id=eq.${trackId}` }, () => callback()).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeToTeamProgress(realtimeKey: string, callback: () => void) {
  if (!realtimeKey) return () => undefined;
  const channel = supabase.channel(`team:${realtimeKey}`).on('broadcast', { event: 'team_progress' }, () => callback()).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeToAllTeams(callback: (teams: TeamData[]) => void) {
  let active = true;
  const refresh = async () => {
    const teams = await getOrganizerOverview();
    if (active) callback(teams);
  };
  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 5000);
  return () => { active = false; window.clearInterval(interval); };
}

export async function setGlobalHuntStatus(started: boolean) { const { error } = await supabase.rpc('set_global_hunt_status', { p_started: started }); if (error) throw error; }
export async function resetGlobalHunt() { const { error } = await supabase.rpc('reset_global_hunt'); if (error) throw error; }
export async function manuallyAdvanceClue(teamId: string) { const { error } = await supabase.rpc('manually_advance_clue', { p_team_id: teamId }); if (error) throw error; }
export async function manuallyRewindClue(teamId: string) { const { error } = await supabase.rpc('manually_rewind_clue', { p_team_id: teamId }); if (error) throw error; }
export async function disqualifyTeam(teamId: string, dq: boolean) { const { error } = await supabase.rpc('disqualify_team', { p_team_id: teamId, p_disqualified: dq }); if (error) throw error; }
export async function resetTeamProgress(teamId: string) { const { error } = await supabase.rpc('reset_team_progress', { p_team_id: teamId }); if (error) throw error; }
export function subscribeToLeaderboard(trackId: string, currentTeamId: string | null, callback: (entries: LeaderboardEntry[]) => void) { const fetchLeaderboard = async () => { const { data, error } = await supabase.rpc('get_leaderboard', { p_track_id: trackId }); if (error || !data) return; const entries: LeaderboardEntry[] = data.map((row: any, index: number) => { const elapsed = Number(row.elapsed_seconds || 0); const hours = Math.floor(elapsed / 3600); const minutes = Math.floor((elapsed % 3600) / 60); const seconds = elapsed % 60; return { id: row.id, rank: index + 1, team: row.team, progress: Math.min(Number(row.progress || 1), 9), total: 9, elapsedTime: [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':'), isCurrentTeam: row.id === currentTeamId }; }); callback(entries); }; void fetchLeaderboard(); const interval = window.setInterval(fetchLeaderboard, 5000); return () => window.clearInterval(interval); }
