import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';

const MultiplayerLobby = ({ user, onBack, socket, setGameState }) => {
  const [activeSection, setActiveSection] = useState('join');
  const [currentLobby, setCurrentLobby] = useState(null);
  const [lobbyCode, setLobbyCode] = useState('');
  const [lobbySettings, setLobbySettings] = useState({
    maxPlayers: 4,
    songCount: 5,
    maxAttempts: 5
  });
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL;

  const isUserHost = () => {
    if (!currentLobby || !user || !currentLobby.ownerId || !user._id) return false;
    try {
      return (
        currentLobby.ownerId === user._id ||
        (currentLobby.ownerId?.toString && user._id?.toString &&
          currentLobby.ownerId.toString() === user._id.toString())
      );
    } catch {
      return false;
    }
  };

  const startGame = async () => {
    if (!currentLobby) {
      setError("Lobby is invalid");
      return;
    }

    try {
      setError('');
      setIsStartingGame(true);
      
      const response = await axios.post(
        `${apiUrl}/multiplayer/game/${currentLobby.lobbyId}`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      const gameData = response.data;
      
      // The game will transition via socket event, but as a fallback we'll use this
      setTimeout(() => {
        setGameState({
          gameStarted: true,
          gameId: gameData.gameId,
          lobbyId: currentLobby.lobbyId,
          totalSongs: gameData.targetSongs?.length || gameData.songs?.length || currentLobby?.gameSettings?.songCount || 5,
          
        });
      }, 500);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to start game');
      setIsStartingGame(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onError = (data) => {
      setError(data.message || 'An error occurred');
      setIsJoining(false);
    };
    
    const onLobbyUpdate = (data) => {
      setCurrentLobby(prev => {
        const updated = {
          ...(prev || {}),
          players: data.players,
          status: data.status,
          ownerId: data.ownerId,
          lobbyId: data.lobbyId,
        };
        
        if (data.maxPlayers) updated.maxPlayers = data.maxPlayers;
        if (data.gameSettings) updated.gameSettings = data.gameSettings;
        
        // Preserve the lobby code and lobby id from the API if not provided by the socket event
        if (prev) {
          updated.lobbyCode = updated.lobbyCode || prev.lobbyCode;
          updated.lobbyId = updated.lobbyId || prev.lobbyId;
        }
        
        return updated;
      });
      
      setActiveSection('lobby');
      setIsJoining(false);
    };

    const onGameStarted = (data) => {
      // Set up game state to transition to the game screen
      setGameState({
        gameStarted: true,
        gameId: data.gameId,
        lobbyId: currentLobby?.lobbyId || data.lobbyId,
        totalSongs: data.totalSongs || data.targetSongs?.length || currentLobby?.gameSettings?.songCount || 5,
        currentPreviewUrl: data.currentPreviewUrl,
        leaderboard: data.leaderboard || []
      });
    };

    const onPlayersReadyStatus = (data) => {
      setAllPlayersReady(data.allReady);
    };
    
    const onLeftLobby = () => {
      setCurrentLobby(null);
      setActiveSection('join');
    };
    
    socket.on('error', onError);
    socket.on('lobby-update', onLobbyUpdate);
    socket.on('players-ready-status', onPlayersReadyStatus);
    socket.on('game-started', onGameStarted);
    socket.on('left-lobby', onLeftLobby);
    
    return () => {
      socket.off('error', onError);
      socket.off('lobby-update', onLobbyUpdate);
      socket.off('players-ready-status', onPlayersReadyStatus);
      socket.off('game-started', onGameStarted);
      socket.off('left-lobby', onLeftLobby);
    };
  }, [socket, currentLobby, setGameState]); 

  const createLobby = async () => {
    if (!socket) {
      setError("Socket connection not established");
      return;
    }

    try {
      setIsJoining(true);
      setError('');
      
      const response = await axios.post(
        `${apiUrl}/multiplayer/lobby`,
        lobbySettings,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      if (response.data.lobbyCode || response.data.lobbyId) {
        setCurrentLobby(prev => ({
          ...(prev || {}),
          lobbyCode: response.data.lobbyCode,
          lobbyId: response.data.lobbyId,
          maxPlayers: response.data.maxPlayers,
          gameSettings: response.data.gameSettings
        }));
      }

      const code = response.data.lobbyCode;
      setCurrentLobby(prev => ({
        ...(prev || {}),
        lobbyCode: code,
      }));
      socket.emit('join-by-code', code, (error, socketResponse) => {
        if (error) {
          setError(error.message || 'Failed to create lobby');
          setIsJoining(false);
          return;
        }
        if (!socketResponse || !socketResponse.success) {
          setError('Failed to create lobby');
          setIsJoining(false);
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating lobby');
      setIsJoining(false);
    }
  };

  const joinLobbyByCode = () => {
    if (!lobbyCode) {
      setError('Please enter a lobby code');
      return;
    }
    
    if (!socket) {
      setError("Socket connection not established");
      return;
    }
    
    setIsJoining(true);
    setError('');
    
    setCurrentLobby(prev => ({
      ...(prev || {}),
      lobbyCode: lobbyCode,
    }));
    
    socket.emit('join-by-code', lobbyCode, (error, response) => {
      if (response && response.lobbyId) {
        setCurrentLobby(prev => ({
          ...(prev || {}),
          lobbyId: response.lobbyId,
        }));
        return;
      }

      if (error) {
        setError(typeof error === 'string' ? error : error.message || 'Invalid lobby code');
        setIsJoining(false);
        return;
      }
      
      if (!response || !response.success) {
        setError('Invalid lobby code or lobby does not exist');
        setIsJoining(false);
      }
    });
  };

  const leaveLobby = () => {
    if (currentLobby && socket) {
      socket.emit('leave-lobby', currentLobby.lobbyId);
    }
  };

  return (
    <div className="space-y-8">
      {activeSection === 'join' && (
        <div className="space-y-8">
          <div className="bg-gray-800/30 p-8 rounded-2xl border border-white/10 backdrop-blur-lg shadow-2xl">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Multiplayer Lobby
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Enter lobby code..."
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                  className="flex-1 px-5 py-3.5 bg-gray-700/30 rounded-xl border border-white/10 focus:border-amber-400/50 focus:ring-4 focus:ring-amber-400/20 text-white placeholder-gray-400 backdrop-blur-sm transition-all"
                  maxLength={6}
                />
                <button
                  onClick={joinLobbyByCode}
                  disabled={isJoining || !socket}
                  className={`px-6 py-3.5 font-semibold rounded-xl transition-all ${
                    isJoining || !socket
                      ? 'bg-amber-500/50 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900'
                  }`}
                >
                  {isJoining ? 'Joining...' : 'Join'}
                </button>
              </div>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-sm">or</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <button
                onClick={() => setActiveSection('create')}
                className="w-full py-4 bg-gray-700/30 hover:bg-gray-700/40 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-400/30 transition-all flex items-center justify-center gap-3 group"
              >
                <svg className="w-6 h-6 text-amber-400 group-hover:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-gray-200 group-hover:text-amber-100 font-medium">Create New Lobby</span>
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-400/20 rounded-xl text-red-400 text-sm mt-6">
                {error}
              </div>
            )}
            
            <div className="mt-8">
              <button
                onClick={onBack}
                className="w-full py-3.5 bg-gray-700/30 hover:bg-gray-700/40 text-gray-300 rounded-xl transition-all border border-white/10 hover:border-amber-400/30"
              >
                Back to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'create' && (
        <div className="bg-gray-800/30 p-8 rounded-2xl border border-white/10 backdrop-blur-lg shadow-2xl">
          <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Create Lobby
          </h2>
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                {[
                  { label: 'Max Players', key: 'maxPlayers', options: [2, 3, 4, 5, 6] },
                  { label: 'Song Count', key: 'songCount', options: [3, 5, 7, 10] },
                  { label: 'Max Attempts', key: 'maxAttempts', options: [3, 5, 6] }
                ].map((setting) => (
                  <div key={setting.key} className="bg-gray-700/30 p-5 rounded-xl border border-white/10">
                    <label className="text-sm text-amber-200/80 mb-3">{setting.label}</label>
                    <select
                      value={lobbySettings[setting.key]}
                      onChange={(e) =>
                        setLobbySettings({ ...lobbySettings, [setting.key]: parseInt(e.target.value) })
                      }
                      className="w-full bg-gray-800/20 px-4 py-2.5 rounded-lg border border-white/10 text-gray-200 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 transition-all"
                    >
                      {setting.options.map(opt => (
                        <option key={opt} value={opt} className="bg-gray-800">{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setActiveSection('join')}
                className="py-3.5 bg-gray-700/30 hover:bg-gray-700/40 text-gray-300 rounded-xl transition-all border border-white/10 hover:border-amber-400/30"
              >
                Back
              </button>
              <button
                onClick={createLobby}
                disabled={isJoining || !socket}
                className={`py-3.5 rounded-xl font-semibold transition-all ${
                  isJoining || !socket
                    ? 'bg-amber-500/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900'
                }`}
              >
                {isJoining ? 'Creating...' : 'Create Lobby'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'lobby' && currentLobby && (
        <div className="bg-gray-800/30 p-8 rounded-2xl border border-white/10 backdrop-blur-lg shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-amber-400">Lobby Code: {currentLobby.lobbyCode}</h2>
              <p className="text-sm text-gray-400 mt-2">
                {currentLobby.players?.length || 0}/{currentLobby.maxPlayers} Players
              </p>
            </div>
            <button
              onClick={leaveLobby}
              className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-400/20 flex items-center gap-2"
            >
              Leave
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-amber-200/80 mb-4">Players</h3>
            <div className="space-y-3">
              {currentLobby.players?.map(player => (
                <div 
                  key={player.userId || player.id}
                  className={`p-4 rounded-xl flex items-center justify-between transition-all ${
                    player.userId === user._id || player.id === user._id
                      ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-400/20'
                      : 'bg-gray-700/30 border border-white/5 hover:border-amber-400/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-gray-200 ${
                      (player.userId || player.id) === currentLobby.ownerId ? 'font-semibold text-amber-400' : ''
                    }`}>
                      {player.email}
                    </span>
                    {(player.userId || player.id) === currentLobby.ownerId && (
                      <span className="text-xs px-2 py-1 bg-amber-400/10 text-amber-400 rounded-full">Host</span>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    player.ready ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {player.ready ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Ready
                      </div>
                    ) : 'Not Ready'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <button
              onClick={() => {
                if (!socket || !currentLobby.lobbyId) return;
                socket.emit('toggle-ready', currentLobby.lobbyId, (error) => {
                  if (error) setError(error.message || 'Failed to update readiness');
                });
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 rounded-xl transition-all font-semibold"
            >
              {currentLobby.players?.find(p => (p.userId || p.id) === user._id)?.ready ? 'Mark Not Ready' : 'Mark Ready'}
            </button>
          </div>

          {isUserHost() && allPlayersReady && (
            <div className="mb-8">
              <button
                onClick={startGame}
                disabled={isStartingGame}
                className={`w-full py-3.5 rounded-xl font-semibold transition-all ${
                  isStartingGame 
                    ? 'bg-green-500/50 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-gray-900'
                }`}
              >
                {isStartingGame ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting Game...
                  </div>
                ) : 'Start Game'}
              </button>
            </div>
          )}

          <div className="border-t border-white/10 pt-8">
            <button
              onClick={onBack}
              className="w-full py-3.5 bg-gray-700/30 hover:bg-gray-700/40 text-gray-300 rounded-xl transition-all border border-white/10 hover:border-amber-400/30"
            >
              Back to Main Menu
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-400/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

MultiplayerLobby.propTypes = {
  user: PropTypes.object.isRequired,
  onBack: PropTypes.func.isRequired,
  socket: PropTypes.object,
  setGameState: PropTypes.func.isRequired
};

export default MultiplayerLobby;