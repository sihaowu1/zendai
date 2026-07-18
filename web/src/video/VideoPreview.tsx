import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
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
        style={styles.video}
        aria-label="Rendered video preview"
      />
    );
  }

  return (
    <div style={styles.livePreview}>
      <Viewport code={code} onModelClick={setClickAnchor} />
      {job?.status === 'running' && (
        <div style={styles.liveBadge}>
          Rendering… {Math.round((job.progress ?? 0) * 100)}%
        </div>
      )}
      {job?.status === 'error' && (
        <div style={{ ...styles.liveBadge, ...styles.liveBadgeError }}>
          Render failed{job.error ? `: ${job.error}` : ''}
        </div>
      )}
      {!job && <div style={styles.liveBadge}>Live preview — click the model to tweak it</div>}
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

const styles = {
  video: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    background: '#000',
    borderRadius: 4,
    display: 'block',
  },
  livePreview: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  liveBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: 'calc(100% - 16px)',
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 12,
    color: 'var(--text-dim)',
    background: 'rgba(18, 21, 28, 0.85)',
    border: '1px solid var(--border)',
  },
  liveBadgeError: {
    color: 'var(--error)',
    borderColor: 'var(--error)',
  },
} satisfies Record<string, CSSProperties>;
