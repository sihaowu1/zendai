import { useEffect, useRef, useState } from 'react';

/** Selectable playback speeds, in multiples of real time. */
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

export interface TimelinePlayback {
  /** Playhead position in seconds, from t=0. */
  currentTime: number;
  isPlaying: boolean;
  /** Speed multiplier applied while playing; one of `PLAYBACK_RATES`. */
  playbackRate: number;
  /** Jump directly to a time (clamped to [0, total]). Used by scrubbing. */
  seek: (time: number) => void;
  togglePlay: () => void;
  skipToStart: () => void;
  skipToEnd: () => void;
  stepBack: () => void;
  stepForward: () => void;
  setPlaybackRate: (rate: number) => void;
}

/**
 * Single source of truth for the timeline playhead, shared by the Timeline
 * transport UI and the video preview (so pausing freezes the preview on the
 * exact scrubbed frame, and playing advances both in lockstep). Runs on a
 * real-time clock — 1 timeline-second per wall-clock second at 1x.
 */
export function useTimelinePlayback(total: number): TimelinePlayback {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  // Clamp the playhead whenever the timeline shrinks (e.g. clips change).
  useEffect(() => {
    setCurrentTime((t) => Math.min(t, total));
  }, [total]);

  useEffect(() => {
    if (!isPlaying) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts: number) => {
      const last = lastTsRef.current;
      lastTsRef.current = ts;
      if (last !== null) {
        const deltaSeconds = ((ts - last) / 1000) * playbackRateRef.current;
        setCurrentTime((t) => {
          const next = t + deltaSeconds;
          if (next >= total) {
            setIsPlaying(false);
            return total;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, total]);

  return {
    currentTime,
    isPlaying,
    playbackRate,
    seek: (time) => setCurrentTime(clamp(time, 0, total)),
    togglePlay: () =>
      setIsPlaying((playing) => {
        if (!playing && currentTime >= total) setCurrentTime(0);
        return !playing;
      }),
    skipToStart: () => setCurrentTime(0),
    skipToEnd: () => {
      setIsPlaying(false);
      setCurrentTime(total);
    },
    stepBack: () => setCurrentTime((t) => clamp(t - 1, 0, total)),
    stepForward: () => setCurrentTime((t) => clamp(t + 1, 0, total)),
    setPlaybackRate,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
