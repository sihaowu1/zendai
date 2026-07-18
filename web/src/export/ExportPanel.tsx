import { useState } from 'react';
import type { RenderSettings } from '@motionforge/shared';
import type { Mp4JobState } from '../state/useSceneProject';

interface Props {
  busy: string | null;
  mp4Job: Mp4JobState | null;
  onExportCode: () => void;
  onExportMp4: (settings: RenderSettings) => void;
}

const RESOLUTIONS = [
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '1080 × 1080 (square)', width: 1080, height: 1080 },
  { label: '1080 × 1920 (vertical)', width: 1080, height: 1920 },
];

/**
 * Export workflows: download the project as code (ZIP) or render it to MP4
 * through the Remotion pipeline, with live progress and a download link.
 */
export function ExportPanel({ busy, mp4Job, onExportCode, onExportMp4 }: Props) {
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(6);
  const [resolution, setResolution] = useState(0);
  const rendering = mp4Job?.status === 'running';

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3">
      <h2 className="m-0 flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-dim">Export</h2>
      <button
        type="button"
        className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        disabled={busy !== null}
        onClick={onExportCode}
      >
        Export code (.zip)
      </button>

      <div className="grid grid-cols-3 gap-1.5">
        <label className="flex flex-col gap-1 text-[11px] text-text-dim">
          FPS
          <select
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-text focus:outline focus:outline-1 focus:outline-accent"
            value={fps}
            onChange={(event) => setFps(Number(event.target.value))}
          >
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-text-dim">
          Seconds
          <input
            type="number"
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-text focus:outline focus:outline-1 focus:outline-accent"
            min={1}
            max={60}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-text-dim">
          Size
          <select
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-text focus:outline focus:outline-1 focus:outline-accent"
            value={resolution}
            onChange={(event) => setResolution(Number(event.target.value))}
          >
            {RESOLUTIONS.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        disabled={busy !== null || rendering}
        onClick={() =>
          onExportMp4({
            fps,
            durationInSeconds: Math.min(60, Math.max(1, duration)),
            width: RESOLUTIONS[resolution].width,
            height: RESOLUTIONS[resolution].height,
          })
        }
      >
        {rendering ? 'Rendering…' : 'Render MP4 (Remotion)'}
      </button>

      {mp4Job && (
        <div className="flex flex-col gap-2">
          {mp4Job.status === 'running' && (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full bg-accent transition-[width] duration-400 ease-out"
                  style={{ width: `${Math.round(mp4Job.progress * 100)}%` }}
                />
              </div>
              <p className="m-0 text-xs leading-relaxed text-text-dim">
                {mp4Job.message} ({Math.round(mp4Job.progress * 100)}%)
              </p>
            </>
          )}
          {mp4Job.status === 'done' && mp4Job.url && (
            <a
              className="inline-block rounded-md bg-ok px-3.5 py-2 text-center font-semibold text-white no-underline"
              href={mp4Job.url}
              download
            >
              Download MP4
            </a>
          )}
          {mp4Job.status === 'error' && (
            <p className="m-0 text-xs leading-relaxed text-error">{mp4Job.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
