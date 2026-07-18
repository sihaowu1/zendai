import { useEffect, useRef, useState } from 'react';
import type { Status } from '../state/useSceneProject';
import { Button } from './ui/Button';
import { PANEL_HEADER } from './ui/Panel';
import { FIELD } from './ui/Input';

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
  /**
   * Set false where the surrounding container already labels this pane — the
   * Video screen wraps it in a titled `Pane`, and two stacked headers read as
   * a bug.
   */
  showTitle?: boolean;
}

/**
 * Minimal chat panel for the Video Generation screen.
 *
 * Owns its own message list (this is a UI concern, not app state). Each user
 * message calls `onGenerate` or `onModify` from `useSceneProject`. When the
 * request completes (`busy` clears), the latest `status` is appended as an
 * assistant reply so the user sees what happened without leaving the pane.
 */
export function ChatPanel({ busy, status, onGenerate, onModify, showTitle = true }: Props) {
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
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {showTitle && (
        <h2 className={`flex-none ${PANEL_HEADER}`}>
          Scene chat
        </h2>
      )}
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {/* An empty screen is an invitation to act, so it centres in the space
            it owns and names the two things you can do rather than floating a
            line of italic prose at the top of a tall blank column. */}
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 text-center">
            <p className="m-0 text-[14px] font-semibold text-text-dim">Describe a scene</p>
            <p className="m-0 text-[13px] leading-normal text-text-faint">
              Generate builds a new scene. Modify edits the one you're looking at.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            // Speaker is carried by side and fill weight, not by hue. A blue
            // bubble per user turn filled the transcript with the accent and
            // left the Generate button with nothing to distinguish it.
            className={`max-w-[90%] whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-[14px] leading-snug ${
              m.role === 'user'
                ? 'self-end border-border-strong bg-bg-hover text-text'
                : 'self-start border-border bg-bg-raised text-text-dim'
            } ${m.kind === 'error' ? 'border-error bg-error/15 text-error' : ''}`}
          >
            {m.text}
          </div>
        ))}
        {busy !== null && <div className="self-start px-1 py-1 text-[14px] italic text-text-dim">{busy}</div>}
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
          placeholder="Ask to modify the model, or generate a new one…"
          rows={2}
          className={`resize-none font-sans ${FIELD}`}
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
          <Button variant="secondary" type="button" disabled={disabled} onClick={() => send('generate')}>
            Generate
          </Button>
          <Button variant="primary" type="submit" disabled={disabled}>
            Modify
          </Button>
        </div>
      </form>
    </div>
  );
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
