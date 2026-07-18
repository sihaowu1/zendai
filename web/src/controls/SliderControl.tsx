import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from './ControlsPanel';

interface Props {
  param: TunableParam;
  onChange: ParamChange;
}

export function SliderControl({ param, onChange }: Props) {
  const value = Number(param.value);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs text-text-dim">
        {param.label}
        <span className="text-text tabular-nums">{value}</span>
      </span>
      <input
        type="range"
        className="w-full accent-accent"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(event) => onChange(param.name, Number(event.target.value))}
      />
    </label>
  );
}
