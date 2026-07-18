/**
 * Shared field styling, in the same spirit as `ui/Button.tsx`.
 *
 * Focus used to light the border blue and add a 3px blue glow. That spends the
 * primary-action colour on the routine act of clicking a text box — and with a
 * blue "Generate" button sitting right next to the field, two different things
 * ended up shouting the same colour. Focus is now a plain brightened hairline
 * plus a faint neutral ring: unmistakable, but quiet.
 */
/**
 * The label above a field. One tier below `PANEL_HEADER` — same muted uppercase
 * treatment, a touch smaller, so a form reads as a group of fields under a
 * section rather than a stack of competing headings.
 */
export const FIELD_LABEL =
  'flex flex-col gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-faint';

export const FIELD =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-text ' +
  'transition-[border-color,box-shadow] duration-100 placeholder:text-text-faint ' +
  'focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-white/10 ' +
  'disabled:cursor-not-allowed disabled:text-text-faint motion-reduce:transition-none';
