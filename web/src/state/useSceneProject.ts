import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_ASPECT_RATIO,
  DEFAULT_SCENE_CODE,
  deleteLayer as deleteLayerInCode,
  extractLayers,
  parseTunables,
  patchParam,
  renameLayer as renameLayerInCode,
  type AspectRatio,
  type ReferenceImage,
  type RenderSettings,
} from '@motionforge/shared';
import * as api from '../api/client';
import { exportSceneAs, type ModelFormat } from '../viewport/exportScene';
import { deriveTimelineTotal, MIN_CLIP_DURATION, type TimelineClip } from '../components/timeline/timelineMath';
import { useTimelinePlayback } from '../components/timeline/useTimelinePlayback';

/**
 * All editor state in one hook.
 *
 * The state holds an array of generated models (per SPEC.md Issue 2). One is
 * "active" at any time; `code`/`tunables` are derived from it, and edits
 * (setCode/setParam/modify) update the active model in place. This is the
 * single source of truth for both the Model screen's
 * viewport/editor and the Video screen's Materials pane.
 *
 * The state also holds an array of timeline clips. Every completed MP4 render
 * appends one clip for the active model so the Timeline on the Video screen
 * reflects rendered scenes without any separate bookkeeping.
 */

export interface Status {
  kind: 'info' | 'error';
  text: string;
}

export interface Mp4JobState {
  id: string;
  status: 'running' | 'done' | 'error';
  progress: number;
  message: string;
  url?: string;
  error?: string;
}

/** A single generated scene: source of truth for both editors, viewport, and Materials pane. */
export interface SceneModel {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  /**
   * When set, this row is a co-view merge of other models. Children stay
   * independent (not constrained); the viewport places them side-by-side on
   * the same ground plane. `code` mirrors the first child so
   * export/modify/tunables still have a primary target.
   */
  childIds?: string[];
  /**
   * When set, this row is a statically-imported GLB/glTF asset (e.g. a
   * Blender export) rather than AI-generated code. `code` stays a valid
   * empty scene module so the rest of the pipeline (tunables, layers,
   * export) keeps working harmlessly; the viewport renders the asset
   * directly via `assetUrl` instead of evaluating `code` — see
   * `SceneRuntime.createImportedModule`.
   */
  assetUrl?: string;
}

/** A rendered scene placed on the Video screen's timeline. */
export interface Clip {
  id: string;
  modelId: string;
  label: string;
  /** Seconds from t=0 on the timeline. */
  start: number;
  /** Length of the clip in seconds (matches the render's durationInSeconds). */
  duration: number;
}

const DEFAULT_MODEL_ID = 'default';

/** Placeholder module for imported assets — satisfies `validateSceneModule` but carries no geometry of its own (the viewport renders `assetUrl` instead). */
const IMPORTED_MODEL_CODE = `// Imported model — rendered from the attached GLB/glTF asset, not from this code.
export const PARAMS = {};
export function buildScene() { return {}; }
export function updateScene() {}
`;

/** Strip the extension and tidy up a filename for display, e.g. "robot_arm.glb" -> "robot arm". */
function nameFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.(glb|gltf)$/i, '');
  const spaced = withoutExt.replace(/[_-]+/g, ' ').trim();
  return spaced || 'Imported model';
}

