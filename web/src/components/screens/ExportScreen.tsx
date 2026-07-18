import { useCallback, useMemo, useState } from 'react';
import type { CameraSpec, RenderSettings, TunableParam } from '@motionforge/shared';
import type { ModelFormat } from '../../viewport/exportScene';
import { RequireAuth } from '../../auth/RequireAuth';
import { useAuth } from '../../auth/useAuth';
import { PublishForm } from '../PublishForm';
import type { ParamChange } from '../controls/ControlsPanel';
import { useGitHubRepo } from '../useGitHubRepo';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { Timeline } from '../timeline/Timeline';
import type { TimelineClip, TimelineLane } from '../timeline/timelineMath';
import type { TimelinePlayback } from '../timeline/useTimelinePlayback';
import type { Mp4JobState, SceneModel } from '../../state/useSceneProject';
import type { TrackOverlay } from '../../viewport/trackOverlay';
import { VideoPreview } from '../VideoPreview';
import { Button, ButtonLink, IconButton } from '../ui/Button';
import { PANEL, PANEL_HEADER } from '../ui/Panel';
import { FIELD, FIELD_LABEL } from '../ui/Input';
import type { CodeExportFormat } from '../../api/client';
import { CODE_EXPORT_FORMATS } from '../../api/client';

export interface ExportScreenProps {
  /** All models to push under `models/` on GitHub commit/create. */
  models: SceneModel[];
  /** Active model scene module source. */
  code: string;
  /** Display name used as export title. */
  modelName: string;
  /** Busy label from `useSceneProject` (blocks export actions while set). */
  busy: string | null;
  /** Download ZIP via `useSceneProject.exportCode`. */
  onExportCode: (format: CodeExportFormat) => void;
  /** Export 3D model via `useSceneProject.exportModel`. */
  onExportModel: (format: ModelFormat) => void;
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
  timelineLanes: TimelineLane[];
  collapsedLaneIds: Set<string>;
  onToggleLane: (laneId: string) => void;
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
  /** Multi-scene co-view when the playhead clip is a merge. */
  previewScenes?: Array<{ id: string; code: string }>;
  /** Playhead position local to the active clip (from `useSceneProject.previewTime`). */
  previewTime: number;
  previewTrackOverlays: TrackOverlay[];
  /** Display name for whatever's under the playhead (from `useSceneProject.previewModelName`). */
  previewModelName: string;
  /** Live orbit pose shared with the Video screen. */
  userCamera: CameraSpec | null;
  onUserCameraChange: (camera: CameraSpec) => void;
  /** Reset local models when the GitHub repo is unlinked. */
  onGitHubUnlink: () => void;
  /** Apply models pulled from the linked GitHub repo. */
  onGitHubPull: (
    models: Array<{ id: string; name: string; code: string }>,
  ) => void;
}

/** Video aspect ratio (matches `config/default.config.json`'s render resolution, 1280x720). */
const VIDEO_ASPECT_RATIO = '16 / 9';

const RESOLUTIONS = [
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '1080 × 1080 (square)', width: 1080, height: 1080 },
  { label: '1080 × 1920 (vertical)', width: 1080, height: 1920 },
];

