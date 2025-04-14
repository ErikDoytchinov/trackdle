import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';
import Downshift from 'downshift';
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
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    correctGuesses: 0,
    averageAttempts: 0,
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const maxAttempts = 5;
  const snippetProgress = useAudioProgress(audioRef, progressBarRef);

  const getAuthConfig = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }, []);

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
    [snippetProgress, volume] // Add volume as a dependency
  );

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
      setInputValue('');
      
      // ensure DOM has updated before playing snippet
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.volume = volume;
        }
        playSnippet(1);
      }, 50);
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, feedback: 'Error loading next song.' }));
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

  // Add a new useEffect to handle audio element updates
  useEffect(() => {
    if (audioRef.current && state.songData) {
      audioRef.current.volume = volume;
    }
  }, [state.songData, volume]);

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
          <GameSetup state={state} setState={setState} startGame={startGame} user={user} />
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
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                        <svg 
                          className="w-6 h-6 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M14.25 10.75a1.5 1.5 0 010 2.122"
                          />
                        </svg>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-24 h-1 bg-slate-600 rounded-full appearance-none cursor-pointer range-sm [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-slate-900"
                        />
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
                    </div>
                    <audio ref={audioRef} src={state.songData.preview_url} preload="auto" />
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        ref={progressBarRef}
                        className="h-full bg-amber-400 rounded-full transition-all duration-75"
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
                          if (changes.hasOwnProperty('isOpen')) {
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
                          getMenuProps,
                          isOpen,
                          highlightedIndex,
                        }) => (
                          <div className="relative">
                            <input
                              {...getInputProps({
                                placeholder: 'Guess the song...',
                                className:
                                  'w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white transition-all',
                                onFocus: () => {
                                  if (inputValue && filteredSongs.length > 0) {
                                    setIsDropdownOpen(true);
                                  }
                                },
                              })}
                            />
                            <ul
                              {...getMenuProps()}
                              className="absolute z-20 w-full mt-2 bg-slate-700 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto"
                            >
                              {isOpen &&
                                filteredSongs.map((song, index) => (
                                  <li
                                    {...getItemProps({
                                      key: song.id,
                                      index,
                                      item: song,
                                      className: `px-4 py-2 cursor-pointer border-t border-slate-600 first:border-t-0 transition-colors ${
                                        highlightedIndex === index ? 'bg-slate-600' : 'hover:bg-slate-600'
                                      }`,
                                    })}
                                  >
                                    <div className="text-white">{song.name}</div>
                                    <div className="text-sm text-slate-400">{song.artist}</div>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </Downshift>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          type="button"
                          onClick={handleSkip}
                          className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                        >
                          Skip
                        </button>
                        <button
                          type="submit"
                          className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors"
                        >
                          Submit
                        </button>
                      </div>
                    </form>
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
                          onClick={state.mode === 'daily' ? handleBack : nextSong}
                          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
                        >
                          {state.mode === 'daily' ? 'Back' : 'Next Song'}
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
