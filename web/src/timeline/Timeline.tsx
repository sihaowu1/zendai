/**
 * One clip on the timeline. `start` and `duration` are in seconds.
 */
export interface TimelineClip {
  id: string;
  /** Label rendered on the block (usually the scene/material name). */
  label: string;
  /** Seconds from the timeline origin (t=0). */
  start: number;
  /** Length of the clip in seconds. Must be > 0. */
  duration: number;
  /** Optional custom fill color; defaults to the accent color. */
  color?: string;
}

export interface TimelineProps {
  clips: TimelineClip[];
  /**
   * Total timeline length in seconds. If omitted, it's derived from the
   * furthest clip end so the layout always fills the track.
   */
  totalDuration?: number;
}

/**
 * V1 timeline: read-only, single horizontal track.
 * Each clip is a positioned block whose left/width is a percentage of the
 * total timeline duration. No drag, no trim, no selection.
 */
export function Timeline({ clips, totalDuration }: TimelineProps) {
  // Derive the visible duration from the clips unless the parent overrides it.
  const derivedEnd = clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
  const total = Math.max(totalDuration ?? derivedEnd, 0.0001);

  if (clips.length === 0) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-border p-3 text-text-dim"
        aria-label="Timeline"
      >
        <span className="text-[13px] font-semibold text-text">No clips yet</span>
        <span className="text-xs">Rendered scenes will appear here as clips.</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-1 p-1" aria-label="Timeline">
      <Ruler total={total} />
      <div
        className="relative min-h-[40px] flex-1 overflow-hidden rounded border border-border bg-bg-raised"
        role="list"
      >
        {clips.map((clip) => {
          // Position and size as percentages of the total timeline length.
          const leftPct = (clip.start / total) * 100;
          const widthPct = (clip.duration / total) * 100;
          return (
            <div
              key={clip.id}
              role="listitem"
              title={`${clip.label} — ${clip.start.toFixed(2)}s → ${(
                clip.start + clip.duration
              ).toFixed(2)}s`}
              className="absolute top-1 bottom-1 flex min-w-[2px] items-center overflow-hidden rounded-[3px] px-1.5 text-xs font-semibold text-[#0b0d12] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                background: clip.color ?? 'var(--color-accent)',
              }}
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{clip.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Simple time ruler above the track. Picks a tick interval that yields a
 * readable number of labels (aim for ~6 ticks) so the ruler doesn't get
 * crowded on short timelines or sparse on long ones.
 */
function Ruler({ total }: { total: number }) {
  const step = pickTickStep(total);
  const ticks: number[] = [];
  for (let t = 0; t <= total + 1e-6; t += step) ticks.push(t);

  return (
    <div className="relative h-4 flex-shrink-0 text-[10px] text-text-dim" aria-hidden="true">
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(t / total) * 100}%` }}
        >
          {formatSeconds(t)}
        </span>
      ))}
    </div>
  );
}

function pickTickStep(total: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const targetTicks = 6;
  for (const c of candidates) {
    if (total / c <= targetTicks) return c;
  }
  return candidates[candidates.length - 1];
}

function formatSeconds(t: number): string {
  if (t < 60) return `${t % 1 === 0 ? t.toFixed(0) : t.toFixed(1)}s`;
  const m = Math.floor(t / 60);
  const s = Math.round(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
