import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TunableParam } from '@motionforge/shared';
import { ControlsFloater } from '../controls/ControlsFloater';
import type { ParamChange } from '../controls/ControlsPanel';
import type { Mp4JobState } from '../state/useSceneProject';
import { Viewport } from '../viewport/Viewport';

interface Props {
  job: Mp4JobState | null;
  /** The scene code for whatever's under the playhead. Undefined when the timeline has nothing there — renders a black screen. */
  code: string | undefined;
  tunables: TunableParam[];
  onParamChange: ParamChange;
  modelName: string;
  /** Set false to hide the click-to-edit tunables floater (e.g. on the Export screen). Defaults to true. */
  enableClickFloater?: boolean;
  /** Timeline playhead position (seconds), passed through to the live viewport. Omit for a free-running preview. */
  time?: number;
}

/**
 * The rendered MP4 once one exists, otherwise a live, click-to-edit 3D
 * preview of the active model — the same viewport + tunable-controls floater
 * as the Model Generation screen (click the model to open its
 * sliders/switches). Shared between the Video Generation and Export screens
 * so both show the exact same "resulting video" surface.
 */
export function VideoPreview({
  job,
  code,
  tunables,
  onParamChange,
  modelName,
  enableClickFloater = true,
  time,
}: Props) {
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

  if (!code) {
    return <div style={styles.blackScreen} aria-label="Empty timeline" />;
  }

  return (
    <div style={styles.livePreview}>
      <Viewport code={code} onModelClick={enableClickFloater ? setClickAnchor : undefined} time={time} />
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
      {!job && enableClickFloater && (
        <div style={styles.liveBadge}>Live preview — click the model to tweak it</div>
      )}
      {enableClickFloater && clickAnchor && (
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
  blackScreen: {
    width: '100%',
    height: '100%',
    background: '#000',
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
