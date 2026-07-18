/**
 * One clip on the timeline. `start` and `duration` are in seconds.
 */
export interface TimelineClip {
  id: string;
  /** Label rendered on the block (usually the scene/material name). */
  label: string;
  /** Seconds from the timeline origin (t=0). */
  start: number;
  /** Length of the clip in seconds. Must be > 0. */
  duration: number;
  /** Optional custom fill color; defaults to the accent color. */
  color?: string;
}

/** Minimum length (seconds) shown for a timeline with no clips yet. */
const EMPTY_TIMELINE_FLOOR = 10;

/**
 * Total timeline length in seconds: the parent's override, else the furthest
 * clip end, else a 10s floor so an empty timeline still has a ruler to
 * scrub against. Shared by `Timeline` (rendering) and `useSceneProject`
 * (deriving the playback clock), so both agree on the same number.
 */
export function deriveTimelineTotal(clips: TimelineClip[], totalDuration?: number): number {
  const derivedEnd = clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
  return Math.max(totalDuration ?? Math.max(derivedEnd, EMPTY_TIMELINE_FLOOR), 0.0001);
}
