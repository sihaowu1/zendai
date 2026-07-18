import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ASPECT_RATIOS, type AspectRatio, type CameraSpec, type TunableParam } from '@motionforge/shared';
import type { ParamChange } from '../controls/ControlsPanel';
import { AspectRatioBox } from '../layout/AspectRatioBox';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { MODEL_DRAG_TYPE, Timeline } from '../timeline/Timeline';
import type { TimelineClip, TimelineLane } from '../timeline/timelineMath';
import type { TimelinePlayback } from '../timeline/useTimelinePlayback';
import type { Mp4JobState, SceneModel } from '../../state/useSceneProject';
import type { TrackOverlay } from '../../viewport/trackOverlay';
import type { ViewportHandle } from '../../viewport/Viewport';
import { VideoPreview } from '../VideoPreview';
import { PANEL_HEADER } from '../ui/Panel';

export interface VideoGenerationScreenProps {
  /** Models generated on the Model Generation screen (from `useSceneProject.models`). */
  models: SceneModel[];
  /**
   * Preview aspect ratio (from `useSceneProject.aspectRatio`). Read by
   * generate/modify at prompt time; changing it here only letterboxes the
   * live preview differently — it never re-generates or re-positions the scene.
   */
  aspectRatio: AspectRatio;
  /** Changes the aspect-ratio dropdown (from `useSceneProject.setAspectRatio`). */
  onAspectRatioChange: (ratio: AspectRatio) => void;
  /** The active model's tunables (from `useSceneProject.tunables`), edited via the click floater. */
  tunables: TunableParam[];
  /** Patches a tunable on the active model (from `useSceneProject.setParam`). */
  onParamChange: ParamChange;
  /** Current MP4 render job from `useSceneProject.mp4Job`. */
  mp4Job: Mp4JobState | null;
  /** Timeline clips (from `useSceneProject.timelineClips`), rendered in the bottom row. */
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
  collapsedLaneIds: Set<string>;
  onToggleLane: (laneId: string) => void;
  timelineFocusModelId: string;
  onTimelineFocusModelChange: (modelId: string) => void;
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
  /** Multi-scene co-view when the playhead clip is a merge. */
  previewScenes?: Array<{ id: string; code: string }>;
  /** Playhead position local to the active clip (from `useSceneProject.previewTime`). */
  previewTime: number;
  previewTrackOverlays: TrackOverlay[];
  /** Display name for whatever's under the playhead (from `useSceneProject.previewModelName`). */
  previewModelName: string;
  /**
   * Drops a material onto the video preview: places a clip for
   * `modelId` at whole-second `second` (from `useSceneProject.addClipAtSecond`).
   */
  onDropModel: (modelId: string, second: number) => void;
  /** Selects a material as the animation / edit target (from `useSceneProject.setActiveModel`). */
  activeModelId: string;
  onSelectModel: (id: string) => void;
  /** Deletes a clip, from the timeline's right-click menu (from `useSceneProject.deleteClip`). */
  onDeleteClip: (clipId: string) => void;
  /** Stashes a clip in the clipboard, from the timeline's right-click menu (from `useSceneProject.copyClip`). */
  onCopyClip: (clipId: string) => void;
  /** Pastes the clipboard clip at a whole second, from the timeline's right-click menu (from `useSceneProject.pasteClip`). */
  onPasteClip: (second: number) => void;
  /** Whether a clip is currently in the clipboard (from `useSceneProject.hasClipboardClip`). */
  hasClipboardClip: boolean;
  /** Resizes a clip via its timeline drag handle (from `useSceneProject.resizeClip`). */
  onResizeClip: (clipId: string, duration: number) => void;
  onMoveClip: (clipId: string, start: number) => void;
  /** Live orbit pose shared across Video/Export (from `useSceneProject.userCamera`). */
  userCamera: CameraSpec | null;
  onUserCameraChange: (camera: CameraSpec) => void;
  /** Optional slot for the chat pane. */
  chat?: ReactNode;
}

/**
 * Screen 2 — Video Generation.
 *
 *   +------+-----------+------------------+
 *   | Chat | Materials | Resulting Video  |
 *   +------+-----------+------------------+
 *   |         Timeline (full width)       |
 *   +-------------------------------------+
 */
