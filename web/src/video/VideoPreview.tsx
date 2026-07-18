import { useEffect, useState } from 'react';
import type { TunableParam } from '@motionforge/shared';
import { ControlsFloater } from '../controls/ControlsFloater';
import type { ParamChange } from '../controls/ControlsPanel';
import type { Mp4JobState } from '../state/useSceneProject';
import { Viewport } from '../viewport/Viewport';

interface Props {
  job: Mp4JobState | null;
  code: string;
  tunables: TunableParam[];
  onParamChange: ParamChange;
  modelName: string;
}

/**
 * The rendered MP4 once one exists, otherwise a live, click-to-edit 3D
 * preview of the active model — the same viewport + tunable-controls floater
 * as the Model Generation screen (click the model to open its
 * sliders/switches). Shared between the Video Generation and Export screens
 * so both show the exact same "resulting video" surface.
 */
export function VideoPreview({ job, code, tunables, onParamChange, modelName }: Props) {
  const [clickAnchor, setClickAnchor] = useState<{ x: number; y: number } | null>(null);

  // A different model becoming active invalidates whatever was anchored.
  useEffect(() => {
    setClickAnchor(null);
  }, [modelName]);

  if (job?.status === 'done' && job.url) {
    return (
      <video
        key={job.url}
        src={job.url}
        controls
        className="block h-full max-h-full w-full rounded bg-black"
        aria-label="Rendered video preview"
      />
    );
  }

  const badgeClass =
    'absolute left-2 bottom-2 max-w-[calc(100%-16px)] rounded border border-border bg-[rgba(18,21,28,0.85)] px-2.5 py-1 text-xs text-text-dim';

  return (
    <div className="relative h-full w-full">
      <Viewport code={code} onModelClick={setClickAnchor} />
      {job?.status === 'running' && (
        <div className={badgeClass}>Rendering… {Math.round((job.progress ?? 0) * 100)}%</div>
      )}
      {job?.status === 'error' && (
        <div className={`${badgeClass} border-error text-error`}>
          Render failed{job.error ? `: ${job.error}` : ''}
        </div>
      )}
      {!job && <div className={badgeClass}>Live preview — click the model to tweak it</div>}
      {clickAnchor && (
        <ControlsFloater
          anchor={clickAnchor}
          title={modelName}
          tunables={tunables}
          onChange={onParamChange}
          onClose={() => setClickAnchor(null)}
        />
      )}
    </div>
  );
}
