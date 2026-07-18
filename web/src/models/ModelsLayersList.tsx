import { useMemo, useState } from 'react';
import { extractLayers } from '@motionforge/shared';
import type { SceneModel } from '../state/useSceneProject';

interface Props {
  models: SceneModel[];
  activeModelId: string;
  onSelectModel: (id: string) => void;
}

/**
 * One row per generated scene/model, expandable to show its layers (the mesh
 * groups `buildScene` returns — see `shared/src/layers.ts`). Clicking a row
 * activates that model, which drives the viewport; it's also the hand-off
 * point for the tunable-controls floater (SPEC.md Issue 3), which isn't
 * built here — this component only tracks/exposes the active selection.
 */
export function ModelsLayersList({ models, activeModelId, onSelectModel }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Layers are derived from each model's code, not stored on SceneModel —
  // the code stays the single source of truth, same as tunables.
  const layersByModel = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const model of models) map.set(model.id, extractLayers(model.code));
    return map;
  }, [models]);

  if (models.length === 0) {
    return (
      <p className="m-0 text-xs leading-relaxed text-text-dim">
        No models yet. Generate one from the chat above to see it listed here.
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {models.map((model) => {
        const layers = layersByModel.get(model.id) ?? [];
        const expanded = expandedId === model.id;
        const active = model.id === activeModelId;
        return (
          <li
            key={model.id}
            className={`overflow-hidden rounded-md border bg-bg-raised ${
              active ? 'border-accent' : 'border-border'
            }`}
          >
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-none border-none bg-transparent px-2.5 py-2 text-left font-medium ${
                active ? 'text-accent' : 'text-text'
              }`}
              aria-expanded={expanded}
              onClick={() => {
                onSelectModel(model.id);
                setExpandedId(expanded ? null : model.id);
              }}
            >
              <span
                className={`inline-block flex-shrink-0 text-[10px] text-text-dim transition-transform duration-150 ease-out ${
                  expanded ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              >
                ▸
              </span>
              <span
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                title={model.name}
              >
                {model.name}
              </span>
              <span
                className="min-w-[18px] flex-shrink-0 rounded-full border border-border bg-bg px-1.5 py-px text-center text-[11px] tabular-nums text-text-dim"
                title={`${layers.length} layer(s)`}
              >
                {layers.length}
              </span>
            </button>
            {expanded && (
              <ul className="m-0 flex flex-col gap-0.5 py-0 pl-[30px] pr-2.5 pb-2">
                {layers.length === 0 ? (
                  <li className="font-sans text-xs italic text-text-dim">No mesh groups found</li>
                ) : (
                  layers.map((layer) => (
                    <li key={layer} className="font-mono text-xs text-text-dim">
                      {layer}
                    </li>
                  ))
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
