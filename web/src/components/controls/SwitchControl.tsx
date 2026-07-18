import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from './ControlsPanel';

interface Props {
  param: TunableParam;
  onChange: ParamChange;
}

export function SwitchControl({ param, onChange }: Props) {
  const checked = param.value === true;
  return (
    <label className="flex flex-row items-center justify-between gap-1">
      <span className="text-[13px] text-text-dim">{param.label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-accent"
        checked={checked}
        onChange={(event) => onChange(param.name, event.target.checked)}
      />
    </label>
  );
}
