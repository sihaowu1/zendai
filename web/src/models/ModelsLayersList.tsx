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
      <p className="hint">
        No models yet. Generate one from the chat above to see it listed here.
      </p>
    );
  }

  return (
    <ul className="models-list">
      {models.map((model) => {
        const layers = layersByModel.get(model.id) ?? [];
        const expanded = expandedId === model.id;
        const active = model.id === activeModelId;
        return (
          <li key={model.id} className={active ? 'model-row model-row--active' : 'model-row'}>
            <button
              type="button"
              className="model-row__header"
              aria-expanded={expanded}
              onClick={() => {
                onSelectModel(model.id);
                setExpandedId(expanded ? null : model.id);
              }}
            >
              <span
                className={
                  expanded ? 'model-row__chevron model-row__chevron--open' : 'model-row__chevron'
                }
                aria-hidden="true"
              >
                ▸
              </span>
              <span className="model-row__name" title={model.name}>
                {model.name}
              </span>
              <span className="model-row__count" title={`${layers.length} layer(s)`}>
                {layers.length}
              </span>
            </button>
            {expanded && (
              <ul className="model-row__layers">
                {layers.length === 0 ? (
                  <li className="model-row__layer model-row__layer--empty">
                    No mesh groups found
                  </li>
                ) : (
                  layers.map((layer) => (
                    <li key={layer} className="model-row__layer">
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
