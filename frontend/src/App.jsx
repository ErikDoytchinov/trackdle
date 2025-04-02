import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';
import debounce from 'lodash.debounce';
import GameSetup from './components/GameSetup';
import GuessHistory from './components/GuessHistory';
import SongPreview from './components/SongPreview';
import useAudioProgress from './hooks/useAudioProgress';
import AuthProfile from './components/AuthProfile';

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    correctGuesses: 0,
    averageAttempts: 0,
  });

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const maxAttempts = 5;
  const snippetProgress = useAudioProgress(audioRef, progressBarRef);

  // Helper to get axios configuration for authenticated requests
  const getAuthConfig = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }, []);

  // Fetch user info and stats on component mount
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
        } catch (err) {
          localStorage.removeItem('token');
        }
      }
    };
    fetchUserAndStats();
  }, [getAuthConfig]);

  // Function to refetch stats when profile icon is clicked
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

  const debouncedSetGuess = useCallback(
    debounce((value) => {
      setState((prev) => ({ ...prev, guess: value }));
    }, 300),
    []
  );

  const filteredSongs = useMemo(() => {
    if (!state.guess) return [];
    return state.recommendedSongs.filter((song) =>
      song.name.toLowerCase().includes(state.guess.toLowerCase())
    );
  }, [state.guess, state.recommendedSongs]);

  const playSnippet = useCallback(
    (duration) => {
      if (!audioRef.current || !progressBarRef.current) return;
      snippetProgress.clearProgress();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      progressBarRef.current.style.transition = 'none';
      progressBarRef.current.style.width = '0%';
      progressBarRef.current.offsetWidth;
      progressBarRef.current.style.transition = 'width 0.05s linear';
      audioRef.current.play().catch(console.error);
      snippetProgress.updateProgress(duration, 0);
    },
    [snippetProgress]
  );

  // This helper now only increases the attempt count and snippet duration.
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
      playSnippet(1);
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
      const targetResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/session/${state.sessionId}/next`,
        {},
        getAuthConfig()
      );
      const targetTrack = targetResponse.data.track;
      if (!targetTrack) {
        setState((prev) => ({ ...prev, feedback: 'No preview available.' }));
        return;
      }
      const songData = { preview_url: targetTrack.preview_url };
      setState((prev) => ({
        ...prev,
        songData,
        snippetDuration: 1,
        attempt: 0,
        feedback: '',
        guess: '',
        correctGuess: false,
        history: [],
        correctSong: null,
      }));
      setInputValue('');
      playSnippet(1);
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, feedback: 'Error loading next song.' }));
    }
  };

  const handleGuess = async (e) => {
    e.preventDefault();
    if (!state.songData || state.guess === undefined) return;
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

      // If the backend signals that the game is over (correct song returned)
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
        // If this guess was incorrect and we're at our last attempt, update state with song data from backend.
        if (state.attempt + 1 >= maxAttempts) {
          setState((prev) => ({
            ...prev,
            feedback: 'Game over! The correct song was not guessed.',
            correctGuess: true,
            correctSong: data.song, // ensure the correct song info is saved
            songData: { preview_url: data.song.preview_url }, // update the preview URL
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

  const handleSuggestionClick = (songName) => {
    setInputValue(songName);
    setState((prev) => ({ ...prev, guess: songName }));
    setShowSuggestions(false);
  };

  // Handle profile icon click:
  // If user is logged in, fetch stats before opening the auth modal.
  const handleProfileClick = async () => {
    if (user) {
      await fetchStats();
    }
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <button
        onClick={handleProfileClick}
        className="fixed top-4 right-4 p-2.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md z-50 group"
      >
        {user ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 group-hover:scale-110 transition-transform"
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
            className="w-5 h-5 group-hover:scale-110 transition-transform"
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
      <div className="w-full max-w-lg bg-slate-800 rounded-2xl shadow-xl p-6 relative z-10">
        <h1 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
          Trackdle
        </h1>
        {!state.gameStarted ? (
          <GameSetup state={state} setState={setState} startGame={startGame} />
        ) : (
          <>
            {!state.songData ? (
              <div className="text-center py-8 text-slate-400">Loading track...</div>
            ) : (
              <div className="space-y-6">
                {!state.correctGuess ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-slate-400 text-sm">
                        Attempt {state.attempt + 1} of {maxAttempts}
                      </div>
                      <button
                        onClick={() => playSnippet(state.snippetDuration)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-md text-slate-300 hover:bg-slate-600 transition-colors"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Play {state.snippetDuration}s
                      </button>
                    </div>
                    <audio ref={audioRef} src={state.songData.preview_url} preload="auto" />
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        ref={progressBarRef}
                        className="h-full bg-amber-400 rounded-full transition-all duration-75"
                      />
                    </div>
                    <form onSubmit={handleGuess} className="relative">
                      <input
                        type="text"
                        placeholder="Guess the song..."
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          debouncedSetGuess(e.target.value);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveSuggestion((prev) =>
                              Math.min(prev + 1, filteredSongs.length - 1)
                            );
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveSuggestion((prev) => Math.max(prev - 1, 0));
                          } else if (e.key === 'Enter') {
                            if (showSuggestions && filteredSongs.length > 0) {
                              e.preventDefault();
                              handleSuggestionClick(filteredSongs[activeSuggestion].name);
                            }
                          }
                        }}
                        aria-autocomplete="list"
                        aria-controls="suggestion-list"
                        className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white transition-all"
                      />
                      {showSuggestions && filteredSongs.length > 0 && (
                        <ul
                          id="suggestion-list"
                          className="absolute z-20 w-full mt-2 bg-slate-700 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto"
                          role="listbox"
                        >
                          {filteredSongs.map((song, index) => (
                            <li
                              key={song.id}
                              onClick={() => handleSuggestionClick(song.name)}
                              className={`px-4 py-2 cursor-pointer border-t border-slate-600 first:border-t-0 transition-colors ${
                                index === activeSuggestion
                                  ? 'bg-slate-600'
                                  : 'hover:bg-slate-600'
                              }`}
                              role="option"
                              aria-selected={index === activeSuggestion}
                            >
                              <div className="text-white">{song.name}</div>
                              <div className="text-sm text-slate-400">{song.artist}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </form>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleSkip}
                        className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        type="submit"
                        onClick={handleGuess}
                        className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors"
                      >
                        Submit
                      </button>
                    </div>
                    {state.history.length > 0 && <GuessHistory history={state.history} />}
                  </div>
                ) : (
                  <>
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        state.feedback.includes('Correct')
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {state.feedback}
                    </div>
                    {state.correctSong && (
                      <>
                        <audio ref={audioRef} src={state.songData.preview_url} preload="auto" />
                        <SongPreview
                          correctSong={state.correctSong}
                          audioRef={audioRef}
                          fullProgressBarRef={progressBarRef}
                        />
                        <button
                          onClick={nextSong}
                          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
                        >
                          Next Song
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
