import { useEffect, useMemo, useState } from 'react';
import { OrganizerLayout } from '../../layouts/OrganizerLayout';
import {
  adminAssignSequence, adminUpsertPair, adminUpsertPositionAssignment,
  createConvergenceTestFixture, deleteConvergenceSequence, exportConvergenceConfig,
  finalizeConvergenceCheckpoint, getCheckpointReview, getConvergenceAdminDashboard,
  getConvergenceCheckpoints, getConvergencePairs, getConvergenceSequences, getConvergenceStickers,
  getConvergenceTeamHistory, getPositionAssignments, getTransitionRiddles, importConvergenceConfig,
  publishConvergenceSequence, setCommonClue9, setTransitionRiddle, uploadConvergenceSticker,
  upsertConvergenceSequence, type ConvergenceSequence, type ConvergenceSticker, type PositionAssignment
} from '../../lib/db';

const STEPS = [
  ['1','Clue 1'],['2','Clue 2'],['3','Clue 3'],
  ['4','Clue 4'],['5','Clue 5'],['6','Clue 6'],
  ['7','Clue 7'],['8','Clue 8'],['9','Clue 9']
] as const;
const TRACKS = ['A','B','C','D'] as const;
type Tab = 'positions'|'checkpoints'|'stickers'|'sequences'|'pairs'|'data'|'test';
type Team = { id:string; name:string; track_id:string; status:string; stage:number; step:string; current_position?:number|null; current_clue?:number|null; original_team_number?:number|null };

