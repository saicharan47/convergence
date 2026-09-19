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
export interface OrganizerTeam { id: string; name: string; track_id: string; created_at: string; member_count: number; }
export interface TeamMember { id: string; team_id: string; name: string; email: string | null; phone: string | null; }
export interface ImportTeamRow { team_name: string; password: string; track_id: string; members: Array<{ name: string; email?: string; phone?: string }>; }

interface OrganizerOverviewRow { id: string; team: string; track_id: string; progress: number; started_at: string | null; finished_at: string | null; disqualified: boolean; }
interface LeaderboardRow { id: string; team: string; progress: number | null; elapsed_seconds: number | null; }

export async function authenticateTeam(teamName: string, password: string): Promise<{ token: string; realtime_key: string; team_id: string; name: string; track_id: string } | null> { const { data, error } = await supabase.rpc('login_team', { p_team_name: teamName.trim(), p_password: password }); if (error || !data) return null; return data; }
export async function getTeamState(token: string): Promise<TeamState | null> { if (!token) return null; const { data, error } = await supabase.rpc('get_team_state', { p_token: token }); if (error) throw error; if (!data) return null; return data as TeamState; }
export async function authenticateOrganizer(email: string, password: string): Promise<boolean> { const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error || !data.user) return false; const { data: organizer, error: organizerError } = await supabase.rpc('get_organizer_profile'); if (organizerError || !organizer || organizer.user_id !== data.user.id) { await supabase.auth.signOut(); return false; } return true; }
export async function isOrganizerAuthenticated(): Promise<boolean> { try { const { data: { user } } = await supabase.auth.getUser(); if (!user) return false; const { data, error } = await supabase.rpc('get_organizer_profile'); return !error && Boolean(data) && data.user_id === user.id; } catch { return false; } }
export async function getOrganizerProfile(): Promise<OrganizerProfile | null> { const { data, error } = await supabase.rpc('get_organizer_profile'); if (error || !data) return null; return data as OrganizerProfile; }
export async function logoutOrganizer() { await supabase.auth.signOut(); }
export async function verifyClueCode(token: string, enteredCode: string): Promise<{ ok: boolean; next_clue?: number; reason?: string }> { const { data, error } = await supabase.rpc('verify_clue_code', { p_token: token, p_code: enteredCode.trim() }); if (error || !data) return { ok: false }; return data as { ok: boolean; next_clue?: number; reason?: string }; }
/** Organizer-only clue listing. Participants must use getCurrentClue with their session token. */
export async function getClues(trackId: string): Promise<MockClue[]> { const { data, error } = await supabase.from('clues').select('id, track_id, clue_number, title, question, instruction, sticker_image_url, clue_image_url').eq('track_id', trackId).order('clue_number', { ascending: true }); if (error) return []; return (data || []) as MockClue[]; }
export async function getCurrentClue(token: string): Promise<MockClue | null> { if (!token) return null; const { data, error } = await supabase.rpc('get_team_current_clue', { p_token: token }); if (error) throw error; return data ? data as MockClue : null; }
export async function getTeamProgress(teamId: string) { const { data, error } = await supabase.from('team_progress').select('team_id, current_clue, start_time, finish_time, hunt_started, disqualified').eq('team_id', teamId).single(); if (error) return null; return data; }
export async function getHuntState() { const { data, error } = await supabase.from('hunt_state').select('id, started, started_at').eq('id', 1).single(); if (error) return null; return data; }
export async function getTrackHuntState(trackId: string): Promise<TrackSchedule | null> { const { data, error } = await supabase.rpc('get_track_hunt_state', { p_track_id: trackId }); if (error || !data) return null; return data as TrackSchedule; }
export async function setTrackHuntStatus(trackId: string, enabled: boolean) { const { error } = await supabase.rpc('set_track_hunt_status', { p_track_id: trackId, p_enabled: enabled }); if (error) throw error; }
export async function setTrackSchedule(trackId: string, startsAt: string | null, endsAt: string | null) { const { error } = await supabase.rpc('set_track_schedule', { p_track_id: trackId, p_starts_at: startsAt, p_ends_at: endsAt }); if (error) throw error; }
export async function getOrganizerOverview(trackId: string | null = null): Promise<TeamData[]> { const { data, error } = await supabase.rpc('get_organizer_overview', { p_track_id: trackId }); if (error || !data) return []; return (data as OrganizerOverviewRow[]).map(t => ({ id: t.id, name: t.team, track: t.track_id, secretCode: '', unlockedClueIndex: t.progress, checkpoints: [], createdAt: Date.now(), startedAt: t.started_at ? new Date(t.started_at).getTime() : undefined, finishedAt: t.finished_at ? new Date(t.finished_at).getTime() : undefined, disqualified: Boolean(t.disqualified) })); }
export async function getClue(trackId: string, clueIndex: number): Promise<ClueData | null> { const clues = await getClues(trackId); const c = clues.find(clue => clue.clue_number === clueIndex); if (!c) return null; return { id: c.id, clueNumber: c.clue_number, title: c.title, riddle: c.question, instruction: c.instruction, stickerImageUrl: c.sticker_image_url, clueImageUrl: c.clue_image_url }; }
export async function updateClue(trackId: string, clueIndex: number, updates: Partial<ClueData>) { const { data: clue, error: lookupError } = await supabase.from('clues').select('id').eq('track_id', trackId).eq('clue_number', clueIndex).single(); if (lookupError || !clue) throw lookupError || new Error('Clue not found'); const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }; if (updates.title !== undefined) payload.title = updates.title; if (updates.riddle !== undefined) payload.question = updates.riddle; if (updates.instruction !== undefined) payload.instruction = updates.instruction; if (updates.stickerImageUrl !== undefined) payload.sticker_image_url = updates.stickerImageUrl; if (updates.clueImageUrl !== undefined) payload.clue_image_url = updates.clueImageUrl; const { error } = await supabase.from('clues').update(payload).eq('id', clue.id); if (error) throw error; }
export async function getOrganizerTeams(trackId: string | null = null): Promise<OrganizerTeam[]> { const { data, error } = await supabase.rpc('get_organizer_teams', { p_track_id: trackId }); if (error || !data) return []; return data as OrganizerTeam[]; }
export async function getOrganizerTeamMembers(teamId: string): Promise<TeamMember[]> { const { data, error } = await supabase.rpc('get_organizer_team_members', { p_team_id: teamId }); if (error || !data) return []; return data as TeamMember[]; }
export async function upsertOrganizerTeam(team: { id?: string | null; name: string; password?: string; trackId: string; members: Array<{ name: string; email?: string; phone?: string }> }): Promise<string> { const { data, error } = await supabase.rpc('upsert_organizer_team', { p_team_id: team.id ?? null, p_name: team.name.trim(), p_password: team.password ?? '', p_track_id: team.trackId, p_members: team.members }); if (error) throw error; return data as string; }
export async function deleteOrganizerTeam(teamId: string): Promise<void> { const { error } = await supabase.rpc('delete_organizer_team', { p_team_id: teamId }); if (error) throw error; }
export async function importOrganizerTeams(rows: ImportTeamRow[]): Promise<{ processed: number; created: number; updated: number }> { const { data, error } = await supabase.rpc('import_organizer_teams', { p_rows: rows }); if (error) throw error; return data as { processed: number; created: number; updated: number }; }
export function subscribeToHuntState(callback: (started: boolean, startedAt?: number) => void) { let active = true; void getHuntState().then(state => { if (!active || !state) return; callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined); }).catch(() => undefined); const channel = supabase.channel('hunt_state_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'hunt_state', filter: 'id=eq.1' }, payload => { const state = payload.new as { started: boolean; started_at: string | null }; callback(state.started, state.started_at ? new Date(state.started_at).getTime() : undefined); }).subscribe(); return () => { active = false; void supabase.removeChannel(channel); }; }
export function subscribeToTrackHuntState(trackId: string, callback: () => void) { if (!trackId) return () => undefined; const channel = supabase.channel(`track_hunt_state:${trackId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'track_hunt_state', filter: `track_id=eq.${trackId}` }, () => callback()).subscribe(); return () => { void supabase.removeChannel(channel); }; }
export function subscribeToTeamProgress(realtimeKey: string, callback: () => void) { if (!realtimeKey) return () => undefined; const channel = supabase.channel(`team:${realtimeKey}`).on('broadcast', { event: 'team_progress' }, () => callback()).subscribe(); return () => { void supabase.removeChannel(channel); }; }
export function subscribeToAllTeams(callback: (teams: TeamData[]) => void) { let active = true; const refresh = async () => { const teams = await getOrganizerOverview(); if (active) callback(teams); }; void refresh(); const interval = window.setInterval(() => { void refresh(); }, 5000); return () => { active = false; window.clearInterval(interval); }; }
export async function setGlobalHuntStatus(started: boolean) { const { error } = await supabase.rpc('set_global_hunt_status', { p_started: started }); if (error) throw error; }
export async function resetGlobalHunt() { const { error } = await supabase.rpc('convergence_admin_reset_game'); if (error) throw error; }
export async function manuallyAdvanceClue(teamId: string) { const { error } = await supabase.rpc('manually_advance_clue', { p_team_id: teamId }); if (error) throw error; }
export async function manuallyRewindClue(teamId: string) { const { error } = await supabase.rpc('manually_rewind_clue', { p_team_id: teamId }); if (error) throw error; }
export async function disqualifyTeam(teamId: string, dq: boolean) { const { error } = await supabase.rpc('disqualify_team', { p_team_id: teamId, p_disqualified: dq }); if (error) throw error; }
export async function resetTeamProgress(teamId: string) { const { error } = await supabase.rpc('reset_team_progress', { p_team_id: teamId }); if (error) throw error; }
export function subscribeToLeaderboard(trackId: string, currentTeamId: string | null, callback: (entries: LeaderboardEntry[]) => void) { const fetchLeaderboard = async () => { const { data, error } = await supabase.rpc('get_leaderboard', { p_track_id: trackId }); if (error || !data) return; const entries: LeaderboardEntry[] = (data as LeaderboardRow[]).map((row, index) => { const elapsed = Number(row.elapsed_seconds || 0); const hours = Math.floor(elapsed / 3600); const minutes = Math.floor((elapsed % 3600) / 60); const seconds = elapsed % 60; return { id: row.id, rank: index + 1, team: row.team, progress: Math.min(Number(row.progress || 1), 9), total: 9, elapsedTime: [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':'), isCurrentTeam: row.id === currentTeamId }; }); callback(entries); }; void fetchLeaderboard(); const interval = window.setInterval(fetchLeaderboard, 5000); return () => window.clearInterval(interval); }


export interface ConvergenceContent {
  step: string;
  title?: string;
  body?: string;
  instruction?: string;
  sticker_image_url?: string | null;
  clue_image_url?: string | null;
  physical_location?: string | null;
  metadata?: Record<string, unknown>;
  pair_key?: string;
}
export interface ConvergenceState {
  team_id: string;
  name: string;
  track_id: string;
  status: 'WAITING'|'ACTIVE'|'PAUSED'|'PROMOTED'|'ELIMINATED'|'FINALIST'|'WINNER';
  stage: number;
  step: string;
  warnings: number;
  game_running: boolean;
  stage_started_at?: string | null;
  started_at?: string | null;
  paused_at?: string | null;
  content?: ConvergenceContent | null;
}
export async function listTrackTeams(trackId: string): Promise<Array<{id:string;name:string}>> {
  const { data, error } = await supabase.rpc('list_track_teams', { p_track_id: trackId });
  if (error || !data) return [];
  return data as Array<{id:string;name:string}>;
}
export async function authenticateTeamV2(trackId: string, teamId: string, password: string) {
  const { data, error } = await supabase.rpc('login_team_v2', { p_track_id: trackId, p_team_id: teamId, p_password: password });
  if (error || !data) return null;
  return data as { token:string; realtime_key:string; team_id:string; name:string; track_id:string };
}
export async function getConvergenceState(token: string): Promise<ConvergenceState | null> {
  if (!token) return null;
  const { data, error } = await supabase.rpc('convergence_client_state', { p_token: token });
  if (error) {
    console.warn('[Convergence] state sync failed');
    throw error;
  }
  if (!data) throw new Error('Convergence session is no longer valid');
  return data as ConvergenceState;
}
export async function verifyConvergenceAction(token: string, action: string, value?: string) {
  const { data, error } = await supabase.rpc('verify_convergence_action', { p_token: token, p_action: action, p_value: value ?? null });
  if (error) throw error;
  return data as { ok:boolean; reason?:string; status?:string; next_step?:string; snippet?:string; rank?:number; timestamp?:string };
}
export async function recordConvergenceViolation(token: string, eventType: string) {
  const { data, error } = await supabase.rpc('record_convergence_violation', { p_token: token, p_event_type: eventType, p_metadata: {} });
  if (error) throw error;
  return data as { ok:boolean; warning?:number; status?:string };
}
export async function setConvergenceGame(stage: number, running: boolean) {
  const { error } = await supabase.rpc('convergence_admin_set_game', { p_stage: stage, p_running: running });
  if (error) throw error;
}
export async function setConvergenceBuffer(enabled: boolean) {
  const { data, error } = await supabase.rpc('convergence_admin_set_buffer', { p_enabled: enabled });
  if (error) throw error;
  return data as { ok:boolean; buffer_active:boolean; buffer_started_at:string|null; buffer_ends_at:string|null; server_now:string };
}
export async function getConvergenceAdminDashboard(trackId: string | null = null) {
  const { data, error } = await supabase.rpc('convergence_admin_get_dashboard', { p_track_id: trackId });
  if (error) throw error;
  return data as { game: { current_stage:number; running:boolean; stage_started_at:string|null }; teams: Array<Record<string,unknown>> };
}
export async function getConvergenceAudit(teamId: string | null = null) {
  const { data, error } = await supabase.rpc('convergence_admin_get_audit', { p_team_id: teamId });
  if (error) throw error;
  return data as Array<{id:number;team_id:string|null;event_type:string;stage:number|null;step_key:string|null;details:Record<string,unknown>;created_at:string}>;
}
export async function adminUpsertRouteItem(input: {teamId:string;stepKey:string;title:string;body:string;instruction:string;stickerImageUrl?:string;clueImageUrl?:string;physicalLocation?:string;code?:string;answer?:string;metadata?:Record<string,unknown>}) {
  const { error } = await supabase.rpc('convergence_admin_upsert_route_item', {
    p_team_id:input.teamId,p_step_key:input.stepKey,p_title:input.title,p_body:input.body,p_instruction:input.instruction,
    p_sticker_image_url:input.stickerImageUrl ?? null,p_clue_image_url:input.clueImageUrl ?? null,p_physical_location:input.physicalLocation ?? null,
    p_code:input.code ?? null,p_answer:input.answer ?? null,p_metadata:input.metadata ?? {}
  });
  if (error) throw error;
}
export async function adminUpsertCheckpoint(input:{stage:number;trackId:string;qrToken:string;checkpointCode:string;snippet:string;snippetAnswer:string}) {
  const { error } = await supabase.rpc('convergence_admin_upsert_checkpoint', {p_stage:input.stage,p_track_id:input.trackId,p_qr_token:input.qrToken,p_checkpoint_code:input.checkpointCode,p_snippet:input.snippet,p_snippet_answer:input.snippetAnswer});
  if (error) throw error;
}
export async function adminAssignSequence(teamId:string,sequenceId:string) {
  const { error } = await supabase.rpc('convergence_admin_assign_sequence',{p_team_id:teamId,p_sequence_id:sequenceId});
  if (error) throw error;
}

export interface ConvergenceSequence { id:string; name:string; payload:Record<string,unknown>; assigned_team_id:string|null; }
export async function getConvergenceSequences():Promise<ConvergenceSequence[]> { const {data,error}=await supabase.rpc('convergence_admin_list_sequences'); if(error||!data)return []; return data as ConvergenceSequence[]; }
export async function upsertConvergenceSequence(id:string|null,name:string,payload:Record<string,unknown>):Promise<string>{ const {data,error}=await supabase.rpc('convergence_admin_upsert_sequence',{p_id:id,p_name:name,p_payload:payload}); if(error)throw error; return data as string; }
export async function adminUpsertPair(input:{teamId:string;pairKey:string;logicalClue:string;stickerImageUrl?:string;physicalLocation?:string;clue9Location?:string}){ const {error}=await supabase.rpc('convergence_admin_upsert_pair',{p_team_id:input.teamId,p_pair_key:input.pairKey,p_logical_clue:input.logicalClue,p_sticker_image_url:input.stickerImageUrl??null,p_physical_location:input.physicalLocation??null,p_clue9_location:input.clue9Location??null}); if(error)throw error; }

export async function getAdminRouteItem(teamId:string,stepKey:string):Promise<Record<string,unknown>|null>{const {data,error}=await supabase.rpc('convergence_admin_get_route_item',{p_team_id:teamId,p_step_key:stepKey});if(error)throw error;return (data as Record<string,unknown>|null)??null;}
