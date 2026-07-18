import { useEffect, useState } from 'react';
import { ChatPanel } from '../chat/ChatPanel';
import { ControlsFloater } from '../controls/ControlsFloater';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { ModelsLayersList } from '../models/ModelsLayersList';
import type { useSceneProject } from '../state/useSceneProject';
import { Viewport } from '../viewport/Viewport';

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
 * Clicking a model row only activates it (for the viewport). The tunable
 * controls floater instead opens from clicking the model *in the viewport*
 * itself (a raycast hit on the rendered object), showing the active model's
 * sliders/switches right where it was clicked.
 */
export function ModelGenerationScreen({ project }: Props) {
  const [clickAnchor, setClickAnchor] = useState<{ x: number; y: number } | null>(null);
  const activeModel = project.models.find((m) => m.id === project.activeModelId);

  const leftWidth = useResizable({
    direction: 'horizontal',
    initial: 320,
    min: 240,
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
    <main className="model-screen" style={{ gridTemplateColumns: `${leftWidth.size}px 1px 1fr` }}>
      <div className="model-screen__left">
        <section
          className="model-screen__chat"
          aria-label="Chat"
          style={{ height: chatHeight.size, flex: 'none' }}
        >
          <ChatPanel
            busy={project.busy}
            status={project.status}
            onGenerate={project.generate}
            onModify={project.modify}
          />
        </section>
        <ResizeHandle direction="vertical" onPointerDown={chatHeight.startDragging} label="Resize chat panel" />
        <section className="model-screen__models" aria-label="Models & Layers">
          <h2 className="model-screen__models-title">Models &amp; Layers</h2>
          <div className="model-screen__models-body">
            <ModelsLayersList
              models={project.models}
              activeModelId={project.activeModelId}
              onSelectModel={project.setActiveModel}
            />
          </div>
        </section>
      </div>
      <ResizeHandle direction="horizontal" onPointerDown={leftWidth.startDragging} label="Resize sidebar" />
      <Viewport code={project.code} onModelClick={setClickAnchor} />
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
