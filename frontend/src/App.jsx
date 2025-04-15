import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';
import Downshift from 'downshift';
import GameSetup from './components/GameSetup';
import GuessHistory from './components/GuessHistory';
import SongPreview from './components/SongPreview';
import MultiplayerLobby from './components/MultiplayerLobby';
import useAudioProgress from './hooks/useAudioProgress';
import AuthProfile from './components/AuthProfile';
import { io } from 'socket.io-client';
import PropTypes from 'prop-types';
import DropdownMenuPortal from './components/DropdownMenuPortal';

const App = () => {
  const [state, setState] = useState({
    mode: 'playlist',
    playlistUrl: '',
    sessionId: null,
    songData: null,
    recommendedSongs: [],
    gameStarted: false,
    snippetDuration: 1,
    guess: '',
    feedback: '',
    attempt: 0,
    correctGuess: false,
    history: [],
    correctSong: null,
  });
  const [inputValue, setInputValue] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    correctGuesses: 0,
    averageAttempts: 0,
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Multiplayer state
  const [mpState, setMpState] = useState({
    inLobby: false,
    gameId: null,
    lobbyId: null,
    currentSongIndex: 0,
    totalSongs: 0,
    leaderboard: [],
    isMultiplayerGame: false,
    currentGuess: '',
    currentAttempt: 0,
    currentSongComplete: false
  });
  const [socket, setSocket] = useState(null);

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const maxAttempts = 5;
  const snippetProgress = useAudioProgress(audioRef, progressBarRef);

  const playSnippet = useCallback(
    (duration) => {
      if (!audioRef.current || !progressBarRef.current) return;
      snippetProgress.clearProgress();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Ensure volume is set before playing
      audioRef.current.volume = volume;
      progressBarRef.current.style.transition = 'none';
      progressBarRef.current.style.width = '0%';
      progressBarRef.current.offsetWidth; // trigger reflow
      progressBarRef.current.style.transition = 'width 0.05s linear';
      audioRef.current.play().catch(console.error);
      snippetProgress.updateProgress(duration, 0);
    },
    [snippetProgress, volume]
  );

  const getAuthConfig = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }, []);

  useEffect(() => {
    if (user && !socket && state.mode === 'multiplayer') {
      const apiUrl = import.meta.env.VITE_API_URL;
            
      const newSocket = io(apiUrl, {
        auth: {
          token: localStorage.getItem('token')
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
    
      newSocket.on('connect', () => {
                // Setup a heartbeat to detect zombie connections
        const heartbeatInterval = setInterval(() => {
          newSocket.emit('ping', () => {
            // Heartbeat successful
          });
        }, 30000);
        
        newSocket.heartbeatInterval = heartbeatInterval;
      });
      
      newSocket.on('connect_error', (error) => {
                setState(prev => ({ 
          ...prev, 
          feedback: `Connection error: ${error.message}. Please try again.` 
        }));
      });
      
      newSocket.on('disconnect', (reason) => {
                if (newSocket.heartbeatInterval) {
          clearInterval(newSocket.heartbeatInterval);
        }
        
        if (reason === 'io server disconnect') {
          setState(prev => ({ 
            ...prev, 
            feedback: 'You were disconnected by the server. Please log in again.' 
          }));
        } else {
          setState(prev => ({ 
            ...prev, 
            feedback: 'Connection to game server lost. Attempting to reconnect...' 
          }));
          newSocket.connect();
        }
      });
      
      newSocket.on('reconnect', () => {
                setState(prev => ({ 
          ...prev, 
          feedback: 'Reconnected to game server!' 
        }));
      });
      
      newSocket.on('reconnect_error', () => {
        setState(prev => ({ 
          ...prev, 
          feedback: 'Failed to reconnect. Please try again later.' 
        }));
      });
      
      newSocket.on('reconnect_failed', () => {
                setState(prev => ({ 
          ...prev, 
          feedback: 'Failed to reconnect. Please refresh the page.' 
        }));
      });
      
      newSocket.on('error', (data) => {
                setState(prev => ({ ...prev, feedback: data.message }));
      });

      newSocket.on('game-started', (data) => {
                if (data && data.gameId) {
          // extract the first song's preview URL from targetSongs array
          const firstSong = data.targetSongs && data.targetSongs.length > 0 
            ? data.targetSongs[0] 
            : null;
            
          setMpState(prev => ({
            ...prev,
            inLobby: false,
            gameId: data.gameId,
            isMultiplayerGame: true,
            currentAttempt: 0,
            currentSongComplete: false,
            lobbyId: data.lobbyId,
            totalSongs: data.targetSongs?.length || data.totalSongs || prev.totalSongs,
            leaderboard: data.leaderboard || []
          }));

          const songList = [];
          
          // Add songs from songs array if available
          if (data.songs && Array.isArray(data.songs)) {
            data.songs.forEach(song => {
              if (song.name && song.artist) {
                songList.push({
                  id: `${song.name}-${song.artist}`.replace(/\s+/g, '-').toLowerCase(),
                  name: song.name,
                  artist: song.artist
                });
              }
            });
          }
          
          // Add songs from targetSongs array if available and different from songs
          if (data.targetSongs && Array.isArray(data.targetSongs)) {
            data.targetSongs.forEach(song => {
              if (song.name && song.artist) {
                // Check if this song is already in the list
                const exists = songList.some(s => 
                  s.name.toLowerCase() === song.name.toLowerCase() && 
                  s.artist.toLowerCase() === song.artist.toLowerCase()
                );
                
                if (!exists) {
                  songList.push({
                    id: `${song.name}-${song.artist}`.replace(/\s+/g, '-').toLowerCase(),
                    name: song.name,
                    artist: song.artist
                  });
                }
              }
            });
          }
          
          setState(prev => ({
            ...prev,
            songData: { preview_url: firstSong?.preview_url || data.currentPreviewUrl },
            snippetDuration: 1,
            attempt: 0,
            feedback: 'Game started! Listen to the first song.',
            guess: '',
            correctGuess: false,
            history: [],
            recommendedSongs: songList.length > 0 ? songList : prev.recommendedSongs
          }));
          
          // Play the song snippet after a short delay
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.volume = volume;
              playSnippet(1);
            }
          }, 50);
        }
      });
      
      // Listen for leaderboard updates
      newSocket.on('leaderboard-update', (data) => {
                if (data && data.leaderboard) {
          setMpState(prev => ({
            ...prev,
            leaderboard: data.leaderboard
          }));
        }
      });

      setSocket(newSocket);
    }
    
    return () => {
      if (socket) {
                if (socket.heartbeatInterval) {
          clearInterval(socket.heartbeatInterval);
        }
      
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('reconnect');
        socket.off('reconnect_error');
        socket.off('reconnect_failed');
        socket.off('error');
        
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [user, state.mode, socket, playSnippet, volume]);

  useEffect(() => {
    const fetchUserAndStats = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userResponse = await axios.get(
            `${import.meta.env.VITE_API_URL}/auth/me`,
            getAuthConfig()
          );
          setUser(userResponse.data.user);
          const statsResponse = await axios.get(
            `${import.meta.env.VITE_API_URL}/user/stats`,
            getAuthConfig()
          );
          setStats(statsResponse.data);
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
    };
    fetchUserAndStats();
  }, [getAuthConfig]);

  const fetchStats = async () => {
    try {
      const statsResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/user/stats`,
        getAuthConfig()
      );
      setStats(statsResponse.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Filter suggestions based on the current input value
  const filteredSongs = useMemo(() => {
    if (!inputValue) return [];
    return state.recommendedSongs.filter((song) =>
      song.name.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [inputValue, state.recommendedSongs]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Add global escape key handler
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, []);

  const incrementGuess = () => {
    const newDuration = state.snippetDuration * 2;
    const newAttempt = state.attempt + 1;
    setState((prev) => ({
      ...prev,
      snippetDuration: newDuration,
      attempt: newAttempt,
      guess: '',
    }));
    setInputValue('');
    playSnippet(newDuration);
  };

  const startGame = async () => {
    if (state.mode === 'playlist' && !state.playlistUrl) {
      setState((prev) => ({ ...prev, feedback: 'Please enter a playlist URL.' }));
      return;
    }
    
    if (state.mode === 'multiplayer') {
      if (!user) {
        setShowAuth(true);
        setState(prev => ({ ...prev, feedback: 'You need to log in to play multiplayer games.' }));
        return;
      }
      
      setMpState(prev => ({ ...prev, inLobby: true }));
      setState(prev => ({ ...prev, gameStarted: true }));
      return;
    }
    
    try {
      const payload = { mode: state.mode };
      if (state.mode === 'playlist') {
        payload.playlist_url = state.playlistUrl;
      }
      const sessionResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/session`,
        payload,
        getAuthConfig()
      );
      const sessionId = sessionResponse.data.session_id;
      const tracks = sessionResponse.data.tracks;
      const detailsResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/session/${sessionId}`
      );
      const sessionData = detailsResponse.data.session;
      const songData = { preview_url: sessionData.targetPreview };
      setState((prev) => ({
        ...prev,
        sessionId,
        gameStarted: true,
        recommendedSongs: tracks,
        songData,
        history: [],
        correctSong: null,
        snippetDuration: 1,
        attempt: sessionData.attempts,
        guess: '',
        correctGuess: false,
        feedback: '',
      }));
      setInputValue('');
      
      // Add a small delay to ensure the audio element is updated
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.volume = volume;
        }
        playSnippet(1);
      }, 50);
    } catch (error) {
      console.error(error);
      setState((prev) => ({
        ...prev,
        feedback: 'Error starting game. Check your settings.',
      }));
    }
  };

  const nextSong = async () => {
    try {
      // reset audio progress and UI before fetching the next song
      snippetProgress.clearProgress();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (progressBarRef.current) {
        progressBarRef.current.style.transition = 'none';
        progressBarRef.current.style.width = '0%';
      }
  
      if (mpState.isMultiplayerGame) {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/multiplayer/game/${mpState.gameId}/next`,
          getAuthConfig()
        );
        
        if (response.data && response.data.song) {
          setMpState(prev => ({
            ...prev,
            currentSongIndex: prev.currentSongIndex + 1,
            currentSongComplete: false,
            currentAttempt: 0,
            leaderboard: response.data.leaderboard || prev.leaderboard
          }));
          
          setState(prev => ({
            ...prev,
            songData: { preview_url: response.data.song.preview_url },
            snippetDuration: 1,
            correctGuess: false,
            correctSong: null,
            guess: '',
            feedback: 'Listen to the next song!',
            history: []
          }));
          
          // Play the song snippet after a short delay
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.volume = volume;
              playSnippet(1);
            }
          }, 50);
        }
      } else {
        const targetResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/session/${state.sessionId}/next`,
          {},
          getAuthConfig()
        );
        const { track, tracks } = targetResponse.data;
        if (!track) {
          setState((prev) => ({ ...prev, feedback: 'No preview available.' }));
          return;
        }
        
        const songData = { preview_url: track.preview_url };
        setState((prev) => ({
          ...prev,
          recommendedSongs: tracks,
          songData,
          snippetDuration: 1,
          attempt: 0,
          feedback: '',
          guess: '',
          correctGuess: false,
          history: [],
          correctSong: null,
        }));
        
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.volume = volume;
            playSnippet(1);
          }
        }, 50);
      }
    } catch (error) {
      console.error('Error fetching next song:', error);
      setState(prev => ({ 
        ...prev, 
        feedback: mpState.isMultiplayerGame 
          ? 'Error loading next song. Please try again.' 
          : 'Error loading next song.' 
      }));
    }
  };

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      mode: 'playlist',
      gameStarted: false,
      sessionId: null,
      songData: null,
      feedback: '',
      correctSong: null,
      snippetDuration: 1,
      attempt: 0,
      history: [],
      guess: '',
    }));
    
    setMpState({
      inLobby: false,
      gameId: null,
      lobbyId: null,
      currentSongIndex: 0,
      totalSongs: 0,
      leaderboard: [],
      isMultiplayerGame: false,
      currentGuess: '',
      currentAttempt: 0,
      currentSongComplete: false
    });
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const handleGuess = async (e) => {
    e.preventDefault();
    if (!state.songData || state.guess === undefined) return;
    
    // Handle multiplayer guess
    if (mpState.isMultiplayerGame) {
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/multiplayer/game/${mpState.gameId}/guess`,
          { guess: state.guess },
          getAuthConfig()
        );
        
        snippetProgress.clearProgress();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        if (progressBarRef.current) {
          progressBarRef.current.style.transition = 'none';
          progressBarRef.current.style.width = '0%';
        }
        
        const newHistory = [
          ...state.history,
          {
            attempt: mpState.currentAttempt + 1,
            type: 'guess',
            value: state.guess,
            correct: data.correct,
          },
        ];

        if (data.correct) {
          setState((prev) => ({
            ...prev,
            feedback: 'Correct!',
            correctGuess: true,
            correctSong: data.song,
            songData: { preview_url: data.song.preview_url },
            history: newHistory,
          }));
          
          setMpState(prev => ({
            ...prev,
            currentSongComplete: true,
            currentAttempt: 0,
          }));
        } else {
          if (mpState.currentAttempt + 1 >= maxAttempts) {
            setState((prev) => ({
              ...prev,
              feedback: 'Game over! The correct song was not guessed.',
              correctGuess: true,
              correctSong: data.song,
              songData: { preview_url: data.song.preview_url },
              history: newHistory,
            }));
            
            setMpState(prev => ({
              ...prev,
              currentSongComplete: true,
              currentAttempt: 0,
            }));
          } else {
            setState((prev) => ({
              ...prev,
              feedback: 'Incorrect. Try again!',
              history: newHistory,
            }));
            
            // Increment the multiplayer attempt
            setMpState(prev => ({
              ...prev,
              currentAttempt: prev.currentAttempt + 1,
            }));
            
            const newDuration = state.snippetDuration * 2;
            setState(prev => ({
              ...prev,
              snippetDuration: newDuration,
              guess: '',
            }));
            setInputValue('');
            playSnippet(newDuration);
          }
        }
      } catch (error) {
        console.error(error);
        setState((prev) => ({ ...prev, feedback: 'Error processing guess.' }));
      }
      return;
    }
    
    // Regular non-multiplayer guess handling
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/session/${state.sessionId}/guess`,
        { guess: state.guess },
        getAuthConfig()
      );
      snippetProgress.clearProgress();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (progressBarRef.current) {
        progressBarRef.current.style.transition = 'none';
        progressBarRef.current.style.width = '0%';
      }
      const newHistory = [
        ...state.history,
        {
          attempt: state.attempt + 1,
          type: 'guess',
          value: state.guess,
          correct: data.correct,
        },
      ];

      if (data.correct) {
        setState((prev) => ({
          ...prev,
          feedback: data.skipped
            ? 'Game over! The correct song has been revealed.'
            : 'Correct!',
          correctGuess: true,
          correctSong: data.song,
          songData: { preview_url: data.song.preview_url },
          history: newHistory,
        }));
      } else {
        if (state.attempt + 1 >= maxAttempts) {
          setState((prev) => ({
            ...prev,
            feedback: 'Game over! The correct song was not guessed.',
            correctGuess: true,
            correctSong: data.song,
            songData: { preview_url: data.song.preview_url },
            history: newHistory,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            feedback: data.hintLevel
              ? `Hint level increased to ${data.hintLevel}.`
              : 'Incorrect. Try again!',
            history: newHistory,
          }));
          incrementGuess();
        }
      }
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, feedback: 'Error processing guess.' }));
    }
  };

  const handleSkip = async () => {  
    // Handle multiplayer skip
    if (mpState.isMultiplayerGame) {
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/multiplayer/game/${mpState.gameId}/guess`,
          { skip: true },
          getAuthConfig()
        );
        
        snippetProgress.clearProgress();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        if (progressBarRef.current) {
          progressBarRef.current.style.transition = 'none';
          progressBarRef.current.style.width = '0%';
        }
        
        const newHistory = [
          ...state.history,
          { attempt: mpState.currentAttempt + 1, type: 'skip', value: 'Skipped' },
        ];
        
        if (data.gameOver) {
          setState((prev) => ({
            ...prev,
            feedback: 'Game over! The song has been revealed.',
            correctGuess: true,
            correctSong: data.song,
            songData: { preview_url: data.song.preview_url },
            history: newHistory,
          }));
          
          setMpState(prev => ({
            ...prev,
            currentSongComplete: true,
            currentAttempt: 0,
          }));
        } else {
          if (mpState.currentAttempt + 1 >= maxAttempts) {
            setState((prev) => ({
              ...prev,
              feedback: 'Game over! The correct song was not guessed.',
              correctGuess: true,
              correctSong: data.song,
              songData: { preview_url: data.song.preview_url },
              history: newHistory,
            }));
            
            setMpState(prev => ({
              ...prev,
              currentSongComplete: true,
              currentAttempt: 0,
            }));
          } else {
            setState((prev) => ({
              ...prev,
              feedback: 'Skipped.',
              history: newHistory,
            }));
            
            // Increment the multiplayer attempt
            setMpState(prev => ({
              ...prev,
              currentAttempt: prev.currentAttempt + 1,
            }));
            
            const newDuration = state.snippetDuration * 2;
            setState(prev => ({
              ...prev,
              snippetDuration: newDuration,
              guess: '',
            }));
            setInputValue('');
            playSnippet(newDuration);
          }
        }
      } catch (error) {
        console.error(error);
        setState((prev) => ({ ...prev, feedback: 'Error processing skip.' }));
      }
      return;
    }
    
    // Regular non-multiplayer skip handling  
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/session/${state.sessionId}/guess`,
        { skip: true },
        getAuthConfig()
      );
      snippetProgress.clearProgress();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (progressBarRef.current) {
        progressBarRef.current.style.transition = 'none';
        progressBarRef.current.style.width = '0%';
      }
      const newHistory = [
        ...state.history,
        { attempt: state.attempt + 1, type: 'skip', value: 'Skipped' },
      ];
      if (data.correct) {
        setState((prev) => ({
          ...prev,
          feedback: 'Game over! The song has been revealed.',
          correctGuess: true,
          correctSong: data.song,
          songData: { preview_url: data.song.preview_url },
          history: newHistory,
        }));
      } else {
        if (state.attempt + 1 >= maxAttempts) {
          setState((prev) => ({
            ...prev,
            feedback: 'Game over! The correct song was not guessed.',
            correctGuess: true,
            correctSong: data.song,
            songData: { preview_url: data.song.preview_url },
            history: newHistory,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            feedback: data.hintLevel
              ? `Hint level increased to ${data.hintLevel}.`
              : 'Skipped.',
            history: newHistory,
          }));
          incrementGuess();
        }
      }
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, feedback: 'Error processing skip.' }));
    }
  };

  const handleProfileClick = async () => {
    if (user) {
      await fetchStats();
    }
    setShowAuth(true);
  };
  
  // Update the setGameState function to properly handle API responses
  const setGameState = useCallback((gameState) => {
    if (gameState.gameStarted) {
      setMpState(prev => ({
        ...prev,
        inLobby: false,
        gameId: gameState.gameId || prev.gameId,
        isMultiplayerGame: true,
        currentAttempt: 0,
        currentSongComplete: false,
        lobbyId: gameState.lobbyId || prev.lobbyId,
        totalSongs: gameState.totalSongs || prev.totalSongs,
        leaderboard: gameState.leaderboard || prev.leaderboard
      }));
      
      if (gameState.currentPreviewUrl) {
        setState(prev => ({
          ...prev,
          songData: { preview_url: gameState.currentPreviewUrl },
          snippetDuration: 1,
          attempt: 0,
          feedback: 'Game started! Listen to the first song.',
          guess: '',
          correctGuess: false,
          history: []
        }));
        
        setTimeout(() => {
          playSnippet(1);
        }, 50);
      }
    }
  }, [playSnippet]);

  // Add a new useEffect to handle audio element updates
  useEffect(() => {
    if (audioRef.current && state.songData) {
      audioRef.current.volume = volume;
    }
  }, [state.songData, volume]);

  // Add this ref for the input anchor
  const inputAnchorRef = useRef(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-space-900 to-stone-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute w-96 h-96 bg-gradient-to-r from-amber-500/20 to-purple-500/20 rounded-full blur-3xl -top-32 -left-32 animate-pulse-slow"></div>
        <div className="absolute w-96 h-96 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-full blur-3xl -bottom-32 -right-32 animate-pulse-slow delay-1000"></div>
      </div>
  
      <button
        onClick={handleProfileClick}
        className="fixed top-4 right-4 p-2.5 rounded-full bg-white/5 backdrop-blur-lg hover:bg-white/10 border border-white/10 transition-all duration-300 shadow-lg hover:shadow-xl z-50 group"
      >
        {user ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-amber-400 group-hover:text-amber-300 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-amber-400 group-hover:text-amber-300 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
          </svg>
        )}
      </button>
  
      {showAuth && (
        <AuthProfile
          user={user}
          setUser={setUser}
          stats={stats}
          onClose={() => setShowAuth(false)}
        />
      )}
  
      <div className="w-full max-w-lg mx-auto bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl shadow-2xl p-5 md:p-6 relative z-10 backdrop-blur-xl border border-white/10 overflow-y-auto max-h-[85vh]">
        <h1 className="text-3xl md:text-4xl font-black text-center mb-4 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500">
          Trackdle
          <span className="text-sm md:text-base block mt-1 font-normal text-amber-200/80">
            Music Guessing Game
          </span>
        </h1>
  
        {!state.gameStarted ? (
          <GameSetup state={state} setState={setState} startGame={startGame} user={user} />
        ) : mpState.inLobby ? (
          <MultiplayerLobby 
            user={user}
            onBack={handleBack}
            socket={socket}
            setGameState={setGameState}
          />
        ) : (
          <>
            {!state.songData ? (
              <div className="text-center py-8 text-gray-400">Loading track...</div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                {state.feedback && (
                  <div className={`p-4 rounded-xl text-sm md:text-base backdrop-blur ${
                    state.feedback.includes('Correct') || state.feedback.includes('started')
                      ? 'bg-green-500/10 text-green-400 border border-green-400/20'
                      : state.feedback.includes('Error') || state.feedback.includes('over')
                      ? 'bg-red-500/10 text-red-400 border border-red-400/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-400/20'
                  }`}>
                    {state.feedback}
                  </div>
                )}
  
                {mpState.isMultiplayerGame && (
                  <div className="bg-gray-700/30 p-3 md:p-4 rounded-xl border border-white/10 backdrop-blur">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">
                        Song {mpState.currentSongIndex + 1} of {mpState.totalSongs}
                      </span>
                      {mpState.currentSongComplete && (
                        <span className="text-green-400 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Song completed
                        </span>
                      )}
                    </div>
                  </div>
                )}
  
                {!state.correctGuess && !mpState.currentSongComplete ? (
                  <div className="space-y-4 md:space-y-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="text-gray-400 text-sm">
                        Attempt {mpState.isMultiplayerGame ? mpState.currentAttempt + 1 : state.attempt + 1} of {maxAttempts}
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-24 md:w-32 h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer"
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (audioRef.current) {
                              if (audioRef.current.paused) {
                                playSnippet(state.snippetDuration);
                              } else {
                                audioRef.current.pause();
                                snippetProgress.clearProgress();
                              }
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl text-gray-300 transition-all border border-white/10 text-sm"
                        >
                          {audioRef.current && !audioRef.current.paused ? (
                            <>
                              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4h4v16H6zm8 0h4v16h-4z"/>
                              </svg>
                              Pause
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              Play {state.snippetDuration}s
                            </>
                          )}
                        </button>
                      </div>
                    </div>
  
                    <audio 
                      ref={audioRef} 
                      src={state.songData.preview_url} 
                      preload="auto"
                      onLoadedMetadata={() => {
                        if (audioRef.current) {
                          audioRef.current.volume = volume;
                        }
                      }}
                    />
  
                    <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur">
                      <div
                        ref={progressBarRef}
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-75"
                      />
                    </div>
  
                    <form onSubmit={handleGuess} className="relative">
                      <Downshift
                        onChange={(selectedItem) => {
                          if (selectedItem) {
                            setInputValue(selectedItem.name);
                            setState((prev) => ({ ...prev, guess: selectedItem.name }));
                          }
                        }}
                        inputValue={inputValue}
                        onInputValueChange={(value) => {
                          setInputValue(value);
                          setState((prev) => ({ ...prev, guess: value }));
                        }}
                        isOpen={isDropdownOpen}
                        onOuterClick={() => setIsDropdownOpen(false)}
                        onStateChange={(changes) => {
                          if (Object.prototype.hasOwnProperty.call(changes, 'isOpen')) {
                            setIsDropdownOpen(changes.isOpen);
                          }
                          if (changes.type === Downshift.stateChangeTypes.keyDownEscape) {
                            setIsDropdownOpen(false);
                          }
                        }}
                        itemToString={(item) => (item ? item.name : '')}
                      >
                        {({
                          getInputProps,
                          getItemProps,
                          isOpen,
                          highlightedIndex,
                        }) => (
                          <div className="relative">
                            <input
                              ref={inputAnchorRef}
                              {...getInputProps({
                                placeholder: 'Guess the song...',
                                className: "w-full px-4 py-3 rounded-xl bg-gray-700/30 border border-white/10 focus:border-amber-400/50 focus:ring-4 focus:ring-amber-400/20 text-white placeholder-gray-400 backdrop-blur-sm transition-all text-sm md:text-base",
                                onFocus: () => {
                                  if (inputValue && filteredSongs.length > 0) {
                                    setIsDropdownOpen(true);
                                  }
                                },
                              })}
                            />
                            {/* Portal-based dropdown */}
                            <DropdownMenuPortal
                              anchorRef={inputAnchorRef}
                              isOpen={isOpen && filteredSongs.length > 0}
                              className="bg-gray-800/90 rounded-xl overflow-hidden shadow-lg max-h-40 md:max-h-48 overflow-y-auto backdrop-blur-lg border border-white/10"
                            >
                              {filteredSongs.map((song, index) => (
                                <li
                                  {...getItemProps({
                                    key: song.id,
                                    index,
                                    item: song,
                                    className: `px-4 py-3 cursor-pointer border-t border-white/10 first:border-t-0 transition-colors ${
                                      highlightedIndex === index ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'
                                    }`,
                                  })}
                                >
                                  <div className="text-gray-100">{song.name}</div>
                                  <div className="text-sm text-gray-400">{song.artist}</div>
                                </li>
                              ))}
                            </DropdownMenuPortal>
                          </div>
                        )}
                      </Downshift>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          type="button"
                          onClick={handleSkip}
                          className="py-2.5 px-4 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-xl transition-all border border-white/10 hover:border-amber-400/30 text-sm md:text-base"
                        >
                          Skip
                        </button>
                        <button
                          type="submit"
                          className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-amber-500/20 text-sm md:text-base"
                        >
                          Submit
                        </button>
                      </div>
                    </form>
                    {state.history.length > 0 && !mpState.isMultiplayerGame && <GuessHistory history={state.history} />}
                  </div>
                ) : (
                  <>
                    {state.correctSong && (
                      <>
                        <audio ref={audioRef} src={state.songData.preview_url} preload="auto" />
                        <SongPreview
                          correctSong={state.correctSong}
                          audioRef={audioRef}
                          fullProgressBarRef={progressBarRef}
                        />
                        <button
                          onClick={state.mode === 'daily' ? handleBack : nextSong}
                          className="w-full py-3 md:py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-amber-500/20"
                        >
                          {state.mode === 'daily' ? 'Back' : 'Next Song'}
                        </button>
                      </>
                    )}
                  </>
                )}
                
                {mpState.isMultiplayerGame && mpState.leaderboard && mpState.leaderboard.length > 0 && (
                  <div className="mt-6 md:mt-8">
                    <h3 className="text-sm md:text-base text-amber-400 mb-4">Leaderboard</h3>
                    <div className="space-y-2">
                      {mpState.leaderboard.map((player, idx) => (
                        <div key={player.email || idx} className="flex justify-between items-center bg-gray-700/30 p-4 rounded-xl border border-white/10 hover:border-amber-400/30 transition-colors">
                          <span className="text-gray-200">{player.email}</span>
                          <span className="text-amber-400 font-medium flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {player.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

GameSetup.propTypes = {
  state: PropTypes.object.isRequired,
  setState: PropTypes.func.isRequired,
  startGame: PropTypes.func.isRequired,
  user: PropTypes.object
};

export default App;