const FORMAT_OPTIONS: { value: CodeExportFormat; label: string }[] = [
  { value: 'standalone', label: 'Standalone HTML' },
  { value: 'react', label: 'React component' },
  { value: 'module', label: 'ES module only' },
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
  models,
  code,
  modelName,
  busy,
  onExportCode,
  onExportModel,
  onExportMp4,
  tunables,
  onParamChange,
  mp4Job,
  timelineClips,
  timelineLanes,
  collapsedLaneIds,
  onToggleLane,
  timelineTotal,
  playback,
  previewCode,
  previewScenes,
  previewTime,
  previewTrackOverlays,
  previewModelName,
  userCamera,
  onUserCameraChange,
  onGitHubUnlink,
  onGitHubPull,
}: ExportScreenProps) {
  const { configured, login } = useAuth();
  const onUnlink = useCallback(() => {
    onGitHubUnlink();
  }, [onGitHubUnlink]);
  const github = useGitHubRepo({ onUnlink });
  const [codeFormat, setCodeFormat] = useState<CodeExportFormat>('standalone');
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(6);
  const [resolution, setResolution] = useState(0);
  const [repoName, setRepoName] = useState('');
  const [privateRepo, setPrivateRepo] = useState(false);
  const [existingFullName, setExistingFullName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const rendering = mp4Job?.status === 'running';
  const exportBusy = busy !== null || github.busy;

  const githubModels = useMemo(
    () =>
      models
        .filter((m) => m.code.trim())
        .map((m) => ({
          id: m.id,
          name: m.name,
          code: m.code,
        })),
    [models],
  );
  const canPushGithub = githubModels.length > 0;

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
        <section className={`flex flex-col gap-3 ${PANEL} p-4`} aria-label="Export options">
          <h2 className={PANEL_HEADER}>
            Export options
          </h2>
          <p className="m-0 text-[13px] leading-normal text-text-faint">
            Download the generated project as code, or render it to an MP4.
          </p>
          <label className={FIELD_LABEL}>
            Code format
            <select
              className={FIELD}
              value={codeFormat}
              disabled={exportBusy}
              onChange={(event) => {
                const next = event.target.value;
                if ((CODE_EXPORT_FORMATS as readonly string[]).includes(next)) {
                  setCodeFormat(next as CodeExportFormat);
                }
              }}
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="m-0 text-[12px] leading-normal text-text-faint">
            Applies to ZIP download and GitHub pushes.
          </p>
          <Button
            variant="secondary"
            type="button"
            disabled={exportBusy}
            onClick={() => onExportCode(codeFormat)}
          >
            Export code (.zip)
          </Button>

          <h3 className={PANEL_HEADER}>3D Model</h3>
          <p className="m-0 text-[12px] leading-normal text-text-faint">
            Export the scene geometry as a standard 3D file for Unity, Blender, CAD, or 3D printing.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <Button variant="secondary" type="button" disabled={exportBusy} onClick={() => onExportModel('glb')}>
              .glb
            </Button>
            <Button variant="secondary" type="button" disabled={exportBusy} onClick={() => onExportModel('obj')}>
              .obj
            </Button>
            <Button variant="secondary" type="button" disabled={exportBusy} onClick={() => onExportModel('stl')}>
              .stl
            </Button>
          </div>

          {/* Size carries the longest option text ("1080 × 1920 (vertical)"),
              which still clipped at 1.5fr in this sidebar. It gets its own full
              -width row instead; FPS and Seconds are short and pair cleanly. */}
          <div className="grid grid-cols-2 gap-2">
            <label className={FIELD_LABEL}>
              FPS
              <select
                className={FIELD}
                value={fps}
                onChange={(event) => setFps(Number(event.target.value))}
                disabled={exportBusy}
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
                disabled={exportBusy}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </label>
            <label className={`col-span-2 ${FIELD_LABEL}`}>
              Size
              <select
                className={FIELD}
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

          <Button
            variant="primary"
            type="button"
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
          </Button>

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

        <section className={`flex flex-col gap-3 ${PANEL} p-4`} aria-label="Export to GitHub">
          <h2 className={PANEL_HEADER}>
            Export to GitHub
          </h2>
          <p className="m-0 text-[13px] leading-normal text-text-faint">
            Save all models under <code className="text-text">models/</code> (and an empty{' '}
            <code className="text-text">animations/</code> folder) using the selected code format.
            Sign in with GitHub is required.
          </p>
          <RequireAuth
            fallback={
              configured ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => void login({ screenHint: 'login', connection: 'github' })}
                >
                  Log in with GitHub
                </Button>
              ) : (
                <p className="m-0 text-[13px] leading-normal text-text-faint">
                  Configure Auth0 (`VITE_AUTH0_*`) to enable GitHub sign-in.
                </p>
              )
            }
          >
            {github.linked ? (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[13px] leading-normal text-text-faint">
                  Linked:{' '}
                  <a className="text-accent" href={github.linked.url} target="_blank" rel="noreferrer">
                    {github.linked.owner}/{github.linked.repo}
                  </a>
                </p>
                <label className={FIELD_LABEL}>
                  Commit message
                  <input
                    type="text"
                    className={FIELD}
                    placeholder="Update MotionForge scene"
                    value={commitMessage}
                    disabled={github.busy}
                    onChange={(event) => setCommitMessage(event.target.value)}
                  />
                </label>
                <Button
                  variant="primary"
                  type="button"
                  disabled={exportBusy || !canPushGithub}
                  onClick={() =>
                    void github.commit({
                      models: githubModels,
                      title: modelName,
                      message: commitMessage || undefined,
                      format: codeFormat,
                    })
                  }
                >
                  {github.busy ? 'Committing…' : `Commit ${githubModels.length} model${githubModels.length === 1 ? '' : 's'}`}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={github.busy}
                  onClick={() =>
                    void github.pull().then((result) => {
                      onGitHubPull(result.models);
                    })
                  }
                >
                  {github.busy ? 'Pulling…' : 'Pull from GitHub'}
                </Button>
                <Button variant="secondary" type="button" disabled={github.busy} onClick={github.unlink}>
                  Unlink repository
                </Button>
                {github.pullStatus && (
                  <p className="m-0 text-[13px] leading-normal text-text-faint">{github.pullStatus}</p>
                )}
                {github.lastCommitUrl && (
                  <p className="m-0 text-[13px] leading-normal text-text-faint">
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
                  <IconButton
                    type="button"
                    className="px-3 py-2 text-[13px] font-semibold"
                    active={github.mode === 'create'}
                    disabled={github.busy}
                    onClick={() => github.setMode('create')}
                  >
                    Create new
                  </IconButton>
                  <IconButton
                    type="button"
                    className="px-3 py-2 text-[13px] font-semibold"
                    active={github.mode === 'existing'}
                    disabled={github.busy}
                    onClick={() => github.setMode('existing')}
                  >
                    Use existing
                  </IconButton>
                </div>

                {github.mode === 'create' ? (
                  <>
                    <label className={FIELD_LABEL}>
                      Repository name
                      <input
                        type="text"
                        className={FIELD}
                        placeholder="my-motionforge-scene"
                        value={repoName}
                        disabled={github.busy}
                        onChange={(event) => setRepoName(event.target.value)}
                      />
                    </label>
                    <label className="flex flex-row items-center gap-2 text-[13px] text-text">
                      <input
                        type="checkbox"
                        checked={privateRepo}
                        disabled={github.busy}
                        onChange={(event) => setPrivateRepo(event.target.checked)}
                      />
                      Private repository
                    </label>
                    <Button
                      variant="primary"
                      type="button"
                      disabled={exportBusy || !repoName.trim() || !canPushGithub}
                      onClick={() =>
                        void github.createRepo({
                          name: repoName.trim(),
                          privateRepo,
                          models: githubModels,
                          title: modelName,
                          message: commitMessage || undefined,
                          format: codeFormat,
                        })
                      }
                    >
                      {github.busy ? 'Creating…' : 'Create repository'}
                    </Button>
                  </>
                ) : (
                  <>
                    <label className={FIELD_LABEL}>
                      Repository
                      <input
                        type="text"
                        className={FIELD}
                        placeholder="owner/repo"
                        value={existingFullName}
                        disabled={github.busy}
                        onChange={(event) => setExistingFullName(event.target.value)}
                      />
                    </label>
                    <Button
                      variant="primary"
                      type="button"
                      disabled={exportBusy || !existingFullName.trim()}
                      onClick={() =>
                        void (async () => {
                          const linkedRepo = await github.linkRepo(existingFullName);
                          const result = await github.pull(linkedRepo);
                          onGitHubPull(result.models);
                        })()
                      }
                    >
                      {github.busy ? 'Linking…' : 'Link repository'}
                    </Button>
                  </>
                )}
              </div>
            )}
            {github.error && <p className="m-0 text-[14px] leading-relaxed text-error">{github.error}</p>}
          </RequireAuth>
        </section>
        <section className={`flex flex-col gap-3 ${PANEL} p-4`} aria-label="Publish to Marketplace">
          <h2 className={PANEL_HEADER}>
            Publish to Marketplace
          </h2>
          <p className="m-0 text-[13px] leading-normal text-text-faint">
            Share your creation with the community. Sign-in required.
          </p>
          <RequireAuth
            fallback={
              configured ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => void login({ screenHint: 'login' })}
                >
                  Log in to publish
                </Button>
              ) : (
                <p className="m-0 text-[13px] leading-normal text-text-faint">
                  Configure Auth0 (`VITE_AUTH0_*`) to enable publishing.
                </p>
              )
            }
          >
            {code ? (
              <PublishForm code={code} />
            ) : (
              <p className="m-0 text-[13px] leading-normal text-text-faint">Generate a scene first to publish it.</p>
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
              scenes={previewScenes}
              tunables={tunables}
              onParamChange={onParamChange}
              modelName={previewModelName}
              enableClickFloater={false}
              time={previewTime}
              trackOverlays={previewTrackOverlays}
              userCamera={userCamera}
              onUserCameraChange={onUserCameraChange}
            />
          </div>
        </div>
        <ResizeHandle direction="vertical" onPointerDown={timelineHeight.startDragging} label="Resize timeline" />
        <div className="flex min-h-0 bg-bg-panel px-2 py-1">
          <Timeline
            clips={timelineClips}
            lanes={timelineLanes}
            collapsedLaneIds={collapsedLaneIds}
            onToggleLane={onToggleLane}
            totalDuration={timelineTotal}
            playback={playback}
          />
        </div>
      </div>
    </main>
  );
}
