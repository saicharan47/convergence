import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppContext } from '../store';
import { verifyConvergenceAction } from '../lib/db';

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
  const state=convergenceState;
  const content=state?.content ?? null;

  useEffect(()=>{ if(!sessionToken){ navigate('/',{replace:true}); } },[sessionToken,navigate]);

  const submit=useCallback(async(action:string, overrideValue?:string)=>{
    if(!sessionToken || busy) return;
    const submittedValue=(overrideValue ?? value).trim();
    const required=expectedLength(state?.step ?? '');
    if(action!=='ACK_RIDDLE' && action!=='FINAL_SUBMISSION' && submittedValue.length<required){setError(`Enter the required ${required}-digit answer.`);return;}
    setBusy(true);setError('');
    try{
      const result=await verifyConvergenceAction(sessionToken,action,submittedValue);
      if(!result.ok){setError(result.reason==='game_paused'?'The game is currently paused.':result.reason==='treasure_already_found'?'The treasure has already been claimed.':'Incorrect entry. Try again.');return;}
      setValue('');
      if(result.status==='WINNER') navigate('/treasure',{replace:true});
    }catch{setError('Connection error. Your progress is safe. Try again.')}
    finally{setBusy(false);}
  },[sessionToken,busy,value,state?.step,navigate]);

  useEffect(()=>{const token=new URLSearchParams(window.location.search).get('checkpoint');if(!token||!sessionToken||!state?.step?.endsWith('_QR'))return;void submit('CHECKPOINT_QR',token)},[sessionToken,state?.step,submit]);

  const showInput=['HAND_IN','STICKER_1','STICKER_2','ANSWER_2','CHECKPOINT_1_QR','CHECKPOINT_1_CODE','SNIPPET_1','STICKER_4','STICKER_5','ANSWER_5','CHECKPOINT_2_QR','CHECKPOINT_2_CODE','SNIPPET_2','STICKER_7','CLUE_9'].includes(state?.step ?? '');
  const action=state?.step==='HAND_IN'?'STICKER_CODE':state?.step?.includes('ANSWER')?'ANSWER':state?.step?.includes('STICKER')?'STICKER_CODE':state?.step?.includes('CHECKPOINT_')?'CHECKPOINT_'+(state.step.endsWith('_QR')?'QR':'CODE'):state?.step?.includes('SNIPPET')?'SNIPPET':state?.step==='CLUE_9'?'CLUE9_CODE':'';

  if(!state) return <AppShell title="THE CONVERGENCE"><div className="flex-1 flex flex-col items-center justify-center text-center px-6"><div className="text-4xl mb-4">◌</div><h2 className="font-display text-xl text-offwhite uppercase tracking-widest">{convergenceLoadError ? 'Route sync unavailable' : 'Loading your route…'}</h2><p className="text-sm text-muted mt-3 max-w-sm">{convergenceLoadError ?? 'Connecting to the Convergence control server.'}</p><div className="mt-6 flex flex-col gap-3 w-full max-w-xs"><button type="button" onClick={() => window.location.reload()} className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-[10px] uppercase tracking-[.25em] text-gold">Retry now</button>{convergenceLoadError && <button type="button" onClick={() => navigate('/team',{replace:true})} className="rounded-xl border border-white/10 px-4 py-3 text-[10px] uppercase tracking-[.25em] text-muted">Return to team login</button>}</div><p className="text-[10px] uppercase tracking-[.25em] text-muted/60 mt-5">Your server-side progress is not reset by refreshing.</p></div></AppShell>;

  if(state.status==='ELIMINATED') return <AppShell title="THE CONVERGENCE"><div className="flex-1 flex flex-col items-center justify-center text-center"><div className="text-6xl mb-5">⚫</div><h2 className="font-display text-3xl text-red-300 uppercase tracking-widest">Eliminated</h2><p className="text-muted mt-3 max-w-sm">Your team is no longer eligible to continue.</p></div></AppShell>;
  if(state.status==='WINNER') return <AppShell title="THE CONVERGENCE"><div className="flex-1 flex flex-col items-center justify-center text-center"><div className="text-6xl mb-5">🏆</div><h2 className="font-display text-3xl text-gold uppercase tracking-widest">Treasure Found</h2><p className="text-offwhite mt-3">{teamName}</p></div></AppShell>;

  return <AppShell title="THE CONVERGENCE" showMenu>
    <div className="flex-1 py-3">
      <div className="text-center mb-6"><p className="text-[10px] text-gold uppercase tracking-[.35em]">Track {trackId}</p><h2 className="font-display text-2xl text-offwhite uppercase tracking-widest mt-1">{teamName}</h2></div>
      <div className="rounded-2xl border border-gold/20 bg-black/30 p-4 mb-5"><div className="flex items-center justify-between text-[10px] uppercase tracking-[.25em] text-muted"><span>Current stage</span><span>{state.stage}/10</span></div><h3 className="font-display text-xl text-gold uppercase tracking-wider mt-2">{label(state.step)}</h3><div className="flex gap-1 mt-4">{Array.from({length:10}).map((_,i)=><div key={i} className={`h-1 flex-1 rounded ${i<Math.min(state.stage,10)?'bg-gold':'bg-white/10'}`}/>)}</div></div>
      {!state.game_running || state.status==='PAUSED' || state.step==='STAGE_4_ASSIGNMENT' || state.step==='STAGE_7' ? <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center"><div className="text-4xl mb-3">⏸</div><h3 className="font-display text-xl text-offwhite uppercase tracking-widest">{state.status==='WAITING'?'Awaiting Orders':'Game Paused'}</h3><p className="text-sm text-muted mt-2">{state.status==='WAITING'?'The admin has not started the hunt yet. This page will update automatically.':'Hold position. The organizer will resume the next stage when the route is ready.'}</p></div> : <div className="space-y-5">
        {content?.sticker_image_url && <div className="mx-auto w-40 h-40 rounded-2xl overflow-hidden border border-gold/30 bg-black/50"><img src={content.sticker_image_url} alt="Mission sticker" className="w-full h-full object-contain"/></div>}
        {state.step==='HAND_IN' && <div className="mx-auto w-40 h-40 rounded-2xl border border-gold/40 bg-gold/5 flex flex-col items-center justify-center animate-glow"><span className="text-4xl">🔓</span><span className="font-display text-gold tracking-widest mt-2">STICKER 1</span><span className="text-[9px] uppercase tracking-widest text-muted mt-1">Unlocked</span></div>}
        {content?.physical_location && <div className="rounded-xl border border-gold/15 bg-gold/5 p-3 text-sm text-offwhite/80"><span className="text-[10px] uppercase tracking-widest text-gold block mb-1">Physical location</span>{content.physical_location}</div>}
        {content?.title && <h3 className="font-display text-2xl text-offwhite uppercase tracking-wider">{content.title}</h3>}
        {content?.body && <div className="rounded-2xl border border-white/10 bg-black/35 p-5 text-offwhite/90 leading-relaxed whitespace-pre-wrap">{content.body}</div>}
        {content?.instruction && <p className="text-xs uppercase tracking-wider text-muted">{content.instruction}</p>}
        {state.step==='RIDDLE_4' && <PrimaryButton onClick={()=>void submit('ACK_RIDDLE')}>I Reached Clue 4 →</PrimaryButton>}
        {state.step==='RIDDLE_7' && <PrimaryButton onClick={()=>void submit('ACK_RIDDLE')}>I Reached Clue 7 →</PrimaryButton>}
        {state.step==='CLUE_8' && <div className="rounded-xl border border-gold/20 p-4 text-center text-sm text-muted">Solve the paired clue and find the person holding Clue 9.</div>}
        {state.step==='FINAL_RIDDLE' && <PrimaryButton variant="parchment" disabled={busy} onClick={()=>void submit('FINAL_SUBMISSION')}>{busy?'Locking…':'I Found The Treasure →'}</PrimaryButton>}
        {showInput && <div className="rounded-2xl border border-white/10 bg-black/30 p-5"><label className="block text-[10px] uppercase tracking-[.25em] text-gold mb-3">{state.step==='HAND_IN'?'Sticker 1 physical code':state.step.includes('QR')?'Track QR token / scan result':state.step.includes('CHECKPOINT')?'Enter checkpoint code':state.step.includes('SNIPPET')?'Submit code snippet answer':state.step==='CLUE_9'?'Enter Clue 9 physical code':state.step.includes('ANSWER')?'Enter 7-digit answer':'Enter the physical sticker code'}</label><input value={value} onChange={e=>{setValue(e.target.value.slice(0, state.step.includes('ANSWER')?7:32));setError('')}} inputMode={state.step.includes('ANSWER')||state.step.includes('STICKER')||state.step.includes('CHECKPOINT')?'numeric':'text'} className="w-full bg-void border border-gold/25 rounded-xl px-4 py-4 text-center text-xl tracking-[.25em] text-offwhite outline-none focus:border-gold" placeholder={state.step.includes('ANSWER')?'7-DIGIT ANSWER':'ENTER CODE'} autoComplete="off"/><div className="mt-4"><PrimaryButton disabled={busy || !value.trim()} onClick={()=>void submit(action)}>{busy?'Verifying…':'Submit'}</PrimaryButton></div></div>}
        {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      </div>}
      <div className="mt-8 text-center text-[9px] uppercase tracking-[.3em] text-muted/60">Progress is server-synced. Refreshing will not reset your route.</div>
    </div>
  </AppShell>;
}
