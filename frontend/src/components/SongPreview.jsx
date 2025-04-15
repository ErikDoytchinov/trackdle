import React, { useState, useEffect, useCallback } from 'react';
import useAudioProgress from '../hooks/useAudioProgress';

const SongPreview = ({ correctSong, audioRef, fullProgressBarRef }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const { clearProgress, updateProgress } = useAudioProgress(audioRef, fullProgressBarRef);

  useEffect(() => {
    const current = audioRef.current;
    if (!current) return;
    const handleTimeUpdate = () => {
      setCurrentTime(current.currentTime);
    };
    current.addEventListener('timeupdate', handleTimeUpdate);
    return () => current.removeEventListener('timeupdate', handleTimeUpdate);
  }, [audioRef]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
      if (audioRef.current.duration) {
        updateProgress(audioRef.current.duration, audioRef.current.currentTime);
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
      clearProgress();
    }
  }, [audioRef, updateProgress, clearProgress]);

  useEffect(() => {
    const current = audioRef.current;
    if (!current) return;
    const onEnded = () => {
      setIsPlaying(false);
      clearProgress();
    };
    current.addEventListener('ended', onEnded);
    return () => current.removeEventListener('ended', onEnded);
  }, [audioRef, clearProgress]);

  return (
    <div className="text-center space-y-4">
      <div className="flex flex-col items-center md:flex-row md:items-center md:gap-5">
        <img
          src={correctSong.album_cover}
          alt={correctSong.name}
          className="w-48 h-48 rounded-xl object-cover shadow-xl border-2 border-white/10 hover:border-amber-400/30 transition-colors"
        />
        <div className="mt-4 md:mt-0 space-y-1 md:text-left">
          <h2 className="text-xl font-bold text-white">{correctSong.name}</h2>
          <p className="text-gray-400">{correctSong.artist}</p>
        </div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-4 border border-white/10 shadow-lg">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={togglePlayback}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 flex items-center justify-center shadow-lg hover:shadow-amber-500/30 transition-all transform hover:scale-105"
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-gray-900" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4h4v16H6zm8 0h4v16h-4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-900" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <div className="flex-1 space-y-2">
            <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur">
              <div
                ref={fullProgressBarRef}
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-75"
                style={{ width: '0%' }}
              />
            </div>
            <div className="flex justify-between text-xs text-amber-100/80">
              <span>{formatTime(currentTime)}</span>
              <span>
                -{formatTime((audioRef.current?.duration || 0) - currentTime)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongPreview;