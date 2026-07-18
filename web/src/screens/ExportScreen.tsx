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
    <main className="export-screen" style={{ gridTemplateColumns: `${leftWidth.size}px 1px 1fr` }}>
      <div className="export-screen__left">
        <section className="panel" aria-label="Export options">
          <h2>Export options</h2>
          <p className="hint">Download the generated project as code, or render it to an MP4.</p>
          <button type="button" disabled>
            Export code (.zip)
          </button>
          <button type="button" disabled>
            Render MP4 (Remotion)
          </button>
        </section>
        <section className="panel" aria-label="Export to GitHub">
          <h2>Export to GitHub</h2>
          <p className="hint">Push the generated project straight to a GitHub repository.</p>
          <input type="text" placeholder="owner/repo" disabled />
          <button type="button" disabled>
            Push to GitHub
          </button>
        </section>
      </div>
      <ResizeHandle direction="horizontal" onPointerDown={leftWidth.startDragging} label="Resize export options" />
      <div className="export-screen__right">
        <VideoPreview
          job={mp4Job}
          code={code}
          tunables={tunables}
          onParamChange={onParamChange}
          modelName={activeModel?.name ?? 'Model'}
          enableClickFloater={false}
        />
      </div>
    </main>
  );
}
