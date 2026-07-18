import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_BLENDER_CODE,
  DEFAULT_SCENE_CODE,
  parseTunables,
  patchParam,
  type RenderSettings,
} from '@motionforge/shared';
import * as api from '../api/client';
import { deriveTimelineTotal, type TimelineClip } from '../timeline/timelineMath';
import { useTimelinePlayback } from '../timeline/useTimelinePlayback';

/**
 * All editor state in one hook.
 *
 * The state holds an array of generated models (per SPEC.md Issue 2). One is
 * "active" at any time; `code`/`blenderCode`/`tunables` are derived from it,
 * and edits (setCode/setBlenderCode/setParam/modify) update the active model
 * in place. This is the single source of truth for both the Model screen's
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
  blenderCode: string;
  createdAt: number;
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

export function useSceneProject() {
  // A default model is seeded so the app has valid code before the first generation.
  const [models, setModels] = useState<SceneModel[]>(() => [
    {
      id: DEFAULT_MODEL_ID,
      name: 'Default scene',
      code: DEFAULT_SCENE_CODE,
      blenderCode: DEFAULT_BLENDER_CODE,
      createdAt: Date.now(),
    },
  ]);
  const [activeModelId, setActiveModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [mp4Job, setMp4Job] = useState<Mp4JobState | null>(null);
  const [blenderStatus, setBlenderStatus] = useState<api.BlenderStatus | null>(null);
  const pollRef = useRef<number | null>(null);

  // The active model backs the editor/viewport. It always resolves to a real
  // model even if `activeModelId` points to something that was removed later.
  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId) ?? models[0],
    [models, activeModelId],
  );
  const code = activeModel.code;
  const blenderCode = activeModel.blenderCode;

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
  const previewCode = previewModel?.code;
  const previewTime = activeClip ? playback.currentTime - activeClip.start : playback.currentTime;
  const previewModelName = previewModel?.name ?? activeModel.name;

  useEffect(() => {
    api.getBlenderStatus().then(setBlenderStatus).catch(() => setBlenderStatus(null));
  }, []);

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
  const updateActiveField = useCallback(
    <K extends 'code' | 'blenderCode'>(field: K, next: SetStateAction<string>) => {
      setModels((current) =>
        current.map((m) => {
          if (m.id !== activeModelId) return m;
          const value = typeof next === 'function' ? (next as (prev: string) => string)(m[field]) : next;
          return { ...m, [field]: value };
        }),
      );
    },
    [activeModelId],
  );

  const setCode: Dispatch<SetStateAction<string>> = useCallback(
    (next) => updateActiveField('code', next),
    [updateActiveField],
  );
  const setBlenderCode: Dispatch<SetStateAction<string>> = useCallback(
    (next) => updateActiveField('blenderCode', next),
    [updateActiveField],
  );

  const generate = useCallback(
    (prompt: string) =>
      run('Generating scene…', async () => {
        const result = await api.generate(prompt);
        const id = makeId();
        setModels((current) => [
          ...current,
          {
            id,
            name: nameFromPrompt(prompt, current.length + 1),
            code: result.code,
            blenderCode: result.blenderCode ?? DEFAULT_BLENDER_CODE,
            createdAt: Date.now(),
          },
        ]);
        setActiveModelId(id);
        setStatus({
          kind: 'info',
          text:
            result.source === 'template'
              ? 'Generated with the offline template (set OPENROUTER_API_KEY for AI generation).'
              : 'Scene generated by the AI agent.',
        });
      }),
    [run],
  );

  const modify = useCallback(
    (prompt: string) =>
      run('Modifying scene…', async () => {
        const result = await api.modify(prompt, code, blenderCode);
        setModels((current) =>
          current.map((m) =>
            m.id === activeModelId
              ? {
                  ...m,
                  code: result.code,
                  blenderCode: result.blenderCode ?? m.blenderCode,
                }
              : m,
          ),
        );
        setStatus({ kind: 'info', text: 'Scene modified by the AI agent.' });
      }),
    [run, code, blenderCode, activeModelId],
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
  }, []);

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

  const exportCode = useCallback(
    () =>
      run('Exporting code…', async () => {
        const blob = await api.exportCodeZip(code, blenderCode);
        downloadBlob(blob, 'motionforge-scene.zip');
        setStatus({ kind: 'info', text: 'Project exported as motionforge-scene.zip.' });
      }),
    [run, code, blenderCode],
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

  const syncBlender = useCallback(
    () =>
      run('Sending scene to Blender…', async () => {
        const result = await api.blenderSync(blenderCode);
        setStatus({ kind: 'info', text: `Blender: ${result.output || 'scene updated'}` });
      }),
    [run, blenderCode],
  );

  const runBlenderAgent = useCallback(
    (prompt: string) =>
      run('Blender agent working…', async () => {
        const result = await api.blenderAgent(prompt);
        setStatus({ kind: 'info', text: `Blender agent: ${result.finalText.slice(0, 300)}` });
      }),
    [run],
  );

  return {
    code,
    setCode,
    blenderCode,
    setBlenderCode,
    tunables,
    setParam,
    busy,
    status,
    mp4Job,
    blenderStatus,
    models,
    activeModelId,
    setActiveModel,
    clips,
    addClipAtSecond,
    timelineClips,
    timelineTotal,
    playback,
    previewCode,
    previewTime,
    previewModelName,
    generate,
    modify,
    exportCode,
    exportMp4,
    syncBlender,
    runBlenderAgent,
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
