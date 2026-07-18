import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Pause, Play, Rewind, SkipBack, SkipForward, FastForward } from '@phosphor-icons/react';
import { PLAYBACK_RATES, type TimelinePlayback } from './useTimelinePlayback';
import { deriveTimelineTotal, MIN_CLIP_DURATION, type TimelineClip } from './timelineMath';
import { IconButton } from '../ui/Button';

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
  /** Deletes a clip (right-click menu → Delete). Omit to disable the context menu entirely. */
  onDeleteClip?: (clipId: string) => void;
  /** Stashes a clip in the clipboard (right-click menu → Copy). */
  onCopyClip?: (clipId: string) => void;
  /** Pastes the clipboard clip at the given whole second (right-click menu → Paste). */
  onPasteClip?: (second: number) => void;
  /** Whether a clip is currently in the clipboard, so Paste can be enabled/disabled. */
  hasClipboardClip?: boolean;
  /**
   * Sets a clip's duration (drag-to-resize via the handle on its right edge).
   * Only changes how long the clip is shown — `updateScene`'s `time` still
   * advances at the same rate, so this never changes playback speed. A
   * periodic animation keeps looping past its original length; a one-shot
   * animation does whatever its own code does for large `time` values.
   */
  onResizeClip?: (clipId: string, duration: number) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  /** The clip that was right-clicked, or undefined if the empty track was right-clicked. */
  clipId?: string;
  /** Timeline second under the right-click, used as the paste target. */
  second: number;
}

interface ResizeState {
  clipId: string;
  /** The clip's duration when the drag started. */
  initialDuration: number;
  /** `clientX` when the drag started. */
  startClientX: number;
  /** Pixels-per-second scale captured at drag start, so growing the clip
   *  (which can grow `total` and rescale the track) doesn't feed back into
   *  the drag itself. */
  pxPerSecond: number;
}

/**
 * V1 timeline: single horizontal track with transport controls (play/pause,
 * step, skip-to-start/end) driving a playhead over it. Playback state is
 * owned by the caller (`useTimelinePlayback`) and passed in as `playback` so
 * other views — e.g. the video preview — can stay in lockstep with the same
 * playhead instead of Timeline keeping a private clock.
 */