function makeDefaultModel(): SceneModel {
  return {
    id: DEFAULT_MODEL_ID,
    name: 'Default model',
    code: DEFAULT_SCENE_CODE,
    createdAt: Date.now(),
  };
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Derive a short display name from a generation prompt. */
function nameFromPrompt(prompt: string, fallbackIndex: number): string {
  const trimmed = prompt.trim();
  if (!trimmed) return `Model ${fallbackIndex}`;
  const first = trimmed.split(/\s+/).slice(0, 6).join(' ');
  return first.length > 42 ? `${first.slice(0, 42)}…` : first;
}

/** Read `ANIMATION.duration` from a scene module when present. */
function parseAnimationDuration(code: string): number | undefined {
  const match = code.match(
    /export\s+const\s+ANIMATION\s*=\s*\{[\s\S]*?\bduration\s*:\s*([0-9]*\.?[0-9]+)/,
  );
  if (!match) return undefined;
  const duration = Number(match[1]);
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

/**
 * Pick which model to animate: a model whose name appears in the prompt
 * (longest match wins), else the active/selected model. Merge rows resolve
 * to their first child so animation targets a real scene module.
 */
function resolveModelForAnimation(
  prompt: string,
  models: SceneModel[],
  activeModelId: string,
): SceneModel | undefined {
  const lower = prompt.toLowerCase();
  const named = [...models]
    .filter((m) => m.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length)
    .find((m) => lower.includes(m.name.toLowerCase()));

  const pick = named ?? models.find((m) => m.id === activeModelId) ?? models[0];
  if (!pick) return undefined;
  if (pick.childIds?.length) {
    return models.find((m) => m.id === pick.childIds![0]) ?? pick;
  }
  return pick;
}

const MODELS_STORAGE_KEY = 'motionforge:models';

function loadPersistedModels(): SceneModel[] {
  try {
    const raw = localStorage.getItem(MODELS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SceneModel[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore corrupt data */ }
  return [makeDefaultModel()];
}

function persistModels(models: SceneModel[]): void {
  try {
    // Don't persist imported asset URLs (blob: URLs are session-only)
    const serializable = models.map(({ assetUrl, ...rest }) => rest);
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(serializable));
  } catch { /* storage full or unavailable */ }
}

export function useSceneProject() {
  // A default model is seeded so the app has valid code before the first generation.
  const [models, setModels] = useState<SceneModel[]>(loadPersistedModels);
  const [activeModelId, setActiveModelId] = useState<string>(() => {
    const persisted = loadPersistedModels();
    return persisted[0]?.id ?? DEFAULT_MODEL_ID;
  });
  /** Shift-click multi-select for building a merge; always includes the active id when non-empty. */
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(() => {
    const persisted = loadPersistedModels();
    return [persisted[0]?.id ?? DEFAULT_MODEL_ID];
  });
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipboardClip, setClipboardClip] = useState<Clip | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [mp4Job, setMp4Job] = useState<Mp4JobState | null>(null);
  // The Video Generation screen's aspect-ratio dropdown. Purely a display
  // concern here: it only controls how the live preview is letterboxed
  // (`AspectRatioBox`) and is not wired into generate/modify — see
  // `server/src/agents/aspectRatioComposition.ts` for the (currently unused)
  // code that would pass this to the camera-composition skill.
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(DEFAULT_ASPECT_RATIO);
  const pollRef = useRef<number | null>(null);

  // The active model backs the editor/viewport. It always resolves to a real
  // model even if `activeModelId` points to something that was removed later.
  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId) ?? models[0],
    [models, activeModelId],
  );
  const code = activeModel.code;

  // Persist models to localStorage on every change
  useEffect(() => {
    persistModels(models);
  }, [models]);

  /** Scene modules the Model-screen viewport should co-render (one entry, or several for a merge). */
  const viewportScenes = useMemo(
    () => resolveViewportScenes(activeModel, models),
    [activeModel, models],
  );

  const tunables = useMemo(() => {
    try {
      return parseTunables(code);
    } catch {
      return [];
    }
  }, [code]);

  // Single shared playhead for the whole app: the Video Generation and
  // Export screens both render a `Timeline` against this same clock and
  // preview the same derived clip, so scrubbing/playing on one screen stays
  // in lockstep on the other instead of each screen re-deriving its own.
  const timelineClips = useMemo<TimelineClip[]>(
    () => clips.map((c) => ({ id: c.id, label: c.label, start: c.start, duration: c.duration })),
    [clips],
  );
  const timelineTotal = useMemo(() => deriveTimelineTotal(timelineClips), [timelineClips]);
  const playback = useTimelinePlayback(timelineTotal);

  // Which clip (and therefore which model's code) is under the playhead
  // right now. Clips are assumed never to overlap — at most one model per
  // timeline second — so the first match is the only match.
  const activeClip = useMemo(
    () => clips.find((c) => playback.currentTime >= c.start && playback.currentTime < c.start + c.duration),
    [clips, playback.currentTime],
  );
  const previewModel = activeClip ? models.find((m) => m.id === activeClip.modelId) : undefined;
  const previewScenes = useMemo(
    () => (previewModel ? resolveViewportScenes(previewModel, models) : []),
    [previewModel, models],
  );
  const previewCode = previewScenes[0]?.code ?? previewModel?.code;
  const previewTime = activeClip ? playback.currentTime - activeClip.start : playback.currentTime;
  const previewModelName = previewModel?.name ?? activeModel.name;

  useEffect(
    () => () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    },
    [],
  );

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setStatus(null);
    try {
      await fn();
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }, []);

  // Patch just the active model in the array. Accepts either a value or an
  // updater function, matching React's `setState` shape so external callers
  // can use `(current) => …` when they only have the current-active value.
  const setCode: Dispatch<SetStateAction<string>> = useCallback(
    (next) => {
      setModels((current) =>
        current.map((m) => {
          if (m.id !== activeModelId) return m;
          const value = typeof next === 'function' ? (next as (prev: string) => string)(m.code) : next;
          return { ...m, code: value };
        }),
      );
    },
    [activeModelId],
  );

  const generate = useCallback(
    (prompt: string, image?: ReferenceImage) =>
      run('Generating model…', async () => {
        const result = await api.generate(prompt, image);
        const id = makeId();
        setModels((current) => [
          ...current,
          {
            id,
            name: result.title || nameFromPrompt(prompt, current.length + 1),
            code: result.code,
            createdAt: Date.now(),
          },
        ]);
        setActiveModelId(id);
        setSelectedModelIds([id]);
        setStatus({
          kind: 'info',
          text:
            result.source === 'template'
              ? 'Generated with the offline template (set OPENROUTER_API_KEY for AI generation).'
              : 'Model generated by the AI agent.',
        });
      }),
    [run],
  );

  /**
   * Imports a Blender-exported GLB/glTF file as a new model row — no AI
   * involved, no server round-trip. The file is kept as an in-memory blob
   * URL (not persisted across reloads), and appears in both the Models &
   * Layers list and the Video screen's Materials pane (which reuses this
   * same `models` array).
   */
  const importModel = useCallback((file: File) => {
    const id = makeId();
    const assetUrl = URL.createObjectURL(file);
    setModels((current) => [
      ...current,
      {
        id,
        name: nameFromFileName(file.name),
        code: IMPORTED_MODEL_CODE,
        createdAt: Date.now(),
        assetUrl,
      },
    ]);
    setActiveModelId(id);
    setSelectedModelIds([id]);
    setStatus({ kind: 'info', text: `Imported “${file.name}”.` });
  }, []);

  const modify = useCallback(
    (prompt: string, image?: ReferenceImage, targetModelId?: string) =>
      run('Modifying model…', async () => {
        const modelId = targetModelId ?? activeModelId;
        const target = models.find((m) => m.id === modelId) ?? activeModel;
        const result = await api.modify(prompt, target.code, image);
        setModels((current) =>
          current.map((m) =>
            m.id === target.id
              ? {
                  ...m,
                  code: result.code,
                  // Only replace the seeded placeholder name — a name the user
                  // already set (by generation or manual rename) is left alone.
                  name: m.name === 'Default model' && result.title ? result.title : m.name,
                }
              : m,
          ),
        );
        if (target.id !== activeModelId) {
          setActiveModelId(target.id);
          setSelectedModelIds([target.id]);
        }
        setStatus({ kind: 'info', text: 'Model modified by the AI agent.' });
      }),
    [run, models, activeModel, activeModelId],
  );

  /**
   * Model-screen single-input gate: asks the server to classify the message
   * as a new build or an edit of something that already exists, then routes
   * to `generate`/`modify` accordingly, instead of the composer's Enter key
   * hard-coding one of them (previously always `modify`, which meant a first
   * "generate a red car" edited the seeded placeholder in place).
   *
   * Never throws: a classification failure (or no API key) falls back to
   * `generate`, same as the server-side default — an unroutable message
   * should append a new model rather than overwrite one the user liked.
   */
  const route = useCallback(
    async (prompt: string, image?: ReferenceImage) => {
      const modelContext = models.map((m) => ({ id: m.id, name: m.name, layers: extractLayers(m.code) }));
      let intent: Awaited<ReturnType<typeof api.classifyIntent>> = { intent: 'generate' };
      try {
        intent = await api.classifyIntent(prompt, modelContext, activeModelId);
      } catch {
        intent = { intent: 'generate' };
      }
      if (intent.intent === 'modify' && models.some((m) => m.id === intent.targetModelId)) {
        await modify(prompt, image, intent.targetModelId);
      } else {
        await generate(prompt, image);
      }
    },
    [models, activeModelId, modify, generate],
  );

  /**
   * Video-screen Generate: run the animation skill against the model named
   * in the prompt, or the active selection if none is named.
   */
  const animate = useCallback(
    (prompt: string) =>
      run('Animating model…', async () => {
        const target = resolveModelForAnimation(prompt, models, activeModelId);
        if (!target) {
          throw new Error('No model available to animate. Generate a model on the Model screen first.');
        }
        const result = await api.animate(prompt, target.code);
        setModels((current) =>
          current.map((m) =>
            m.id === target.id
              ? {
                  ...m,
                  code: result.code,
                }
              : m,
          ),
        );
        setActiveModelId(target.id);
        setSelectedModelIds([target.id]);

        const duration = parseAnimationDuration(result.code) ?? 3;
        setClips((current) => {
          const start =
            current.length === 0
              ? 0
              : Math.ceil(Math.max(...current.map((c) => c.start + c.duration)));
          return [
            ...current,
            {
              id: makeId(),
              modelId: target.id,
              label: `${target.name} · animated`,
              start,
              duration,
            },
          ].sort((a, b) => a.start - b.start);
        });

        setStatus({
          kind: 'info',
          text: `Animated “${target.name}” (${duration.toFixed(duration % 1 === 0 ? 0 : 1)}s one-shot).`,
        });
      }),
    [run, models, activeModelId],
  );

  // Slider/switch changes are code edits: patch the PARAMS literal in place.
  const setParam = useCallback(
    (name: string, value: number | boolean | string) => {
      setCode((current) => patchParam(current, name, value));
    },
    [setCode],
  );

  const setActiveModel = useCallback((id: string) => {
    setActiveModelId(id);
    setSelectedModelIds([id]);
  }, []);

  /**
   * Click selects one model; shift-click toggles it in the multi-select set
   * used for Merge (does not remove the previous selection).
   */
  const selectModel = useCallback((id: string, options?: { shiftKey?: boolean }) => {
    if (options?.shiftKey) {
      setSelectedModelIds((current) => {
        if (current.includes(id)) {
          if (current.length <= 1) return current;
          return current.filter((entry) => entry !== id);
        }
        return [...current, id];
      });
      setActiveModelId(id);
      return;
    }
    setActiveModelId(id);
    setSelectedModelIds([id]);
  }, []);

  /** Renames a model in the Models & Layers list (display name only). */
  const renameModel = useCallback((modelId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setModels((current) =>
      current.map((m) => (m.id === modelId && m.name !== trimmed ? { ...m, name: trimmed } : m)),
    );
    setClips((current) =>
      current.map((c) => (c.modelId === modelId && c.label !== trimmed ? { ...c, label: trimmed } : c)),
    );
  }, []);

  /** Renames a mesh-group key on a model's scene module (code stays source of truth). */
  const renameModelLayer = useCallback((modelId: string, oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setModels((current) =>
      current.map((m) => {
        if (m.id !== modelId || m.childIds?.length) return m;
        const code = renameLayerInCode(m.code, oldName, trimmed);
        return code === m.code ? m : { ...m, code };
      }),
    );
  }, []);

  /** Removes a mesh-group from a model's scene module so it no longer renders. */
  const deleteModelLayer = useCallback((modelId: string, layerName: string) => {
    setModels((current) =>
      current.map((m) => {
        if (m.id !== modelId || m.childIds?.length) return m;
        const code = deleteLayerInCode(m.code, layerName);
        return code === m.code ? m : { ...m, code };
      }),
    );
  }, []);

  /** Removes an entire model from the project. */
  const deleteModel = useCallback((modelId: string) => {
    setModels((current) => {
      const next = current.filter((m) => m.id !== modelId);
      const cleaned = next.map((m) =>
        m.childIds?.includes(modelId)
          ? { ...m, childIds: m.childIds.filter((id) => id !== modelId) }
          : m,
      );
      if (cleaned.length === 0) return [makeDefaultModel()];
      return cleaned;
    });
    setSelectedModelIds((ids) => ids.filter((id) => id !== modelId));
  }, []);

  /**
   * Creates a co-view merge from the current multi-selection. Children remain
   * separate models; the new row only groups them for side-by-side viewing.
   */
  const mergeSelectedModels = useCallback(() => {
    const ids = selectedModelIds.filter((id) => models.some((m) => m.id === id));
    if (ids.length < 2) {
      setStatus({ kind: 'error', text: 'Shift-click at least two models, then merge.' });
      return;
    }

    // Flatten nested merges so the viewport always gets leaf scene modules.
    const leafIds: string[] = [];
    for (const id of ids) {
      const model = models.find((m) => m.id === id);
      if (!model) continue;
      if (model.childIds?.length) {
        for (const childId of model.childIds) {
          if (!leafIds.includes(childId)) leafIds.push(childId);
        }
      } else if (!leafIds.includes(id)) {
        leafIds.push(id);
      }
    }
    if (leafIds.length < 2) {
      setStatus({ kind: 'error', text: 'Need at least two distinct models to merge.' });
      return;
    }

    const children = leafIds
      .map((id) => models.find((m) => m.id === id))
      .filter((m): m is SceneModel => Boolean(m));
    const primary = children[0];
    const id = makeId();
    const name = children.map((m) => m.name).join(' + ');
    setModels((current) => [
      ...current,
      {
        id,
        name: name.length > 48 ? `${name.slice(0, 48)}…` : name,
        code: primary.code,
        createdAt: Date.now(),
        childIds: leafIds,
      },
    ]);
    setActiveModelId(id);
    setSelectedModelIds([id]);
    setStatus({
      kind: 'info',
      text: `Merged ${children.length} models onto one plane (not constrained — side-by-side view).`,
    });
  }, [selectedModelIds, models]);

  // Places a 1-second clip for `modelId` at the given whole second, dropped
  // from the Materials list. Per the one-model-per-second invariant, any
  // clip already occupying that second is replaced.
  const addClipAtSecond = useCallback(
    (modelId: string, second: number) => {
      const model = models.find((m) => m.id === modelId);
      if (!model) return;
      const start = Math.max(0, Math.floor(second));
      setClips((current) => [
        ...current.filter((c) => !(start < c.start + c.duration && start + 1 > c.start)),
        { id: makeId(), modelId, label: model.name, start, duration: 1 },
      ].sort((a, b) => a.start - b.start));
    },
    [models],
  );

  // Timeline right-click menu: delete removes a clip outright; copy stashes
  // it in an in-memory clipboard; paste drops the stashed clip at the given
  // whole second, replacing any clip already occupying that span (same
  // overlap rule as `addClipAtSecond`).
  const deleteClip = useCallback((id: string) => {
    setClips((current) => current.filter((c) => c.id !== id));
  }, []);

  const copyClip = useCallback(
    (id: string) => {
      const clip = clips.find((c) => c.id === id);
      if (clip) setClipboardClip(clip);
    },
    [clips],
  );

  const pasteClip = useCallback(
    (second: number) => {
      if (!clipboardClip) return;
      const start = Math.max(0, Math.floor(second));
      const duration = clipboardClip.duration;
      setClips((current) =>
        [
          ...current.filter((c) => !(start < c.start + c.duration && start + duration > c.start)),
          { ...clipboardClip, id: makeId(), start },
        ].sort((a, b) => a.start - b.start),
      );
    },
    [clipboardClip],
  );

  // Timeline resize handle: changes only how long a clip is shown, not its
  // playback rate — `updateScene`'s `time` still advances one second per
  // second, so a periodic animation keeps looping past the clip's original
  // length and a one-shot animation does whatever its own code does at
  // large `time` values. Clamped to a minimum width and to the start of the
  // next clip on the timeline so resizing can't create an overlap.
  const resizeClip = useCallback((id: string, duration: number) => {
    setClips((current) => {
      const clip = current.find((c) => c.id === id);
      if (!clip) return current;
      const next = current
        .filter((c) => c.id !== id && c.start >= clip.start)
        .reduce<Clip | undefined>((closest, c) => (!closest || c.start < closest.start ? c : closest), undefined);
      const maxDuration = next ? next.start - clip.start : Infinity;
      const clamped = Math.min(Math.max(duration, MIN_CLIP_DURATION), maxDuration);
      return current.map((c) => (c.id === id ? { ...c, duration: clamped } : c));
    });
  }, []);

  const exportCode = useCallback(
    (format: api.CodeExportFormat = 'standalone') =>
      run('Exporting code…', async () => {
        const blob = await api.exportCodeZip(code, format);
        const fileName = `zendai-scene-${format}.zip`;
        downloadBlob(blob, fileName);
        setStatus({ kind: 'info', text: `Project exported as ${fileName}.` });
      }),
    [run, code],
  );

  const exportModel = useCallback(
    (format: ModelFormat) =>
      run(`Exporting ${format.toUpperCase()}…`, async () => {
        await exportSceneAs(code, format);
        setStatus({ kind: 'info', text: `Scene exported as scene.${format}.` });
      }),
    [run, code],
  );

  const exportMp4 = useCallback(
    (settings: RenderSettings) =>
      run('Starting MP4 render…', async () => {
        const { jobId } = await api.startMp4Export(code, settings);
        setMp4Job({ id: jobId, status: 'running', progress: 0, message: 'Queued' });
        // Snapshot which model this render is for; the active model could
        // change while polling and we want the clip labelled correctly.
        const renderModelId = activeModelId;
        const renderModelName = activeModel.name;
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        pollRef.current = window.setInterval(async () => {
          try {
            const job = await api.getMp4Job(jobId);
            setMp4Job({
              id: jobId,
              status: job.status,
              progress: job.progress,
              message: job.message,
              url: job.result?.url,
              error: job.error,
            });
            if (job.status !== 'running' && pollRef.current !== null) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
            // On success, append the render as a new clip at the end of the timeline.
            if (job.status === 'done') {
              setClips((current) => {
                const nextStart = current.reduce(
                  (max, c) => Math.max(max, c.start + c.duration),
                  0,
                );
                return [
                  ...current,
                  {
                    id: makeId(),
                    modelId: renderModelId,
                    label: renderModelName,
                    start: nextStart,
                    duration: settings.durationInSeconds,
                  },
                ];
              });
            }
          } catch {
            // transient poll failure — keep polling
          }
        }, 2000);
      }),
    [run, code, activeModelId, activeModel.name],
  );

  /** Clear models/clips and reseed the Default model (unlink / no linked repo). */
  const resetToDefault = useCallback(() => {
    const seed = makeDefaultModel();
    setModels([seed]);
    setActiveModelId(seed.id);
    setSelectedModelIds([seed.id]);
    setClips([]);
    setMp4Job(null);
    setStatus({ kind: 'info', text: 'Reset to Default model.' });
  }, []);

  /** Replace local models with scripts pulled from a linked GitHub repo. Clears timeline clips. */
  const replaceFromRemote = useCallback(
    (remote: Array<{ id: string; name: string; code: string }>) => {
      if (remote.length === 0) {
        resetToDefault();
        setStatus({
          kind: 'info',
          text: 'Linked repo has no models — reset to Default.',
        });
        return;
      }
      const next: SceneModel[] = remote.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        createdAt: Date.now(),
      }));
      setModels(next);
      setActiveModelId(next[0].id);
      setSelectedModelIds([next[0].id]);
      setClips([]);
      setStatus({
        kind: 'info',
        text: `Loaded ${next.length} model${next.length === 1 ? '' : 's'} from linked GitHub repo.`,
      });
    },
    [resetToDefault],
  );

  return {
    code,
    setCode,
    tunables,
    setParam,
    busy,
    status,
    mp4Job,
    models,
    activeModelId,
    selectedModelIds,
    setActiveModel,
    selectModel,
    mergeSelectedModels,
    renameModel,
    renameModelLayer,
    deleteModelLayer,
    deleteModel,
    viewportScenes,
    clips,
    addClipAtSecond,
    deleteClip,
    copyClip,
    pasteClip,
    resizeClip,
    hasClipboardClip: clipboardClip !== null,
    timelineClips,
    timelineTotal,
    playback,
    previewCode,
    previewScenes,
    previewTime,
    previewModelName,
    generate,
    modify,
    route,
    importModel,
    animate,
    aspectRatio,
    setAspectRatio,
    exportCode,
    exportModel,
    exportMp4,
    replaceFromRemote,
    resetToDefault,
  };
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Resolve a model (or merge) into the scene-module entries the viewport should load. */
export function resolveViewportScenes(
  model: SceneModel,
  models: SceneModel[],
): Array<{ id: string; code: string; assetUrl?: string }> {
  if (model.childIds?.length) {
    const scenes: Array<{ id: string; code: string; assetUrl?: string }> = [];
    for (const childId of model.childIds) {
      const child = models.find((m) => m.id === childId);
      if (child?.code) scenes.push({ id: child.id, code: child.code, assetUrl: child.assetUrl });
    }
    if (scenes.length > 0) return scenes;
  }
  return [{ id: model.id, code: model.code, assetUrl: model.assetUrl }];
}
