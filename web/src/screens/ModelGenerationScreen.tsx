import { ChatPanel } from '../chat/ChatPanel';
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
 * Clicking a model row only activates it (for the viewport) — the per-model
 * controls floater is separate work (SPEC.md Issue 3).
 */
export function ModelGenerationScreen({ project }: Props) {
  return (
    <main className="model-screen">
      <div className="model-screen__left">
        <section className="model-screen__chat" aria-label="Chat">
          <ChatPanel
            busy={project.busy}
            status={project.status}
            onGenerate={project.generate}
            onModify={project.modify}
          />
        </section>
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
      <Viewport code={project.code} />
    </main>
  );
}
