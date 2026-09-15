import { useState, useEffect } from 'react';
import { OrganizerLayout } from '../../layouts/OrganizerLayout';
import { getClue, updateClue, type ClueData } from '../../lib/db';
import { Image as ImageIcon, Save, CheckCircle } from 'lucide-react';

export function ClueManagementScreen() {
  const [selectedTrack, setSelectedTrack] = useState('A');
  const [selectedClue, setSelectedClue] = useState(1);
  const [clueData, setClueData] = useState<ClueData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [riddle, setRiddle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [stickerImageUrl, setStickerImageUrl] = useState('');
  const [clueImageUrl, setClueImageUrl] = useState('');

  useEffect(() => {
    async function load() {
      const data = await getClue(selectedTrack, selectedClue);
      if (data) {
        setClueData(data);
        setRiddle(data.riddle);
        setInstruction(data.instruction || '');
        setStickerImageUrl(data.stickerImageUrl || '');
        setClueImageUrl(data.clueImageUrl || '');
      } else {
        setClueData(null); setRiddle(''); setInstruction(''); setStickerImageUrl(''); setClueImageUrl('');
      }
      setSaveSuccess(false);
    }
    void load();
  }, [selectedTrack, selectedClue]);

  const handleSave = async () => {
    setIsSaving(true); setSaveSuccess(false);
    try {
      await updateClue(selectedTrack, selectedClue, { riddle, instruction, stickerImageUrl, clueImageUrl });
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 2000);
    } finally { setIsSaving(false); }
  };

  return <OrganizerLayout title="Clue Management"><div className="flex gap-8 h-full max-w-6xl mx-auto">
    <div className="w-64 shrink-0 flex flex-col gap-6"><div className="bg-[#111] border border-gray-800 rounded p-4"><h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3 font-semibold">Track</h3><div className="flex flex-col gap-2">{['A','B','C','D'].map(t=><button key={t} onClick={()=>setSelectedTrack(t)} className={`p-2 text-sm rounded text-left transition-colors ${selectedTrack===t?'bg-gold/10 text-gold border border-gold/50':'bg-[#1a1a1a] border border-transparent text-gray-400 hover:text-gray-200'}`}>Track {t}</button>)}</div></div>
      <div className="bg-[#111] border border-gray-800 rounded p-4 flex-1 overflow-y-auto"><h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3 font-semibold">Clues</h3><div className="flex flex-col gap-1">{Array.from({length:9}).map((_,i)=>{const num=i+1;return <button key={num} onClick={()=>setSelectedClue(num)} className={`p-2 text-sm rounded text-left transition-colors ${selectedClue===num?'bg-gray-800 text-white':'hover:bg-[#1a1a1a] text-gray-400'}`}>Clue {num}</button>})}</div></div>
    </div>
    <div className="flex-1 bg-[#111] border border-gray-800 rounded p-6 flex flex-col">{clueData?<><div className="flex justify-between items-center mb-6"><div><h2 className="text-xl font-medium text-white">Track {selectedTrack} - Clue {selectedClue}</h2><p className="text-sm text-gray-500">Edit content and media</p></div><button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-gold hover:bg-gold-dark text-black px-4 py-2 rounded font-semibold text-sm transition-colors disabled:opacity-50">{saveSuccess?<CheckCircle className="w-4 h-4"/>:<Save className="w-4 h-4"/>}{saveSuccess?'Saved':isSaving?'Saving...':'Save Changes'}</button></div>
      <div className="space-y-6 flex-1 overflow-y-auto pr-2"><div><label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Riddle Content</label><textarea value={riddle} onChange={e=>setRiddle(e.target.value)} className="w-full h-32 bg-[#1a1a1a] border border-gray-700 rounded p-3 text-gray-200 focus:outline-none focus:border-gold resize-none" placeholder="Enter the riddle here..."/></div>
      <div><label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Instruction</label><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} className="w-full h-24 bg-[#1a1a1a] border border-gray-700 rounded p-3 text-gray-200 focus:outline-none focus:border-gold resize-none" placeholder="E.g., Find the physical marker and enter the 5-digit code..."/></div>
      <div><label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Sticker Image URL</label><input type="text" value={stickerImageUrl} onChange={e=>setStickerImageUrl(e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-gray-200 focus:outline-none focus:border-gold" placeholder="https://..."/>{stickerImageUrl?<div className="mt-4 border border-gray-800 rounded-lg p-4 bg-[#151515] flex justify-center"><img src={stickerImageUrl} alt="Sticker preview" className="max-h-48 object-contain rounded"/></div>:<div className="mt-4 text-center text-gray-600"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50"/><p className="text-sm">No sticker image</p></div>}</div>
      <div><label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Clue Image URL</label><input type="text" value={clueImageUrl} onChange={e=>setClueImageUrl(e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-3 text-gray-200 focus:outline-none focus:border-gold" placeholder="https://..."/>{clueImageUrl?<div className="mt-4 border border-gray-800 rounded-lg p-4 bg-[#151515] flex justify-center"><img src={clueImageUrl} alt="Clue preview" className="max-h-64 object-contain rounded"/></div>:<div className="mt-4 text-center text-gray-600"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50"/><p className="text-sm">No clue image</p></div>}</div></div>
    </>:<div className="flex-1 flex items-center justify-center text-gray-500">Loading clue data...</div>}</div>
  </div></OrganizerLayout>;
}
