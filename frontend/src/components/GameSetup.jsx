// src/components/GameSetup.jsx
import React from 'react';

const GameSetup = ({ state, setState, startGame }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-3">Game Mode</label>
          <div className="flex gap-1 p-1 bg-slate-700 rounded-lg border border-slate-600">
            {['playlist', 'random'].map((mode) => (
              <button
                key={mode}
                onClick={() => setState(prev => ({ ...prev, mode }))}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  state.mode === mode
                    ? 'bg-amber-400/10 text-amber-400 shadow-sm border border-amber-400/30'
                    : 'text-slate-300 hover:bg-slate-600/50'
                }`}
                aria-pressed={state.mode === mode}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
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
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
        >
          Start Game
        </button>
      </div>
      {state.feedback && <p className="text-red-400 text-sm">{state.feedback}</p>}
    </div>
  );
};

export default GameSetup;