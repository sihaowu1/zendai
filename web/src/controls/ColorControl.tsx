import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from './ControlsPanel';

interface Props {
  param: TunableParam;
  onChange: ParamChange;
}

export function ColorControl({ param, onChange }: Props) {
  const value = String(param.value);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs text-text-dim">
        {param.label}
        <span className="text-text tabular-nums">{value}</span>
      </span>
      <input
        type="color"
        className="h-7 w-full rounded-md border border-border bg-bg p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        value={normalizeHex(value)}
        onChange={(event) => onChange(param.name, event.target.value)}
      />
    </label>
  );
}

// <input type="color"> requires #rrggbb; expand #rgb shorthand.
function normalizeHex(hex: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ffffff';
}
