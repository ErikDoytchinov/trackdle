import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const GameSetup = ({ state, setState, startGame, user, dailyStatus, dailyCountdown, refreshDailyStatus }) => {
  const isLoading = dailyStatus === null && state.mode === 'daily';
  const refreshRequested = useRef(false);

  const handleModeSelection = (mode) => {
    setState((prev) => ({ ...prev, mode }));
  };

  useEffect(() => {
    if (state.mode === 'daily' && dailyCountdown === '' && refreshDailyStatus && !refreshRequested.current) {
      refreshRequested.current = true;
      setTimeout(() => {
        refreshDailyStatus();
        refreshRequested.current = false;
      }, 100);
    }
  }, [state.mode, dailyCountdown, refreshDailyStatus]);

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <label className="block text-sm text-amber-200/80 mb-4">Game Mode</label>
          <div className="grid grid-cols-2 gap-3 p-2 bg-gray-800/30 rounded-2xl backdrop-blur border border-white/10">
            {['playlist', 'random', 'daily', 'multiplayer'].map((mode) => (
              <div key={mode} className="relative">
                <button
                  onClick={() => handleModeSelection(mode)}
                  className={`w-full py-4 px-5 rounded-xl transition-all flex items-center justify-center gap-2 group
                    ${
                      state.mode === mode
                        ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 shadow-inner border border-amber-400/20'
                        : (mode === 'daily' && (!dailyStatus?.available || isLoading)) || (mode === 'multiplayer' && !user)
                        ? 'bg-gray-700/20 text-gray-300/50 cursor-not-allowed opacity-60'
                        : 'bg-transparent hover:bg-white/5 border border-transparent hover:border-amber-400/20 text-gray-300'
                    }`}
                  type="button"
                  disabled={(mode === 'daily' && (!dailyStatus?.available || isLoading)) || (mode === 'multiplayer' && !user)}
                  aria-disabled={(mode === 'daily' && (!dailyStatus?.available || isLoading)) || (mode === 'multiplayer' && !user)}
                >
                  {mode === 'playlist' && (
                    <svg className="w-5 h-5 text-amber-400 group-hover:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  )}
                  {mode === 'random' && (
                    <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {mode === 'daily' && (
                    <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {mode === 'multiplayer' && (
                    <svg className="w-5 h-5 text-green-400 group-hover:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  )}
                  <span className="group-hover:text-amber-100 transition-colors">
                    {mode === 'multiplayer' 
                      ? 'Multiplayer' 
                      : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </span>
                </button>
                {mode === 'daily' && !dailyStatus?.available && dailyCountdown && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl z-10">
                    <span className="text-xs text-amber-300 mb-1">Available in</span>
                    <span className="text-amber-400 font-mono font-bold">{dailyCountdown}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {state.mode === 'playlist' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Paste Spotify playlist URL..."
              value={state.playlistUrl}
              onChange={(e) => setState(prev => ({ ...prev, playlistUrl: e.target.value }))}
              className="w-full px-5 py-3.5 bg-gray-700/30 rounded-xl border border-white/10 focus:border-amber-400/50 focus:ring-4 focus:ring-amber-400/20 text-white placeholder-gray-400 backdrop-blur-sm transition-all"
            />
            <p className="text-xs text-gray-400">
              Example: https://open.spotify.com/playlist/...
            </p>
          </div>
        )}
        {state.mode === 'multiplayer' && !user && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400">
            You need to sign in to play multiplayer games.
          </div>
        )}
        <button
          onClick={startGame}
          disabled={(state.mode === 'daily' && !dailyStatus?.available) || isLoading}
          className={`w-full py-4 font-semibold rounded-xl transition-all ${
            (state.mode === 'daily' && !dailyStatus?.available) || isLoading
              ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 transform hover:scale-[1.02] shadow-lg hover:shadow-amber-500/20'
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
      {state.feedback && <p className="text-red-400 text-sm text-center">{state.feedback}</p>}
    </div>
  );
};

GameSetup.propTypes = {
  state: PropTypes.object.isRequired, 
  setState: PropTypes.func.isRequired,
  startGame: PropTypes.func.isRequired,
  user: PropTypes.object,
  dailyStatus: PropTypes.object,
  dailyCountdown: PropTypes.string,
  refreshDailyStatus: PropTypes.func
};

export default GameSetup;