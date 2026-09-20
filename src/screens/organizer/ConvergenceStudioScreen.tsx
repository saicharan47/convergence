import { useEffect, useMemo, useState } from 'react';
import { OrganizerLayout } from '../../layouts/OrganizerLayout';
import {
  adminAssignSequence,
  adminManualTeamAction,
  adminUpsertCheckpoint,
  adminUpsertPair,
  adminUpsertRouteItem,
  createConvergenceTestFixture,
  deleteConvergenceSequence,
  duplicateConvergenceSequence,
  exportConvergenceConfig,
  getAdminRouteItem,
  getConvergenceAdminDashboard,
  getConvergenceCheckpoints,
  getConvergencePairs,
  getConvergenceSequences,
  importConvergenceConfig,
  publishConvergenceSequence,
  upsertConvergenceSequence,
  type ConvergenceSequence,
} from '../../lib/db';

const STEPS = ['HAND_IN','STICKER_1','STICKER_2','ANSWER_2','RIDDLE_4','STICKER_4','STICKER_5','ANSWER_5','RIDDLE_7','STICKER_7','CLUE_8','CLUE_9','FINAL_RIDDLE'];
const TRACKS = ['A','B','C','D'] as const;
type Tab = 'content'|'sequences'|'checkpoints'|'pairs'|'data'|'test';

type Team = { id:string; name:string; track_id:string; status:string; stage:number; step:string; };

