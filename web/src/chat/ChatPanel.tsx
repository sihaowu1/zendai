import { useEffect, useRef, useState } from 'react';
import type { Status } from '../state/useSceneProject';

/**
 * A single chat entry rendered in the message list.
 * `kind` on assistant messages mirrors `Status.kind` so errors can be styled red.
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: 'info' | 'error';
}

interface Props {
  busy: string | null;
  status: Status | null;
  onGenerate: (prompt: string) => void;
  onModify: (prompt: string) => void;
}

/**
 * Minimal chat panel for the Video Generation screen.
 *
 * Owns its own message list (this is a UI concern, not app state). Each user
 * message calls `onGenerate` or `onModify` from `useSceneProject`. When the
 * request completes (`busy` clears), the latest `status` is appended as an
 * assistant reply so the user sees what happened without leaving the pane.
 */
export function ChatPanel({ busy, status, onGenerate, onModify }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  // Tracks the previous `busy` value so we only append a reply on the
  // transition from "in-flight" → "idle", not every time `status` changes.
  const wasBusyRef = useRef<boolean>(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isBusy = busy !== null;
    if (wasBusyRef.current && !isBusy && status) {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'assistant', text: status.text, kind: status.kind },
      ]);
    }
    wasBusyRef.current = isBusy;
  }, [busy, status]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const disabled = busy !== null || input.trim() === '';

  const send = (kind: 'generate' | 'modify') => {
    const prompt = input.trim();
    if (!prompt) return;
    setMessages((prev) => [...prev, { id: makeId(), role: 'user', text: prompt }]);
    setInput('');
    if (kind === 'generate') onGenerate(prompt);
    else onModify(prompt);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="px-1 py-2 text-xs italic text-text-dim">
            Ask the AI to modify the current scene, or start a new one with Generate.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-[13px] leading-snug ${
              m.role === 'user'
                ? 'self-end bg-accent font-medium text-[#0b0d12]'
                : 'self-start border border-border bg-bg-raised text-text'
            } ${m.kind === 'error' ? 'border-error bg-error/15 text-error' : ''}`}
          >
            {m.text}
          </div>
        ))}
        {busy !== null && <div className="self-start px-1 py-1 text-xs italic text-text-dim">{busy}</div>}
      </div>
      <form
        className="flex flex-shrink-0 flex-col gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) send('modify');
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask to modify the scene, or generate a new one…"
          rows={2}
          className="resize-none rounded border border-border bg-bg-raised p-2 font-sans text-[13px] text-text"
          disabled={busy !== null}
          onKeyDown={(event) => {
            // Enter sends (Modify). Shift+Enter inserts a newline.
            if (event.key === 'Enter' && !event.shiftKey && !disabled) {
              event.preventDefault();
              send('modify');
            }
          }}
        />
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            className="rounded-md border border-border bg-bg-raised px-3.5 py-2 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled}
            onClick={() => send('generate')}
          >
            Generate
          </button>
          <button
            type="submit"
            className="rounded-md bg-accent px-3.5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled}
          >
            Modify
          </button>
        </div>
      </form>
    </div>
  );
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
