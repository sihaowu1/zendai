import { useEffect, useRef, useState } from 'react';
import { UploadSimple } from '@phosphor-icons/react';
import { ChatPanel } from '../ChatPanel';
import { ControlsFloater } from '../controls/ControlsFloater';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { ModelsLayersList } from '../ModelsLayersList';
import type { useSceneProject } from '../../state/useSceneProject';
import { Viewport } from '../../viewport/Viewport';
import { IconButton } from '../ui/Button';
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
 */
export function ModelGenerationScreen({ project }: Props) {
  const [clickAnchor, setClickAnchor] = useState<{ x: number; y: number } | null>(null);
  const activeModel = project.models.find((m) => m.id === project.activeModelId);
  const importInputRef = useRef<HTMLInputElement>(null);

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
            onSmartSend={project.route}
          />
        </section>
        <ResizeHandle direction="vertical" onPointerDown={chatHeight.startDragging} label="Resize chat panel" />
        <section className="flex min-h-0 flex-1 flex-col gap-2 p-3" aria-label="Models & Layers">
          <div className="flex flex-shrink-0 items-center justify-between gap-2">
            <h2
              className={PANEL_HEADER}
              title="Click to select a model. Shift-click to select several and merge them."
            >
              Models &amp; Layers
            </h2>
            <IconButton
              className="h-6 w-6"
              title="Import a Blender-exported GLB/glTF model"
              aria-label="Import a Blender-exported GLB/glTF model"
              onClick={() => importInputRef.current?.click()}
            >
              <UploadSimple size={13} weight="bold" aria-hidden="true" />
            </IconButton>
            <input
              ref={importInputRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) project.importModel(file);
                event.target.value = '';
              }}
            />
          </div>
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
              onDeleteModel={project.deleteModel}
            />
          </div>
        </section>
      </div>
      <ResizeHandle direction="horizontal" onPointerDown={leftWidth.startDragging} label="Resize sidebar" />
      <Viewport scenes={project.viewportScenes} onModelClick={setClickAnchor} showToolbar />
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
