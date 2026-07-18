import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from './ControlsPanel';

type AxisColor = 'x' | 'y' | 'z';

// Written out in full (not built via template interpolation) so Tailwind's
// static scanner can find these class names in the source.
const THUMB_ACCENT: Record<AxisColor, string> = {
  x: 'accent-axis-x',
  y: 'accent-axis-y',
  z: 'accent-axis-z',
};

const VALUE_COLOR: Record<AxisColor, string> = {
  x: 'text-axis-x',
  y: 'text-axis-y',
  z: 'text-axis-z',
};

interface Props {
  param: TunableParam;
  onChange: ParamChange;
  /**
   * Matches the slider thumb + value readout to the corresponding X/Y/Z axis
   * color used by the viewport's "Axes" helper (see `TransformControls`).
   * Omit for the default accent color — used by ordinary PARAMS tunables and
   * the angle slider, neither of which map to a single axis.
   */
  axis?: AxisColor;
}

export function SliderControl({ param, onChange, axis }: Props) {
  const value = Number(param.value);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[13px] text-text-dim">
        {param.label}
        {/* The readout sits in its own field, like an inspector's numeric input. */}
        <span
          className={`rounded-md border border-border bg-bg px-1.5 py-0.5 text-[12px] tabular-nums ${axis ? VALUE_COLOR[axis] : 'text-text'}`}
        >
          {value}
        </span>
      </span>
      <input
        type="range"
        className={`w-full cursor-pointer ${axis ? THUMB_ACCENT[axis] : 'accent-accent'}`}
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(event) => onChange(param.name, Number(event.target.value))}
      />
    </label>
  );
}
