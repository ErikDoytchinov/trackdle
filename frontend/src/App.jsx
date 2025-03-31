import React, { useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import debounce from 'lodash.debounce';
import GameSetup from './components/GameSetup';
import GuessHistory from './components/GuessHistory';
import SongPreview from './components/SongPreview';
import useAudioProgress from './hooks/useAudioProgress';

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

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const maxAttempts = 5;
  const snippetProgress = useAudioProgress(audioRef, progressBarRef);

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
    if (newAttempt < maxAttempts) {
      playSnippet(newDuration);
    } else {
      setState((prev) => ({
        ...prev,
        feedback: `Game over! The correct song was not guessed.`,
        correctGuess: true,
      }));
    }
  };

  // Updated startGame to send the mode along with the playlist URL (if needed)
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
        payload
      );
      const sessionId = sessionResponse.data.session_id;
      const tracks = sessionResponse.data.tracks;
      const detailsResponse = await axios.get(`${import.meta.env.VITE_API_URL}/session/${sessionId}`);
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

  // Updated nextSong function that calls the /next endpoint.
  // This function now works with both "playlist" and "random" modes.
  const nextSong = async () => {
    try {
      const targetResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/session/${state.sessionId}/next`
      );
      const targetTrack = targetResponse.data.track;
      if (!targetTrack) {
        setState((prev) => ({ ...prev, feedback: 'No preview available.' }));
        return;
      }
      // Update the session state with the new target preview
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
        { guess: state.guess }
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
        { attempt: state.attempt + 1, type: 'guess', value: state.guess, correct: data.correct },
      ];
      if (data.correct) {
        setState((prev) => ({
          ...prev,
          feedback: 'Correct!',
          correctGuess: true,
          correctSong: data.song,
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
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, feedback: 'Error processing guess.' }));
    }
  };

  const handleSkip = async () => {
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/session/${state.sessionId}/guess`,
        { skip: true }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-lg bg-slate-800 rounded-2xl shadow-xl p-6">
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
                      <div ref={progressBarRef} className="h-full bg-amber-400 rounded-full transition-all duration-75" />
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
                          className="absolute z-10 w-full mt-2 bg-slate-700 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto"
                          role="listbox"
                        >
                          {filteredSongs.map((song, index) => (
                            <li
                              key={song.id}
                              onClick={() => handleSuggestionClick(song.name)}
                              className={`px-4 py-2 cursor-pointer border-t border-slate-600 first:border-t-0 transition-colors ${
                                index === activeSuggestion ? 'bg-slate-600' : 'hover:bg-slate-600'
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
                        <SongPreview correctSong={state.correctSong} audioRef={audioRef} fullProgressBarRef={progressBarRef} />
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
