import React, { useState, useRef, useCallback } from 'react';
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
  const maxAttempts = 5;

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const progressAnimationFrameRef = useRef(null);

  const clearProgressAnimation = () => {
    if (progressAnimationFrameRef.current) {
      cancelAnimationFrame(progressAnimationFrameRef.current);
      progressAnimationFrameRef.current = null;
    }
  };

  // Play the audio snippet and update the progress bar.
  const playSnippet = useCallback((duration) => {
    if (audioRef.current && progressBarRef.current) {
      clearProgressAnimation();

      // Temporarily disable transition so the progress resets instantly.
      progressBarRef.current.style.transition = 'none';
      progressBarRef.current.style.width = '0%';
      progressBarRef.current.offsetWidth; // Force reflow
      // Re-enable the transition.
      progressBarRef.current.style.transition = 'width 0.05s linear';

      // Reset audio.
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      // Start playback.
      audioRef.current.play().catch((error) => {
        console.error('Playback error:', error);
        setFeedback('Error playing audio.');
      });
      const startTime = Date.now();

      // Update the progress bar until the snippet duration has elapsed.
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

  // Start game: fetch basic playlist info and then get the target track with a preview.
  const startGame = async () => {
    if (!playlistUrl) {
      setFeedback('Please enter a playlist URL.');
      return;
    }
    try {
      // Reset history when starting a new game.
      setHistory([]);
      
      // Fetch basic track info for suggestions.
      const playlistResponse = await axios.get('/playlist', {
        params: { url: playlistUrl },
      });
      const tracks = playlistResponse.data.tracks || [];
      if (!tracks.length) {
        setFeedback('No tracks found in the playlist.');
        return;
      }
      setRecommendedSongs(tracks);

      // Get the target track (with preview) for the game.
      const targetResponse = await axios.get('/target', {
        params: { url: playlistUrl },
      });
      const targetTrack = targetResponse.data.track;
      if (!targetTrack) {
        setFeedback("Could not find a track with a preview available. Please try another playlist.");
        return;
      }
      setSongData(targetTrack);

      // Initialize game state.
      setGameStarted(true);
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
      setFeedback('Error starting game. Please check the playlist URL.');
    }
  };

  // Handle the user's guess.
  const handleGuess = async (e) => {
    e.preventDefault();
    if (!songData || !guess) return;
    try {
      const { data } = await axios.post('/guess', {
        songId: songData.id,
        guess,
      });
      // Record the guess attempt.
      setHistory(prev => [
        ...prev,
        { attempt: attempt + 1, type: 'guess', value: guess, correct: data.correct }
      ]);
      if (data.correct) {
        setFeedback(`Correct! The song was "${songData.name}" by ${songData.artist}.`);
        setCorrectGuess(true);
      } else {
        setFeedback(`Incorrect guess. Try again!`);
        incrementGuess();
      }
    } catch (error) {
      console.error(error);
      setFeedback('Error processing guess.');
    }
  };

  // Update the guess input when a suggestion is clicked.
  const handleSuggestionClick = (songName) => {
    setGuess(songName);
  };

  // Increment guess count and increase the snippet duration.
  const incrementGuess = () => {
    setSnippetDuration(prev => prev * 2);
    setAttempt(prev => prev + 1);
    if (attempt + 1 < maxAttempts) {
      playSnippet(snippetDuration * 2);
    } else {
      setFeedback(`Game over! The correct song was "${songData.name}" by ${songData.artist}.`);
      setCorrectGuess(true);
    }
  };

  // Handle skip action: record the skip in history and then increment.
  const handleSkip = () => {
    setHistory(prev => [
      ...prev,
      { attempt: attempt + 1, type: 'skip', value: 'Skipped' }
    ]);
    setFeedback('');
    incrementGuess();
  };

  // Updated nextSong: fetch a new target track with a preview from the backend and reset history.
  const nextSong = async () => {
    try {
      // Reset history for the new song.
      setHistory([]);
      const targetResponse = await axios.get('/target', {
        params: { url: playlistUrl },
      });
      const targetTrack = targetResponse.data.track;
      if (!targetTrack) {
        setFeedback("Could not find a track with a preview available. Please try another playlist.");
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
      if (progressBarRef.current) {
        progressBarRef.current.style.width = '0%';
      }
      playSnippet(1);
    } catch (error) {
      console.error(error);
      setFeedback("Error starting next song.");
    }
  };

  // Filter recommended songs for suggestions.
  const filteredSongs = guess
    ? recommendedSongs.filter(
        (song) =>
          song.name.toLowerCase().includes(guess.toLowerCase()) &&
          song.name.toLowerCase() !== guess.toLowerCase()
      )
    : [];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-5">
      <h1 className="text-3xl font-bold mb-5">Song Guessing Game</h1>
      {!gameStarted ? (
        <div className="text-center">
          <input
            type="text"
            placeholder="Enter Spotify Playlist URL"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            className="w-[400px] p-2 border border-gray-500 rounded bg-gray-700 text-white"
          />
          <button
            onClick={startGame}
            className="ml-2 py-2 px-4 bg-gray-600 text-white rounded hover:bg-gray-500"
          >
            Start Game
          </button>
          {feedback && <p className="mt-2 text-red-300">{feedback}</p>}
        </div>
      ) : (
        <>
          {!songData ? (
            <div className="text-center">
              <p>Loading track...</p>
            </div>
          ) : (
            <div className="w-full text-center">
              {!correctGuess && (
                <div className="mb-4">
                  <h2 className="text-2xl mb-2">Guess the Song</h2>
                  {/* History Display */}
                  {history.length > 0 && (
                    <div className="mb-2 text-left w-[300px] mx-auto">
                      {history.map((entry) => (
                        <p key={entry.attempt} className="text-sm">
                          Attempt {entry.attempt}: {entry.type === 'skip' ? 'Skipped' : entry.value}
                        </p>
                      ))}
                    </div>
                  )}
                  <audio ref={audioRef} src={songData.preview_url} preload="auto" />
                  <div className="w-[300px] h-2 bg-gray-600 rounded my-2 overflow-hidden mx-auto">
                    <div
                      ref={progressBarRef}
                      className="h-full bg-yellow-400 rounded transition-all duration-75"
                    />
                  </div>
                  <div className="my-2 flex justify-center gap-2">
                    <button
                      onClick={() => playSnippet(snippetDuration)}
                      className="py-2 px-4 bg-gray-600 text-white rounded hover:bg-gray-500"
                    >
                      Play {snippetDuration} second snippet
                    </button>
                    <button
                      onClick={handleSkip}
                      className="py-2 px-4 bg-gray-600 text-white rounded hover:bg-gray-500"
                    >
                      Skip
                    </button>
                  </div>
                  <form onSubmit={handleGuess} className="relative w-[300px] mx-auto">
                    <input
                      type="text"
                      placeholder="Enter your guess"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      className="w-full p-2 text-base bg-gray-700 text-white border border-gray-500 rounded"
                    />
                    {filteredSongs.length > 0 && (
                      <ul className="absolute top-[45px] left-0 right-0 border border-gray-500 bg-gray-700 list-none m-0 p-1 max-h-[150px] overflow-y-auto z-10">
                        {filteredSongs.map((song) => (
                          <li
                            key={song.id}
                            onClick={() => handleSuggestionClick(song.name)}
                            className="p-1 cursor-pointer text-white hover:bg-gray-600"
                          >
                            {song.name} - {song.artist}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="submit"
                      className="py-2 px-4 text-base mt-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                    >
                      Submit Guess
                    </button>
                  </form>
                </div>
              )}
              {feedback && <p className="mt-2 text-red-300">{feedback}</p>}
              {correctGuess && (
                <button
                  onClick={nextSong}
                  className="py-2 px-4 text-base mt-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                >
                  Next Song
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
