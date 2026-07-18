import { useEffect, useState } from 'react';
import type { TunableParam } from '@motionforge/shared';
import type { ObjectHandle, ObjectTransform } from '../../viewport/SceneRuntime';
import { SliderControl } from './SliderControl';

interface Props {
  handle: ObjectHandle;
  /** Section heading — "Position" for a clicked model, "Camera" for the camera editor. Defaults to "Position". */
  label?: string;
}

const AXES: Array<{
  key: keyof ObjectTransform;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Matches the slider to the same X/Y/Z color as the viewport's "Axes" helper. Omitted for `angle`/`pitch`, neither of which is a single position axis. */
  axis?: 'x' | 'y' | 'z';
}> = [
  { key: 'x', label: 'Position X', min: -10, max: 10, step: 0.05, axis: 'x' },
  { key: 'y', label: 'Position Y', min: -10, max: 10, step: 0.05, axis: 'y' },
  { key: 'z', label: 'Position Z', min: -10, max: 10, step: 0.05, axis: 'z' },
  { key: 'angle', label: 'Left/Right', min: -180, max: 180, step: 1 },
  { key: 'pitch', label: 'Up/Down', min: -89, max: 89, step: 1 },
];

/**
 * Position (x/y/z) and rotation (left/right yaw, up/down pitch) sliders for
 * whichever object was clicked in the viewport — or, via `ControlsFloater`'s
 * "Camera" mode, the live camera itself. Reads/writes go straight through
 * `ObjectHandle` to the live `THREE.Object3D` in `SceneRuntime` — this never
 * touches PARAMS, generated code, or the AI agent, unlike the PARAMS-driven
 * sliders in `ControlsPanel` rendered alongside it.
 */
export function TransformControls({ handle, label = 'Position' }: Props) {
  const [transform, setTransform] = useState<ObjectTransform>(() => handle.getTransform());

  // A new click (even on the same object) hands us a new handle — resync the
  // sliders to that object's actual current transform rather than stale state.
  useEffect(() => {
    setTransform(handle.getTransform());
  }, [handle]);

  const handleChange = (name: string, value: number | boolean | string) => {
    const next = { ...transform, [name]: Number(value) };
    setTransform(next);
    handle.setTransform(next);
  };

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3">
      <h2 className="m-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
        {label}
      </h2>
      {AXES.map((axis) => {
        const param: TunableParam = {
          name: axis.key,
          label: axis.label,
          type: 'number',
          value: transform[axis.key],
          min: axis.min,
          max: axis.max,
          step: axis.step,
        };
        return <SliderControl key={axis.key} param={param} onChange={handleChange} axis={axis.axis} />;
      })}
    </section>
  );
}
