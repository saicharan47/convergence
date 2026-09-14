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
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const clueNum = Number.parseInt(id || '', 10);

  useEffect(() => {
    if (!progress || !Number.isInteger(clueNum) || clueNum < 1 || clueNum > 9) {
      navigate(progress ? '/dashboard' : '/', { replace: true });
      return;
    }

    // Only the single server-authoritative current clue is actionable.
    // Completed clues and future clues cannot be reopened through the URL.
    if (clueNum !== progress.current_clue) {
      navigate('/dashboard', { replace: true });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setClue(null);
    getClues(trackId || '').then(clues => {
      if (cancelled) return;
      const activeClue = clues.find(c => c.clue_number === clueNum);
      if (activeClue) setClue(activeClue);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [clueNum, progress, trackId, navigate]);

  const handleVerify = async () => {
    if (code.length !== 5 || !sessionToken || isVerifying) return;
    setIsVerifying(true);
    setError(false);
    try {
      const { ok } = await verifyClueCode(sessionToken, code);
      if (ok) {
        navigate(`/clue/${clueNum}/success`);
      } else {
        setError(true);
        setCode('');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell showBack showMenu title="THE CONVERGENCE">
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
            <p className="text-xs uppercase tracking-widest text-muted">Unsealing the next clue…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!clue) {
    return (
      <AppShell showBack showMenu title="THE CONVERGENCE">
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-red-300">This clue could not be loaded. Return to the dashboard and try again.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showBack showMenu title="THE CONVERGENCE">
      <div className="flex-1 flex flex-col py-4">
        <div className="text-center mb-5">
          <p className="text-[10px] text-gold/70 uppercase tracking-[0.3em] mb-1">Current Objective</p>
          <h2 className="font-display text-xl text-offwhite uppercase tracking-widest text-glow">Clue {clueNum.toString().padStart(2, '0')}</h2>
        </div>

        {clue.sticker_image_url && (
          <div className="mb-5 flex justify-center">
            <div className="w-full max-w-[190px] aspect-square rounded-xl overflow-hidden border border-gold/35 bg-void/70 shadow-[0_0_35px_rgba(184,134,46,0.12)]">
              <img src={clue.sticker_image_url} alt={`Clue ${clueNum} sticker`} className="w-full h-full object-contain" />
            </div>
          </div>
        )}

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
          <p className="font-sans text-sm text-offwhite/90 leading-relaxed italic mb-4">"{clue.question}"</p>
          <div className="h-px w-full bg-gold/20 my-4" />
          <p className="font-sans text-xs text-offwhite/60 uppercase tracking-wider font-semibold">Instruction: {clue.instruction}</p>
        </ParchmentCard>

        <motion.div className={cn("mt-auto", error && "animate-shake")}>
          <div className="mb-8">
            <CodeInput value={code} onChange={(val) => { setCode(val.replace(/\D/g, '').slice(0, 5)); setError(false); }} error={error} />
            {error && <p className="mt-3 text-center text-red-400 text-xs uppercase tracking-widest">The mark does not match.</p>}
          </div>
          <PrimaryButton variant="parchment" disabled={code.length !== 5 || isVerifying} onClick={handleVerify}>
            {isVerifying ? 'Verifying…' : 'Verify Code →'}
          </PrimaryButton>
        </motion.div>
      </div>
    </AppShell>
  );
}
