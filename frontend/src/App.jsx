import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

function App() {
  // State variables
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [songData, setSongData] = useState(null);
  const [recommendedSongs, setRecommendedSongs] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [snippetDuration, setSnippetDuration] = useState(1);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [correctGuess, setCorrectGuess] = useState(false);
  const [history, setHistory] = useState([]);
  const [correctSong, setCorrectSong] = useState(null);
  const [, forceUpdate] = useState();
  const maxAttempts = 5;

  // Refs
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const progressAnimationFrameRef = useRef(null);
  const fullProgressBarRef = useRef(null);
  const fullProgressAnimationRef = useRef(null);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(progressAnimationFrameRef.current);
      cancelAnimationFrame(fullProgressAnimationRef.current);
    };
  }, []);

  const clearProgressAnimation = () => {
    if (progressAnimationFrameRef.current) {
      cancelAnimationFrame(progressAnimationFrameRef.current);
      progressAnimationFrameRef.current = null;
    }
  };

  const playSnippet = useCallback((duration) => {
    if (audioRef.current && progressBarRef.current) {
      clearProgressAnimation();
      
      // Reset progress bar
      progressBarRef.current.style.transition = 'none';
      progressBarRef.current.style.width = '0%';
      progressBarRef.current.offsetWidth; // Force reflow
      progressBarRef.current.style.transition = 'width 0.05s linear';

      // Reset audio
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      // Start playback
      audioRef.current.play().catch(console.error);
      const startTime = Date.now();

      const updateProgress = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const percent = Math.min(100, (elapsed / duration) * 100);
        progressBarRef.current.style.width = `${percent}%`;
        if (elapsed < duration) {
          progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
        } else {
          progressBarRef.current.style.width = '100%';
          audioRef.current.pause();
        }
      };

      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const updateFullProgress = useCallback(() => {
    if (audioRef.current && fullProgressBarRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      fullProgressBarRef.current.style.width = `${progress}%`;
      fullProgressAnimationRef.current = requestAnimationFrame(updateFullProgress);
    }
  }, []);

  const startGame = async () => {
    if (!playlistUrl) {
      setFeedback('Please enter a playlist URL.');
      return;
    }
    
    try {
      setHistory([]);
      setCorrectSong(null);
      setFeedback('');

      const playlistResponse = await axios.get('/playlist', {
        params: { url: playlistUrl },
      });
      const tracks = playlistResponse.data.tracks || [];
      
      if (!tracks.length) {
        setFeedback('No tracks found in the playlist.');
        return;
      }

      setRecommendedSongs(tracks);
      const targetResponse = await axios.post('/target', { tracks });
      const targetTrack = targetResponse.data.track;

      if (!targetTrack) {
        setFeedback("Could not find a track with a preview. Try another playlist.");
        return;
      }

      setSongData(targetTrack);
      setGameStarted(true);
      setSnippetDuration(1);
      setAttempt(0);
      setGuess('');
      setCorrectGuess(false);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      playSnippet(1);
    } catch (error) {
      console.error(error);
      setFeedback('Error starting game. Check the playlist URL.');
    }
  };

  const handleGuess = async (e) => {
    e.preventDefault();
    if (!songData || !guess) return;

    try {
      const { data } = await axios.post('/guess', {
        songId: songData.id,
        guess,
      });

      setHistory(prev => [...prev, {
        attempt: attempt + 1,
        type: 'guess',
        value: guess,
        correct: data.correct
      }]);

      if (data.correct) {
        setFeedback('Correct!');
        setCorrectGuess(true);
        setCorrectSong(data.song);
      } else {
        setFeedback('Incorrect. Try again!');
        incrementGuess();
      }
    } catch (error) {
      console.error(error);
      setFeedback('Error processing guess.');
    }
  };

  const incrementGuess = () => {
    setSnippetDuration(prev => prev * 2);
    setAttempt(prev => prev + 1);
    
    if (attempt + 1 < maxAttempts) {
      playSnippet(snippetDuration * 2);
    } else {
      setFeedback(`Game over! The song was "${songData.name}" by ${songData.artist}.`);
      setCorrectGuess(true);
      setCorrectSong(songData);
    }
  };

  const handleSkip = () => {
    setHistory(prev => [...prev, {
      attempt: attempt + 1,
      type: 'skip',
      value: 'Skipped'
    }]);
    setFeedback('');
    incrementGuess();
  };

  const handleSuggestionClick = (songName) => {
    setGuess(songName);
    // Force close the dropdown by filtering the suggestions
    forceUpdate({}); // Not strictly necessary, but ensures a re-render
  };

  const nextSong = async () => {
    try {
      setHistory([]);
      setCorrectSong(null);
      const targetResponse = await axios.post('/target', { tracks: recommendedSongs });
      const targetTrack = targetResponse.data.track;

      if (!targetTrack) {
        setFeedback("No tracks with previews available.");
        return;
      }

      setSongData(targetTrack);
      setSnippetDuration(1);
      setAttempt(0);
      setFeedback('');
      setGuess('');
      setCorrectGuess(false);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      playSnippet(1);
    } catch (error) {
      console.error(error);
      setFeedback("Error loading next song.");
    }
  };

  const filteredSongs = guess
    ? recommendedSongs.filter(song =>
        song.name.toLowerCase().includes(guess.toLowerCase()) &&
        song.name.toLowerCase() !== guess.toLowerCase()
      )
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-800 rounded-2xl shadow-xl p-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
          Trackdle
        </h1>

        {!gameStarted ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter Spotify playlist URL..."
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white placeholder-slate-400 transition-all"
              />
              <button
                onClick={startGame}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
              >
                Start Game
              </button>
            </div>
            {feedback && <p className="text-red-400 text-sm">{feedback}</p>}
          </div>
        ) : (
          <>
            {!songData ? (
              <div className="text-center py-8 text-slate-400">Loading track...</div>
            ) : (
              <div className="space-y-6">
                {!correctGuess && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-slate-400 text-sm">
                        Attempt {attempt + 1} of {maxAttempts}
                      </div>
                      <button
                        onClick={() => playSnippet(snippetDuration)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-md text-slate-300 hover:bg-slate-600 transition-colors"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                        Play {snippetDuration}s
                      </button>
                    </div>

                    <audio ref={audioRef} src={songData.preview_url} preload="auto" />

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
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 text-white placeholder-slate-400 transition-all"
                      />
                      {filteredSongs.length > 0 && (
                        <ul className="absolute z-10 w-full mt-2 bg-slate-700 rounded-lg overflow-hidden shadow-lg">
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

                    {history.length > 0 && (
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
                    )}
                  </div>
                )}

                {feedback && (
                  <div className={`p-3 rounded-lg text-sm ${
                    feedback.includes('Correct') 
                      ? 'bg-green-500/10 text-green-400' 
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {feedback}
                  </div>
                )}

                {correctGuess && correctSong && (
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
                          onClick={() => {
                            if (audioRef.current.paused) {
                              audioRef.current.play();
                              fullProgressAnimationRef.current = requestAnimationFrame(updateFullProgress);
                            } else {
                              audioRef.current.pause();
                              cancelAnimationFrame(fullProgressAnimationRef.current);
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors"
                        >
                          {audioRef.current?.paused ? (
                            <svg className="w-5 h-5 fill-current text-slate-900" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 fill-current text-slate-900" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
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
                      <audio
                        ref={audioRef}
                        src={correctSong.preview_url}
                        onTimeUpdate={() => forceUpdate({})}
                        onEnded={() => cancelAnimationFrame(fullProgressAnimationRef.current)}
                        className="hidden"
                      />
                    </div>

                    <button
                      onClick={nextSong}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
                    >
                      Next Song
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;