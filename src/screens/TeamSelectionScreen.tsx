import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { authenticateTeamV2, listTrackTeams } from '../lib/db';
import { useAppContext } from '../store';

const TRACKS = ['A','B','C','D'] as const;

export function TeamSelectionScreen() {
  const navigate = useNavigate();
  const { setTeamLogin } = useAppContext();
  const [track, setTrack] = useState<string | null>(null);
  const [teams, setTeams] = useState<Array<{id:string;name:string}>>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!track) return;
    setTeamId(null); setPassword(''); setError('');
    void listTrackTeams(track).then(setTeams);
  }, [track]);

  const enter = async () => {
    if (!track || !teamId || !password || loading) return;
    setLoading(true); setError('');
    try {
      const session = await authenticateTeamV2(track, teamId, password);
      if (!session) { setError('Incorrect team password.'); return; }
      setTeamLogin(session.team_id, session.name, session.track_id, session.token, session.realtime_key);
      navigate('/dashboard', { replace: true });
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <AppShell showBack title="THE CONVERGENCE">
      <div className="flex-1 flex flex-col justify-center py-8">
        <div className="text-center mb-8">
          <p className="text-[10px] text-gold uppercase tracking-[0.35em] mb-2">Identify your route</p>
          <h2 className="font-display text-3xl text-offwhite tracking-widest uppercase">Select Your Track</h2>
        </div>

        {!track ? (
          <div className="grid grid-cols-2 gap-3">
            {TRACKS.map(t => (
              <button key={t} onClick={() => setTrack(t)} className="min-h-28 rounded-2xl border border-gold/25 bg-black/35 text-offwhite hover:border-gold/70 active:scale-[.98] transition-all">
                <span className="block font-display text-3xl text-gold">{t}</span>
                <span className="text-[10px] uppercase tracking-[.25em] text-muted">Track {t}</span>
              </button>
            ))}
          </div>
        ) : !teamId ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-xs text-muted uppercase tracking-widest">Track {track}</p><h3 className="font-display text-xl text-offwhite uppercase tracking-wider">Choose Your Team</h3></div>
              <button onClick={() => setTrack(null)} className="text-xs text-gold uppercase tracking-wider">Change</button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {teams.map(team => (
                <button key={team.id} onClick={() => setTeamId(team.id)} className="text-left p-4 rounded-xl border border-white/10 bg-black/30 hover:border-gold/50 transition-colors">
                  <span className="font-display text-lg text-offwhite uppercase">{team.name}</span>
                </button>
              ))}
              {!teams.length && <p className="text-center text-muted py-8">No teams are configured for this track yet.</p>}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gold/30 bg-black/40 p-6">
            <button onClick={() => { setTeamId(null); setPassword(''); }} className="text-xs text-gold uppercase tracking-wider mb-5">← Choose another team</button>
            <p className="text-[10px] uppercase tracking-[.3em] text-muted">Track {track}</p>
            <h3 className="font-display text-2xl text-offwhite uppercase tracking-widest mb-6">{teams.find(t => t.id === teamId)?.name}</h3>
            <label className="block text-xs uppercase tracking-widest text-muted mb-2">Team password</label>
            <input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if(e.key==='Enter') void enter(); }} className="w-full bg-void/60 border border-gold/25 rounded-xl px-4 py-4 text-offwhite text-center tracking-widest outline-none focus:border-gold" placeholder="ENTER PASSWORD" autoComplete="current-password" />
            {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
            <div className="mt-6"><PrimaryButton variant="parchment" disabled={!password || loading} onClick={enter}>{loading ? 'Entering…' : 'Enter Game →'}</PrimaryButton></div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
