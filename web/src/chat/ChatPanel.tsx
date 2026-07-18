import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
    <div style={styles.root}>
      <div ref={listRef} style={styles.list}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            Ask the AI to modify the current scene, or start a new one with Generate.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.msg,
              ...(m.role === 'user' ? styles.msgUser : styles.msgAssistant),
              ...(m.kind === 'error' ? styles.msgError : null),
            }}
          >
            {m.text}
          </div>
        ))}
        {busy !== null && <div style={styles.busy}>{busy}</div>}
      </div>
      <form
        style={styles.form}
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
          style={styles.input}
          disabled={busy !== null}
          onKeyDown={(event) => {
            // Enter sends (Modify). Shift+Enter inserts a newline.
            if (event.key === 'Enter' && !event.shiftKey && !disabled) {
              event.preventDefault();
              send('modify');
            }
          }}
        />
        <div style={styles.buttons}>
          <button
            type="button"
            className="secondary"
            disabled={disabled}
            onClick={() => send('generate')}
          >
            Generate
          </button>
          <button type="submit" disabled={disabled}>
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

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    gap: 8,
  },
  list: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingRight: 4,
  },
  empty: {
    color: 'var(--text-dim)',
    fontSize: 12,
    fontStyle: 'italic',
    padding: '8px 4px',
  },
  msg: {
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.4,
    maxWidth: '90%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  msgUser: {
    alignSelf: 'flex-end',
    background: 'var(--accent)',
    color: '#0b0d12',
    fontWeight: 500,
  },
  msgAssistant: {
    alignSelf: 'flex-start',
    background: 'var(--bg-raised)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  msgError: {
    background: 'rgba(229, 72, 77, 0.15)',
    borderColor: 'var(--error)',
    color: 'var(--error)',
  },
  busy: {
    alignSelf: 'flex-start',
    fontSize: 12,
    color: 'var(--text-dim)',
    fontStyle: 'italic',
    padding: '4px 4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  input: {
    resize: 'none',
    fontFamily: 'inherit',
    fontSize: 13,
    padding: 8,
    background: 'var(--bg-raised)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 4,
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
  },
} satisfies Record<string, CSSProperties>;
