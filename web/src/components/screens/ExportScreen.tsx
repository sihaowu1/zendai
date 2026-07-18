import { useState } from 'react';
import type { RenderSettings, TunableParam } from '@motionforge/shared';
import { RequireAuth } from '../../auth/RequireAuth';
import { useAuth } from '../../auth/useAuth';
import { PublishForm } from '../PublishForm';
import type { ParamChange } from '../controls/ControlsPanel';
import { useGitHubRepo } from '../useGitHubRepo';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { Timeline } from '../timeline/Timeline';
import type { TimelineClip } from '../timeline/timelineMath';
import type { TimelinePlayback } from '../timeline/useTimelinePlayback';
import type { Mp4JobState } from '../../state/useSceneProject';
import { VideoPreview } from '../VideoPreview';

export interface ExportScreenProps {
  /** Active model scene module source. */
  code: string;
  /** Active model Blender script. */
  blenderCode: string;
  /** Display name used as export title. */
  modelName: string;
  /** Busy label from `useSceneProject` (blocks export actions while set). */
  busy: string | null;
  /** Download ZIP via `useSceneProject.exportCode`. */
  onExportCode: () => void;
  /** Start Remotion MP4 via `useSceneProject.exportMp4`. */
  onExportMp4: (settings: RenderSettings) => void;
  /** The active model's tunables (from `useSceneProject.tunables`), edited via the click floater. */
  tunables: TunableParam[];
  /** Patches a tunable on the active model (from `useSceneProject.setParam`). */
  onParamChange: ParamChange;
  /** Current MP4 render job from `useSceneProject.mp4Job`. */
  mp4Job: Mp4JobState | null;
  /** Timeline clips (from `useSceneProject.timelineClips`), rendered read-only below the preview. */
  timelineClips: TimelineClip[];
  /** Timeline length in seconds (from `useSceneProject.timelineTotal`). */
  timelineTotal: number;
  /**
   * Shared playhead (from `useSceneProject.playback`) — the same clock the
   * Video Generation screen's timeline reads, so the preview here shows
   * exactly what that screen shows without re-deriving anything.
   */
  playback: TimelinePlayback;
  /** Scene code for whatever's under the playhead (from `useSceneProject.previewCode`); undefined shows a black screen. */
  previewCode: string | undefined;
  /** Playhead position local to the active clip (from `useSceneProject.previewTime`). */
  previewTime: number;
  /** Display name for whatever's under the playhead (from `useSceneProject.previewModelName`). */
  previewModelName: string;
}

/** Video aspect ratio (matches `config/default.config.json`'s render resolution, 1280x720). */
const VIDEO_ASPECT_RATIO = '16 / 9';

const RESOLUTIONS = [
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '1080 × 1080 (square)', width: 1080, height: 1080 },
  { label: '1080 × 1920 (vertical)', width: 1080, height: 1920 },
];

/**
 * Screen 3 — Export.
 *
 *   +------------------+---------------------------+
 *   | Export options   |      Resulting Video       |
 *   | Export to GitHub |   (letterboxed, padded —   |
 *   | (left)           |    same preview as Video   |
 *   |                  |    Generation screen)      |
 *   |                  +---------------------------+
 *   |                  |  Timeline (read-only)      |
 *   +------------------+---------------------------+
 */
