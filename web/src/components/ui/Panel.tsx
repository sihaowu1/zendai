import type { HTMLAttributes, ReactNode } from 'react';

/**
 * The single source of truth for panel and section-header styling, in the same
 * spirit as `ui/Button.tsx` — every surface that frames a group of controls
 * comes from here so the Model, Video and Export screens can't drift apart.
 *
 * A panel is defined by its hairline border, not by its fill. The old panels
 * stacked a gradient, an inset highlight and a drop shadow to separate
 * themselves from the page; at this contrast that reads as three competing
 * edges. One 1px border on a flat charcoal does the same job cleanly.
 */
export const PANEL = 'rounded-lg border border-border bg-bg-panel';

/**
 * Section headers are labels, not titles: small, uppercase, letter-spaced and
 * muted. They name the region and then get out of the way, which is why there
 * is no accent bar next to them — a blue block beside every heading spends the
 * accent on navigation instead of on the one action that matters.
 */
export const PANEL_HEADER =
  'm-0 font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.11em] text-text-faint';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'title'> {
  title?: ReactNode;
  /** Extra layout classes only (width, flex, margin) — never colour or radius. */
  className?: string;
  children: ReactNode;
}

/** A bordered section with an optional muted uppercase header. */
export function Panel({ title, className = '', children, ...rest }: PanelProps) {
  return (
    <section className={`flex flex-col gap-3 ${PANEL} p-4 ${className}`} {...rest}>
      {title && <h2 className={PANEL_HEADER}>{title}</h2>}
      {children}
    </section>
  );
}
