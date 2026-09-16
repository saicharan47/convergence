import { useEffect, useMemo, useState } from 'react';
import { OrganizerLayout } from '../../layouts/OrganizerLayout';
import { LiveOverviewTable } from '../../components/organizer/LiveOverviewTable';
import {
  getOrganizerOverview,
  getOrganizerProfile,
  getTrackHuntState,
  resetGlobalHunt,
  setGlobalHuntStatus,
  setTrackHuntStatus,
  setTrackSchedule,
  type OrganizerProfile,
  type TeamData,
  type TrackSchedule,
} from '../../lib/db';
import { Play, RotateCcw, Square } from 'lucide-react';

const TRACKS = ['A', 'B', 'C', 'D'] as const;
type TrackId = typeof TRACKS[number];

function toInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function OrganizerDashboardScreen() {
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackId | 'ALL'>('ALL');
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [schedules, setSchedules] = useState<Record<string, TrackSchedule>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');

  const visibleTracks = useMemo(() => {
    if (profile?.track_id && TRACKS.includes(profile.track_id as TrackId)) return [profile.track_id as TrackId];
    return [...TRACKS];
  }, [profile]);

  const load = async () => {
    const nextProfile = await getOrganizerProfile();
    setProfile(nextProfile);
    const allowedTrack = nextProfile?.track_id as TrackId | null | undefined;
    const track = allowedTrack && TRACKS.includes(allowedTrack) ? allowedTrack : null;
    if (track && selectedTrack === 'ALL') setSelectedTrack(track);
    const filter = track || (selectedTrack === 'ALL' ? null : selectedTrack);
    const [overview, ...stateResults] = await Promise.all([
      getOrganizerOverview(filter),
      ...visibleTracks.map((id) => getTrackHuntState(id)),
    ]);
    setTeams(overview);
    const nextSchedules: Record<string, TrackSchedule> = {};
    visibleTracks.forEach((id, index) => {
      const state = stateResults[index];
      if (state) nextSchedules[id] = state;
    });
    setSchedules(nextSchedules);
    const current = nextSchedules[selectedTrack === 'ALL' ? visibleTracks[0] : selectedTrack];
    if (current) {
      setScheduleStart(toInputValue(current.starts_at));
      setScheduleEnd(toInputValue(current.ends_at));
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, [selectedTrack]);

  const activeTrack = selectedTrack === 'ALL' ? null : selectedTrack;
  const displayedTeams = activeTrack ? teams.filter((team) => team.track === activeTrack) : teams;

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try { await action(); await load(); } finally { setBusy(null); }
  };

  const handleGlobalStart = () => run('global-start', async () => {
    if (confirm('Start the hunt for ALL tracks and ALL eligible teams now?')) await setGlobalHuntStatus(true);
  });

  const handleGlobalReset = () => run('global-reset', async () => {
    const input = prompt('Type RESET to reset all teams and stop the master hunt.');
    if (input === 'RESET') await resetGlobalHunt();
  });

  const handleTrackToggle = (track: TrackId) => run(`track-${track}`, async () => {
    const current = schedules[track];
    await setTrackHuntStatus(track, !current?.enabled);
  });

  const handleScheduleSave = () => {
    if (!activeTrack) return;
    run(`schedule-${activeTrack}`, async () => {
      const start = scheduleStart ? new Date(scheduleStart).toISOString() : null;
      const end = scheduleEnd ? new Date(scheduleEnd).toISOString() : null;
      await setTrackSchedule(activeTrack, start, end);
    });
  };

  return (
    <OrganizerLayout title="Live Overview">
      <div className="flex flex-col gap-6 h-full">
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button onClick={handleGlobalStart} disabled={busy !== null} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition-colors font-medium text-sm tracking-wide uppercase disabled:opacity-50">
            <Play className="w-4 h-4" fill="currentColor" /> Master Start
          </button>
          <button onClick={handleGlobalReset} disabled={busy !== null} className="flex items-center gap-2 bg-transparent border border-red-900 text-red-500 hover:bg-red-900/20 px-4 py-2 rounded transition-colors font-medium text-sm tracking-wide uppercase disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> Reset Hunt
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
          {visibleTracks.map((track) => {
            const state = schedules[track];
            return (
              <div key={track} className="bg-[#151515] border border-gray-800 p-3 rounded">
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setSelectedTrack(track)} className={`font-medium ${selectedTrack === track ? 'text-gold' : 'text-gray-300'}`}>Track {track}</button>
                  <button onClick={() => handleTrackToggle(track)} disabled={busy !== null} className={`flex items-center gap-1 px-2 py-1 rounded text-xs uppercase ${state?.enabled ? 'bg-red-950 text-red-300' : 'bg-green-950 text-green-300'} disabled:opacity-50`}>
                    {state?.enabled ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {state?.enabled ? 'Stop' : 'Start'}
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">{state?.active_now ? 'LIVE NOW' : state?.starts_at ? `Scheduled: ${new Date(state.starts_at).toLocaleString()}` : 'No schedule set'}</div>
              </div>
            );
          })}
        </div>

        {activeTrack && (
          <div className="bg-[#111] border border-gray-800 rounded p-4 shrink-0">
            <div className="flex flex-wrap items-end gap-3">
              <div><label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Track {activeTrack} start</label><input type="datetime-local" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-sm text-white" /></div>
              <div><label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Track {activeTrack} end</label><input type="datetime-local" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-sm text-white" /></div>
              <button onClick={handleScheduleSave} disabled={busy !== null} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">Save Timing</button>
            </div>
            <p className="text-xs text-gray-600 mt-2">Master Start launches every track immediately. Track controls and schedules can still be used for individual track control afterward.</p>
          </div>
        )}

        <div className="flex-1 min-h-[400px]"><LiveOverviewTable teams={displayedTeams} /></div>
      </div>
    </OrganizerLayout>
  );
}
