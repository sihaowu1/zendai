import { useRef, useState } from 'react';
import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { TimelinePlayback } from './useTimelinePlayback';

/** Drag-and-drop MIME type used to carry a model id onto the timeline (and the video preview). */
export const MODEL_DRAG_TYPE = 'application/x-motionforge-model-id';

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
 * scrub against. Exported so callers can feed the same number into
 * `useTimelinePlayback` that `Timeline` renders against.
 */
export function deriveTimelineTotal(clips: TimelineClip[], totalDuration?: number): number {
  const derivedEnd = clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
  return Math.max(totalDuration ?? Math.max(derivedEnd, EMPTY_TIMELINE_FLOOR), 0.0001);
}

export interface TimelineProps {
  clips: TimelineClip[];
  /** Same value passed to `useTimelinePlayback` — see `deriveTimelineTotal`. */
  totalDuration?: number;
  /** Shared playhead state/controls from `useTimelinePlayback`. */
  playback: TimelinePlayback;
  /** Drops a material at the given whole second, dropped from the Materials list onto the track. */
  onDropModel?: (modelId: string, second: number) => void;
}

/**
 * V1 timeline: single horizontal track with transport controls (play/pause,
 * step, skip-to-start/end) driving a playhead over it. Playback state is
 * owned by the caller (`useTimelinePlayback`) and passed in as `playback` so
 * other views — e.g. the video preview — can stay in lockstep with the same
 * playhead instead of Timeline keeping a private clock.
 */
