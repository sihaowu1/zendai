import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CameraSpec, TunableParam } from '@motionforge/shared';
import { ControlsFloater } from './controls/ControlsFloater';
import type { ParamChange } from './controls/ControlsPanel';
import type { Mp4JobState } from '../state/useSceneProject';
import type { ObjectHandle } from '../viewport/SceneRuntime';
import type { TrackOverlay } from '../viewport/trackOverlay';
import { Viewport, type ViewportHandle } from '../viewport/Viewport';

interface Props {
  job: Mp4JobState | null;
  /** The scene code for whatever's under the playhead. Undefined when the timeline has nothing there — renders a black screen. */
  code: string | undefined;
  /** Multi-scene co-view when the playhead clip is a merge. Takes precedence over `code` when non-empty. */
  scenes?: Array<{ id: string; code: string }>;
  tunables: TunableParam[];
  onParamChange: ParamChange;
  modelName: string;
  /** Set false to hide the click-to-edit tunables floater (e.g. on the Export screen). Defaults to true. */
  enableClickFloater?: boolean;
  /** Timeline playhead position (seconds), passed through to the live viewport. Omit for a free-running preview. */
  time?: number;
  /** Host-side part tracks for multi-clip NLE playback. */
  trackOverlays?: TrackOverlay[];
  /** Persisted orbit pose; when set, overrides module CAMERA for the live preview. */
  userCamera?: CameraSpec | null;
  onUserCameraChange?: (camera: CameraSpec) => void;
}

/**
 * The rendered MP4 once one exists, otherwise a live, click-to-edit 3D
 * preview of the active model — the same viewport + tunable-controls floater
 * as the Model Generation screen (click the model to open its
 * sliders/switches). Shared between the Video Generation and Export screens
 * so both show the exact same "resulting video" surface.
 *
 * Framing follows the user's orbit (`userCamera`); module `CAMERA` is only a
 * starting hint until the user moves the view.
 */
export const VideoPreview = forwardRef<ViewportHandle, Props>(function VideoPreview(
  {
    job,
    code,
    scenes,
    tunables,
    onParamChange,
    modelName,
    enableClickFloater = true,
    time,
    trackOverlays,
    userCamera,
    onUserCameraChange,
  },
  ref,
) {
  const [selection, setSelection] = useState<{ anchor: { x: number; y: number }; handle: ObjectHandle } | null>(
    null,
  );
  const viewportRef = useRef<ViewportHandle>(null);

  useImperativeHandle(
    ref,
    () => ({
      setAxesVisible: (visible) => viewportRef.current?.setAxesVisible(visible),
      getCameraSpec: () => viewportRef.current?.getCameraSpec() ?? null,
      getCameraHandle: () => viewportRef.current?.getCameraHandle() ?? null,
      clearCameraOverride: () => viewportRef.current?.clearCameraOverride(),
    }),
    [],
  );

  // A different model becoming active, or its code changing underneath the
  // click (e.g. an AI modify), invalidates whatever was selected — the old
  // handle's object no longer exists once the scene rebuilds.
  useEffect(() => {
    setSelection(null);
  }, [modelName, code]);

  if (job?.status === 'done' && job.url) {
    return (
      <video
        key={job.url}
        src={job.url}
        controls
        className="block h-full max-h-full w-full rounded-lg bg-black"
        aria-label="Rendered video preview"
      />
    );
  }

  const badgeClass =
    'absolute left-2 bottom-2 max-w-[calc(100%-16px)] rounded-md border border-border bg-[rgba(10,10,11,0.85)] px-2.5 py-1 text-[13px] text-text-dim';

  const hasScenes = Boolean(scenes?.length) || Boolean(code);
  if (!hasScenes) {
    return <div className="h-full w-full bg-black" aria-label="Empty timeline" />;
  }

  return (
    <div className="relative h-full w-full">
      <Viewport
        ref={viewportRef}
        code={code}
        scenes={scenes}
        onModelClick={enableClickFloater ? (anchor, handle) => setSelection({ anchor, handle }) : undefined}
        time={time}
        trackOverlays={trackOverlays}
        userCamera={userCamera}
        onUserCameraChange={onUserCameraChange}
      />
      {job?.status === 'running' && (
        <div className={badgeClass}>Rendering… {Math.round((job.progress ?? 0) * 100)}%</div>
      )}
      {job?.status === 'error' && (
        <div className={`${badgeClass} border-error text-error`}>
          Render failed{job.error ? `: ${job.error}` : ''}
        </div>
      )}
      {enableClickFloater && selection && (
        <ControlsFloater
          anchor={selection.anchor}
          title={modelName}
          objectHandle={selection.handle}
          tunables={tunables}
          onChange={onParamChange}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
});
