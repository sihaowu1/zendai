import { useEffect, useRef, useState } from 'react';
import type { Status } from '../state/useSceneProject';
import { Button } from './ui/Button';
import { PANEL_HEADER } from './ui/Panel';

/** The composer's outer shell — the border `FIELD` would otherwise put on the textarea alone. */
const COMPOSER =
  'rounded-lg border border-border bg-bg transition-[border-color,box-shadow] duration-100 ' +
  'focus-within:border-border-strong focus-within:ring-2 focus-within:ring-white/10 motion-reduce:transition-none';

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
        {/* No empty-state copy: the input's own placeholder already says what
            to type, and the two buttons name what they do. A paragraph
            explaining them was a third statement of the same thing. */}
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
      {/* Field and actions share one bordered container so the composer reads
          as a single command box. The border lives here, and the textarea
          inside it is chromeless, rather than each part drawing its own edge. */}
      <form
        className={`flex flex-shrink-0 flex-col ${COMPOSER}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) send('modify');
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Describe a model, or ask for a change…"
          rows={2}
          className="w-full resize-none border-none bg-transparent px-2.5 pb-1 pt-2 font-sans text-[14px] text-text outline-none placeholder:text-text-faint disabled:cursor-not-allowed disabled:text-text-faint"
          disabled={busy !== null}
          onKeyDown={(event) => {
            // Enter sends (Modify). Shift+Enter inserts a newline.
            if (event.key === 'Enter' && !event.shiftKey && !disabled) {
              event.preventDefault();
              send('modify');
            }
          }}
        />
        <div className="flex justify-end gap-1.5 px-1.5 pb-1.5">
          <Button
            variant="ghost"
            type="button"
            disabled={disabled}
            title="Build a new model from this prompt"
            onClick={() => send('generate')}
          >
            Generate
          </Button>
          <Button variant="primary" type="submit" disabled={disabled} title="Edit the current model (Enter)">
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