function Field({label,value,onChange,rows=2,type='text'}:{label:string;value:string;onChange:(v:string)=>void;rows?:number;type?:string}) {
  return <label className="block text-[10px] uppercase tracking-wider text-gray-500">{label}
    {type==='textarea'
      ? <textarea rows={rows} value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
      : <input value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white" />}
  </label>;
}

export function ConvergenceStudioScreen() {
  const [tab,setTab]=useState<Tab>('content');
  const [teams,setTeams]=useState<Team[]>([]);
  const [teamId,setTeamId]=useState('');
  const [step,setStep]=useState(STEPS[0]);
  const [route,setRoute]=useState({title:'',body:'',instruction:'',physicalLocation:'',stickerImageUrl:'',clueImageUrl:'',code:'',answer:''});
  const [sequences,setSequences]=useState<ConvergenceSequence[]>([]);
  const [sequenceId,setSequenceId]=useState<string|null>(null);
  const [sequenceName,setSequenceName]=useState('');
  const [sequenceJson,setSequenceJson]=useState('{"items":[]}');
  const [checkpoints,setCheckpoints]=useState<Array<{id:string;stage:number;track_id:string;qr_label:string|null;active:boolean;qr_token:string|null;checkpoint_code:string|null;snippet:string;snippet_answer:string|null}>>([]);
  const [cp,setCp]=useState({stage:'3',track:'A',qrLabel:'',active:true,qrToken:'',code:'',snippet:'',answer:''});
  const [pairs,setPairs]=useState<Array<{team_id:string;team_name:string;track_id:string;pair_key:string;logical_clue:string;sticker_image_url:string|null;physical_location:string|null;clue9_location:string|null}>>([]);
  const [pair,setPair]=useState({teamId:'',pairKey:'',logicalClue:'',stickerImageUrl:'',physicalLocation:'',clue9Location:''});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [importText,setImportText]=useState('');
  const [testCreds,setTestCreds]=useState<{team_name:string;password:string}|null>(null);

  const load=async()=>{
    const data=await getConvergenceAdminDashboard();
    setTeams(data.teams as unknown as Team[]);
    setSequences(await getConvergenceSequences());
    setCheckpoints(await getConvergenceCheckpoints());
    setPairs(await getConvergencePairs());
  };
  useEffect(()=>{void load().catch(e=>setMessage(e instanceof Error?e.message:'Unable to load studio.'));},[]);

  const selectedTeam=useMemo(()=>teams.find(t=>t.id===teamId),[teams,teamId]);
  useEffect(()=>{
    if(!teamId) return;
    void getAdminRouteItem(teamId,step).then(data=>{
      const x=data??{};
      setRoute({
        title:String(x.title??''),body:String(x.body??''),instruction:String(x.instruction??''),
        physicalLocation:String(x.physical_location??''),stickerImageUrl:String(x.sticker_image_url??''),
        clueImageUrl:String(x.clue_image_url??''),code:String(x.code??''),answer:String(x.answer??'')
      });
    }).catch(e=>setMessage(e instanceof Error?e.message:'Unable to load route item.'));
  },[teamId,step]);

  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();await load();}catch(e){setMessage(e instanceof Error?e.message:'Action failed.');}finally{setBusy(false);}};

  const saveRoute=()=>run(async()=>{
    if(!teamId) throw new Error('Select a team first.');
    await adminUpsertRouteItem({teamId,stepKey:step,title:route.title,body:route.body,instruction:route.instruction,physicalLocation:route.physicalLocation,stickerImageUrl:route.stickerImageUrl,clueImageUrl:route.clueImageUrl,code:route.code||undefined,answer:route.answer||undefined});
    setMessage('Route item published to the selected team.');
  });

  const saveSequence=()=>run(async()=>{
    const payload=JSON.parse(sequenceJson) as Record<string,unknown>;
    const id=await upsertConvergenceSequence(sequenceId,sequenceName,payload);
    setSequenceId(id);
    setMessage('Sequence saved as draft. Publish it before assignment.');
  });

  const saveCheckpoint=()=>run(async()=>{
    await adminUpsertCheckpoint({stage:Number(cp.stage),trackId:cp.track,qrToken:cp.qrToken,checkpointCode:cp.code,snippet:cp.snippet,snippetAnswer:cp.answer,qrLabel:cp.qrLabel,active:cp.active});
    setMessage('Checkpoint saved.');
  });

  const savePair=()=>run(async()=>{
    if(!pair.teamId) throw new Error('Select a team for the pair entry.');
    await adminUpsertPair(pair);
    setMessage('Pair saved.');
  });

  const downloadCsv=async()=>{
    setBusy(true);
    try{
      const data=await exportConvergenceConfig();
      const routes=Array.isArray(data.routes)?data.routes as Array<Record<string,unknown>>:[];
      const header=['team_id','step_key','title','body','instruction','physical_location','code','answer','published'];
      const esc=(v:unknown)=>'"'+String(v??'').replaceAll('"','""').replaceAll('\\n',' ')+'"';
      const csv=[header.join(','),...routes.map(r=>header.map(h=>esc(r[h])).join(','))].join('\\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='convergence-routes.csv'; a.click(); URL.revokeObjectURL(url);
      setMessage('Route CSV exported.');
    }catch(e){setMessage(e instanceof Error?e.message:'CSV export failed.');}finally{setBusy(false);}
  };

  const downloadExport=async()=>{setBusy(true);try{const data=await exportConvergenceConfig();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='convergence-config.json';a.click();URL.revokeObjectURL(url);setMessage('Configuration exported.');}catch(e){setMessage(e instanceof Error?e.message:'Export failed.');}finally{setBusy(false);}};
  const importConfig=()=>run(async()=>{const data=JSON.parse(importText) as Record<string,unknown>;await importConvergenceConfig(data);setMessage('Configuration imported.');});
  const makeTest=()=>run(async()=>{const c=await createConvergenceTestFixture();setTestCreds({team_name:c.team_name,password:c.password});setMessage('Isolated TEST track fixture created. Use it only for rehearsal.');});

  const colors:Record<string,string>={A:'text-red-300',B:'text-blue-300',C:'text-green-300',D:'text-yellow-300'};

  return <OrganizerLayout title="Convergence Studio">
    <div className="space-y-5">
      {message&&<div className="border border-gold/20 bg-gold/5 text-gold px-4 py-3 rounded text-sm">{message}</div>}
      <div className="flex flex-wrap gap-2">{(['content','sequences','checkpoints','pairs','data','test'] as Tab[]).map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded border text-xs uppercase tracking-widest ${tab===t?'border-gold text-gold bg-gold/5':'border-gray-800 text-gray-500'}`}>{t}</button>)}</div>

      {tab==='content'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <div><h3 className="text-white font-semibold">Team Route Content</h3><p className="text-xs text-gray-500 mt-1">Edit Hand-In, riddles, stickers, physical clues, codes, answers and final riddle without source-code changes.</p></div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-[10px] uppercase text-gray-500">Team<select value={teamId} onChange={e=>setTeamId(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value="">Select team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name} · {t.track_id}</option>)}</select></label>
          <label className="text-[10px] uppercase text-gray-500">Route component<select value={step} onChange={e=>setStep(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white">{STEPS.map(s=><option key={s}>{s}</option>)}</select></label>
        </div>
        {selectedTeam&&<div className={`text-xs ${colors[selectedTeam.track_id]??'text-gray-300'}`}>{selectedTeam.name} · Track {selectedTeam.track_id} · {selectedTeam.status} · Stage {selectedTeam.stage}</div>}
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Title" value={route.title} onChange={v=>setRoute({...route,title:v})}/>
          <Field label="Physical location" value={route.physicalLocation} onChange={v=>setRoute({...route,physicalLocation:v})}/>
          <Field label="Body / riddle / clue" value={route.body} onChange={v=>setRoute({...route,body:v})} rows={6} type="textarea"/>
          <Field label="Instruction" value={route.instruction} onChange={v=>setRoute({...route,instruction:v})} rows={4} type="textarea"/>
          <Field label="Physical code" value={route.code} onChange={v=>setRoute({...route,code:v})}/>
          <Field label="Answer / 7-digit answer" value={route.answer} onChange={v=>setRoute({...route,answer:v})}/>
          <Field label="Sticker image URL" value={route.stickerImageUrl} onChange={v=>setRoute({...route,stickerImageUrl:v})}/>
          <Field label="Clue image URL" value={route.clueImageUrl} onChange={v=>setRoute({...route,clueImageUrl:v})}/>
        </div>
        <button disabled={busy||!teamId} onClick={()=>void saveRoute()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save Route Component</button>
      </section>}

      {tab==='sequences'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <div className="flex flex-wrap gap-2">{sequences.map(s=><button key={s.id} onClick={()=>{setSequenceId(s.id);setSequenceName(s.name);setSequenceJson(JSON.stringify(s.payload,null,2));}} className={`px-3 py-2 rounded border text-xs ${sequenceId===s.id?'border-gold text-gold':'border-gray-800 text-gray-400'}`}>{s.name} · {s.published?'PUBLISHED':'DRAFT'}</button>)}</div>
        <div className="grid md:grid-cols-[220px_1fr] gap-3"><Field label="Sequence name" value={sequenceName} onChange={setSequenceName}/><Field label="Sequence JSON" value={sequenceJson} onChange={setSequenceJson} rows={12} type="textarea"/></div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy||!sequenceName} onClick={()=>void saveSequence()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save</button>
          {sequenceId&&<><button disabled={busy} onClick={()=>void run(async()=>{await publishConvergenceSequence(sequenceId,!sequences.find(s=>s.id===sequenceId)?.published);setMessage('Sequence publication state updated.');})} className="border border-green-800 text-green-300 px-4 py-2 rounded text-sm">{sequences.find(s=>s.id===sequenceId)?.published?'Unpublish':'Publish'}</button><button disabled={busy} onClick={()=>void run(async()=>{await duplicateConvergenceSequence(sequenceId,sequenceName+' Copy');setMessage('Sequence duplicated.');})} className="border border-gray-700 text-gray-300 px-4 py-2 rounded text-sm">Duplicate</button><button disabled={busy} onClick={()=>void run(async()=>{await deleteConvergenceSequence(sequenceId);setSequenceId(null);setMessage('Sequence deleted.');})} className="border border-red-900 text-red-300 px-4 py-2 rounded text-sm">Delete</button></>}
        </div>
        <div className="grid md:grid-cols-2 gap-2">{teams.filter(t=>t.status==='PROMOTED').map(t=><div key={t.id} className="border border-gray-800 rounded p-3 flex items-center justify-between"><span className="text-sm text-white">{t.name} · {t.track_id}</span><button disabled={!sequenceId||busy||!sequences.find(s=>s.id===sequenceId)?.published} onClick={()=>void run(async()=>{await adminAssignSequence(t.id,sequenceId!);setMessage('Published sequence assigned.');})} className="text-xs text-gold disabled:text-gray-700">Assign selected</button></div>)}</div>
      </section>}

      {tab==='checkpoints'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <h3 className="text-white font-semibold">Checkpoint + QR Management</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Stage (3 or 6)" value={cp.stage} onChange={v=>setCp({...cp,stage:v})}/>
          <label className="text-[10px] uppercase text-gray-500">Track<select value={cp.track} onChange={e=>setCp({...cp,track:e.target.value})} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white">{TRACKS.map(t=><option key={t}>{t}</option>)}</select></label>
          <Field label="QR label" value={cp.qrLabel} onChange={v=>setCp({...cp,qrLabel:v})}/>
          <label className="flex items-end gap-2 text-xs text-gray-400 pb-2"><input type="checkbox" checked={cp.active} onChange={e=>setCp({...cp,active:e.target.checked})}/> Active</label>
        </div>
        <div className="grid md:grid-cols-2 gap-3"><Field label="Secure QR token" value={cp.qrToken} onChange={v=>setCp({...cp,qrToken:v})}/><Field label="Checkpoint code" value={cp.code} onChange={v=>setCp({...cp,code:v})}/><Field label="Code snippet" value={cp.snippet} onChange={v=>setCp({...cp,snippet:v})} rows={6} type="textarea"/><Field label="Snippet answer" value={cp.answer} onChange={v=>setCp({...cp,answer:v})}/></div>
        <button disabled={busy} onClick={()=>void saveCheckpoint()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save Checkpoint</button>
        <div className="overflow-auto"><table className="w-full text-sm"><thead className="text-[10px] text-gray-500 uppercase"><tr><th className="text-left py-2">Stage</th><th>Track</th><th>QR</th><th>Active</th><th>Code</th></tr></thead><tbody>{checkpoints.map(c=><tr key={c.id} className="border-t border-gray-900"><td className="py-2">{c.stage}</td><td className="text-center">{c.track_id}</td><td className="text-center">{c.qr_label||'—'}</td><td className="text-center">{c.active?'Yes':'No'}</td><td className="text-center font-mono">{c.checkpoint_code||'—'}</td></tr>)}</tbody></table></div>
      </section>}

      {tab==='pairs'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <h3 className="text-white font-semibold">Clue 8 Pairing</h3><p className="text-xs text-gray-500">Use the same pair key for exactly two teams. Their participant views expose no paired-team identity.</p>
        <div className="grid md:grid-cols-2 gap-3"><label className="text-[10px] uppercase text-gray-500">Team<select value={pair.teamId} onChange={e=>setPair({...pair,teamId:e.target.value})} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value="">Select team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name} · {t.track_id}</option>)}</select></label><Field label="Pair key" value={pair.pairKey} onChange={v=>setPair({...pair,pairKey:v})}/><Field label="Logical Clue 8" value={pair.logicalClue} onChange={v=>setPair({...pair,logicalClue:v})} rows={5} type="textarea"/><Field label="Physical location" value={pair.physicalLocation} onChange={v=>setPair({...pair,physicalLocation:v})}/><Field label="Clue 9 location" value={pair.clue9Location} onChange={v=>setPair({...pair,clue9Location:v})}/><Field label="Sticker image URL" value={pair.stickerImageUrl} onChange={v=>setPair({...pair,stickerImageUrl:v})}/></div>
        <button disabled={busy||!pair.teamId} onClick={()=>void savePair()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save Pair</button>
        <div className="grid md:grid-cols-2 gap-2">{pairs.map(p=><div key={p.team_id} className="border border-gray-800 rounded p-3 text-sm"><div className="text-white">{p.team_name} · Track {p.track_id}</div><div className="text-xs text-gold mt-1">Pair {p.pair_key}</div><div className="text-xs text-gray-500 mt-1">{p.logical_clue}</div></div>)}</div>
      </section>}

      {tab==='data'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <h3 className="text-white font-semibold">Import / Export</h3><p className="text-xs text-gray-500">Export contains organizer-only content including configured codes/answers. Keep the file private.</p>
        <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void downloadExport()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Export JSON</button><button disabled={busy} onClick={()=>void downloadCsv()} className="border border-gray-700 text-gray-300 px-4 py-2 rounded text-sm">Export Routes CSV</button></div>
        <textarea value={importText} onChange={e=>setImportText(e.target.value)} rows={14} placeholder="Paste a Convergence config JSON export here…" className="w-full bg-[#171717] border border-gray-700 rounded p-3 text-white font-mono text-xs"/>
        <button disabled={busy||!importText.trim()} onClick={()=>void importConfig()} className="border border-gold/40 text-gold px-4 py-2 rounded text-sm">Import JSON</button>
      </section>}

      {tab==='test'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <h3 className="text-white font-semibold">Organizer Test Mode</h3>
        <p className="text-sm text-gray-400">Creates an isolated TEST-track rehearsal fixture with real server-side code validation. It does not participate in A/B/C/D qualification counts.</p>
        <button disabled={busy} onClick={()=>void makeTest()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Create / Reset Test Fixture</button>
        {testCreds&&<div className="border border-green-800/60 bg-green-950/20 rounded p-4 text-sm"><div className="text-green-300">Test credentials</div><div className="font-mono mt-2">Team: {testCreds.team_name}<br/>Password: {testCreds.password}</div><p className="text-xs text-gray-500 mt-2">Rehearsal flow: Hand-In → Sticker 1 code <b>24680</b> → Sticker 2 code <b>13579</b> → 7-digit answer <b>1234567</b> → checkpoint.</p></div>}
        <div className="border border-gray-800 rounded p-4 text-xs text-gray-400 space-y-2"><div>Built-in test clue: <b className="text-white">Find the blue envelope at the test table.</b></div><div>Wrong-code test: submit <b className="text-white">00000</b>; the route must not advance.</div><div>Correct-code test: submit <b className="text-white">24680</b>; Sticker 2 must unlock.</div><div>Refresh/reconnect test: reload after every success; server state must remain unchanged.</div><div>Rate-limit test: send more than 10 rapid submissions; server must return rate_limited without advancing.</div></div>
      </section>}
    </div>
  </OrganizerLayout>;
}