export function VideoGenerationScreen({
  models,
  aspectRatio,
  onAspectRatioChange,
  tunables,
  onParamChange,
  mp4Job,
  timelineClips,
  timelineLanes,
  collapsedLaneIds,
  onToggleLane,
  timelineFocusModelId,
  onTimelineFocusModelChange,
  timelineTotal,
  playback,
  previewCode,
  previewScenes,
  previewTime,
  previewTrackOverlays,
  previewModelName,
  onDropModel,
  activeModelId,
  onSelectModel,
  onDeleteClip,
  onCopyClip,
  onPasteClip,
  hasClipboardClip,
  onResizeClip,
  onMoveClip,
  userCamera,
  onUserCameraChange,
  chat,
}: VideoGenerationScreenProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const videoPreviewRef = useRef<ViewportHandle>(null);
  const [axesVisible, setAxesVisible] = useState(false);

  const timelineModelOptions = useMemo(
    () => models.map((m) => ({ id: m.id, name: m.name })),
    [models],
  );

  useEffect(() => {
    videoPreviewRef.current?.setAxesVisible(axesVisible);
  }, [axesVisible, previewCode]);

  const chatWidth = useResizable({
    direction: 'horizontal',
    initial: 320,
    min: 240,
    max: 640,
    storageKey: 'motionforge:video-screen:chat-width',
  });
  const materialsWidth = useResizable({
    direction: 'horizontal',
    initial: 260,
    min: 180,
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
        <div className="flex min-h-0 min-w-0 flex-col bg-bg-panel">
          <section className="flex min-h-0 flex-1 flex-col p-3" aria-label="Chat">
            {chat ?? (
              <Placeholder label="Chat" hint="Prompt the AI to edit or extend the video." />
            )}
          </section>
        </div>
        <ResizeHandle direction="horizontal" onPointerDown={chatWidth.startDragging} label="Resize chat panel" />
        <div className="flex min-h-0 min-w-0 flex-col bg-bg-panel">
          <section className="flex min-h-0 flex-1 flex-col gap-2 p-3" aria-label="Materials">
            <h2 className={`flex-shrink-0 ${PANEL_HEADER}`}>Materials</h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MaterialsList models={models} activeModelId={activeModelId} onSelectModel={onSelectModel} />
            </div>
          </section>
        </div>
        <ResizeHandle
          direction="horizontal"
          onPointerDown={materialsWidth.startDragging}
          label="Resize materials panel"
        />
        <Pane
          title="Resulting Video"
          bodyClassName="overflow-hidden p-0"
          actions={
            <div className="flex items-center gap-1.5">
              <AxesToggleButton pressed={axesVisible} onToggle={() => setAxesVisible((v) => !v)} />
              <AspectRatioSelect value={aspectRatio} onChange={onAspectRatioChange} />
            </div>
          }
        >
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
            <AspectRatioBox ratio={aspectRatioValue(aspectRatio)}>
              <VideoPreview
                ref={videoPreviewRef}
                job={mp4Job}
                code={previewCode}
                scenes={previewScenes}
                tunables={tunables}
                onParamChange={onParamChange}
                modelName={previewModelName}
                time={previewTime}
                trackOverlays={previewTrackOverlays}
                userCamera={userCamera}
                onUserCameraChange={onUserCameraChange}
              />
            </AspectRatioBox>
            {isDropTarget && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(10,10,11,0.65)] text-[14px] font-semibold text-text"
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
            lanes={timelineLanes}
            collapsedLaneIds={collapsedLaneIds}
            onToggleLane={onToggleLane}
            totalDuration={timelineTotal}
            playback={playback}
            onDropModel={onDropModel}
            onDeleteClip={onDeleteClip}
            onCopyClip={onCopyClip}
            onPasteClip={onPasteClip}
            hasClipboardClip={hasClipboardClip}
            onResizeClip={onResizeClip}
            onMoveClip={onMoveClip}
            modelOptions={timelineModelOptions}
            focusModelId={timelineFocusModelId}
            onFocusModelChange={onTimelineFocusModelChange}
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
 * List of models for the video screen.
 * Click selects the animation/edit target; drag onto the preview/timeline
 * places a clip (`MODEL_DRAG_TYPE`).
 */
function MaterialsList({
  models,
  activeModelId,
  onSelectModel,
}: {
  models: SceneModel[];
  activeModelId: string;
  onSelectModel: (id: string) => void;
}) {
  if (models.length === 0) {
    return (
      <p className="m-0 text-[13px] leading-normal text-text-faint">
        Generate a model on the Model Generation screen to see it here.
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {models.map((m) => {
        const isActive = m.id === activeModelId;
        return (
          <li
            key={m.id}
            className={`overflow-hidden rounded-lg border border-border ${
              isActive ? 'bg-bg-hover' : 'bg-bg-raised'
            }`}
          >
            <div
              className={`flex cursor-grab items-center gap-2 px-2.5 py-2 ${
                isActive ? 'text-accent' : 'text-text'
              }`}
              draggable
              onClick={() => onSelectModel(m.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData(MODEL_DRAG_TYPE, m.id);
                event.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium"
                title={m.name}
              >
                {m.name}
                {m.children?.length ? (
                  <span className="ml-1.5 font-normal text-text-dim">· merge</span>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Pane({
  title,
  children,
  bodyClassName,
  actions,
}: {
  title: string;
  children: ReactNode;
  bodyClassName?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-panel" aria-label={title}>
      <header className={`flex items-center justify-between gap-2 border-b border-border px-4 py-3 ${PANEL_HEADER}`}>
        <span>{title}</span>
        {actions}
      </header>
      <div className={`min-h-0 flex-1 overflow-auto p-4 ${bodyClassName ?? ''}`}>{children}</div>
    </div>
  );
}

function aspectRatioValue(aspectRatio: AspectRatio): number {
  return ASPECT_RATIOS.find((a) => a.value === aspectRatio)?.ratio ?? 16 / 9;
}

/** Aspect-ratio dropdown shown in the "Resulting Video" pane header. */
function AspectRatioSelect({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
}) {
  return (
    <select
      className="rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-text"
      aria-label="Preview aspect ratio"
      value={value}
      onChange={(event) => onChange(event.target.value as AspectRatio)}
    >
      {ASPECT_RATIOS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Toggles the red/green/blue X/Y/Z reference axes at the scene origin in the live preview (see `SceneRuntime.setAxesVisible`). */
function AxesToggleButton({ pressed, onToggle }: { pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`rounded border px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal transition-colors ${
        pressed
          ? 'border-accent bg-accent text-white'
          : 'border-border bg-bg text-text hover:bg-bg-raised'
      }`}
      aria-pressed={pressed}
      onClick={onToggle}
    >
      Axes
    </button>
  );
}

function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-4 text-center text-text-dim">
      <div className="text-[15px] font-semibold text-text">{label}</div>
      <div className="text-[14px]">{hint}</div>
    </div>
  );
}
