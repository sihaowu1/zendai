import type { TunableParam } from '@motionforge/shared';
import { SliderControl } from './SliderControl';
import { SwitchControl } from './SwitchControl';
import { ColorControl } from './ColorControl';

export type ParamChange = (name: string, value: number | boolean | string) => void;

interface Props {
  tunables: TunableParam[];
  onChange: ParamChange;
}

/**
 * Renders one control per @tunable PARAMS entry in the generated code:
 * numbers → sliders, booleans → switches, hex colors → color pickers.
 * Every change is written back into the code (patchParam), so the code stays
 * the single source of truth.
 */
export function ControlsPanel({ tunables, onChange }: Props) {
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3">
      <h2 className="m-0 flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-dim">Controls</h2>
      {tunables.length === 0 ? (
        <p className="m-0 text-xs leading-relaxed text-text-dim">
          No tunable parameters found. Annotate PARAMS entries with{' '}
          <code className="rounded bg-bg px-1 py-px">@tunable</code> to get sliders and switches.
        </p>
      ) : (
        tunables.map((param) => {
          if (param.type === 'number') {
            return <SliderControl key={param.name} param={param} onChange={onChange} />;
          }
          if (param.type === 'boolean') {
            return <SwitchControl key={param.name} param={param} onChange={onChange} />;
          }
          return <ColorControl key={param.name} param={param} onChange={onChange} />;
        })
      )}
    </section>
  );
}
