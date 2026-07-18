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
  const directionClass =
    direction === 'horizontal'
      ? "w-px cursor-col-resize after:absolute after:-left-[3px] after:-right-[3px] after:top-0 after:bottom-0 after:content-['']"
      : "h-px w-full cursor-row-resize after:absolute after:-top-[3px] after:-bottom-[3px] after:left-0 after:right-0 after:content-['']";

  return (
    <div
      className={`relative z-[5] flex-shrink-0 bg-border hover:bg-accent active:bg-accent ${directionClass}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-label={label}
    />
  );
}
