import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TunableParam } from '@motionforge/shared';
import { ControlsPanel, type ParamChange } from './ControlsPanel';

interface Props {
  /** Viewport-relative point (clientX/clientY) to anchor the floater near. */
  anchor: { x: number; y: number };
  title: string;
  tunables: TunableParam[];
  onChange: ParamChange;
  onClose: () => void;
}

/**
 * Positioned popover shown next to a clicked model, wrapping `ControlsPanel`
 * unchanged. Dismisses on outside click or Escape. Only one is ever mounted
 * at a time by the caller, so there's no stacking to manage here.
 */
export function ControlsFloater({ anchor, title, tunables, onChange, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // Measure after mount so the floater can be clamped inside the viewport
  // instead of running off-screen when the click is near an edge.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    const left = clamp(anchor.x - rect.width / 2, margin, window.innerWidth - rect.width - margin);
    const top = clamp(anchor.y + 16, margin, window.innerHeight - rect.height - margin);
    setPosition({ left, top });
  }, [anchor]);

  useLayoutEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const style: CSSProperties = {
    position: 'fixed',
    left: position?.left ?? anchor.x,
    top: position?.top ?? anchor.y,
    visibility: position ? 'visible' : 'hidden',
  };

  return (
    <div ref={rootRef} className="controls-floater" style={style} role="dialog" aria-label={`${title} controls`}>
      <header className="controls-floater__header">
        <span className="controls-floater__title" title={title}>
          {title}
        </span>
        <button
          type="button"
          className="controls-floater__close"
          aria-label="Close controls"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="controls-floater__body">
        <ControlsPanel tunables={tunables} onChange={onChange} />
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
