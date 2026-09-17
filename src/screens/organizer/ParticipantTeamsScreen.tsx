import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Edit3, Plus, RefreshCw, Save, Trash2, Upload, Users, X } from 'lucide-react';
import { OrganizerLayout } from '../../layouts/OrganizerLayout';
import {
  deleteOrganizerTeam,
  getOrganizerProfile,
  getOrganizerTeamMembers,
  getOrganizerTeams,
  importOrganizerTeams,
  upsertOrganizerTeam,
  type OrganizerProfile,
  type OrganizerTeam,
  type TeamMember,
} from '../../lib/db';

const TRACKS = ['A', 'B', 'C', 'D', 'TEST'] as const;
type TrackId = typeof TRACKS[number];
type DraftMember = { name: string; email: string; phone: string };

function normalizeHeader(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some(v => v.trim())) rows.push(row); }
  return rows;
}

function parseImport(text: string): { rows: Array<{ team_name: string; password: string; track_id: string; members: DraftMember[] }>; skipped: number } {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('CSV must contain a header row and at least one team row.');
  const headers = table[0].map(normalizeHeader);
  const indexOf = (...names: string[]) => names.map(normalizeHeader).map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;
  const teamIndex = indexOf('team_name', 'team', 'name', 'team_name');
  const passwordIndex = indexOf('password', 'team_password', 'login_password');
  const trackIndex = indexOf('track_id', 'track', 'track_name');
  const memberNameIndex = indexOf('member_name', 'participant_name', 'participant', 'member');
  const emailIndex = indexOf('member_email', 'participant_email', 'email');
  const phoneIndex = indexOf('member_phone', 'participant_phone', 'phone', 'mobile');
  if (teamIndex < 0 || trackIndex < 0) throw new Error('CSV needs Team Name and Track columns. Password is optional for existing teams.');
  const grouped = new Map<string, { team_name: string; password: string; track_id: string; members: DraftMember[] }>();
  let skipped = 0;
  for (const cells of table.slice(1)) {
    const teamName = (cells[teamIndex] || '').trim();
    const track = (cells[trackIndex] || '').trim().toUpperCase();
    if (!teamName || !track) { skipped += 1; continue; }
    if (!TRACKS.includes(track as TrackId)) throw new Error(`Unknown track "${track}" for team "${teamName}".`);
    const key = `${track}::${teamName.toLowerCase()}`;
    const entry = grouped.get(key) ?? { team_name: teamName, password: passwordIndex >= 0 ? (cells[passwordIndex] || '').trim() : '', track_id: track, members: [] };
    const memberName = memberNameIndex >= 0 ? (cells[memberNameIndex] || '').trim() : '';
    if (memberName) entry.members.push({ name: memberName, email: emailIndex >= 0 ? (cells[emailIndex] || '').trim() : '', phone: phoneIndex >= 0 ? (cells[phoneIndex] || '').trim() : '' });
    grouped.set(key, entry);
  }
  return { rows: [...grouped.values()], skipped };
}

function downloadTemplate() {
  const csv = 'team_name,password,track_id,member_name,member_email,member_phone\nTeam Alpha,Alpha@123,A,Alice Example,alice@example.com,9876543210\nTeam Alpha,Alpha@123,A,Bob Example,bob@example.com,9876543211\nTeam Beta,Beta@123,B,Charlie Example,charlie@example.com,9876543212\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'convergence-participant-teams-template.csv'; a.click(); URL.revokeObjectURL(url);
}

