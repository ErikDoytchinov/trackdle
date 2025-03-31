import { useRef, useCallback, useEffect } from 'react';

const useAudioProgress = (audioRef, progressBarRef) => {
  const animationFrameRef = useRef(null);

  const clearProgress = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const updateProgress = useCallback(
    (duration, offsetSeconds = 0) => {
      clearProgress();
      const startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const totalElapsed = offsetSeconds + elapsed;
        const percent = Math.min(100, (totalElapsed / duration) * 100);
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${percent}%`;
        }
        if (totalElapsed < duration && audioRef.current && !audioRef.current.paused) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else if (totalElapsed >= duration) {
          audioRef.current?.pause();
        }
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [audioRef, progressBarRef, clearProgress]
  );

  useEffect(() => {
    return () => clearProgress();
  }, [clearProgress]);

  return { clearProgress, updateProgress };
};

export default useAudioProgress;
