import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from '../controls/ControlsPanel';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { MODEL_DRAG_TYPE, Timeline, deriveTimelineTotal } from '../timeline/Timeline';
import { useTimelinePlayback } from '../timeline/useTimelinePlayback';
import type { Clip, Mp4JobState, SceneModel } from '../state/useSceneProject';
import { VideoPreview } from '../video/VideoPreview';

export interface VideoGenerationScreenProps {
  /** Models generated on the Model Generation screen (from `useSceneProject.models`). */
  models: SceneModel[];
  /** The active model's id (from `useSceneProject.activeModelId`). */
  activeModelId: string;
  /** The active model's scene code (from `useSceneProject.code`), live-previewed until a render exists. */
  code: string;
  /** The active model's tunables (from `useSceneProject.tunables`), edited via the click floater. */
  tunables: TunableParam[];
  /** Patches a tunable on the active model (from `useSceneProject.setParam`). */
  onParamChange: ParamChange;
  /** Current MP4 render job from `useSceneProject.mp4Job`. */
  mp4Job: Mp4JobState | null;
  /** Timeline clips (from `useSceneProject.clips`), rendered in the bottom row. */
  clips: Clip[];
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
  activeModelId,
  code,
  tunables,
  onParamChange,
  mp4Job,
  clips,
  onDropModel,
  chat,
}: VideoGenerationScreenProps) {
  const activeModel = models.find((m) => m.id === activeModelId);
  const [isDropTarget, setIsDropTarget] = useState(false);

  // Single shared playhead: the Timeline transport controls it, and the
  // preview reads it, so scrubbing/playing/pausing stay in lockstep.
  const timelineClips = clips.map((c) => ({ id: c.id, label: c.label, start: c.start, duration: c.duration }));
  const timelineTotal = deriveTimelineTotal(timelineClips);
  const playback = useTimelinePlayback(timelineTotal);

  // Which clip (and therefore which model's code) is under the playhead
  // right now. Clips are assumed never to overlap — at most one model per
  // timeline second — so the first match is the only match.
  const activeClip = clips.find(
    (c) => playback.currentTime >= c.start && playback.currentTime < c.start + c.duration,
  );
  const previewModel = activeClip ? models.find((m) => m.id === activeClip.modelId) : undefined;
  const previewCode = previewModel?.code;
  const previewTime = activeClip ? playback.currentTime - activeClip.start : playback.currentTime;

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
      className="video-screen"
      style={{ ...styles.root, gridTemplateRows: `1fr 1px ${timelineHeight.size}px` }}
    >
      <div
        className="video-screen__top"
        style={{
          ...styles.top,
          gridTemplateColumns: `${chatWidth.size}px 1px ${materialsWidth.size}px 1px 1fr`,
        }}
      >
        <Pane title="Chat" area="chat">
          {chat ?? <Placeholder label="Chat" hint="Prompt the AI to edit or extend the video." />}
        </Pane>
        <ResizeHandle direction="horizontal" onPointerDown={chatWidth.startDragging} label="Resize chat panel" />
        <Pane title="Materials" area="materials">
          <MaterialsList models={models} />
        </Pane>
        <ResizeHandle
          direction="horizontal"
          onPointerDown={materialsWidth.startDragging}
          label="Resize materials panel"
        />
        <Pane title="Resulting Video" area="video" bodyStyle={styles.videoPaneBody}>
          <div
            style={isDropTarget ? { ...styles.videoDropZone, ...styles.videoDropZoneActive } : styles.videoDropZone}
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
              modelName={previewModel?.name ?? activeModel?.name ?? 'Model'}
              time={previewTime}
            />
            {isDropTarget && (
              <div style={styles.dropHint} aria-hidden="true">
                Drop to place at {formatDropSecond(playback.currentTime)}s
              </div>
            )}
          </div>
        </Pane>
      </div>
      <ResizeHandle direction="vertical" onPointerDown={timelineHeight.startDragging} label="Resize timeline" />
      <div className="video-screen__timeline" style={styles.timeline}>
        <Pane title="Timeline" area="timeline">
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
    <ul style={styles.materialsList}>
      {models.map((m) => (
        <li
          key={m.id}
          style={styles.materialItem}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(MODEL_DRAG_TYPE, m.id);
            event.dataTransfer.effectAllowed = 'copy';
          }}
        >
          <div style={styles.materialThumbFallback} aria-hidden="true" />
          <span style={styles.materialName} title={m.name}>
            {m.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pane({
  title,
  area,
  children,
  bodyStyle,
}: {
  title: string;
  area: string;
  children: ReactNode;
  bodyStyle?: CSSProperties;
}) {
  return (
    <div
      className={`video-screen__pane video-screen__pane--${area}`}
      style={styles.pane}
      aria-label={title}
    >
      <header style={styles.paneHeader}>{title}</header>
      <div style={bodyStyle ? { ...styles.paneBody, ...bodyStyle } : styles.paneBody}>
        {children}
      </div>
    </div>
  );
}

function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={styles.placeholder}>
      <div style={styles.placeholderLabel}>{label}</div>
      <div style={styles.placeholderHint}>{hint}</div>
    </div>
  );
}

const styles = {
  root: {
    display: 'grid',
    gridTemplateRows: '1fr auto',
    gap: 0,
    padding: 0,
    minHeight: 0,
    height: '100%',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  top: {
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 1fr) minmax(200px, 1fr) minmax(320px, 2fr)',
    gap: 0,
    minHeight: 0,
  },
  timeline: {
    minHeight: 0,
    display: 'flex',
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    flex: 1,
    background: 'var(--bg-panel)',
    overflow: 'hidden',
  },
  paneHeader: {
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    background: 'var(--bg-raised)',
    borderBottom: '1px solid var(--border)',
  },
  paneBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: 12,
  },
  videoPaneBody: {
    overflow: 'hidden',
    padding: 0,
  },
  videoDropZone: {
    position: 'relative',
    width: '100%',
    height: '100%',
    boxShadow: 'inset 0 0 0 0 var(--accent)',
    transition: 'box-shadow 100ms ease-out',
  },
  videoDropZoneActive: {
    boxShadow: 'inset 0 0 0 2px var(--accent)',
  },
  dropHint: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    background: 'rgba(18, 21, 28, 0.6)',
    pointerEvents: 'none',
  },
  placeholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 6,
    color: 'var(--text-dim)',
    border: '1px dashed var(--border)',
    borderRadius: 4,
    padding: 16,
  },
  placeholderLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  placeholderHint: {
    fontSize: 12,
  },
  materialsList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  materialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'grab',
  },
  materialThumbFallback: {
    width: 32,
    height: 32,
    borderRadius: 3,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    flexShrink: 0,
  },
  materialName: {
    fontSize: 13,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
} satisfies Record<string, CSSProperties>;
