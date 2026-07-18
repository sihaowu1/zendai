import type { Status } from '../../state/useSceneProject';

interface Props {
  busy: string | null;
  status: Status | null;
}

const base = 'flex-shrink-0 border-t border-border bg-bg-panel px-4 py-2 text-[13px] text-text-dim';

const kindClass: Record<string, string> = {
  busy: 'text-warn',
  error: 'text-error',
  info: 'text-ok',
};

export function StatusBar({ busy, status }: Props) {
  if (busy) {
    return <footer className={`${base} ${kindClass.busy}`}>{busy}</footer>;
  }
  if (status) {
    return <footer className={`${base} ${kindClass[status.kind] ?? ''}`}>{status.text}</footer>;
  }
  return <footer className={base}>Ready — edit the code, drag a slider, or prompt the AI.</footer>;
}
