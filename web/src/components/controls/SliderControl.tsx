import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from './ControlsPanel';

interface Props {
  param: TunableParam;
  onChange: ParamChange;
}

export function SliderControl({ param, onChange }: Props) {
  const value = Number(param.value);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[13px] text-text-dim">
        {param.label}
        {/* The readout sits in its own field, like an inspector's numeric input. */}
        <span className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-[12px] text-text tabular-nums">
          {value}
        </span>
      </span>
      <input
        type="range"
        className="w-full accent-accent cursor-pointer"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(event) => onChange(param.name, Number(event.target.value))}
      />
    </label>
  );
}
