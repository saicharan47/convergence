import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ParchmentCard } from '../components/ParchmentCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { CodeInput } from '../components/CodeInput';
import { useAppContext } from '../store';
import { joinRoom } from '../lib/db';

export function RoomCodeScreen() {
  const navigate = useNavigate();
  const { setRoomCode } = useAppContext();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleContinue = async () => {
    if (code.trim().length === 5) {
      const roomData = await joinRoom(code);
      if (roomData) {
        setRoomCode(roomData.id);
        navigate('/team');
      } else {
        setError(true);
      }
    }
  };

  return (
    <AppShell showBack title="THE CONVERGENCE">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
        <ParchmentCard variant="dark" className="animate-fade-in-up">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl text-offwhite uppercase tracking-widest mb-4">
              Enter Room Code
            </h2>
            <p className="text-muted text-sm max-w-[250px] mx-auto">
              Input the 5-letter access code provided by your event coordinator.
            </p>
          </div>

          <div className="mb-10">
            <CodeInput 
              value={code} 
              onChange={(val) => { setCode(val); setError(false); }} 
              error={error} 
            />
          </div>

          <PrimaryButton 
            variant="parchment"
            disabled={code.trim().length !== 5} 
            onClick={handleContinue}
          >
            Continue
          </PrimaryButton>
        </ParchmentCard>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
        <p className="text-[10px] uppercase tracking-widest text-muted/40 font-sans italic">
          Every journey begins with a single key.
        </p>
      </div>
    </AppShell>
  );
}
