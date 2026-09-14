import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { authenticateOrganizer } from '../../lib/db';

export function OrganizerLoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await authenticateOrganizer(email, password);
    if (success) {
      navigate('/organizer/dashboard');
    } else {
      setError(true);
      setTimeout(() => setError(false), 400);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#0a0a0a] flex items-center justify-center font-sans">
      <div className={cn("w-full max-w-sm p-8 bg-[#111] border border-gray-800 rounded-lg shadow-2xl", error && "animate-shake border-red-500/50")}>
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl text-gold uppercase tracking-widest mb-1">Convergence</h1>
          <p className="text-sm text-gray-500 uppercase tracking-widest">Organizer Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(false); }}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white focus:border-gold focus:outline-none transition-colors"
              placeholder="organizer@example.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white focus:border-gold focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit"
            disabled={!email || !password}
            className="w-full mt-4 bg-gold hover:bg-gold-dark text-black font-semibold uppercase tracking-widest py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
