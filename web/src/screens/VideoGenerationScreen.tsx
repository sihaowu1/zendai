import type { ReactNode } from 'react';
import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from '../controls/ControlsPanel';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { Timeline } from '../timeline/Timeline';
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
  chat,
}: VideoGenerationScreenProps) {
  const activeModel = models.find((m) => m.id === activeModelId);

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
          <VideoPreview
            job={mp4Job}
            code={code}
            tunables={tunables}
            onParamChange={onParamChange}
            modelName={activeModel?.name ?? 'Model'}
          />
        </Pane>
      </div>
      <ResizeHandle direction="vertical" onPointerDown={timelineHeight.startDragging} label="Resize timeline" />
      <div className="flex min-h-0">
        <Pane title="Timeline">
          <Timeline
            clips={clips.map((c) => ({
              id: c.id,
              label: c.label,
              start: c.start,
              duration: c.duration,
            }))}
          />
        </Pane>
      </div>
    </section>
  );
}

/**
 * Read-only list of models generated on the Model Generation screen.
 * Purely a view over the `models` prop — no local state, no fetching.
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
          className="flex items-center gap-2 rounded border border-border bg-bg-raised px-2 py-1.5"
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
