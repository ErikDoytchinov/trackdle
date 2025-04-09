import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';

const GameSetup = ({ state, setState, startGame, user }) => {
  const [dailyStatus, setDailyStatus] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const countdownInterval = useRef(null);

  const getAuthConfig = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }, []);

  const updateCountdown = (endTime) => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    countdownInterval.current = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        clearInterval(countdownInterval.current);
        setCountdown('');
        checkDailyStatus();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
  };

  const checkDailyStatus = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/daily/status`,
        getAuthConfig()
      );
      setDailyStatus(response.data);
      
      if (!response.data.available && response.data.next_available_at) {
        updateCountdown(response.data.next_available_at);
      } else {
        setCountdown('');
      }
    } catch (error) {
      console.error('Error checking daily status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkDailyStatus();

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    checkDailyStatus(); 
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-3">Game Mode</label>
          <div className="flex gap-1 p-1 bg-slate-700 rounded-lg border border-slate-600">
            {['playlist', 'random', 'daily', 'multiplayer'].map((mode) => (
              <button
                key={mode}
                onClick={() => setState(prev => ({ ...prev, mode }))}
                className={`flex-1 py-2 px-3 rounded-md text-sm transition-all ${
                  state.mode === mode
                    ? 'bg-amber-400/10 text-amber-400 shadow-sm border border-amber-400/30'
                    : (mode === 'daily' && (!dailyStatus?.available || isLoading)) || (mode === 'multiplayer' && !user)
                    ? 'bg-slate-800/50 text-slate-400 cursor-not-allowed'
                    : 'text-slate-300 hover:bg-slate-600/50'
                }`}
                disabled={(mode === 'daily' && (!dailyStatus?.available || isLoading)) || (mode === 'multiplayer' && !user)}
                aria-pressed={state.mode === mode}
              >
                {mode === 'playlist' ? 'Playlist' : 
                 mode === 'daily' ? (
                   <div className="flex flex-col items-center space-y-0.5">
                     <div className="flex items-center gap-1.5">
                       <span className="font-medium">Daily</span>
                       {dailyStatus?.current_daily?.id && (
                         <span className="text-xs text-slate-400">
                           #{dailyStatus.current_daily.id}
                         </span>
                       )}
                     </div>
                     {!dailyStatus?.available && (
                       <div className="text-[0.65em] tracking-tighter font-mono text-slate-500">
                         {countdown || '--:--:--'}
                       </div>
                     )}
                   </div>
                 ) : 
                 mode === 'multiplayer' ? (
                   <div className="flex items-center justify-center gap-1.5 relative">
                     <svg 
                       className="w-4 h-4 text-amber-400/80" 
                       fill="none" 
                       viewBox="0 0 24 24" 
                       stroke="currentColor"
                     >
                       <path 
                         strokeLinecap="round" 
                         strokeLinejoin="round" 
                         strokeWidth={2} 
                         d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
                       />
                     </svg>
                     <span>Multiplayer</span>
                     {!user && (
                       <span className="absolute -top-1.5 -right-1.5">
                         <svg className="w-4 h-4 text-amber-400/50" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                         </svg>
                       </span>
                     )}
                   </div>
                 ) : 
                 'Random'}
              </button>
            ))}
          </div>
        </div>

        {state.mode === 'playlist' && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Paste Spotify playlist URL..."
              value={state.playlistUrl}
              onChange={(e) => setState(prev => ({ ...prev, playlistUrl: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white transition-all placeholder:text-slate-400"
            />
            <p className="text-xs text-slate-400">
              Example: https://open.spotify.com/playlist/...
            </p>
          </div>
        )}
        
        {state.mode === 'multiplayer' && !user && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
            You need to sign in to play multiplayer games.
          </div>
        )}

        <button
          onClick={startGame}
          disabled={(state.mode === 'daily' && !dailyStatus?.available) || isLoading}
          className={`w-full py-3 font-semibold rounded-lg transition-colors ${
            (state.mode === 'daily' && !dailyStatus?.available) || isLoading
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
          }`}
        >
          {isLoading 
            ? 'Loading...' 
            : state.mode === 'multiplayer' 
            ? 'Enter Multiplayer Lobby'
            : state.mode === 'daily' 
            ? 'Start Daily Challenge' 
            : 'Start Game'}
        </button>
      </div>
      {state.feedback && <p className="text-red-400 text-sm">{state.feedback}</p>}
    </div>
  );
};

GameSetup.propTypes = {
  state: PropTypes.object.isRequired, 
  setState: PropTypes.func.isRequired,
  startGame: PropTypes.func.isRequired,
  user: PropTypes.object
};

export default GameSetup;