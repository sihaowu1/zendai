import { useState } from 'react';
import { CubeIcon } from '@phosphor-icons/react';
import type { BlenderStatus } from '../api/client';
import { Button } from './ui/Button';
import { PANEL, PANEL_HEADER } from './ui/Panel';
import { FIELD } from './ui/Input';

interface Props {
  status: BlenderStatus | null;
  busy: string | null;
  onSync: () => void;
  onAgent: (prompt: string) => void;
}

/**
 * Blender MCP integration: shows connection state, sends the current Blender
 * script to the live Blender instance, and lets the AI agent drive Blender
 * iteratively through MCP tools.
 */
export function BlenderPanel({ status, busy, onSync, onAgent }: Props) {
  const [agentPrompt, setAgentPrompt] = useState('');
  const connected = status?.connected === true;
  const enabled = status?.enabled === true;
  const dotClass = connected ? 'bg-ok' : enabled ? 'bg-warn' : 'bg-text-dim';

  return (
    <section className={`flex flex-col gap-3 ${PANEL} p-4`}>
      <h2 className={PANEL_HEADER}>
        <CubeIcon size={13} />
        Blender (MCP)
        <span className={`ml-auto inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
      </h2>
      {!enabled && (
        <p className="m-0 text-[13px] leading-normal text-text-faint">
          Disabled. Set <code className="rounded bg-bg px-1 py-px">BLENDER_MCP_ENABLED=true</code>,
          install the bridge add-on in Blender, and restart the server.
        </p>
      )}
      {enabled && !connected && (
        <p className="m-0 text-[13px] leading-normal text-text-faint">
          Enabled but not connected — start the Zendai bridge in Blender (N-panel → Zendai → Start
          bridge).
        </p>
      )}
      {connected && (
        <p className="m-0 text-[13px] leading-normal text-text-faint">
          Connected. Tools: {status?.tools.join(', ')}
        </p>
      )}

      <Button variant="primary" type="button" disabled={!connected || busy !== null} onClick={onSync}>
        Send scene to Blender
      </Button>

      <div className="flex gap-1.5">
        <input
          type="text"
          className={`min-w-0 flex-1 ${FIELD}`}
          value={agentPrompt}
          placeholder="Ask the agent to build in Blender…"
          onChange={(event) => setAgentPrompt(event.target.value)}
        />
        <Button
          variant="primary"
          type="button"
          disabled={!connected || busy !== null || agentPrompt.trim() === ''}
          onClick={() => onAgent(agentPrompt.trim())}
        >
          Run agent
        </Button>
      </div>
    </section>
  );
}
