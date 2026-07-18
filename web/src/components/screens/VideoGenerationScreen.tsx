import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ASPECT_RATIOS, type AspectRatio, type TunableParam } from '@motionforge/shared';
import { ControlsFloater } from '../controls/ControlsFloater';
import type { ParamChange } from '../controls/ControlsPanel';
import { AspectRatioBox } from '../layout/AspectRatioBox';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { MODEL_DRAG_TYPE, Timeline } from '../timeline/Timeline';
import type { TimelineClip } from '../timeline/timelineMath';
import type { TimelinePlayback } from '../timeline/useTimelinePlayback';
import type { Mp4JobState, SceneModel } from '../../state/useSceneProject';
import type { ObjectHandle } from '../../viewport/SceneRuntime';
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
  /** Display name for whatever's under the playhead (from `useSceneProject.previewModelName`). */
  previewModelName: string;
  /**
   * Drops a material onto the video preview: places a 1-second clip for
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
  aspectRatio,
  onAspectRatioChange,
  tunables,
  onParamChange,
  mp4Job,
  timelineClips,
  timelineTotal,
  playback,
  previewCode,
  previewScenes,
  previewTime,
  previewModelName,
  onDropModel,
  activeModelId,
  onSelectModel,
  onDeleteClip,
  onCopyClip,
  onPasteClip,
  hasClipboardClip,
  onResizeClip,
  chat,
}: VideoGenerationScreenProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const videoPreviewRef = useRef<ViewportHandle>(null);
  const [cameraEditor, setCameraEditor] = useState<{ anchor: { x: number; y: number }; handle: ObjectHandle } | null>(
    null,
  );
  const [axesVisible, setAxesVisible] = useState(false);

  const closeCameraEditor = () => {
    videoPreviewRef.current?.clearCameraOverride();
    setCameraEditor(null);
  };

  // The scene under the playhead changed (different clip, AI modify) — the
  // camera the editor was pointed at may no longer reflect what's on screen.
  useEffect(() => {
    setCameraEditor(null);
  }, [previewCode]);

  // Re-applies the toggle whenever the live viewport (re)mounts — e.g. the
  // timeline going from empty to occupied swaps in a fresh `Viewport`/
  // `SceneRuntime` that starts with axes hidden. A code edit alone doesn't
  // need this: `SceneRuntime` re-adds its own axes helper across rebuilds.
  useEffect(() => {
    videoPreviewRef.current?.setAxesVisible(axesVisible);
  }, [axesVisible, previewCode]);

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
          <MaterialsList models={models} activeModelId={activeModelId} onSelectModel={onSelectModel} />
        </Pane>
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
              <CameraAngleButton
                disabled={!previewCode}
                onOpen={(anchor) => {
                  const handle = videoPreviewRef.current?.getCameraHandle();
                  if (handle) setCameraEditor({ anchor, handle });
                }}
              />
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
              />
            </AspectRatioBox>
            {cameraEditor && (
              <ControlsFloater
                anchor={cameraEditor.anchor}
                title="Camera"
                objectHandle={cameraEditor.handle}
                transformLabel="Camera"
                showTunables={false}
                tunables={[]}
                onChange={() => {}}
                onClose={closeCameraEditor}
              />
            )}
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
            totalDuration={timelineTotal}
            playback={playback}
            onDropModel={onDropModel}
            onDeleteClip={onDeleteClip}
            onCopyClip={onCopyClip}
            onPasteClip={onPasteClip}
            hasClipboardClip={hasClipboardClip}
            onResizeClip={onResizeClip}
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
 * List of models generated on the Model Generation screen.
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
      <Placeholder
        label="No materials yet"
        hint="Generate a model on the Model Generation screen to see it here."
      />
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {models.map((m) => {
        const isActive = m.id === activeModelId;
        return (
          <li
            key={m.id}
            className={`flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 ${
              isActive
                ? 'border-accent bg-accent/10'
                : 'border-border bg-bg-raised hover:border-border hover:bg-bg-raised/80'
            }`}
            draggable
            onClick={() => onSelectModel(m.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData(MODEL_DRAG_TYPE, m.id);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <div className="h-8 w-8 flex-shrink-0 rounded-sm border border-border bg-bg" aria-hidden="true" />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] text-text" title={m.name}>
              {m.name}
              {m.childIds?.length ? (
                <span className="ml-1 font-normal text-text-dim">· merge</span>
              ) : null}
            </span>
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
      {/* Same muted mono title the Model and Export screens use, so a pane
          header reads identically wherever you meet one. Header and body share
          one horizontal inset — at px-4 over p-3 every pane's content sat 4px
          left of its own title. */}
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

/**
 * Button shown next to the aspect-ratio dropdown that opens the camera's
 * x/y/z position + angle editor (the same `TransformControls` used for a
 * clicked model, aimed at the live camera instead — see `SceneRuntime.getCameraHandle`).
 */
function CameraAngleButton({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: (anchor: { x: number; y: number }) => void;
}) {
  return (
    <button
      type="button"
      className="rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-text disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:bg-bg-raised"
      disabled={disabled}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onOpen({ x: rect.left + rect.width / 2, y: rect.bottom });
      }}
    >
      Camera
    </button>
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
