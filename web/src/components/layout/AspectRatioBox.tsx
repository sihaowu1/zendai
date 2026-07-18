import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface Props {
  /** width / height, e.g. 16/9, 1, 4/3. */
  ratio: number;
  children: ReactNode;
}

/**
 * Letterboxes `children` to a fixed `ratio` box, centered within whatever
 * space the parent gives this component. Sizing is computed in JS (not CSS
 * `aspect-ratio`) so the box always lands on an exact pixel size — the same
 * size the child's own `ResizeObserver` (see `Viewport`) will measure, which
 * is what drives `camera.aspect`. Changing `ratio` only ever changes this
 * box's size, never anything about the scene itself.
 */
export function AspectRatioBox({ ratio, children }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const compute = (containerWidth: number, containerHeight: number) => {
      if (containerWidth <= 0 || containerHeight <= 0) return;
      const containerRatio = containerWidth / containerHeight;
      const next =
        containerRatio > ratio
          ? { width: containerHeight * ratio, height: containerHeight }
          : { width: containerWidth, height: containerWidth / ratio };
      setBox(next);
    };
    compute(outer.clientWidth, outer.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      compute(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(outer);
    return () => observer.disconnect();
  }, [ratio]);

  return (
    <div ref={outerRef} className="flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <div style={{ width: box.width, height: box.height }} className="relative flex-shrink-0">
        {children}
      </div>
    </div>
  );
}
