import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TunableParam } from '@motionforge/shared';
import { X } from '@phosphor-icons/react';
import type { ObjectHandle } from '../../viewport/SceneRuntime';
import { ControlsPanel, type ParamChange } from './ControlsPanel';
import { TransformControls } from './TransformControls';
import { IconButton } from '../ui/Button';

interface Props {
  /** Viewport-relative point (clientX/clientY) to anchor the floater near. */
  anchor: { x: number; y: number };
  title: string;
  /** The clicked object's live position/rotation, from `Viewport`'s `onModelClick` — or the live camera, from the "Camera" button. */
  objectHandle?: ObjectHandle;
  /** Heading above the transform sliders. Defaults to "Position"; pass "Camera" for the camera editor. */
  transformLabel?: string;
  /** Set false to hide the PARAMS-driven tunables section (the camera editor has none). Defaults to true. */
  showTunables?: boolean;
  tunables: TunableParam[];
  onChange: ParamChange;
  onClose: () => void;
}

/**
 * Positioned popover shown next to a clicked model, wrapping `ControlsPanel`
 * unchanged. Dismisses on outside click or Escape. Only one is ever mounted
 * at a time by the caller, so there's no stacking to manage here.
 */
export function ControlsFloater({
  anchor,
  title,
  objectHandle,
  transformLabel,
  showTunables = true,
  tunables,
  onChange,
  onClose,
}: Props) {
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
    <div
      ref={rootRef}
      className="z-50 flex max-h-[min(70vh,480px)] w-[280px] flex-col overflow-hidden rounded-lg border border-border bg-bg-panel shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      style={style}
      role="dialog"
      aria-label={`${title} controls`}
    >
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-bg-raised py-2 pl-3 pr-2">
        <span
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] font-semibold uppercase leading-none tracking-[0.09em] text-text-dim"
          title={title}
        >
          {title}
        </span>
        <IconButton type="button" className="h-6 w-6" aria-label="Close controls" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>
      <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto p-3 [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0">
        {objectHandle && <TransformControls handle={objectHandle} label={transformLabel} />}
        {showTunables && <ControlsPanel tunables={tunables} onChange={onChange} />}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
