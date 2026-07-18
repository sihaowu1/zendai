import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from '../controls/ControlsPanel';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import type { Mp4JobState, SceneModel } from '../state/useSceneProject';
import { VideoPreview } from '../video/VideoPreview';

export interface ExportScreenProps {
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
}

/**
 * Screen 3 — Export.
 *
 *   +------------------+---------------------------+
 *   | Export options   |                           |
 *   | Export to GitHub |   Resulting Video          |
 *   | (left)           |   (same preview as the     |
 *   |                  |    Video Generation screen)|
 *   +------------------+---------------------------+
 *
 * Bare-minimum placeholder for now — the actual export/GitHub-push wiring
 * (see SPEC.md Issue 5) isn't implemented here yet, this just lays out the
 * screen and its resizable split.
 */
export function ExportScreen({ models, activeModelId, code, tunables, onParamChange, mp4Job }: ExportScreenProps) {
  const activeModel = models.find((m) => m.id === activeModelId);

  const leftWidth = useResizable({
    direction: 'horizontal',
    initial: 340,
    min: 260,
    max: 640,
    storageKey: 'motionforge:export-screen:left-width',
  });

  return (
    <main
      className="grid min-h-0 flex-1 grid-cols-[var(--export-left-w)_1px_1fr]"
      style={{ ['--export-left-w' as string]: `${leftWidth.size}px` }}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto bg-bg-panel p-3">
        <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3" aria-label="Export options">
          <h2 className="m-0 flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-dim">Export options</h2>
          <p className="m-0 text-xs leading-relaxed text-text-dim">
            Download the generated project as code, or render it to an MP4.
          </p>
          <button
            type="button"
            className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled
          >
            Export code (.zip)
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled
          >
            Render MP4 (Remotion)
          </button>
        </section>
        <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3" aria-label="Export to GitHub">
          <h2 className="m-0 flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-dim">Export to GitHub</h2>
          <p className="m-0 text-xs leading-relaxed text-text-dim">
            Push the generated project straight to a GitHub repository.
          </p>
          <input
            type="text"
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-text focus:outline focus:outline-1 focus:outline-accent"
            placeholder="owner/repo"
            disabled
          />
          <button
            type="button"
            className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled
          >
            Push to GitHub
          </button>
        </section>
      </div>
      <ResizeHandle direction="horizontal" onPointerDown={leftWidth.startDragging} label="Resize export options" />
      <div className="relative min-h-0 min-w-0">
        <VideoPreview
          job={mp4Job}
          code={code}
          tunables={tunables}
          onParamChange={onParamChange}
          modelName={activeModel?.name ?? 'Model'}
        />
      </div>
    </main>
  );
}
