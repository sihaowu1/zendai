import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from '../controls/ControlsPanel';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { MODEL_DRAG_TYPE, Timeline } from '../timeline/Timeline';
import type { TimelineClip } from '../timeline/timelineMath';
import type { TimelinePlayback } from '../timeline/useTimelinePlayback';
import type { Mp4JobState, SceneModel } from '../state/useSceneProject';
import { VideoPreview } from '../video/VideoPreview';

export interface VideoGenerationScreenProps {
  /** Models generated on the Model Generation screen (from `useSceneProject.models`). */
  models: SceneModel[];
  /** The active model's tunables (from `useSceneProject.tunables`), edited via the click floater. */
  tunables: TunableParam[];
  /** Patches a tunable on the active model (from `useSceneProject.setParam`). */
  onParamChange: ParamChange;
  /** Current MP4 render job from `useSceneProject.mp4Job`. */
  mp4Job: Mp4JobState | null;
  /** Timeline clips (from `useSceneProject.timelineClips`), rendered in the bottom row. */
  timelineClips: TimelineClip[];
  /** Timeline length in seconds (from `useSceneProject.timelineTotal`). */
  timelineTotal: number;
  /**
   * Shared playhead (from `useSceneProject.playback`) — the same clock the
   * Export screen's timeline reads, so scrubbing/playing stays in sync
   * across screens instead of each screen keeping its own clock.
   */
  playback: TimelinePlayback;
  /** Scene code for whatever's under the playhead (from `useSceneProject.previewCode`); undefined shows a black screen. */
  previewCode: string | undefined;
  /** Playhead position local to the active clip (from `useSceneProject.previewTime`). */
  previewTime: number;
  /** Display name for whatever's under the playhead (from `useSceneProject.previewModelName`). */
  previewModelName: string;
  /**
   * Drops a material onto the video preview: places a 1-second clip for
   * `modelId` at whole-second `second` (from `useSceneProject.addClipAtSecond`).
   */
  onDropModel: (modelId: string, second: number) => void;
  /** Optional slot for the chat pane (component not built yet — see SPEC.md Issue 4). */
  chat?: ReactNode;
}

/**
 * Screen 2 — Video Generation.
 *
 *   +------------+------------+------------------+
 *   | Chat       | Materials  |                  |
 *   | (top-left) | (from      |  Resulting Video |
 *   |            |  Screen 1) |  (top-right)     |
 *   +------------+------------+------------------+
 *   |              Timeline (full width)         |
 *   +--------------------------------------------+
 */
export function VideoGenerationScreen({
  models,
  tunables,
  onParamChange,
  mp4Job,
  timelineClips,
  timelineTotal,
  playback,
  previewCode,
  previewTime,
  previewModelName,
  onDropModel,
  chat,
}: VideoGenerationScreenProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  const chatWidth = useResizable({
    direction: 'horizontal',
    initial: 280,
    min: 200,
    max: 640,
    storageKey: 'motionforge:video-screen:chat-width',
  });
  const materialsWidth = useResizable({
    direction: 'horizontal',
    initial: 240,
    min: 160,
    max: 640,
    storageKey: 'motionforge:video-screen:materials-width',
  });
  const timelineHeight = useResizable({
    direction: 'vertical',
    initial: 200,
    min: 120,
    max: 420,
    storageKey: 'motionforge:video-screen:timeline-height',
    invert: true,
  });

  return (
    <section
      className="grid h-full min-h-0 gap-0 bg-bg p-0 text-text grid-rows-[1fr_1px_var(--timeline-h)]"
      style={{ ['--timeline-h' as string]: `${timelineHeight.size}px` }}
    >
      <div
        className="grid min-h-0 gap-0"
        style={{
          gridTemplateColumns: `${chatWidth.size}px 1px ${materialsWidth.size}px 1px 1fr`,
        }}
      >
        <Pane title="Chat">
          {chat ?? <Placeholder label="Chat" hint="Prompt the AI to edit or extend the video." />}
        </Pane>
        <ResizeHandle direction="horizontal" onPointerDown={chatWidth.startDragging} label="Resize chat panel" />
        <Pane title="Materials">
          <MaterialsList models={models} />
        </Pane>
        <ResizeHandle
          direction="horizontal"
          onPointerDown={materialsWidth.startDragging}
          label="Resize materials panel"
        />
        <Pane title="Resulting Video" bodyClassName="overflow-hidden p-0">
          <div
            className={`relative h-full w-full shadow-[inset_0_0_0_0_var(--color-accent)] transition-shadow duration-100 ${
              isDropTarget ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''
            }`}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(MODEL_DRAG_TYPE)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              setIsDropTarget(true);
            }}
            onDragLeave={() => setIsDropTarget(false)}
            onDrop={(event) => {
              const modelId = event.dataTransfer.getData(MODEL_DRAG_TYPE);
              setIsDropTarget(false);
              if (!modelId) return;
              event.preventDefault();
              onDropModel(modelId, playback.currentTime);
            }}
          >
            <VideoPreview
              job={mp4Job}
              code={previewCode}
              tunables={tunables}
              onParamChange={onParamChange}
              modelName={previewModelName}
              time={previewTime}
            />
            {isDropTarget && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(18,21,28,0.6)] text-[13px] font-semibold text-text"
                aria-hidden="true"
              >
                Drop to place at {formatDropSecond(playback.currentTime)}s
              </div>
            )}
          </div>
        </Pane>
      </div>
      <ResizeHandle direction="vertical" onPointerDown={timelineHeight.startDragging} label="Resize timeline" />
      <div className="flex min-h-0">
        <Pane title="Timeline">
          <Timeline
            clips={timelineClips}
            totalDuration={timelineTotal}
            playback={playback}
            onDropModel={onDropModel}
          />
        </Pane>
      </div>
    </section>
  );
}

function formatDropSecond(time: number): number {
  return Math.max(0, Math.floor(time));
}

/**
 * Read-only list of models generated on the Model Generation screen.
 * Purely a view over the `models` prop — no local state, no fetching. Each
 * item is draggable so it can be dropped onto the video preview to place it
 * on the timeline (see `MODEL_DRAG_TYPE`).
 */
function MaterialsList({ models }: { models: SceneModel[] }) {
  if (models.length === 0) {
    return (
      <Placeholder
        label="No materials yet"
        hint="Generate a model on the Model Generation screen to see it here."
      />
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {models.map((m) => (
        <li
          key={m.id}
          className="flex cursor-grab items-center gap-2 rounded border border-border bg-bg-raised px-2 py-1.5"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(MODEL_DRAG_TYPE, m.id);
            event.dataTransfer.effectAllowed = 'copy';
          }}
        >
          <div className="h-8 w-8 flex-shrink-0 rounded-sm border border-border bg-bg" aria-hidden="true" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-text" title={m.name}>
            {m.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pane({
  title,
  children,
  bodyClassName,
}: {
  title: string;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-panel" aria-label={title}>
      <header className="border-b border-border bg-bg-raised px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-dim">
        {title}
      </header>
      <div className={`min-h-0 flex-1 overflow-auto p-3 ${bodyClassName ?? ''}`}>{children}</div>
    </div>
  );
}

function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 rounded border border-dashed border-border p-4 text-center text-text-dim">
      <div className="text-sm font-semibold text-text">{label}</div>
      <div className="text-xs">{hint}</div>
    </div>
  );
}
