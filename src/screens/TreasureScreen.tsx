import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ParchmentCard } from '../components/ParchmentCard';
import { useAppContext } from '../store';
import { ChestIcon } from '../icons/CustomIcons';

export function TreasureScreen(){
 const navigate=useNavigate(); const {teamName,convergenceState}=useAppContext();
 if(convergenceState?.status!=='WINNER'){navigate('/dashboard',{replace:true});return null;}
 return <AppShell title="THE CONVERGENCE" showMenu><div className="flex-1 flex flex-col items-center justify-center p-4 py-8 animate-fade-in-up"><div className="mb-8 w-40 h-40 rounded-full overflow-hidden border-2 border-gold/40 shadow-[0_0_30px_rgba(201,162,75,0.4)] mx-auto relative bg-void/50 flex items-center justify-center"><div className="absolute inset-0 bg-gold/10 animate-pulse pointer-events-none"/><ChestIcon className="w-20 h-20 text-gold"/></div><ParchmentCard variant="dark" className="w-full max-w-sm p-8 text-center"><h2 className="font-display text-3xl text-gold uppercase tracking-widest mb-2 text-glow">🏆 Treasure Found</h2><p className="font-sans text-sm text-offwhite/90 italic leading-relaxed">Congratulations, {teamName}. Your server-verified final submission claimed the treasure.</p><div className="mt-6 bg-void/40 border border-gold/20 rounded p-5"><p className="text-muted text-xs uppercase tracking-widest">THE CONVERGENCE WINNER</p><p className="font-display text-2xl text-offwhite mt-2">{teamName}</p></div></ParchmentCard></div></AppShell>;
}
