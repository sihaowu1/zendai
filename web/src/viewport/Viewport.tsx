import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ArrowsClockwise, GridFour, Lightbulb } from '@phosphor-icons/react';
import type { CameraSpec } from '@motionforge/shared';
import { SceneRuntime, type ObjectHandle, type SceneEntry } from './SceneRuntime';
import type { TrackOverlay } from './trackOverlay';
import { IconButton } from '../components/ui/Button';

interface Props {
  /** Single-scene shorthand used by most call sites. */
  code?: string;
  /**
   * Multi-scene co-view (merges). When provided and non-empty, takes
   * precedence over `code` — each entry is built into its own offset group.
   * Fused merges are a single entry; legacy co-view still supported.
   */
  scenes?: SceneEntry[];
  /**
   * Fired when the user clicks any rendered object (not empty space). `handle`
   * reads/writes that exact object's position and Y rotation directly in the
   * runtime — no PARAMS, code, or AI involved.
   */
  onModelClick?: (point: { x: number; y: number }, handle: ObjectHandle) => void;
  /**
   * Seconds fed to `updateScene` on every frame. Omit for a free-running
   * preview (Model screen); pass a timeline playhead to freeze/scrub the
   * scene at an exact instant instead (Video/Export screens).
   */
  time?: number;
  /** Host-side part tracks for multi-clip NLE playback (see `trackOverlay.ts`). */
  trackOverlays?: TrackOverlay[];
  /** Shows the grid/lighting/camera toolbar. Off for read-only previews. */
  showToolbar?: boolean;
  /** Persisted user orbit; when set, applied after the scene loads. */
  userCamera?: CameraSpec | null;
  /** Fired when the user finishes orbiting/panning/zooming. */
  onUserCameraChange?: (camera: CameraSpec) => void;
  /** When false, disables orbit controls so the preview is view-only. Default true. */
  interactive?: boolean;
}

/** Imperative escape hatch for axes toggle and reading the live orbit for MP4 export. */
export interface ViewportHandle {
  setAxesVisible: (visible: boolean) => void;
  getCameraSpec: () => CameraSpec | null;
  getCameraHandle: () => ObjectHandle | null;
  clearCameraOverride: () => void;
}

/**
 * The WebGL preview panel. Debounces code changes (typing, slider drags, AI
 * output) and hot-reloads them into the SceneRuntime.
 */
export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(
  { code, scenes, onModelClick, time, trackOverlays, showToolbar = false, userCamera, onUserCameraChange, interactive = true },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState(false);
  const [fill, setFill] = useState(false);
  // Kept in a ref so the mount-only effect below always calls the latest
  // handler without needing to recreate the runtime when it changes.
  const onModelClickRef = useRef(onModelClick);
  onModelClickRef.current = onModelClick;
  const onUserCameraChangeRef = useRef(onUserCameraChange);
  onUserCameraChangeRef.current = onUserCameraChange;
  const userCameraRef = useRef(userCamera);
  userCameraRef.current = userCamera;

  useImperativeHandle(
    ref,
    () => ({
      setAxesVisible: (visible) => runtimeRef.current?.setAxesVisible(visible),
      getCameraSpec: () => runtimeRef.current?.getCameraSpec() ?? null,
      getCameraHandle: () => runtimeRef.current?.getCameraHandle() ?? null,
      clearCameraOverride: () => runtimeRef.current?.clearCameraOverride(),
    }),
    [],
  );

  const resolvedScenes = useMemo<SceneEntry[]>(() => {
    if (scenes && scenes.length > 0) return scenes;
    if (code) return [{ id: 'scene', code }];
    return [];
  }, [scenes, code]);

  // Stable signature so object-identity churn on `scenes` doesn't thrash reloads.
  const scenesKey = useMemo(
    () => resolvedScenes.map((s) => `${s.id}:${s.code}:${s.assetUrl ?? ''}`).join('\0'),
    [resolvedScenes],
  );
  const resolvedScenesRef = useRef(resolvedScenes);
  resolvedScenesRef.current = resolvedScenes;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const runtime = new SceneRuntime(canvasRef.current);
    runtime.onError = (err) => setError(err.message);
    runtime.onObjectClick = (point, handle) => onModelClickRef.current?.(point, handle);
    runtime.onCameraChange = (spec) => onUserCameraChangeRef.current?.(spec);
    if (!interactive) runtime.setControlsEnabled(false);
    runtimeRef.current = runtime;
    const observer = new ResizeObserver(([entry]) => {
      runtime.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setError(null);
      runtimeRef.current
        ?.setScenes(resolvedScenesRef.current)
        .then(() => {
          const cam = userCameraRef.current;
          if (cam) runtimeRef.current?.setUserCamera(cam);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [scenesKey]);

  useEffect(() => {
    if (time !== undefined) runtimeRef.current?.setTime(time);
  }, [time]);

  useEffect(() => {
    runtimeRef.current?.setTrackOverlays(trackOverlays ?? []);
  }, [trackOverlays]);

  // Re-apply a restored orbit when navigating between Video/Export screens.
  useEffect(() => {
    if (userCamera) runtimeRef.current?.setUserCamera(userCamera);
  }, [userCamera]);

  // The runtime holds these across rebuilds, so each effect only has to push
  // the change; `rebuild` re-applies whatever it was last told.
  useEffect(() => {
    runtimeRef.current?.setGridVisible(grid);
  }, [grid]);

  useEffect(() => {
    runtimeRef.current?.setFillLightsVisible(fill);
  }, [fill]);

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 bg-black" ref={containerRef}>
      <canvas className="block h-full w-full" ref={canvasRef} />
      {showToolbar && (
        <div
          // Floated over the canvas rather than given its own strip: the
          // viewport is the one place on screen that should feel uninterrupted.
          className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-lg border border-border bg-bg-panel/85 p-1 backdrop-blur-sm"
          role="toolbar"
          aria-label="Viewport settings"
        >
          <IconButton
            active={grid}
            className="h-7 w-7"
            title="Toggle grid"
            aria-label="Toggle grid"
            aria-pressed={grid}
            onClick={() => setGrid((v) => !v)}
          >
            <GridFour size={15} aria-hidden="true" />
          </IconButton>
          <IconButton
            active={fill}
            className="h-7 w-7"
            title="Toggle fill lighting"
            aria-label="Toggle fill lighting"
            aria-pressed={fill}
            onClick={() => setFill((v) => !v)}
          >
            <Lightbulb size={15} aria-hidden="true" />
          </IconButton>
          <IconButton
            className="h-7 w-7"
            title="Reset camera"
            aria-label="Reset camera"
            onClick={() => runtimeRef.current?.resetCamera()}
          >
            <ArrowsClockwise size={15} aria-hidden="true" />
          </IconButton>
        </div>
      )}
      {error && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 whitespace-pre-wrap rounded-md border border-error bg-[rgba(30,8,10,0.92)] px-3 py-2 font-mono text-xs text-[#ffb4b8]">
          {error}
        </div>
      )}
    </div>
  );
});
