import type { TunableParam } from '@motionforge/shared';
import type { ParamChange } from './ControlsPanel';

interface Props {
  param: TunableParam;
  onChange: ParamChange;
}

export function ColorControl({ param, onChange }: Props) {
  const value = String(param.value);
  return (
    // Swatch and hex share one row, the way an inspector lists a fill.
    <label className="flex items-center justify-between gap-2 text-[13px] text-text-dim">
      {param.label}
      <span className="flex items-center gap-1.5 rounded-md border border-border bg-bg py-0.5 pl-0.5 pr-2">
        <input
          type="color"
          className="h-5 w-5 cursor-pointer rounded-sm border-none bg-transparent p-0"
          value={normalizeHex(value)}
          onChange={(event) => onChange(param.name, event.target.value)}
        />
        <span className="text-[12px] uppercase text-text tabular-nums">{value.replace('#', '')}</span>
      </span>
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
