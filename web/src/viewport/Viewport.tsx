import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneRuntime, type SceneEntry } from './SceneRuntime';

interface Props {
  /** Single-scene shorthand used by most call sites. */
  code?: string;
  /**
   * Multi-scene co-view (merges). When provided and non-empty, takes
   * precedence over `code` — each entry is built into its own offset group.
   */
  scenes?: SceneEntry[];
  /** Fired when the user clicks any rendered object (not empty space). */
  onModelClick?: (point: { x: number; y: number }) => void;
  /**
   * Seconds fed to `updateScene` on every frame. Omit for a free-running
   * preview (Model screen); pass a timeline playhead to freeze/scrub the
   * scene at an exact instant instead (Video/Export screens).
   */
  time?: number;
}

/**
 * The WebGL preview panel. Debounces code changes (typing, slider drags, AI
 * output) and hot-reloads them into the SceneRuntime.
 */
export function Viewport({ code, scenes, onModelClick, time }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept in a ref so the mount-only effect below always calls the latest
  // handler without needing to recreate the runtime when it changes.
  const onModelClickRef = useRef(onModelClick);
  onModelClickRef.current = onModelClick;

  const resolvedScenes = useMemo<SceneEntry[]>(() => {
    if (scenes && scenes.length > 0) return scenes;
    if (code) return [{ id: 'scene', code }];
    return [];
  }, [scenes, code]);

  // Stable signature so object-identity churn on `scenes` doesn't thrash reloads.
  const scenesKey = useMemo(
    () => resolvedScenes.map((s) => `${s.id}:${s.code}`).join('\0'),
    [resolvedScenes],
  );
  const resolvedScenesRef = useRef(resolvedScenes);
  resolvedScenesRef.current = resolvedScenes;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const runtime = new SceneRuntime(canvasRef.current);
    runtime.onError = (err) => setError(err.message);
    runtime.onObjectClick = (point) => onModelClickRef.current?.(point);
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
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [scenesKey]);

  useEffect(() => {
    if (time !== undefined) runtimeRef.current?.setTime(time);
  }, [time]);

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 bg-black" ref={containerRef}>
      <canvas className="block h-full w-full" ref={canvasRef} />
      {error && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 whitespace-pre-wrap rounded-md border border-error bg-[rgba(30,8,10,0.92)] px-3 py-2 font-mono text-xs text-[#ffb4b8]">
          {error}
        </div>
      )}
    </div>
  );
}
