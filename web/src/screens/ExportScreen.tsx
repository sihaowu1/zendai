import type { CSSProperties } from 'react';
import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from '../controls/ControlsPanel';
import { ResizeHandle } from '../layout/ResizeHandle';
import { useResizable } from '../layout/useResizable';
import { Timeline } from '../timeline/Timeline';
import type { TimelineClip } from '../timeline/timelineMath';
import type { TimelinePlayback } from '../timeline/useTimelinePlayback';
import type { Mp4JobState } from '../state/useSceneProject';
import { VideoPreview } from '../video/VideoPreview';

export interface ExportScreenProps {
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
 *
 * The preview and timeline read the same shared playhead/derived clip as
 * the Video Generation screen (`useSceneProject.playback`/`previewCode`) —
 * scrubbing or playing here is exactly the Video screen's timeline, not a
 * separate copy, so nothing needs to be regenerated to "sync" the two.
 * This timeline is playback-only: no drag-and-drop from Materials (there's
 * no Materials pane here), just transport controls and a speed selector.
 * Both the video and the timeline are contained within the right section,
 * alongside (not underneath) the export options on the left.
 *
 * Export options/GitHub push are still a placeholder (see SPEC.md Issue 5).
 */
export function ExportScreen({
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
    <main className="export-screen" style={{ gridTemplateColumns: `${leftWidth.size}px 1px 1fr` }}>
      <div className="export-screen__left">
        <section className="panel" aria-label="Export options">
          <h2>Export options</h2>
          <p className="hint">Download the generated project as code, or render it to an MP4.</p>
          <button type="button" disabled>
            Export code (.zip)
          </button>
          <button type="button" disabled>
            Render MP4 (Remotion)
          </button>
        </section>
        <section className="panel" aria-label="Export to GitHub">
          <h2>Export to GitHub</h2>
          <p className="hint">Push the generated project straight to a GitHub repository.</p>
          <input type="text" placeholder="owner/repo" disabled />
          <button type="button" disabled>
            Push to GitHub
          </button>
        </section>
      </div>
      <ResizeHandle direction="horizontal" onPointerDown={leftWidth.startDragging} label="Resize export options" />
      <div
        className="export-screen__right"
        style={{ ...styles.right, gridTemplateRows: `1fr 1px ${timelineHeight.size}px` }}
      >
        <div style={styles.videoOuter}>
          <div style={styles.videoBox}>
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
        <div style={styles.timeline}>
          <Timeline clips={timelineClips} totalDuration={timelineTotal} playback={playback} />
        </div>
      </div>
    </main>
  );
}

const styles = {
  right: {
    display: 'grid',
    gap: 0,
    minHeight: 0,
    minWidth: 0,
  },
  videoOuter: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    minHeight: 0,
    minWidth: 0,
    padding: 20,
  },
  videoBox: {
    position: 'relative',
    aspectRatio: VIDEO_ASPECT_RATIO,
    maxWidth: '100%',
    maxHeight: '100%',
    background: '#000',
    borderRadius: 6,
    overflow: 'hidden',
    boxShadow: '0 0 0 1px var(--border)',
  },
  timeline: {
    minHeight: 0,
    display: 'flex',
    padding: '4px 8px',
    background: 'var(--bg-panel)',
  },
} satisfies Record<string, CSSProperties>;