export function ExportScreen({
  code,
  blenderCode,
  modelName,
  busy,
  onExportCode,
  onExportMp4,
  tunables,
  onParamChange,
  mp4Job,
  timelineClips,
  timelineTotal,
  playback,
  previewCode,
  previewTime,
  previewModelName,
}: ExportScreenProps) {
  const { configured, login } = useAuth();
  const github = useGitHubRepo();
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(6);
  const [resolution, setResolution] = useState(0);
  const [repoName, setRepoName] = useState('');
  const [privateRepo, setPrivateRepo] = useState(false);
  const [existingFullName, setExistingFullName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const rendering = mp4Job?.status === 'running';
  const exportBusy = busy !== null || github.busy;

  const leftWidth = useResizable({
    direction: 'horizontal',
    initial: 340,
    min: 260,
    max: 640,
    storageKey: 'motionforge:export-screen:left-width',
  });
  const timelineHeight = useResizable({
    direction: 'vertical',
    initial: 160,
    min: 120,
    max: 360,
    storageKey: 'motionforge:export-screen:timeline-height',
    invert: true,
  });

  return (
    <main
      className="grid min-h-0 flex-1 grid-cols-[var(--export-left-w)_1px_1fr]"
      style={{ ['--export-left-w' as string]: `${leftWidth.size}px` }}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto bg-bg-panel p-3">
        <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3" aria-label="Export options">
          <h2 className="m-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            Export options
          </h2>
          <p className="m-0 text-[13px] leading-relaxed text-text-dim">
            Download the generated project as code, or render it to an MP4.
          </p>
          <button type="button" className="btn btn-secondary" disabled={exportBusy} onClick={onExportCode}>
            Export code (.zip)
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <label className="flex flex-col gap-1 text-[11px] text-text-dim">
              FPS
              <select
                className="rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-text focus:border-accent focus:outline-none"
                value={fps}
                onChange={(event) => setFps(Number(event.target.value))}
                disabled={exportBusy}
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
                className="rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-text focus:border-accent focus:outline-none"
                min={1}
                max={60}
                value={duration}
                disabled={exportBusy}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-dim">
              Size
              <select
                className="rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-text focus:border-accent focus:outline-none"
                value={resolution}
                disabled={exportBusy}
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
            className="btn btn-primary"
            disabled={exportBusy || rendering}
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
            <div className="flex flex-col gap-1.5">
              {mp4Job.status === 'running' && (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full bg-accent transition-[width] duration-300"
                      style={{ width: `${Math.round(mp4Job.progress * 100)}%` }}
                    />
                  </div>
                  <p className="m-0 text-[13px] leading-relaxed text-text-dim">
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
                <p className="m-0 text-[13px] leading-relaxed text-error">{mp4Job.error}</p>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3" aria-label="Export to GitHub">
          <h2 className="m-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            Export to GitHub
          </h2>
          <p className="m-0 text-[13px] leading-relaxed text-text-dim">
            Save the scene module and viewer to a GitHub repo so frontend apps can clone and use
            them. Sign in with GitHub is required.
          </p>
          <RequireAuth
            fallback={
              configured ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void login({ screenHint: 'login', connection: 'github' })}
                >
                  Log in with GitHub
                </button>
              ) : (
                <p className="m-0 text-[13px] leading-relaxed text-text-dim">
                  Configure Auth0 (`VITE_AUTH0_*`) to enable GitHub sign-in.
                </p>
              )
            }
          >
            {github.linked ? (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[13px] leading-relaxed text-text-dim">
                  Linked:{' '}
                  <a className="text-accent" href={github.linked.url} target="_blank" rel="noreferrer">
                    {github.linked.owner}/{github.linked.repo}
                  </a>
                </p>
                <label className="flex flex-col gap-1 text-[11px] text-text-dim">
                  Commit message
                  <input
                    type="text"
                    className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                    placeholder="Update MotionForge scene"
                    value={commitMessage}
                    disabled={github.busy}
                    onChange={(event) => setCommitMessage(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={exportBusy || !code.trim()}
                  onClick={() =>
                    void github.commit({
                      code,
                      blenderCode,
                      title: modelName,
                      message: commitMessage || undefined,
                    })
                  }
                >
                  {github.busy ? 'Committing…' : 'Commit changes'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={github.busy} onClick={github.unlink}>
                  Unlink repository
                </button>
                {github.lastCommitUrl && (
                  <p className="m-0 text-[13px] leading-relaxed text-text-dim">
                    Last commit:{' '}
                    <a className="text-accent" href={github.lastCommitUrl} target="_blank" rel="noreferrer">
                      view on GitHub
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Repository mode">
                  <button
                    type="button"
                    className={github.mode === 'create' ? 'btn btn-icon active' : 'btn btn-icon'}
                    disabled={github.busy}
                    onClick={() => github.setMode('create')}
                  >
                    Create new
                  </button>
                  <button
                    type="button"
                    className={github.mode === 'existing' ? 'btn btn-icon active' : 'btn btn-icon'}
                    disabled={github.busy}
                    onClick={() => github.setMode('existing')}
                  >
                    Use existing
                  </button>
                </div>

                {github.mode === 'create' ? (
                  <>
                    <label className="flex flex-col gap-1 text-[11px] text-text-dim">
                      Repository name
                      <input
                        type="text"
                        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                        placeholder="my-motionforge-scene"
                        value={repoName}
                        disabled={github.busy}
                        onChange={(event) => setRepoName(event.target.value)}
                      />
                    </label>
                    <label className="flex flex-row items-center gap-2 text-[12px] text-text">
                      <input
                        type="checkbox"
                        checked={privateRepo}
                        disabled={github.busy}
                        onChange={(event) => setPrivateRepo(event.target.checked)}
                      />
                      Private repository
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={exportBusy || !repoName.trim() || !code.trim()}
                      onClick={() =>
                        void github.createRepo({
                          name: repoName.trim(),
                          privateRepo,
                          code,
                          blenderCode,
                          title: modelName,
                          message: commitMessage || undefined,
                        })
                      }
                    >
                      {github.busy ? 'Creating…' : 'Create repository'}
                    </button>
                  </>
                ) : (
                  <>
                    <label className="flex flex-col gap-1 text-[11px] text-text-dim">
                      Repository
                      <input
                        type="text"
                        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
                        placeholder="owner/repo"
                        value={existingFullName}
                        disabled={github.busy}
                        onChange={(event) => setExistingFullName(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={exportBusy || !existingFullName.trim()}
                      onClick={() => void github.linkRepo(existingFullName)}
                    >
                      {github.busy ? 'Linking…' : 'Link repository'}
                    </button>
                  </>
                )}
              </div>
            )}
            {github.error && <p className="m-0 text-[13px] leading-relaxed text-error">{github.error}</p>}
          </RequireAuth>
        </section>
        <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3" aria-label="Publish to Marketplace">
          <h2 className="m-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            Publish to Marketplace
          </h2>
          <p className="m-0 text-[13px] leading-relaxed text-text-dim">
            Share your creation with the community. Sign-in required.
          </p>
          <RequireAuth
            fallback={
              configured ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void login({ screenHint: 'login' })}
                >
                  Log in to publish
                </button>
              ) : (
                <p className="m-0 text-[13px] leading-relaxed text-text-dim">
                  Configure Auth0 (`VITE_AUTH0_*`) to enable publishing.
                </p>
              )
            }
          >
            {code ? (
              <PublishForm code={code} blenderCode={blenderCode ?? ''} />
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-text-dim">Generate a scene first to publish it.</p>
            )}
          </RequireAuth>
        </section>
      </div>
      <ResizeHandle direction="horizontal" onPointerDown={leftWidth.startDragging} label="Resize export options" />
      <div
        className="grid min-h-0 min-w-0"
        style={{ gridTemplateRows: `1fr 1px ${timelineHeight.size}px` }}
      >
        <div className="flex min-h-0 min-w-0 items-stretch justify-center p-5">
          <div
            className="relative max-h-full max-w-full overflow-hidden rounded-md bg-black shadow-[0_0_0_1px_var(--color-border)]"
            style={{ aspectRatio: VIDEO_ASPECT_RATIO }}
          >
            <VideoPreview
              job={mp4Job}
              code={previewCode}
              tunables={tunables}
              onParamChange={onParamChange}
              modelName={previewModelName}
              enableClickFloater={false}
              time={previewTime}
            />
          </div>
        </div>
        <ResizeHandle direction="vertical" onPointerDown={timelineHeight.startDragging} label="Resize timeline" />
        <div className="flex min-h-0 bg-bg-panel px-2 py-1">
          <Timeline clips={timelineClips} totalDuration={timelineTotal} playback={playback} />
        </div>
      </div>
    </main>
  );
}
