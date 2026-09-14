import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ParchmentCard } from '../components/ParchmentCard';
import { CodeInput } from '../components/CodeInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppContext } from '../store';
import { verifyClueCode, getClues, type MockClue } from '../lib/db';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function ActiveClueScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trackId, sessionToken, progress } = useAppContext();
  
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [clue, setClue] = useState<MockClue | null>(null);
  const clueNum = parseInt(id || '1', 10);

  useEffect(() => {
    if (!progress) {
      navigate('/', { replace: true });
      return;
    }
    
    if (clueNum > progress.current_clue) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const fetchClue = async () => {
      if (!trackId) return;
      const clues = await getClues(trackId);
      const activeClue = clues.find(c => c.clue_number === clueNum);
      if (activeClue) setClue(activeClue);
    };
    fetchClue();
  }, [clueNum, progress, trackId, navigate]);

  const isSolved = progress && clueNum < progress.current_clue;

  const handleVerify = async () => {
    if (code.trim().length === 5 && sessionToken) {
      const { ok } = await verifyClueCode(sessionToken, code);
      if (ok) {
        // State updates automatically via Realtime subscription in AppContext
        navigate(`/clue/${clueNum}/success`);
      } else {
        setError(true);
        setTimeout(() => setError(false), 400); // Reset for shake animation
      }
    }
  };

  if (!clue) return null; // Or a loading spinner

  return (
    <AppShell showBack showMenu title="THE CONVERGENCE">
      <div className="flex-1 flex flex-col py-4">
        <div className="text-center mb-6">
          <h2 className="font-display text-xl text-offwhite uppercase tracking-widest text-glow">
            Clue 0{clueNum}
          </h2>
        </div>

        <ParchmentCard variant="dark" className="mb-8">
          {clue.clue_image_url ? (
            <div className="w-full h-48 rounded overflow-hidden mb-4 border border-gold/30">
              <img src={clue.clue_image_url} alt="Clue" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-32 bg-offwhite/5 rounded mb-4 border border-offwhite/10 flex items-center justify-center">
              <span className="text-offwhite/40 font-display text-sm tracking-widest">MAP FRAGMENT</span>
            </div>
          )}
          
          <h3 className="font-display text-lg text-gold font-bold mb-2">{clue.title}</h3>
          <p className="font-sans text-sm text-offwhite/90 leading-relaxed italic mb-4">
            "{clue.question}"
          </p>
          <div className="h-px w-full bg-gold/20 my-4" />
          <p className="font-sans text-xs text-offwhite/60 uppercase tracking-wider font-semibold">
            Instruction: {clue.instruction}
          </p>
        </ParchmentCard>

        {isSolved ? (
          <div className="mt-auto text-center p-4 border border-gold/40 rounded bg-void/80">
            <p className="text-gold font-display tracking-widest uppercase">Clue Completed</p>
          </div>
        ) : (
          <motion.div className={cn("mt-auto", error && "animate-shake")}>
            <div className="mb-8">
              <CodeInput 
                value={code} 
                onChange={(val) => { setCode(val); setError(false); }} 
                error={error} 
              />
            </div>

            <PrimaryButton 
              variant="parchment"
              disabled={code.trim().length !== 5} 
              onClick={handleVerify}
            >
              Verify Code &rarr;
            </PrimaryButton>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