export function Timeline({ clips, totalDuration, playback, onDropModel }: TimelineProps) {
  const total = deriveTimelineTotal(clips, totalDuration);
  const { currentTime, isPlaying, seek, togglePlay, skipToStart, skipToEnd, stepBack, stepForward } = playback;
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  function seekToClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
    seek(fraction * total);
  }

  function timeAtClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
    return fraction * total;
  }

  function handleTrackDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!onDropModel || !event.dataTransfer.types.includes(MODEL_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDropTarget(true);
  }

  function handleTrackDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (!onDropModel) return;
    const modelId = event.dataTransfer.getData(MODEL_DRAG_TYPE);
    setIsDropTarget(false);
    if (!modelId) return;
    event.preventDefault();
    onDropModel(modelId, timeAtClientX(event.clientX));
  }

  function handleScrubberPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToClientX(event.clientX);
  }

  function handleScrubberPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1) return;
    seekToClientX(event.clientX);
  }

  const playheadPct = (currentTime / total) * 100;

  return (
    <div style={styles.root} aria-label="Timeline">
      <TransportBar
        currentTime={currentTime}
        total={total}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onSkipToStart={skipToStart}
        onSkipToEnd={skipToEnd}
        onStepBack={stepBack}
        onStepForward={stepForward}
      />
      <div
        ref={trackRef}
        style={styles.scrubArea}
        onPointerDown={handleScrubberPointerDown}
        onPointerMove={handleScrubberPointerMove}
        onDragOver={handleTrackDragOver}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={handleTrackDrop}
      >
        <Ruler total={total} />
        <div style={isDropTarget ? { ...styles.track, ...styles.trackDropTarget } : styles.track} role="list">
          {clips.length === 0 && (
            <span style={styles.emptyTrackHint}>No clips yet — rendered scenes will appear here.</span>
          )}
          {clips.map((clip) => {
            // Position and size as percentages of the total timeline length.
            const leftPct = (clip.start / total) * 100;
            const widthPct = (clip.duration / total) * 100;
            return (
              <div
                key={clip.id}
                role="listitem"
                title={`${clip.label} — ${clip.start.toFixed(2)}s → ${(
                  clip.start + clip.duration
                ).toFixed(2)}s`}
                style={{
                  ...styles.clip,
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: clip.color ?? 'var(--accent)',
                }}
              >
                <span style={styles.clipLabel}>{clip.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ ...styles.playhead, left: `${playheadPct}%` }} aria-hidden="true">
          <div style={styles.playheadKnob} />
        </div>
      </div>
    </div>
  );
}

interface TransportBarProps {
  currentTime: number;
  total: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipToStart: () => void;
  onSkipToEnd: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
}

/** Play/pause + skip/step buttons and the elapsed/total time readout. */
function TransportBar({
  currentTime,
  total,
  isPlaying,
  onTogglePlay,
  onSkipToStart,
  onSkipToEnd,
  onStepBack,
  onStepForward,
}: TransportBarProps) {
  return (
    <div style={styles.transport} role="toolbar" aria-label="Playback controls">
      <button type="button" style={styles.transportButton} onClick={onSkipToStart} aria-label="Skip to start">
        ⏮
      </button>
      <button type="button" style={styles.transportButton} onClick={onStepBack} aria-label="Step back 1 second">
        ⏪
      </button>
      <button
        type="button"
        style={{ ...styles.transportButton, ...styles.transportButtonPrimary }}
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button type="button" style={styles.transportButton} onClick={onStepForward} aria-label="Step forward 1 second">
        ⏩
      </button>
      <button type="button" style={styles.transportButton} onClick={onSkipToEnd} aria-label="Skip to end">
        ⏭
      </button>
      <span style={styles.transportTime}>
        {formatSeconds(currentTime)} / {formatSeconds(total)}
      </span>
    </div>
  );
}

/**
 * Simple time ruler above the track. Picks a tick interval that yields a
 * readable number of labels (aim for ~6 ticks) so the ruler doesn't get
 * crowded on short timelines or sparse on long ones.
 */
function Ruler({ total }: { total: number }) {
  const step = pickTickStep(total);
  const ticks: number[] = [];
  for (let t = 0; t <= total + 1e-6; t += step) ticks.push(t);

  return (
    <div style={styles.ruler} aria-hidden="true">
      {ticks.map((t) => (
        <span
          key={t}
          style={{
            ...styles.tick,
            left: `${(t / total) * 100}%`,
          }}
        >
          {formatSeconds(t)}
        </span>
      ))}
    </div>
  );
}

function pickTickStep(total: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const targetTicks = 6;
  for (const c of candidates) {
    if (total / c <= targetTicks) return c;
  }
  return candidates[candidates.length - 1];
}

function formatSeconds(t: number): string {
  if (t < 60) return `${t % 1 === 0 ? t.toFixed(0) : t.toFixed(1)}s`;
  const m = Math.floor(t / 60);
  const s = Math.round(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    height: '100%',
    minHeight: 0,
    padding: 4,
  },
  transport: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  transportButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 24,
    padding: 0,
    fontSize: 13,
    lineHeight: 1,
    color: 'var(--text)',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'pointer',
  },
  transportButtonPrimary: {
    width: 32,
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#0b0d12',
  },
  transportTime: {
    marginLeft: 6,
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text-dim)',
  },
  scrubArea: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minHeight: 0,
    cursor: 'pointer',
    touchAction: 'none',
  },
  ruler: {
    position: 'relative',
    height: 16,
    color: 'var(--text-dim)',
    fontSize: 10,
    flexShrink: 0,
  },
  tick: {
    position: 'absolute',
    top: 0,
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
  },
  track: {
    position: 'relative',
    flex: 1,
    minHeight: 40,
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackDropTarget: {
    boxShadow: 'inset 0 0 0 2px var(--accent)',
  },
  emptyTrackHint: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: 'var(--text-dim)',
    pointerEvents: 'none',
  },
  clip: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    minWidth: 2,
    borderRadius: 3,
    padding: '0 6px',
    display: 'flex',
    alignItems: 'center',
    color: '#0b0d12',
    fontSize: 12,
    fontWeight: 600,
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  clipLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playhead: {
    position: 'absolute',
    top: 16,
    bottom: 0,
    width: 0,
    borderLeft: '2px solid var(--accent)',
    pointerEvents: 'none',
    transform: 'translateX(-1px)',
  },
  playheadKnob: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent)',
  },
} satisfies Record<string, CSSProperties>;
