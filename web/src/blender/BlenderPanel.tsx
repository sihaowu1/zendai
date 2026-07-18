import { useState } from 'react';
import type { BlenderStatus } from '../api/client';

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
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-raised p-3">
      <h2 className="m-0 flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-dim">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} /> Blender (MCP)
      </h2>
      {!enabled && (
        <p className="m-0 text-xs leading-relaxed text-text-dim">
          Disabled. Set <code className="rounded bg-bg px-1 py-px">BLENDER_MCP_ENABLED=true</code>,
          install the bridge add-on in Blender, and restart the server.
        </p>
      )}
      {enabled && !connected && (
        <p className="m-0 text-xs leading-relaxed text-text-dim">
          Enabled but not connected — start the Zendai bridge in Blender (N-panel → Zendai → Start
          bridge).
        </p>
      )}
      {connected && (
        <p className="m-0 text-xs leading-relaxed text-text-dim">
          Connected. Tools: {status?.tools.join(', ')}
        </p>
      )}

      <button
        type="button"
        className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!connected || busy !== null}
        onClick={onSync}
      >
        Send scene to Blender
      </button>

      <div className="flex gap-1.5">
        <input
          type="text"
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-text focus:outline focus:outline-1 focus:outline-accent"
          value={agentPrompt}
          placeholder="Ask the agent to build in Blender…"
          onChange={(event) => setAgentPrompt(event.target.value)}
        />
        <button
          type="button"
          className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!connected || busy !== null || agentPrompt.trim() === ''}
          onClick={() => onAgent(agentPrompt.trim())}
        >
          Run agent
        </button>
      </div>
    </section>
  );
}
