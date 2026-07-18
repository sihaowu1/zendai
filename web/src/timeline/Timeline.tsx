import { useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { PLAYBACK_RATES, type TimelinePlayback } from './useTimelinePlayback';
import { deriveTimelineTotal, type TimelineClip } from './timelineMath';

export type { TimelineClip } from './timelineMath';
export { deriveTimelineTotal } from './timelineMath';

/** Drag-and-drop MIME type used to carry a model id onto the timeline (and the video preview). */
export const MODEL_DRAG_TYPE = 'application/x-motionforge-model-id';

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
  const {
    currentTime,
    isPlaying,
    playbackRate,
    seek,
    togglePlay,
    skipToStart,
    skipToEnd,
    stepBack,
    stepForward,
    setPlaybackRate,
  } = playback;
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
    <div className="flex h-full w-full min-h-0 flex-col gap-1.5 p-1" aria-label="Timeline">
      <TransportBar
        currentTime={currentTime}
        total={total}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        onTogglePlay={togglePlay}
        onSkipToStart={skipToStart}
        onSkipToEnd={skipToEnd}
        onStepBack={stepBack}
        onStepForward={stepForward}
        onSetPlaybackRate={setPlaybackRate}
      />
      <div
        ref={trackRef}
        className="relative flex flex-1 min-h-0 flex-col gap-1 cursor-pointer touch-none"
        onPointerDown={handleScrubberPointerDown}
        onPointerMove={handleScrubberPointerMove}
        onDragOver={handleTrackDragOver}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={handleTrackDrop}
      >
        <Ruler total={total} />
        <div
          className={`relative min-h-[40px] flex-1 overflow-hidden rounded border border-border bg-bg-raised ${
            isDropTarget ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''
          }`}
          role="list"
        >
          {clips.length === 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-text-dim">
              No clips yet — rendered scenes will appear here.
            </span>
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
                className="absolute top-1 bottom-1 flex min-w-[2px] items-center overflow-hidden rounded-[3px] px-1.5 text-xs font-semibold text-[#0b0d12] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: clip.color ?? 'var(--color-accent)',
                }}
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{clip.label}</span>
              </div>
            );
          })}
        </div>
        <div
          className="pointer-events-none absolute bottom-0 top-4 w-0 -translate-x-px border-l-2 border-accent"
          style={{ left: `${playheadPct}%` }}
          aria-hidden="true"
        >
          <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}

interface TransportBarProps {
  currentTime: number;
  total: number;
  isPlaying: boolean;
  playbackRate: number;
  onTogglePlay: () => void;
  onSkipToStart: () => void;
  onSkipToEnd: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSetPlaybackRate: (rate: number) => void;
}

/** Play/pause + skip/step buttons, a speed selector, and the elapsed/total time readout. */
function TransportBar({
  currentTime,
  total,
  isPlaying,
  playbackRate,
  onTogglePlay,
  onSkipToStart,
  onSkipToEnd,
  onStepBack,
  onStepForward,
  onSetPlaybackRate,
}: TransportBarProps) {
  const transportButtonClass =
    'flex h-6 w-7 items-center justify-center rounded border border-border bg-bg-raised p-0 text-[13px] leading-none text-text cursor-pointer';

  return (
    <div className="flex flex-shrink-0 items-center gap-1" role="toolbar" aria-label="Playback controls">
      <button type="button" className={transportButtonClass} onClick={onSkipToStart} aria-label="Skip to start">
        ⏮
      </button>
      <button type="button" className={transportButtonClass} onClick={onStepBack} aria-label="Step back 1 second">
        ⏪
      </button>
      <button
        type="button"
        className={`${transportButtonClass} w-8 border-accent bg-accent text-[#0b0d12]`}
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button type="button" className={transportButtonClass} onClick={onStepForward} aria-label="Step forward 1 second">
        ⏩
      </button>
      <button type="button" className={transportButtonClass} onClick={onSkipToEnd} aria-label="Skip to end">
        ⏭
      </button>
      <span className="ml-1.5 text-[11px] tabular-nums text-text-dim">
        {formatSeconds(currentTime)} / {formatSeconds(total)}
      </span>
      <span className="ml-auto flex gap-0.5" role="group" aria-label="Playback speed">
        {PLAYBACK_RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            className={`rounded border px-1.5 py-0.5 text-[11px] tabular-nums cursor-pointer ${
              rate === playbackRate
                ? 'border-accent bg-accent text-[#0b0d12]'
                : 'border-border bg-bg-raised text-text-dim'
            }`}
            onClick={() => onSetPlaybackRate(rate)}
            aria-pressed={rate === playbackRate}
          >
            {rate}×
          </button>
        ))}
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
    <div className="relative h-4 flex-shrink-0 text-[10px] text-text-dim" aria-hidden="true">
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(t / total) * 100}%` }}
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
