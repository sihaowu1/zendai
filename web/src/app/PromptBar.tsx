import { useState } from 'react';

interface Props {
  busy: string | null;
  onGenerate: (prompt: string) => void;
  onModify: (prompt: string) => void;
}

/**
 * The single prompt input driving the AI agents: "Generate" creates a new
 * scene from the prompt; "Modify" applies the prompt to the current scene.
 *
 * Not currently mounted anywhere — both screens now have their own
 * scrollback-backed chat (`chat/ChatPanel.tsx`) instead of one global,
 * fire-and-forget prompt bar. Kept around in case a compact/no-history input
 * is wanted elsewhere later; safe to delete if not.
 */
export function PromptBar({ busy, onGenerate, onModify }: Props) {
  const [prompt, setPrompt] = useState('');
  const disabled = busy !== null || prompt.trim() === '';

  return (
    <header className="flex items-center gap-2 border-b border-border bg-bg-panel px-3.5 py-2.5">
      <span className="mr-1.5 whitespace-nowrap font-bold tracking-wide text-accent">Zendai</span>
      <input
        type="text"
        className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-text focus:outline focus:outline-1 focus:outline-accent"
        value={prompt}
        placeholder='Describe a 3D scene… e.g. "a gold torus knot spinning over a dark floor"'
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !disabled) onGenerate(prompt.trim());
        }}
      />
      <button
        type="button"
        className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled}
        onClick={() => onGenerate(prompt.trim())}
      >
        Generate
      </button>
      <button
        type="button"
        className="rounded-md border border-border bg-bg-raised px-3.5 py-2 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled}
        onClick={() => onModify(prompt.trim())}
      >
        Modify
      </button>
    </header>
  );
}