export function ParticipantTeamsScreen() {
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [teams, setTeams] = useState<OrganizerTeam[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrackId | 'ALL'>('ALL');
  const [editing, setEditing] = useState<OrganizerTeam | null>(null);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTrack, setFormTrack] = useState<TrackId>('A');
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleTracks = useMemo(() => profile?.track_id ? [profile.track_id as TrackId] : TRACKS.filter(t => t !== 'TEST'), [profile]);
  const visibleTeams = selectedTrack === 'ALL' ? teams : teams.filter(t => t.track_id === selectedTrack);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const nextProfile = await getOrganizerProfile(); setProfile(nextProfile);
      const allowed = nextProfile?.track_id ?? null;
      if (allowed) setSelectedTrack(allowed as TrackId);
      setTeams(await getOrganizerTeams(allowed || (selectedTrack === 'ALL' ? null : selectedTrack)));
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load teams.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [selectedTrack]);

  const openCreate = () => { setEditing(null); setFormName(''); setFormPassword(''); setFormTrack((profile?.track_id as TrackId) || 'A'); setMembers([]); setMessage(''); setError(''); };
  const openEdit = async (team: OrganizerTeam) => { setEditing(team); setFormName(team.name); setFormPassword(''); setFormTrack(team.track_id as TrackId); setMessage(''); setError(''); const current = await getOrganizerTeamMembers(team.id); setMembers(current.map(m => ({ name: m.name, email: m.email || '', phone: m.phone || '' }))); };
  const addMember = () => setMembers(prev => [...prev, { name: '', email: '', phone: '' }]);
  const updateMember = (index: number, key: keyof DraftMember, value: string) => setMembers(prev => prev.map((m, i) => i === index ? { ...m, [key]: value } : m));
  const removeMember = (index: number) => setMembers(prev => prev.filter((_, i) => i !== index));

  const saveTeam = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    try { await upsertOrganizerTeam({ id: editing?.id, name: formName, password: formPassword, trackId: formTrack, members: members.filter(m => m.name.trim()) }); setMessage(editing ? 'Team updated and synced to Supabase.' : 'Team created and synced to Supabase.'); setEditing(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save team.'); }
  };

  const removeTeam = async (team: OrganizerTeam) => {
    if (!confirm(`Remove "${team.name}" from the participant teams? This also removes its hunt progress and active sessions.`)) return;
    setError('');
    try { await deleteOrganizerTeam(team.id); setMessage('Team removed from Supabase.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to remove team.'); }
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setImporting(true); setError(''); setMessage('');
    try { const parsed = parseImport(await file.text()); if (!parsed.rows.length) throw new Error('No valid team rows found in CSV.'); const result = await importOrganizerTeams(parsed.rows); setMessage(`Import complete: ${result.created} created, ${result.updated} updated, ${result.processed} processed${parsed.skipped ? `, ${parsed.skipped} skipped` : ''}.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'CSV import failed.'); }
    finally { setImporting(false); event.target.value = ''; }
  };

  return (
    <OrganizerLayout title="Participant Teams">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-gray-400 text-sm">Import registrations once, then manage the same teams directly from this panel.</p><p className="text-gray-600 text-xs mt-1">CSV rows are grouped by team + track, and repeated participant rows become team members.</p></div>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-2 border border-gray-700 px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800"><Download className="w-4 h-4" /> CSV Template</button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="flex items-center gap-2 bg-gold text-black px-3 py-2 rounded text-sm font-semibold disabled:opacity-50"><Upload className="w-4 h-4" /> {importing ? 'Importing…' : 'Import CSV'}</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importFile} className="hidden" />
            <button onClick={openCreate} className="flex items-center gap-2 border border-gold/50 text-gold px-3 py-2 rounded text-sm"><Plus className="w-4 h-4" /> Add Team</button>
            <button onClick={() => void load()} className="p-2 border border-gray-700 rounded text-gray-400 hover:text-white" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {message && <div className="border border-green-900 bg-green-950/30 text-green-300 px-4 py-3 rounded text-sm">{message}</div>}
        {error && <div className="border border-red-900 bg-red-950/30 text-red-300 px-4 py-3 rounded text-sm">{error}</div>}

        <div className="flex flex-wrap gap-2">
          {!profile?.track_id && <button onClick={() => setSelectedTrack('ALL')} className={`px-4 py-2 rounded text-sm ${selectedTrack === 'ALL' ? 'bg-gold text-black' : 'bg-[#151515] text-gray-400'}`}>All Tracks</button>}
          {visibleTracks.map(track => <button key={track} onClick={() => setSelectedTrack(track)} className={`px-4 py-2 rounded text-sm ${selectedTrack === track ? 'bg-gold text-black' : 'bg-[#151515] text-gray-400'}`}>Track {track}</button>)}
        </div>

        {editing !== null || formName !== '' || members.length > 0 ? (
          <form onSubmit={saveTeam} className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-white font-semibold">{editing ? 'Edit Team' : 'Add Team'}</h3><button type="button" onClick={() => { setEditing(null); setFormName(''); setMembers([]); }}><X className="w-4 h-4 text-gray-500" /></button></div>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-xs text-gray-500 uppercase">Team name<input value={formName} onChange={e => setFormName(e.target.value)} required className="mt-1 w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white text-sm" /></label>
              <label className="text-xs text-gray-500 uppercase">Team password<input value={formPassword} onChange={e => setFormPassword(e.target.value)} type="text" placeholder={editing ? 'Leave blank to keep current' : 'Required for login'} required={!editing} className="mt-1 w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white text-sm" /></label>
              <label className="text-xs text-gray-500 uppercase">Track<select value={formTrack} onChange={e => setFormTrack(e.target.value as TrackId)} disabled={Boolean(profile?.track_id)} className="mt-1 w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white text-sm">{visibleTracks.map(track => <option key={track} value={track}>{track}</option>)}</select></label>
            </div>
            <div className="space-y-2"><div className="flex items-center justify-between"><h4 className="text-sm text-gray-300 flex items-center gap-2"><Users className="w-4 h-4" /> Participants ({members.length})</h4><button type="button" onClick={addMember} className="text-xs text-gold">+ Add participant</button></div>
              {members.map((member, index) => <div key={`${index}-${member.name}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2"><input value={member.name} onChange={e => updateMember(index,'name',e.target.value)} placeholder="Name" className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-sm" /><input value={member.email} onChange={e => updateMember(index,'email',e.target.value)} placeholder="Email" className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-sm" /><input value={member.phone} onChange={e => updateMember(index,'phone',e.target.value)} placeholder="Phone" className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-sm" /><button type="button" onClick={() => removeMember(index)} className="p-2 text-red-400"><X className="w-4 h-4" /></button></div>)}
            </div>
            <button type="submit" className="flex items-center gap-2 bg-gold text-black px-4 py-2 rounded font-semibold text-sm"><Save className="w-4 h-4" /> Save & Sync</button>
          </form>
        ) : null}

        <div className="bg-[#111] border border-gray-800 rounded overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_120px] gap-3 px-4 py-3 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500"><span>Team</span><span>Track</span><span>Participants</span><span className="text-right">Actions</span></div>
          {loading ? <div className="p-8 text-center text-gray-600">Loading teams…</div> : visibleTeams.length === 0 ? <div className="p-8 text-center text-gray-600">No participant teams yet. Import your registration CSV or add a team.</div> : visibleTeams.map(team => <div key={team.id} className="grid grid-cols-[1fr_120px_120px_120px] gap-3 items-center px-4 py-3 border-b border-gray-900 last:border-0"><div className="text-white font-medium">{team.name}</div><div className="text-gray-400">{team.track_id}</div><div className="text-gray-400">{team.member_count}</div><div className="flex justify-end gap-1"><button onClick={() => void openEdit(team)} className="p-2 text-gray-400 hover:text-gold" title="Edit"><Edit3 className="w-4 h-4" /></button><button onClick={() => void removeTeam(team)} className="p-2 text-gray-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button></div></div>)}
        </div>
      </div>
    </OrganizerLayout>
  );
}
