import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { KeyIcon } from '../icons/CustomIcons';
import { useAppContext } from '../store';

export function SuccessScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const clueNum = parseInt(id || '1', 10);
  const isFinalClue = clueNum === 9;

  const handleNext = () => {
    navigate('/dashboard');
  };

  return (
    <AppShell title="THE CONVERGENCE">
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        
        <div className="mb-8 p-6 rounded-full bg-void border border-gold shadow-[0_0_40px_rgba(201,162,75,0.3)] relative">
          <div className="absolute inset-0 rounded-full animate-ping border border-gold opacity-20" />
          <KeyIcon className="w-16 h-16 text-gold" />
        </div>
        
        <h2 className="font-display text-2xl text-offwhite uppercase tracking-widest mb-4 text-glow">
          Clue 0{clueNum} Completed
        </h2>
        
        <p className="text-muted text-sm max-w-[280px] mx-auto mb-16">
          {isFinalClue 
            ? "You have uncovered all secrets and completed the hunt. Let us see how you fare against the others."
            : "The truth reveals itself piece by piece. Your path opens further."}
        </p>

        <PrimaryButton variant="parchment" onClick={handleNext} className="mt-auto md:mt-10">
          {isFinalClue ? "View Leaderboard" : "View Next Clue"} &rarr;
        </PrimaryButton>
      </div>
    </AppShell>
  );
}
