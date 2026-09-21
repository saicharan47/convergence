import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppContext } from '../store';
import { recordConvergenceViolation, verifyConvergenceAction } from '../lib/db';
import { getConvergenceFlow } from '../lib/convergenceFlow';

const TRACK_STYLES: Record<string,string> = { A:'text-red-300 border-red-400/30 bg-red-500/5', B:'text-blue-300 border-blue-400/30 bg-blue-500/5', C:'text-green-300 border-green-400/30 bg-green-500/5', D:'text-yellow-300 border-yellow-400/30 bg-yellow-500/5' };

function label(step:string) {
  return step.replaceAll('_',' ').replace('ANSWER 2','7-DIGIT ANSWER').replace('ANSWER 5','7-DIGIT ANSWER').replace('CHECKPOINT 1 QR','CHECKPOINT 1').replace('CHECKPOINT 2 QR','CHECKPOINT 2');
}
function expectedLength(step:string) {
  if (step.includes('STICKER') || step.includes('CHECKPOINT_1_CODE') || step.includes('CHECKPOINT_2_CODE') || step==='CLUE_9') return 5;
  if (step.includes('ANSWER_')) return 7;
  if (step.includes('SNIPPET')) return 1;
  return 1;
}

export function DashboardScreen() {
  const navigate = useNavigate();
  const { sessionToken, teamName, trackId, convergenceState, convergenceLoadError } = useAppContext();
  const [value,setValue]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [clock,setClock]=useState(()=>Date.now());
  const state=convergenceState;
  const content=state?.content ?? null;
  const flow=getConvergenceFlow(state?.step ?? 'HAND_IN');
  useEffect(()=>{const id=window.setInterval(()=>setClock(Date.now()),100);return()=>window.clearInterval(id);},[]);
  const serverOffset=useMemo(()=>state?.server_now?new Date(state.server_now).getTime()-clock:0,[state?.server_now,clock]);
  const serverNow=clock+serverOffset;
  const bufferRemaining=state?.buffer_ends_at?Math.max(0,new Date(state.buffer_ends_at).getTime()-serverNow):0;
  const formatBuffer=(ms:number)=>{const m=Math.floor(ms/60000);const s=Math.floor((ms%60000)/1000);const milli=ms%1000;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(milli).padStart(3,'0')}`;};

  useEffect(()=>{ if(!sessionToken){ navigate('/',{replace:true}); } },[sessionToken,navigate]);

  useEffect(()=>{
    if(!sessionToken || !state?.game_running || state.status==='ELIMINATED' || state.status==='WINNER') return;
    let hiddenTimer:number|undefined;
    const handleVisibility=()=>{
      if(!document.hidden){ if(hiddenTimer) window.clearTimeout(hiddenTimer); return; }
      // Delay the violation so refresh/navigation unloads do not create a false warning.
      hiddenTimer=window.setTimeout(()=>{
        if(document.hidden) void recordConvergenceViolation(sessionToken,'TAB_HIDDEN',{step:state.step}).catch(()=>undefined);
      },1500);
    };
    document.addEventListener('visibilitychange',handleVisibility);
    return()=>{document.removeEventListener('visibilitychange',handleVisibility);if(hiddenTimer)window.clearTimeout(hiddenTimer);};
  },[sessionToken,state?.game_running,state?.status,state?.step]);

  const submit=useCallback(async(action:string, overrideValue?:string)=>{
    if(!sessionToken || busy) return;
    const submittedValue=(overrideValue ?? value).trim();
    const required=expectedLength(state?.step ?? '');
    if(!['ACK_RIDDLE','ACK_HANDIN','ACK_CLUE_8','FINAL_SUBMISSION'].includes(action) && submittedValue.length<required){setError(`Enter the required ${required}-digit answer.`);return;}
    setBusy(true);setError('');
    try{
      const result=await verifyConvergenceAction(sessionToken,action,submittedValue);
      if(!result.ok){setError(result.reason==='game_paused'?'The game is currently paused.':result.reason==='buffer_period'?'The 20-minute buffer period is active. Wait for the organizer to end it or for the timer to finish.':result.reason==='rate_limited'?'Too many attempts in a short period. Wait a few seconds and try again.':result.reason==='treasure_already_found'?'The treasure has already been claimed.':'Incorrect entry. Try again.');return;}
      setValue('');
      if(result.status==='WINNER') navigate('/treasure',{replace:true});
    }catch{setError('Connection error. Your progress is safe. Try again.')}
    finally{setBusy(false);}
  },[sessionToken,busy,value,state?.step,navigate]);

  useEffect(()=>{const token=new URLSearchParams(window.location.search).get('checkpoint');if(!token||!sessionToken||!state?.step?.endsWith('_QR'))return;void submit('CHECKPOINT_QR',token)},[sessionToken,state?.step,submit]);

  const showInput=['STICKER_1','STICKER_2','ANSWER_2','CHECKPOINT_1_QR','CHECKPOINT_1_CODE','SNIPPET_1','STICKER_4','STICKER_5','ANSWER_5','CHECKPOINT_2_QR','CHECKPOINT_2_CODE','SNIPPET_2','STICKER_7','CLUE_9'].includes(state?.step ?? '');
  const action=state?.step==='CLUE_8'?'ACK_CLUE_8':state?.step?.includes('ANSWER')?'ANSWER':state?.step?.includes('STICKER')?'STICKER_CODE':state?.step?.includes('CHECKPOINT_')?'CHECKPOINT_'+(state.step.endsWith('_QR')?'QR':'CODE'):state?.step?.includes('SNIPPET')?'SNIPPET':state?.step==='CLUE_9'?'CLUE9_CODE':'';

  if(!state) return <AppShell title="THE CONVERGENCE"><div className="flex-1 flex flex-col items-center justify-center text-center px-6"><div className="text-4xl mb-4">◌</div><h2 className="font-display text-xl text-offwhite uppercase tracking-widest">{convergenceLoadError ? 'Route sync unavailable' : 'Loading your route…'}</h2><p className="text-sm text-muted mt-3 max-w-sm">{convergenceLoadError ?? 'Connecting to the Convergence control server.'}</p><div className="mt-6 flex flex-col gap-3 w-full max-w-xs"><button type="button" onClick={() => window.location.reload()} className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-[10px] uppercase tracking-[.25em] text-gold">Retry now</button>{convergenceLoadError && <button type="button" onClick={() => navigate('/team',{replace:true})} className="rounded-xl border border-white/10 px-4 py-3 text-[10px] uppercase tracking-[.25em] text-muted">Return to team login</button>}</div><p className="text-[10px] uppercase tracking-[.25em] text-muted/60 mt-5">Your server-side progress is not reset by refreshing.</p></div></AppShell>;

  if(state.status==='ELIMINATED') return <AppShell title="THE CONVERGENCE"><div className="flex-1 flex flex-col items-center justify-center text-center"><div className="text-6xl mb-5">⚫</div><h2 className="font-display text-3xl text-red-300 uppercase tracking-widest">Eliminated</h2><p className="text-muted mt-3 max-w-sm">Your team is no longer eligible to continue.</p></div></AppShell>;
  if(state.status==='WINNER') return <AppShell title="THE CONVERGENCE"><div className="flex-1 flex flex-col items-center justify-center text-center"><div className="text-6xl mb-5">🏆</div><h2 className="font-display text-3xl text-gold uppercase tracking-widest">Treasure Found</h2><p className="text-offwhite mt-3">{teamName}</p></div></AppShell>;

  return <AppShell title="THE CONVERGENCE" showMenu>
    <div className="flex-1 py-3">
      <div className="text-center mb-6"><p className={`inline-flex px-3 py-1 rounded-full border text-[10px] uppercase tracking-[.25em] ${TRACK_STYLES[trackId ?? ''] ?? 'text-gold border-gold/20 bg-gold/5'}`}>Track {trackId} · {trackId==='A'?'RED':trackId==='B'?'BLUE':trackId==='C'?'GREEN':'YELLOW'}</p><h2 className="font-display text-2xl text-offwhite uppercase tracking-widest mt-1">{teamName}</h2></div>
      <div className="rounded-2xl border border-gold/20 bg-black/30 p-4 mb-5"><div className="flex items-center justify-between text-[10px] uppercase tracking-[.25em] text-muted"><span>Current event flow</span><span>{flow.position}/10</span></div><h3 className="font-display text-xl text-gold uppercase tracking-wider mt-2">{flow.label}</h3><p className="text-xs uppercase tracking-[.18em] text-offwhite/70 mt-1">{flow.title}</p><div className="flex gap-1 mt-4">{Array.from({length:10}).map((_,i)=><div key={i} className={`h-1 flex-1 rounded ${i<flow.position?'bg-gold':'bg-white/10'}`}/>)}</div></div>
      {state.buffer_active && bufferRemaining>0 ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center"><div className="text-4xl mb-3">⏳</div><p className="text-[10px] uppercase tracking-[.35em] text-amber-400">Buffer Period</p><h3 className="font-display text-3xl text-offwhite tracking-widest mt-2 font-mono">{formatBuffer(bufferRemaining)}</h3><p className="text-sm text-muted mt-3">The hunt is paused for the 20-minute buffer period. Your progress is saved. Wait for the organizer to start the next stage.</p></div> : !state.game_running || state.status==='PAUSED' || state.step==='STAGE_4_ASSIGNMENT' || state.step==='STAGE_7' ? <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center"><div className="text-4xl mb-3">⏸</div><h3 className="font-display text-xl text-offwhite uppercase tracking-widest">Waiting Lounge</h3><p className="text-sm text-muted mt-2">The current stage is paused. Stay ready — this screen will update automatically when the organizer starts the next stage.</p></div> : <div className="space-y-5">
        {content?.sticker_image_url && <div className="mx-auto w-40 h-40 rounded-2xl overflow-hidden border border-gold/30 bg-black/50"><img src={content.sticker_image_url} alt="Mission sticker" className="w-full h-full object-contain"/></div>}
        
        {content?.physical_location && <div className="rounded-xl border border-gold/15 bg-gold/5 p-3 text-sm text-offwhite/80"><span className="text-[10px] uppercase tracking-widest text-gold block mb-1">Physical location</span>{content.physical_location}</div>}
        {content?.title && <h3 className="font-display text-2xl text-offwhite uppercase tracking-wider">{content.title}</h3>}
        {content?.body && <div className="rounded-2xl border border-white/10 bg-black/35 p-5 text-offwhite/90 leading-relaxed whitespace-pre-wrap">{content.body}</div>}
        {content?.instruction && <p className="text-xs uppercase tracking-wider text-muted">{content.instruction}</p>}
        {state.step==='HAND_IN' && <PrimaryButton onClick={()=>void submit('ACK_HANDIN')}>I Found Clue 1 →</PrimaryButton>}
        {state.step==='RIDDLE_4' && <PrimaryButton onClick={()=>void submit('ACK_RIDDLE')}>I Reached Clue 4 →</PrimaryButton>}
        {state.step==='RIDDLE_7' && <PrimaryButton onClick={()=>void submit('ACK_RIDDLE')}>I Reached Clue 7 →</PrimaryButton>}
        {state.step==='CLUE_8' && <PrimaryButton onClick={()=>void submit('ACK_CLUE_8')}>I Found Clue 9 →</PrimaryButton>}
        {state.step==='FINAL_RIDDLE' && <PrimaryButton variant="parchment" disabled={busy} onClick={()=>void submit('FINAL_SUBMISSION')}>{busy?'Locking…':'I Found The Treasure →'}</PrimaryButton>}
        {showInput && <div className="rounded-2xl border border-white/10 bg-black/30 p-5"><label className="block text-[10px] uppercase tracking-[.25em] text-gold mb-3">{state.step==='HAND_IN'?'':state.step.includes('QR')?'Track QR token / scan result':state.step.includes('CHECKPOINT')?'Enter checkpoint code':state.step.includes('SNIPPET')?'Submit code snippet answer':state.step==='CLUE_9'?'Enter Clue 9 physical code':state.step.includes('ANSWER')?'Enter 7-digit answer':'Enter the physical sticker code'}</label><input value={value} onChange={e=>{setValue(e.target.value.slice(0, state.step.includes('ANSWER')?7:32));setError('')}} inputMode={state.step.includes('ANSWER')||state.step.includes('STICKER')||state.step.includes('CHECKPOINT')?'numeric':'text'} className="w-full bg-void border border-gold/25 rounded-xl px-4 py-4 text-center text-xl tracking-[.25em] text-offwhite outline-none focus:border-gold" placeholder={state.step.includes('ANSWER')?'7-DIGIT ANSWER':'ENTER CODE'} autoComplete="off"/><div className="mt-4"><PrimaryButton disabled={busy || !value.trim()} onClick={()=>void submit(action)}>{busy?'Verifying…':'Submit'}</PrimaryButton></div></div>}
        {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      </div>}
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-[10px] uppercase tracking-[.25em] text-gold mb-3">Event rules</div><div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-muted"><span>✓ Refresh safe</span><span>✓ Internet loss safe</span><span>✓ Progress saved</span><span>⚠ 3 tab violations = elimination</span></div></div><div className="mt-4 text-center text-[9px] uppercase tracking-[.3em] text-muted/60">Progress is server-synced. Refreshing will not reset your route.</div>
    </div>
  </AppShell>;
}