export function Timeline({
  clips,
  totalDuration,
  playback,
  onDropModel,
  onDeleteClip,
  onCopyClip,
  onPasteClip,
  hasClipboardClip,
  onResizeClip,
}: TimelineProps) {
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuEnabled = Boolean(onDeleteClip || onCopyClip || onPasteClip);
  const [resizing, setResizing] = useState<ResizeState | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeOnEscape);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

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

  function handleTrackContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!contextMenuEnabled) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, second: timeAtClientX(event.clientX) });
  }

  function handleClipContextMenu(event: ReactMouseEvent<HTMLDivElement>, clipId: string) {
    if (!contextMenuEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, clipId, second: timeAtClientX(event.clientX) });
  }

  function handleResizeHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>, clip: TimelineClip) {
    if (!onResizeClip) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const el = trackRef.current;
    const pxPerSecond = el ? el.getBoundingClientRect().width / total : 1;
    setResizing({ clipId: clip.id, initialDuration: clip.duration, startClientX: event.clientX, pxPerSecond });
  }

  function handleResizeHandlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizing || !onResizeClip) return;
    const deltaSeconds = (event.clientX - resizing.startClientX) / resizing.pxPerSecond;
    onResizeClip(resizing.clipId, Math.max(MIN_CLIP_DURATION, resizing.initialDuration + deltaSeconds));
  }

  function handleResizeHandlePointerUp() {
    setResizing(null);
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
        onContextMenu={handleTrackContextMenu}
      >
        <Ruler total={total} />
        <div
          className={`relative min-h-[40px] flex-1 overflow-hidden rounded-md border border-border bg-bg-raised ${
            isDropTarget ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''
          }`}
          role="list"
        >
          {clips.length === 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-[14px] text-text-dim">
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
                // Clips carry the scene's violet, not the blue accent — the
                // playhead is blue and has to stay visible crossing a clip.
                className="absolute top-1 bottom-1 flex min-w-[2px] items-center overflow-hidden rounded-[3px] px-1.5 text-xs font-semibold text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
                onContextMenu={(event) => handleClipContextMenu(event, clip.id)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: clip.color ?? 'var(--color-scene)',
                }}
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{clip.label}</span>
                {onResizeClip && (
                  <div
                    className="absolute -right-0.5 top-0 bottom-0 w-2.5 cursor-ew-resize touch-none rounded-r-[3px] hover:bg-[rgba(255,255,255,0.35)]"
                    onPointerDown={(event) => handleResizeHandlePointerDown(event, clip)}
                    onPointerMove={handleResizeHandlePointerMove}
                    onPointerUp={handleResizeHandlePointerUp}
                    aria-label={`Resize ${clip.label}`}
                    role="slider"
                    aria-valuenow={clip.duration}
                    aria-orientation="horizontal"
                  />
                )}
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
      {contextMenu && (
        <ClipContextMenu
          state={contextMenu}
          hasClipboardClip={Boolean(hasClipboardClip)}
          onDelete={onDeleteClip}
          onCopy={onCopyClip}
          onPaste={onPasteClip}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

interface ClipContextMenuProps {
  state: ContextMenuState;
  hasClipboardClip: boolean;
  onDelete?: (clipId: string) => void;
  onCopy?: (clipId: string) => void;
  onPaste?: (second: number) => void;
  onClose: () => void;
}

/**
 * Right-click menu for a timeline clip (or the empty track). Delete/Copy
 * only apply when a clip was right-clicked; Paste always targets the
 * timeline second under the click and is disabled without a clipboard clip.
 */
function ClipContextMenu({ state, hasClipboardClip, onDelete, onCopy, onPaste, onClose }: ClipContextMenuProps) {
  const { x, y, clipId, second } = state;
  const itemClass =
    'block w-full cursor-pointer whitespace-nowrap border-0 bg-transparent px-3 py-1.5 text-left text-[13px] text-text hover:bg-bg-hover disabled:cursor-not-allowed disabled:text-text-dim disabled:hover:bg-transparent';

  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-md border border-border bg-bg-panel py-1 shadow-lg"
      style={{ left: x, top: y }}
      role="menu"
      // Stop the outside-click-close listener from firing on the click that opens/selects a menu item.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        disabled={!clipId || !onDelete}
        onClick={() => {
          if (clipId && onDelete) onDelete(clipId);
          onClose();
        }}
      >
        Delete
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        disabled={!clipId || !onCopy}
        onClick={() => {
          if (clipId && onCopy) onCopy(clipId);
          onClose();
        }}
      >
        Copy
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        disabled={!hasClipboardClip || !onPaste}
        onClick={() => {
          if (onPaste) onPaste(second);
          onClose();
        }}
      >
        Paste
      </button>
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
  const transportButtonClass = 'h-7 w-7';

  return (
    <div className="flex flex-shrink-0 items-center gap-1" role="toolbar" aria-label="Playback controls">
      <IconButton type="button" className={transportButtonClass} onClick={onSkipToStart} aria-label="Skip to start">
        <SkipBack size={14} weight="fill" />
      </IconButton>
      <IconButton type="button" className={transportButtonClass} onClick={onStepBack} aria-label="Step back 1 second">
        <Rewind size={14} weight="fill" />
      </IconButton>
      <IconButton
        type="button"
        active
        className="h-7 w-8"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
      </IconButton>
      <IconButton type="button" className={transportButtonClass} onClick={onStepForward} aria-label="Step forward 1 second">
        <FastForward size={14} weight="fill" />
      </IconButton>
      <IconButton type="button" className={transportButtonClass} onClick={onSkipToEnd} aria-label="Skip to end">
        <SkipForward size={14} weight="fill" />
      </IconButton>
      <span className="ml-1.5 font-mono text-[13px] tabular-nums text-text-dim">
        {formatSeconds(currentTime)} / {formatSeconds(total)}
      </span>
      <span className="ml-auto flex gap-0.5" role="group" aria-label="Playback speed">
        {PLAYBACK_RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            // A speed toggle is a setting, not a call to action — it gets the
            // same tint-shift treatment as any other selected item.
            className={`rounded-md border border-border px-1.5 py-0.5 text-[12px] tabular-nums cursor-pointer transition-colors ${
              rate === playbackRate
                ? 'bg-bg-hover text-text'
                : 'bg-bg-raised text-text-dim hover:text-text hover:bg-bg-hover'
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
    <div className="relative h-4 flex-shrink-0 text-[11px] text-text-dim" aria-hidden="true">
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
