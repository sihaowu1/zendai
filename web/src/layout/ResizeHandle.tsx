import type { PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  /** 'horizontal' = a vertical bar that resizes a width; 'vertical' = a horizontal bar that resizes a height. */
  direction: 'horizontal' | 'vertical';
  onPointerDown: (event: ReactPointerEvent) => void;
  label: string;
}

/**
 * Thin draggable divider rendered between two panels. Purely presentational —
 * all drag tracking lives in `useResizable`; this just forwards `pointerdown`
 * and renders a hit target a bit wider than its visible line.
 */
export function ResizeHandle({ direction, onPointerDown, label }: Props) {
  return (
    <div
      className={`resize-handle resize-handle--${direction}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-label={label}
    />
  );
}
