import { useNavigate } from 'react-router-dom';
import { PrimaryButton } from '../components/PrimaryButton';

export function HomeScreen() {
  const navigate = useNavigate();
  return <div className="min-h-[100dvh] relative flex flex-col items-center justify-center p-6 text-center overflow-hidden bg-void">
    <div className="absolute inset-0 bg-home-texture opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-transparent" />
    <div className="relative z-10 max-w-sm w-full mt-auto mb-12"><h1 className="font-display text-4xl md:text-5xl text-offwhite tracking-widest uppercase mb-4 text-glow">The<br/>Convergence</h1><p className="font-sans text-gold tracking-[0.2em] uppercase text-sm mb-12 opacity-90">Nine Paths. One Truth.</p><div className="space-y-6 mb-16"><p className="text-muted/80 text-sm italic">An ancient legend. A modern campus. The greatest treasure DBIT has ever known awaits the worthy.</p><p className="text-offwhite/90 font-medium tracking-wide uppercase text-sm">Are you ready to uncover what lies beneath?</p></div><PrimaryButton variant="parchment" onClick={() => navigate('/room-code')} className="mb-6 text-xl">Enter The Hunt &rarr;</PrimaryButton><p className="text-xs text-muted/50 tracking-widest uppercase font-sans">DBIT CSE | A Campus-Wide Treasure Hunt</p></div>
  </div>;
}
