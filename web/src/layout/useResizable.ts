import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface UseResizableOptions {
  /** Which axis the pointer must move along to resize: 'horizontal' drags a width, 'vertical' drags a height. */
  direction: 'horizontal' | 'vertical';
  /** Initial size in pixels, used when nothing is persisted yet (or persistence is off). */
  initial: number;
  min: number;
  max: number;
  /** localStorage key to remember the size across reloads; omitted means no persistence. */
  storageKey?: string;
  /**
   * The tracked size normally sits *before* the handle in layout order, so
   * dragging right/down grows it. Set true when the tracked size instead
   * sits *after* the handle (dragging right/down should shrink it).
   */
  invert?: boolean;
}

/**
 * Drives a single draggable divider: pointer-down on the returned handler
 * starts tracking `pointermove`/`pointerup` on `window` (so the drag keeps
 * working even if the pointer leaves the thin handle element), clamps the
 * result to `[min, max]`, and — if `storageKey` is given — persists it so
 * panel sizing survives a reload.
 */
export function useResizable({ direction, initial, min, max, storageKey, invert }: UseResizableOptions) {
  const [size, setSize] = useState<number>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed)) return clamp(parsed, min, max);
    }
    return clamp(initial, min, max);
  });

  const drag = useRef<{ startPos: number; startSize: number } | null>(null);

  useEffect(() => {
    if (storageKey) window.localStorage.setItem(storageKey, String(size));
  }, [size, storageKey]);

  const stopDragging = useCallback(() => {
    drag.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!drag.current) return;
      const pos = direction === 'horizontal' ? event.clientX : event.clientY;
      const delta = pos - drag.current.startPos;
      const signedDelta = invert ? -delta : delta;
      setSize(clamp(drag.current.startSize + signedDelta, min, max));
    },
    [direction, invert, min, max],
  );

  const startDragging = useCallback(
    (event: ReactPointerEvent) => {
      event.preventDefault();
      drag.current = {
        startPos: direction === 'horizontal' ? event.clientX : event.clientY,
        startSize: size,
      };
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDragging);
    },
    [direction, size, onPointerMove, stopDragging],
  );

  // Re-bind the live listener whenever it changes identity (min/max/direction
  // change mid-drag are edge cases, but this keeps them correct regardless).
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
    };
  }, [onPointerMove, stopDragging]);

  return { size, startDragging };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
