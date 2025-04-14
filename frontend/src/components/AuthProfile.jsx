// AuthProfile.jsx
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

  const formatPlaytime = (seconds) => {
    if (!seconds && seconds !== 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-gray-800/90 rounded-2xl p-8 w-full max-w-md relative z-[110] backdrop-blur-xl border border-white/10 shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-300 hover:text-amber-400 transition-colors p-1.5 hover:bg-white/5 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {user ? (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Player Stats
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5 rounded-xl border border-amber-400/20">
                <div className="text-3xl font-bold text-amber-400 mb-2">{stats.gamesPlayed}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">Games Played</div>
              </div>
              <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/10 p-5 rounded-xl border border-green-400/20">
                <div className="text-3xl font-bold text-green-400 mb-2">{stats.correctGuesses}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-green-400/80">Correct Guesses</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-5 rounded-xl border border-blue-400/20">
                <div className="text-3xl font-bold text-blue-400 mb-2">{stats.averageAttempts ? stats.averageAttempts.toFixed(1) : '-'}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-400/80">Avg Attempts</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-5 rounded-xl border border-purple-400/20">
                <div className="text-3xl font-bold text-purple-400 mb-2">{stats.winRate ? `${stats.winRate.toFixed(1)}%` : '-'}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-400/80">Win Rate</div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-white/5 hover:border-amber-400/30 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span className="text-gray-200">Total Playtime</span>
                </div>
                <span className="text-amber-400 font-medium">{formatPlaytime(stats.totalPlaytime)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('token');
                setUser(null);
                onClose();
              }}
              className="w-full py-3.5 bg-transparent border border-amber-400/30 hover:border-amber-400/50 text-amber-400 rounded-xl transition-all hover:bg-amber-400/10 font-medium"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-6">
            <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            
            {error && <div className="p-3 bg-red-500/10 text-red-400 rounded-lg text-sm text-center">{error}</div>}
            
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-700/30 rounded-xl border border-white/10 focus:border-amber-400/50 focus:ring-4 focus:ring-amber-400/20 text-white placeholder-gray-400 backdrop-blur-sm transition-all"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-700/30 rounded-xl border border-white/10 focus:border-amber-400/50 focus:ring-4 focus:ring-amber-400/20 text-white placeholder-gray-400 backdrop-blur-sm transition-all"
                required
              />
            </div>
            
            <div className="flex flex-col gap-4">
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-amber-500/20"
              >
                {mode === 'login' ? 'Sign In' : 'Get Started'}
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-gray-400 hover:text-amber-300 text-sm text-center transition-colors"
              >
                {mode === 'login' 
                  ? 'New here? Create an account →'
                  : 'Already have an account? Sign in →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthProfile;