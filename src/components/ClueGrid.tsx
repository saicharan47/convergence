import { ChestIcon } from '../icons/CustomIcons';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ClueGridProps { total: number; currentClue: number; }

export function ClueGrid({ total, currentClue }: ClueGridProps) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[320px] mx-auto">
      {Array.from({ length: total }).map((_, i) => {
        const clueNumber = i + 1;
        const isSolved = clueNumber < currentClue;
        const isCurrent = clueNumber === currentClue;
        const isLocked = clueNumber > currentClue;
        return (
          <motion.button key={i} onClick={() => !isLocked && navigate(`/clue/${clueNumber}`)} disabled={isLocked} aria-disabled={isLocked}
            initial={isCurrent ? { scale: 0.8, opacity: 0 } : false} animate={isCurrent ? { scale: 1, opacity: 1 } : false}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }} whileHover={!isLocked ? { scale: 1.05 } : {}} whileTap={!isLocked ? { scale: 0.95 } : {}}
            className={cn('aspect-square rounded border flex flex-col items-center justify-center transition-colors relative overflow-hidden',
              isLocked ? 'bg-void/60 border-gold/10 opacity-50 cursor-not-allowed' : isCurrent ? 'bg-void border-gold shadow-[0_0_15px_rgba(201,162,75,0.4)]' : 'bg-parchment-texture border-gold/30')}>
            {isLocked ? <ChestIcon className="w-8 h-8 text-muted/50 mb-1" /> : isSolved ? <><span className="font-display text-2xl text-ink opacity-80">{clueNumber}</span><span className="text-[10px] font-sans text-ink uppercase tracking-widest mt-1 opacity-70">Solved</span></> : <><div className="absolute inset-0 bg-gold/5 animate-pulse pointer-events-none" /><span className="font-display text-2xl text-offwhite text-glow">{clueNumber}</span><span className="text-[10px] font-sans text-gold uppercase tracking-widest mt-1">Active</span></>}
          </motion.button>
        );
      })}
    </div>
  );
}
