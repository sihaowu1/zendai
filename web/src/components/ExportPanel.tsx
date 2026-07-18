import { useState } from 'react';
import type { RenderSettings } from '@motionforge/shared';
import type { Mp4JobState } from '../state/useSceneProject';
import { Button, ButtonLink } from './ui/Button';
import { PANEL, PANEL_HEADER } from './ui/Panel';
import { FIELD, FIELD_LABEL } from './ui/Input';

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
    <section className={`flex flex-col gap-3 ${PANEL} p-4`}>
      <h2 className={PANEL_HEADER}>
        Export
      </h2>
      <Button variant="primary" type="button" disabled={busy !== null} onClick={onExportCode}>
        Export code (.zip)
      </Button>

      <div className="grid grid-cols-3 gap-1.5">
        <label className={FIELD_LABEL}>
          FPS
          <select
            className={FIELD}
            value={fps}
            onChange={(event) => setFps(Number(event.target.value))}
          >
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>
        <label className={FIELD_LABEL}>
          Seconds
          <input
            type="number"
            className={FIELD}
            min={1}
            max={60}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </label>
        <label className={FIELD_LABEL}>
          Size
          <select
            className={FIELD}
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

      <Button
        variant="primary"
        type="button"
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
      </Button>

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
              <p className="m-0 text-[13px] leading-normal text-text-faint">
                {mp4Job.message} ({Math.round(mp4Job.progress * 100)}%)
              </p>
            </>
          )}
          {mp4Job.status === 'done' && mp4Job.url && (
            <ButtonLink variant="success" href={mp4Job.url} download>
              Download MP4
            </ButtonLink>
          )}
          {mp4Job.status === 'error' && (
            <p className="m-0 text-[14px] leading-relaxed text-error">{mp4Job.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
