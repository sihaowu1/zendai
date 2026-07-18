import { useEffect, useState } from 'react';
import { ChatPanel } from '../ChatPanel';
import { ControlsFloater } from '../controls/ControlsFloater';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { ModelsLayersList } from '../ModelsLayersList';
import type { useSceneProject } from '../../state/useSceneProject';
import { Viewport } from '../../viewport/Viewport';
import { PANEL_HEADER } from '../ui/Panel';

interface Props {
  project: ReturnType<typeof useSceneProject>;
}

/**
 * Screen 1 — Model Generation.
 *
 *   +------------------+---------------------------+
 *   | Chat             |                           |
 *   | (top-left)       |                           |
 *   +------------------+   3D Viewport             |
 *   | Models & Layers  |   (full right column)     |
 *   | (bottom-left)    |                           |
 *   +------------------+---------------------------+
 *
 * The left column is chat (scrollback, drives generate/modify) over the
 * Models & Layers list; both read/write `useSceneProject`, which is lifted
 * to `App` so this stays in sync with the Video screen's Materials pane.
 * Clicking a model row activates it (for the viewport). Shift-click adds to a
 * multi-select; Merge Selected places those models side-by-side on one plane
 * (not constrained). The tunable controls floater opens from clicking the
 * model *in the viewport* itself (a raycast hit on the rendered object).
 */
export function ModelGenerationScreen({ project }: Props) {
  const [clickAnchor, setClickAnchor] = useState<{ x: number; y: number } | null>(null);
  const activeModel = project.models.find((m) => m.id === project.activeModelId);

  const leftWidth = useResizable({
    direction: 'horizontal',
    initial: 380,
    min: 300,
    max: 640,
    storageKey: 'motionforge:model-screen:left-width',
  });
  const chatHeight = useResizable({
    direction: 'vertical',
    initial: 320,
    min: 140,
    max: 800,
    storageKey: 'motionforge:model-screen:chat-height',
  });

  // Selecting a different model (from the list) invalidates whatever was
  // anchored, since it may no longer correspond to what's on screen.
  useEffect(() => {
    setClickAnchor(null);
  }, [project.activeModelId]);

  return (
    <main
      className="grid min-h-0 flex-1 grid-cols-[var(--model-left-w)_1px_1fr]"
      style={{ ['--model-left-w' as string]: `${leftWidth.size}px` }}
    >
      <div className="flex min-h-0 min-w-0 flex-col bg-bg-panel">
        <section
          className="flex min-h-0 flex-none flex-col p-3"
          aria-label="Chat"
          style={{ height: chatHeight.size }}
        >
          <ChatPanel
            busy={project.busy}
            status={project.status}
            onGenerate={project.generate}
            onModify={project.modify}
          />
        </section>
        <ResizeHandle direction="vertical" onPointerDown={chatHeight.startDragging} label="Resize chat panel" />
        <section className="flex min-h-0 flex-1 flex-col gap-2 p-3" aria-label="Models & Layers">
          <h2 className={`flex-shrink-0 ${PANEL_HEADER}`}>
            Models &amp; Layers
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ModelsLayersList
              models={project.models}
              activeModelId={project.activeModelId}
              selectedModelIds={project.selectedModelIds}
              onSelectModel={project.selectModel}
              onMergeSelected={project.mergeSelectedModels}
              onRenameModel={project.renameModel}
              onRenameLayer={project.renameModelLayer}
              onDeleteLayer={project.deleteModelLayer}
            />
          </div>
        </section>
      </div>
      <ResizeHandle direction="horizontal" onPointerDown={leftWidth.startDragging} label="Resize sidebar" />
      <Viewport scenes={project.viewportScenes} onModelClick={setClickAnchor} />
      {clickAnchor && (
        <ControlsFloater
          anchor={clickAnchor}
          title={activeModel?.name ?? 'Model'}
          tunables={project.tunables}
          onChange={project.setParam}
          onClose={() => setClickAnchor(null)}
        />
      )}
    </main>
  );
}
