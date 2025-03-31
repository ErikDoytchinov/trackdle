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
                <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 fill-current text-slate-900" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
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
