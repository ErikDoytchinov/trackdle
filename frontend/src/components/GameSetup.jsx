import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

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
    // Clear any existing interval to avoid duplicates.
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
        // Check the daily status one more time when the countdown is done.
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

  // Run on mount
  useEffect(() => {
    checkDailyStatus();

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  // Re-run checkDailyStatus whenever the user changes (e.g., after login/signup)
  useEffect(() => {
    if (user) {
      checkDailyStatus();
    }
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-3">Game Mode</label>
          <div className="flex gap-1 p-1 bg-slate-700 rounded-lg border border-slate-600">
            {['playlist', 'random', 'daily'].map((mode) => (
              <button
                key={mode}
                onClick={() => setState(prev => ({ ...prev, mode }))}
                className={`flex-1 py-2 px-3 rounded-md text-sm transition-all ${
                  state.mode === mode
                    ? 'bg-amber-400/10 text-amber-400 shadow-sm border border-amber-400/30'
                    : mode === 'daily' && (!dailyStatus?.available || isLoading)
                    ? 'bg-slate-800/50 text-slate-400 cursor-not-allowed'
                    : 'text-slate-300 hover:bg-slate-600/50'
                }`}
                disabled={(mode === 'daily' && (!dailyStatus?.available || isLoading)) || isLoading}
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
            : (state.mode === 'daily' ? 'Start Daily Challenge' : 'Start Game')}
        </button>
      </div>
      {state.feedback && <p className="text-red-400 text-sm">{state.feedback}</p>}
    </div>
  );
};

export default GameSetup;