function Field({label,value,onChange,rows=2,type='text'}:{label:string;value:string;onChange:(v:string)=>void;rows?:number;type?:string}) {
  return <label className="block text-[10px] uppercase tracking-wider text-gray-500">{label}
    {type==='textarea'
      ? <textarea rows={rows} value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
      : <input value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white" />}
  </label>;
}

export function ConvergenceStudioScreen() {
  const [tab,setTab]=useState<Tab>('positions');
  const [teams,setTeams]=useState<Team[]>([]);
  const [track,setTrack]=useState('A');
  const [stageGroup,setStageGroup]=useState(1);
  const [position,setPosition]=useState(1);
  const [clue,setClue]=useState(1);
  const [assignments,setAssignments]=useState<PositionAssignment[]>([]);
  const [assignment,setAssignment]=useState({title:'',body:'',instruction:'',physicalLocation:'',stickerId:'',stickerImageUrl:'',code:'',answer:'',published:false});
  const [checkpoints,setCheckpoints]=useState<Array<{id:string;stage:number;track_id:string;qr_label:string|null;active:boolean;qr_token:string|null;checkpoint_code:string|null;snippet:string;snippet_answer:string|null}>>([]);
  const [checkpoint,setCheckpoint]=useState(1);
  const [review,setReview]=useState<Array<Record<string,unknown>>>([]);
  const [selectedEliminations,setSelectedEliminations]=useState<string[]>([]);
  const [riddle1,setRiddle1]=useState('');
  const [riddle2,setRiddle2]=useState('');
  const [common9,setCommon9]=useState({title:'CLUE 9 — COMMON TREASURE',body:'',instruction:'',location:'',code:'',stickerId:'',stickerImageUrl:''});
  const [stickers,setStickers]=useState<ConvergenceSticker[]>([]);
  const [stickerName,setStickerName]=useState('');
  const [stickerClue,setStickerClue]=useState(1);
  const [stickerStage,setStickerStage]=useState(1);
  const [stickerFile,setStickerFile]=useState<File|null>(null);
  const [sequences,setSequences]=useState<ConvergenceSequence[]>([]);
  const [sequenceId,setSequenceId]=useState<string|null>(null);
  const [sequenceName,setSequenceName]=useState('');
  const [sequenceJson,setSequenceJson]=useState('{"items":[]}');
  const [pairs,setPairs]=useState<Array<{team_id:string;team_name:string;track_id:string;pair_key:string;logical_clue:string;sticker_image_url:string|null;physical_location:string|null;clue9_location:string|null}>>([]);
  const [pair,setPair]=useState({teamId:'',pairKey:'',logicalClue:'',stickerImageUrl:'',physicalLocation:'',clue9Location:''});
  const [historyTeam,setHistoryTeam]=useState('');
  const [history,setHistory]=useState<Array<Record<string,unknown>>>([]);
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
    setStickers(await getConvergenceStickers());
    const rs=await getTransitionRiddles();
    setRiddle1(rs.find(r=>r.checkpoint_number===1)?.riddle_text??'');
    setRiddle2(rs.find(r=>r.checkpoint_number===2)?.riddle_text??'');
    const g=data.game as Record<string,unknown>;
    setCommon9({
      title:String(g.common_clue9_title??'CLUE 9 — COMMON TREASURE'),
      body:String(g.common_clue9_body??''),instruction:String(g.common_clue9_instruction??''),
      location:String(g.common_clue9_location??''),code:String(g.common_clue9_code_plaintext??''),
      stickerId:String(g.common_clue9_sticker_id??''),stickerImageUrl:String(g.common_clue9_sticker_image_url??'')
    });
  };
  useEffect(()=>{void load().catch(e=>setMessage(e instanceof Error?e.message:'Unable to load studio.'));},[]);

  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();await load();}catch(e){setMessage(e instanceof Error?e.message:'Action failed.');}finally{setBusy(false);}};

  const maxPosition=stageGroup===1?15:stageGroup===2?10:5;
  const selectedAssignment=useMemo(()=>assignments.find(a=>a.track_id===track&&a.stage_group===stageGroup&&a.position===position&&a.clue_number===clue),[assignments,track,stageGroup,position,clue]);
  useEffect(()=>{
    void getPositionAssignments(track,stageGroup,position).then(rows=>{
      setAssignments(rows);
      const a=rows.find(x=>x.clue_number===clue);
      setAssignment(a?{
        title:a.title,body:a.body,instruction:a.instruction,physicalLocation:a.physical_location??'',
        stickerId:a.sticker_id??'',stickerImageUrl:a.sticker_image_url??'',code:a.code_plaintext??'',
        answer:a.answer_plaintext??'',published:a.published
      }:{title:'',body:'',instruction:'',physicalLocation:'',stickerId:'',stickerImageUrl:'',code:'',answer:'',published:false});
    }).catch(()=>undefined);
  },[track,stageGroup,position,clue]);

  const savePosition=()=>run(async()=>{
    await adminUpsertPositionAssignment({
      trackId:track,stageGroup,position,clueNumber:clue,title:assignment.title,body:assignment.body,
      instruction:assignment.instruction,physicalLocation:assignment.physicalLocation,stickerId:assignment.stickerId||null,
      stickerImageUrl:assignment.stickerImageUrl,code:assignment.code,answer:assignment.answer,published:assignment.published
    });
    setMessage(\`Track \${track} Position \${position} → Clue \${clue} saved.\`);
  });

  const loadReview=async()=>{
    const rows=await getCheckpointReview(checkpoint);
    setReview(rows);
    setSelectedEliminations([]);
  };
  useEffect(()=>{if(tab==='checkpoints')void loadReview().catch(e=>setMessage(e instanceof Error?e.message:'Unable to load checkpoint review.'));},[tab,checkpoint]);
  const countByTrack=TRACKS.map(t=>[t,selectedEliminations.filter(id=>String(review.find(r=>r.id===id)?.track_id)===t).length] as const);
  const canFinalize=countByTrack.every(([,n])=>n===5)&&selectedEliminations.length===20;
  const toggleElimination=(id:string)=>{
    setSelectedEliminations(prev=>prev.includes(id)?prev.filter(x=>x!==id):prev.length>=20?prev:[...prev,id]);
  };
  const finalize=()=>run(async()=>{
    if(!canFinalize)throw new Error('Select exactly 5 teams in every track.');
    if(!window.confirm(\`Finalize Checkpoint \${checkpoint}? This permanently eliminates the selected 20 teams and recalculates every remaining position.\`))return;
    await finalizeConvergenceCheckpoint(checkpoint,selectedEliminations);
    setSelectedEliminations([]);
    setMessage(\`Checkpoint \${checkpoint} finalized. Remaining teams were repositioned automatically.\`);
  });

  const saveRiddles=()=>run(async()=>{await setTransitionRiddle(1,riddle1,true);await setTransitionRiddle(2,riddle2,true);setMessage('Transition riddles saved.');});
  const saveCommon9=()=>run(async()=>{await setCommonClue9(common9);setMessage('Common Clue 9 saved.');});
  const uploadSticker=()=>run(async()=>{
    if(!stickerFile)throw new Error('Choose a sticker image first.');
    const created=await uploadConvergenceSticker(stickerFile,stickerName,stickerClue,stickerStage);
    setStickers(prev=>[created,...prev]);setStickerFile(null);setStickerName('');setMessage('Sticker uploaded.');
  });

  const saveSequence=()=>run(async()=>{const payload=JSON.parse(sequenceJson) as Record<string,unknown>;const id=await upsertConvergenceSequence(sequenceId,sequenceName,payload);setSequenceId(id);setMessage('Sequence saved as draft.');});
  const saveCheckpoint=()=>run(async()=>{await adminUpsertCheckpoint({stage:Number(checkpoint===1?3:6),trackId:track,qrToken:'',checkpointCode:'',snippet:'',snippetAnswer:'',qrLabel:'',active:true});setMessage('Use the checkpoint configuration controls below for QR/code/snippet data.');});
  const savePair=()=>run(async()=>{if(!pair.teamId)throw new Error('Select a team.');await adminUpsertPair(pair);setMessage('Pair saved.');});
  const downloadCsv=async()=>{setBusy(true);try{const data=await exportConvergenceConfig();const routes=Array.isArray(data.routes)?data.routes as Array<Record<string,unknown>>:[];const header=['team_id','step_key','title','body','instruction','physical_location','code','answer','published'];const esc=(v:unknown)=>'"'+String(v??'').replaceAll('"','""').replaceAll('\\n',' ')+'"';const csv=[header.join(','),...routes.map(r=>header.map(h=>esc(r[h])).join(','))].join('\\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='convergence-routes.csv';a.click();URL.revokeObjectURL(url);}finally{setBusy(false);}};
  const downloadExport=async()=>{setBusy(true);try{const data=await exportConvergenceConfig();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='convergence-config.json';a.click();URL.revokeObjectURL(url);}finally{setBusy(false);}};
  const importConfig=()=>run(async()=>{await importConvergenceConfig(JSON.parse(importText));setMessage('Configuration imported.');});
  const makeTest=()=>run(async()=>{const x=await createConvergenceTestFixture();setTestCreds({team_name:x.team_name,password:x.password});setMessage('TEST fixture ready.');});
  const loadHistory=async()=>{if(!historyTeam)return;setHistory(await getConvergenceTeamHistory(historyTeam));};
  const colors:Record<string,string>={A:'text-red-300',B:'text-blue-300',C:'text-green-300',D:'text-yellow-300'};

  return <OrganizerLayout title="Convergence Studio">
    <div className="space-y-5">
      {message&&<div className="border border-gold/20 bg-gold/5 text-gold px-4 py-3 rounded text-sm">{message}</div>}
      <div className="flex flex-wrap gap-2">{(['positions','checkpoints','stickers','sequences','pairs','data','test'] as Tab[]).map(t=><button key={t} onClick={()=>setTab(t)} className={\`px-4 py-2 rounded border text-xs uppercase tracking-widest \${tab===t?'border-gold text-gold bg-gold/5':'border-gray-800 text-gray-500'}\`}>{t}</button>)}</div>

      {tab==='positions'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <div><h3 className="text-white font-semibold">Position-Based Clue & Sticker Assignment</h3><p className="text-xs text-gray-500 mt-1">Assignments belong to Track + current Position + Clue. Team IDs never own a clue assignment.</p></div>
        <div className="grid md:grid-cols-4 gap-3">
          <label className="text-[10px] uppercase text-gray-500">Track<select value={track} onChange={e=>setTrack(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white">{TRACKS.map(t=><option key={t}>{t}</option>)}</select></label>
          <label className="text-[10px] uppercase text-gray-500">Stage Group<select value={stageGroup} onChange={e=>{const v=Number(e.target.value);setStageGroup(v);setPosition(1)}} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value={1}>Stage 1 · Clues 1–3</option><option value={2}>Stage 2 · Clues 4–6</option><option value={3}>Stage 3 · Clues 7–9</option></select></label>
          <label className="text-[10px] uppercase text-gray-500">Current Position<select value={position} onChange={e=>setPosition(Number(e.target.value))} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white">{Array.from({length:maxPosition},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}</select></label>
          <label className="text-[10px] uppercase text-gray-500">Clue<select value={clue} onChange={e=>setClue(Number(e.target.value))} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white">{STEPS.filter(([n])=>{const x=Number(n);return stageGroup===1?x<=3:stageGroup===2?x>=4&&x<=6:x>=7&&x<=9}).map(([n,label])=><option key={n} value={n}>{label}</option>)}</select></label>
        </div>
        {selectedAssignment&&<div className="text-xs text-green-300">Existing assignment loaded · {assignment.published?'PUBLISHED':'DRAFT'}</div>}
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Title" value={assignment.title} onChange={v=>setAssignment({...assignment,title:v})}/>
          <Field label="Physical location" value={assignment.physicalLocation} onChange={v=>setAssignment({...assignment,physicalLocation:v})}/>
          <Field label="Clue / riddle body" value={assignment.body} onChange={v=>setAssignment({...assignment,body:v})} rows={7} type="textarea"/>
          <Field label="Instruction" value={assignment.instruction} onChange={v=>setAssignment({...assignment,instruction:v})} rows={4} type="textarea"/>
          <Field label="Physical code" value={assignment.code} onChange={v=>setAssignment({...assignment,code:v})}/>
          <Field label="Answer / 7-digit answer" value={assignment.answer} onChange={v=>setAssignment({...assignment,answer:v})}/>
          <label className="text-[10px] uppercase text-gray-500">Sticker<select value={assignment.stickerId} onChange={e=>{const s=stickers.find(x=>x.id===e.target.value);setAssignment({...assignment,stickerId:e.target.value,stickerImageUrl:s?.image_url??assignment.stickerImageUrl})}} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value="">No sticker selected</option>{stickers.filter(s=>s.clue_number===clue).map(s=><option key={s.id} value={s.id}>{s.sticker_name}</option>)}</select></label>
          <Field label="Sticker image URL" value={assignment.stickerImageUrl} onChange={v=>setAssignment({...assignment,stickerImageUrl:v})}/>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={assignment.published} onChange={e=>setAssignment({...assignment,published:e.target.checked})}/> Published / visible to participant when this position reaches the clue</label>
        <button disabled={busy} onClick={()=>void savePosition()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save Position Assignment</button>
      </section>}

      {tab==='checkpoints'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <div><h3 className="text-white font-semibold">Checkpoint Elimination Control</h3><p className="text-xs text-gray-500 mt-1">Select exactly 5 teams per track. The server locks the checkpoint, eliminates the selected teams, compresses positions and moves survivors to the transition riddle.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={()=>setCheckpoint(1)} className={\`px-4 py-2 rounded border text-xs \${checkpoint===1?'border-gold text-gold':'border-gray-800 text-gray-500'}\`}>Checkpoint 1 · after Clue 3</button><button onClick={()=>setCheckpoint(2)} className={\`px-4 py-2 rounded border text-xs \${checkpoint===2?'border-gold text-gold':'border-gray-800 text-gray-500'}\`}>Checkpoint 2 · after Clue 6</button><button disabled={busy} onClick={()=>void loadReview()} className="border border-gray-700 text-gray-300 px-4 py-2 rounded text-xs">Refresh Review</button></div>
        <div className="grid grid-cols-4 gap-2">{countByTrack.map(([t,n])=><div key={t} className={\`rounded border p-3 \${n===5?'border-green-800 text-green-300':'border-gray-800 text-gray-400'}\`}><div className={colors[t]}>Track {t}</div><div className="text-2xl font-mono mt-1">{n}/5</div></div>)}</div>
        <div className="grid md:grid-cols-4 gap-3">{TRACKS.map(t=><div key={t} className="border border-gray-800 rounded p-3"><div className={\`text-xs font-semibold mb-2 \${colors[t]}\`}>TRACK {t}</div><div className="space-y-1">{review.filter(r=>r.track_id===t).map(r=>{const id=String(r.id);const selected=selectedEliminations.includes(id);return <button key={id} onClick={()=>toggleElimination(id)} disabled={busy || (!selected&&selectedEliminations.length>=20) || String(r.status)==='ELIMINATED'} className={\`w-full text-left px-2 py-2 rounded border text-xs \${selected?'border-red-700 bg-red-950/30 text-red-200':'border-gray-900 bg-black/20 text-gray-400'}\`}><div className="flex justify-between"><span>Pos {String(r.current_position??'—')} · {String(r.name)}</span><span>{selected?'ELIMINATE':String(r.status)}</span></div><div className="text-[9px] text-gray-600 mt-1">{r.current_step as string} · {r.checkpoint_complete?'READY':'NOT READY'}</div></button>})}</div></div>)}</div>
        <button disabled={busy||!canFinalize} onClick={()=>void finalize()} className="bg-red-600 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-3 rounded text-sm font-semibold">Finalize Checkpoint {checkpoint} · Eliminate 20</button>
      </section>}

      {tab==='stickers'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-5">
        <div><h3 className="text-white font-semibold">Sticker Management</h3><p className="text-xs text-gray-500 mt-1">Upload, preview and reuse sticker assets without changing code.</p></div>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="Sticker name" value={stickerName} onChange={setStickerName}/>
          <Field label="Clue number" value={String(stickerClue)} onChange={v=>setStickerClue(Number(v)||1)}/>
          <label className="text-[10px] uppercase text-gray-500">Stage<select value={stickerStage} onChange={e=>setStickerStage(Number(e.target.value))} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value={1}>Stage 1</option><option value={2}>Stage 2</option><option value={3}>Stage 3</option></select></label>
          <label className="text-[10px] uppercase text-gray-500">Image<input type="file" accept="image/*" onChange={e=>setStickerFile(e.target.files?.[0]??null)} className="mt-1 block w-full text-xs text-gray-400"/></label>
        </div>
        <button disabled={busy||!stickerFile} onClick={()=>void uploadSticker()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Upload Sticker</button>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{stickers.map(s=><div key={s.id} className="border border-gray-800 rounded p-3">{s.image_url&&<img src={s.image_url} alt={s.sticker_name} className="w-full aspect-square object-contain bg-black rounded mb-2"/>}<div className="text-xs text-white">{s.sticker_name}</div><div className="text-[9px] text-gray-500">Clue {s.clue_number} · Stage {s.stage_group}</div></div>)}</div>
        <div className="border-t border-gray-900 pt-5 space-y-3"><h4 className="text-white text-sm">Checkpoint Transition Riddles</h4><Field label="After Checkpoint 1" value={riddle1} onChange={setRiddle1} rows={4} type="textarea"/><Field label="After Checkpoint 2" value={riddle2} onChange={setRiddle2} rows={4} type="textarea"/><button disabled={busy} onClick={()=>void saveRiddles()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save Riddles</button></div>
        <div className="border-t border-gray-900 pt-5 space-y-3"><h4 className="text-white text-sm">Clue 9 — One Common Treasure Destination</h4><div className="grid md:grid-cols-2 gap-3"><Field label="Title" value={common9.title} onChange={v=>setCommon9({...common9,title:v})}/><Field label="Common location" value={common9.location} onChange={v=>setCommon9({...common9,location:v})}/><Field label="Body" value={common9.body} onChange={v=>setCommon9({...common9,body:v})} rows={5} type="textarea"/><Field label="Instruction" value={common9.instruction} onChange={v=>setCommon9({...common9,instruction:v})} rows={3} type="textarea"/><Field label="Common physical code" value={common9.code} onChange={v=>setCommon9({...common9,code:v})}/><label className="text-[10px] uppercase text-gray-500">Sticker<select value={common9.stickerId} onChange={e=>{const s=stickers.find(x=>x.id===e.target.value);setCommon9({...common9,stickerId:e.target.value,stickerImageUrl:s?.image_url??''})}} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value="">No sticker</option>{stickers.filter(s=>s.clue_number===9).map(s=><option key={s.id} value={s.id}>{s.sticker_name}</option>)}</select></label></div><button disabled={busy} onClick={()=>void saveCommon9()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save Common Clue 9</button></div>
      </section>}

      {tab==='sequences'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4">
        <div className="flex flex-wrap gap-2">{sequences.map(s=><button key={s.id} onClick={()=>{setSequenceId(s.id);setSequenceName(s.name);setSequenceJson(JSON.stringify(s.payload,null,2));}} className={\`px-3 py-2 rounded border text-xs \${sequenceId===s.id?'border-gold text-gold':'border-gray-800 text-gray-400'}\`}>{s.name} · {s.published?'PUBLISHED':'DRAFT'}</button>)}</div>
        <div className="grid md:grid-cols-[220px_1fr] gap-3"><Field label="Sequence name" value={sequenceName} onChange={setSequenceName}/><Field label="Sequence JSON" value={sequenceJson} onChange={setSequenceJson} rows={12} type="textarea"/></div>
        <div className="flex flex-wrap gap-2"><button disabled={busy||!sequenceName} onClick={()=>void saveSequence()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save</button>{sequenceId&&<><button disabled={busy} onClick={()=>void run(async()=>{await publishConvergenceSequence(sequenceId,!sequences.find(s=>s.id===sequenceId)?.published);})} className="border border-green-800 text-green-300 px-4 py-2 rounded text-sm">{sequences.find(s=>s.id===sequenceId)?.published?'Unpublish':'Publish'}</button><button disabled={busy} onClick={()=>void run(async()=>{await deleteConvergenceSequence(sequenceId);setSequenceId(null);})} className="border border-red-900 text-red-300 px-4 py-2 rounded text-sm">Delete</button></>}</div>
        <div className="grid md:grid-cols-2 gap-2">{teams.filter(t=>t.status==='PROMOTED').map(t=><div key={t.id} className="border border-gray-800 rounded p-3 flex items-center justify-between"><span className="text-sm text-white">{t.name} · {t.track_id}</span><button disabled={!sequenceId||busy||!sequences.find(s=>s.id===sequenceId)?.published} onClick={()=>void run(async()=>{await adminAssignSequence(t.id,sequenceId!);})} className="text-xs text-gold disabled:text-gray-700">Assign selected</button></div>)}</div>
      </section>}

      {tab==='pairs'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4"><h3 className="text-white font-semibold">Clue 8 Pairing</h3><p className="text-xs text-gray-500">Exactly two teams share a pair key. Their participant views never expose the partner identity.</p><div className="grid md:grid-cols-2 gap-3"><label className="text-[10px] uppercase text-gray-500">Team<select value={pair.teamId} onChange={e=>setPair({...pair,teamId:e.target.value})} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value="">Select team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name} · {t.track_id}</option>)}</select></label><Field label="Pair key" value={pair.pairKey} onChange={v=>setPair({...pair,pairKey:v})}/><Field label="Logical Clue 8" value={pair.logicalClue} onChange={v=>setPair({...pair,logicalClue:v})} rows={5} type="textarea"/><Field label="Physical location" value={pair.physicalLocation} onChange={v=>setPair({...pair,physicalLocation:v})}/><Field label="Clue 9 location" value={pair.clue9Location} onChange={v=>setPair({...pair,clue9Location:v})}/><Field label="Sticker image URL" value={pair.stickerImageUrl} onChange={v=>setPair({...pair,stickerImageUrl:v})}/></div><button disabled={busy||!pair.teamId} onClick={()=>void savePair()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Save Pair</button><div className="grid md:grid-cols-2 gap-2">{pairs.map(p=><div key={p.team_id} className="border border-gray-800 rounded p-3 text-sm"><div className="text-white">{p.team_name} · Track {p.track_id}</div><div className="text-xs text-gold mt-1">Pair {p.pair_key}</div><div className="text-xs text-gray-500 mt-1">{p.logical_clue}</div></div>)}</div></section>}

      {tab==='data'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-5"><h3 className="text-white font-semibold">Data, History & Import/Export</h3><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void downloadExport()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Export JSON</button><button disabled={busy} onClick={()=>void downloadCsv()} className="border border-gray-700 text-gray-300 px-4 py-2 rounded text-sm">Export Routes CSV</button></div><div className="grid md:grid-cols-2 gap-3"><label className="text-[10px] uppercase text-gray-500">Team history<select value={historyTeam} onChange={e=>setHistoryTeam(e.target.value)} className="mt-1 w-full bg-[#171717] border border-gray-700 rounded px-3 py-2 text-sm text-white"><option value="">Select team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name} · Track {t.track_id}</option>)}</select></label><button disabled={!historyTeam||busy} onClick={()=>void loadHistory()} className="self-end border border-gold/40 text-gold px-4 py-2 rounded text-sm">Load History</button></div><div className="overflow-auto">{history.length>0&&<table className="w-full text-xs"><thead className="text-gray-500 uppercase"><tr><th className="text-left py-2">Time</th><th>Phase</th><th>Position</th><th>Clue</th><th>Status</th><th>Event</th></tr></thead><tbody>{history.map(h=><tr key={String(h.id)} className="border-t border-gray-900"><td className="py-2">{String(h.assigned_at)}</td><td className="text-center">{String(h.stage_group)}</td><td className="text-center">{String(h.position_at_time??'—')}</td><td className="text-center">{String(h.clue_number??'—')}</td><td className="text-center">{String(h.status)}</td><td className="text-center">{String(h.event_type)}</td></tr>)}</tbody></table>}</div><textarea value={importText} onChange={e=>setImportText(e.target.value)} rows={10} placeholder="Paste a Convergence config JSON export…" className="w-full bg-[#171717] border border-gray-700 rounded p-3 text-white font-mono text-xs"/><button disabled={busy||!importText.trim()} onClick={()=>void importConfig()} className="border border-gold/40 text-gold px-4 py-2 rounded text-sm">Import JSON</button></section>}

      {tab==='test'&&<section className="bg-[#111] border border-gray-800 rounded p-5 space-y-4"><h3 className="text-white font-semibold">Organizer Test Mode</h3><p className="text-sm text-gray-400">The test fixture is isolated from A/B/C/D qualification counts.</p><button disabled={busy} onClick={()=>void makeTest()} className="bg-gold text-black px-4 py-2 rounded text-sm font-semibold">Create / Reset Test Fixture</button>{testCreds&&<div className="border border-green-800/60 bg-green-950/20 rounded p-4 text-sm"><div className="text-green-300">Team: {testCreds.team_name}</div><div className="font-mono mt-2">Password: {testCreds.password}</div></div>}<div className="border border-gray-800 rounded p-4 text-xs text-gray-400 space-y-2"><div>Position test: eliminate A2, A5, A7, A11, A14 → survivors must become A1,A3,A4,A6,A8,A9,A10,A12,A13,A15 at positions 1–10.</div><div>Checkpoint test: exactly 5 selections per track; 6th selection in any track must be blocked.</div><div>Refresh after every success; server state must remain unchanged.</div></div></section>}
    </div>
  </OrganizerLayout>;
}
