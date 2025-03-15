import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

// Custom hook for audio progress management
const useAudioProgress = (audioRef, progressBarRef) => {
  const animationFrameRef = useRef(null);

  const clearProgress = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const updateProgress = useCallback((duration) => {
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const percent = Math.min(100, (elapsed / duration) * 100);
      
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${percent}%`;
      }

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [audioRef, progressBarRef]);

  useEffect(() => {
    return () => clearProgress();
  }, [clearProgress]);

  return { clearProgress, updateProgress };
};

// Sub-components
const PlaylistInput = ({ state, setState, startGame }) => (
  <div className="space-y-6">
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Enter Spotify playlist URL..."
        value={state.playlistUrl}
        onChange={(e) => setState(prev => ({ ...prev, playlistUrl: e.target.value }))}
        className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white placeholder-slate-400 transition-all"
      />
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

const GuessHistory = ({ history }) => (
  <div className="bg-slate-700/50 p-4 rounded-lg">
    <h3 className="text-sm text-slate-400 mb-2">Previous guesses:</h3>
    <div className="space-y-2">
      {history.map((entry) => (
        <div 
          key={entry.attempt}
          className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-md"
        >
          <span className="text-sm text-slate-300">
            {entry.type === 'skip' ? 'Skipped' : entry.value}
          </span>
          <span className="text-xs text-slate-500">
            Attempt {entry.attempt}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const SongPreview = ({ correctSong, audioRef, fullProgressBarRef }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="text-center space-y-6">
      <div className="inline-block">
        <img
          src={correctSong.album_cover}
          alt={correctSong.name}
          className="w-48 h-48 rounded-xl object-cover mx-auto shadow-lg border border-slate-600"
        />
        <div className="mt-4 space-y-1">
          <h2 className="text-xl font-semibold text-white">{correctSong.name}</h2>
          <p className="text-slate-400">{correctSong.artist}</p>
        </div>
      </div>
      
      <div className="bg-slate-700 p-4 rounded-lg space-y-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={togglePlayback}
            className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5 fill-current text-slate-900" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 fill-current text-slate-900" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <div className="flex-1 space-y-2">
            <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
              <div 
                ref={fullProgressBarRef}
                className="h-full bg-amber-400 rounded-full transition-all duration-75"
                style={{ width: '0%' }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>
                {new Date(audioRef.current?.currentTime * 1000 || 0).toISOString().substr(14, 5)}
              </span>
              <span>
                -{new Date((audioRef.current?.duration - audioRef.current?.currentTime) * 1000 || 0).toISOString().substr(14, 5)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component
const App = () => {
  const [state, setState] = useState({
    playlistUrl: '',
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

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const fullProgressBarRef = useRef(null);
  const maxAttempts = 5;

  const snippetProgress = useAudioProgress(audioRef, progressBarRef);
  const fullProgress = useAudioProgress(audioRef, fullProgressBarRef);

  const playSnippet = useCallback((duration) => {
    if (!audioRef.current || !progressBarRef.current) return;

    snippetProgress.clearProgress();
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    progressBarRef.current.style.transition = 'none';
    progressBarRef.current.style.width = '0%';
    progressBarRef.current.offsetWidth; // Force reflow
    progressBarRef.current.style.transition = 'width 0.05s linear';

    audioRef.current.play().catch(console.error);
    snippetProgress.updateProgress(duration);
  }, [snippetProgress]);

  const startGame = async () => {
    if (!state.playlistUrl) {
      setState(prev => ({ ...prev, feedback: 'Please enter a playlist URL.' }));
      return;
    }

    try {
      const playlistResponse = await axios.get(`${import.meta.env.VITE_API_URL}/playlist`, {
        params: { url: state.playlistUrl },
      });

      const tracks = playlistResponse.data.tracks || [];
      if (!tracks.length) {
        setState(prev => ({ ...prev, feedback: 'No tracks found in the playlist.' }));
        return;
      }

      const targetResponse = await axios.post(`${import.meta.env.VITE_API_URL}/target`, { tracks });
      const targetTrack = targetResponse.data.track;

      if (!targetTrack) {
        setState(prev => ({ ...prev, feedback: 'No tracks with previews available.' }));
        return;
      }

      setState(prev => ({
        ...prev,
        gameStarted: true,
        recommendedSongs: tracks,
        songData: targetTrack,
        history: [],
        correctSong: null,
        snippetDuration: 1,
        attempt: 0,
        guess: '',
        correctGuess: false,
        feedback: '',
      }));

      playSnippet(1);
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, feedback: 'Error starting game. Check the playlist URL.' }));
    }
  };

  const handleGuess = async (e) => {
    e.preventDefault();
    if (!state.songData || !state.guess) return;

    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/guess`, {
        songId: state.songData.id,
        guess: state.guess,
      });

      const newHistory = [...state.history, {
        attempt: state.attempt + 1,
        type: 'guess',
        value: state.guess,
        correct: data.correct
      }];

      if (data.correct) {
        setState(prev => ({
          ...prev,
          feedback: 'Correct!',
          correctGuess: true,
          correctSong: data.song,
          history: newHistory,
        }));
      } else {
        setState(prev => ({
          ...prev,
          feedback: 'Incorrect. Try again!',
          history: newHistory,
        }));
        incrementGuess();
      }
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, feedback: 'Error processing guess.' }));
    }
  };

  const incrementGuess = () => {
    const newDuration = state.snippetDuration * 2;
    const newAttempt = state.attempt + 1;

    setState(prev => ({
      ...prev,
      snippetDuration: newDuration,
      attempt: newAttempt,
      guess: '',
    }));

    if (newAttempt < maxAttempts) {
      playSnippet(newDuration);
    } else {
      setState(prev => ({
        ...prev,
        feedback: `Game over! The song was "${prev.songData.name}" by ${prev.songData.artist}.`,
        correctGuess: true,
        correctSong: prev.songData,
      }));
    }
  };

  const handleSkip = () => {
    setState(prev => ({
      ...prev,
      history: [...prev.history, {
        attempt: prev.attempt + 1,
        type: 'skip',
        value: 'Skipped'
      }],
      feedback: '',
    }));
    incrementGuess();
  };

  const handleSuggestionClick = (songName) => {
    setState(prev => ({ ...prev, guess: songName }));
  };

  const nextSong = async () => {
    try {
      const targetResponse = await axios.post(`${import.meta.env.VITE_API_URL}/target`, { 
        tracks: state.recommendedSongs 
      });
      const targetTrack = targetResponse.data.track;

      if (!targetTrack) {
        setState(prev => ({ ...prev, feedback: "No tracks with previews available." }));
        return;
      }

      setState(prev => ({
        ...prev,
        songData: targetTrack,
        snippetDuration: 1,
        attempt: 0,
        feedback: '',
        guess: '',
        correctGuess: false,
        history: [],
        correctSong: null,
      }));

      playSnippet(1);
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, feedback: "Error loading next song." }));
    }
  };

  const filteredSongs = state.guess
    ? state.recommendedSongs.filter(song =>
        song.name.toLowerCase().includes(state.guess.toLowerCase()) &&
        song.name.toLowerCase() !== state.guess.toLowerCase()
      )
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-lg bg-slate-800 rounded-2xl shadow-xl p-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
          Trackdle
        </h1>

        {!state.gameStarted ? (
          <PlaylistInput state={state} setState={setState} startGame={startGame} />
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
                          <path d="M8 5v14l11-7z"/>
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
                        value={state.guess}
                        onChange={(e) => setState(prev => ({ ...prev, guess: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white placeholder-slate-400 transition-all"
                      />
                      {filteredSongs.length > 0 && (
                        <ul className="absolute z-10 w-full mt-2 bg-slate-700 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                          {filteredSongs.map((song) => (
                            <li
                              key={song.id}
                              onClick={() => handleSuggestionClick(song.name)}
                              className="px-4 py-2 cursor-pointer hover:bg-slate-600 transition-colors border-t border-slate-600 first:border-t-0"
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
                    <div className={`p-3 rounded-lg text-sm ${
                      state.feedback.includes('Correct') 
                        ? 'bg-green-500/10 text-green-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {state.feedback}
                    </div>

                    {state.correctSong && (
                      <>
                        <SongPreview 
                          correctSong={state.correctSong} 
                          audioRef={audioRef}
                          fullProgressBarRef={fullProgressBarRef}
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