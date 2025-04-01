import { useState } from 'react';
import axios from 'axios';

const AuthProfile = ({ user, setUser, onClose, stats }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = mode === 'login' ? 'login' : 'signup';
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/${endpoint}`,
        { email, password }
      );
      
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    }
  };

  // Utility to format playtime (e.g., seconds to mm:ss)
  const formatPlaytime = (seconds) => {
    if (!seconds && seconds !== 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md relative z-[110]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-amber-400 transition-colors"
        >
          ✕
        </button>
        
        {user ? (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              Player Stats
            </h2>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-700/50 p-4 rounded-lg text-center backdrop-blur-sm">
                <div className="text-2xl font-bold text-amber-400 mb-1">{stats.gamesPlayed}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Games</div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg text-center backdrop-blur-sm">
                <div className="text-2xl font-bold text-green-400 mb-1">{stats.correctGuesses}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Correct</div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg text-center backdrop-blur-sm">
                <div className="text-2xl font-bold text-blue-400 mb-1">{stats.averageAttempts ? stats.averageAttempts.toFixed(1) : '-'}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Avg Tries</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span className="text-slate-300">Total Playtime</span>
                </div>
                <span className="text-slate-400">{formatPlaytime(stats.totalPlaytime)}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span className="text-slate-300">Win Rate</span>
                </div>
                <span className="text-slate-400">{stats.winRate ? `${stats.winRate.toFixed(1)}%` : '-'}</span>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('token');
                setUser(null);
                onClose();
              }}
              className="w-full py-3 bg-transparent border border-amber-400/30 hover:border-amber-400/50 text-amber-400 rounded-lg transition-all hover:bg-amber-400/10"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            <h2 className="text-2xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white transition-all"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white transition-all"
                required
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
              >
                {mode === 'login' ? 'Sign In' : 'Get Started'}
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-slate-400 hover:text-amber-300 text-sm text-center transition-colors"
              >
                {mode === 'login' 
                  ? 'New here? Create an account'
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthProfile;
