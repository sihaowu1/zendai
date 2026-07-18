import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReferenceImage } from '@motionforge/shared';
import type { Status } from '../state/useSceneProject';
import { Button, IconButton } from './ui/Button';
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
  /** Data URL for an attached image thumbnail (user messages only). */
  imagePreview?: string;
}

interface Props {
  busy: string | null;
  status: Status | null;
  onGenerate: (prompt: string, image?: ReferenceImage) => void;
  /** Omit or set showModify=false on Video — Enter then runs Generate/Animate. */
  onModify?: (prompt: string, image?: ReferenceImage) => void;
  /**
   * Enter/submit routing. When provided (Model screen), it decides generate
   * vs modify per message instead of always calling `onModify` — see
   * `useSceneProject`'s `route`.
   */
  onSmartSend?: (prompt: string, image?: ReferenceImage) => void;
  /** Primary action label (default Generate). Video screen uses Animate. */
  generateLabel?: string;
  modifyLabel?: string;
  placeholder?: string;
  emptyHint?: string;
  /** Section label above the message list (default "Model chat"). */
  title?: string;
  /**
   * Set false where the surrounding container already labels this pane —
   * otherwise two stacked headers read as a bug.
   */
  showTitle?: boolean;
  /** When false, hide camera/upload/paste image attachment (Video screen). */
  allowImageAttachment?: boolean;
  /** When false, hide Modify and make Enter/submit run Generate (Video screen). */
  showModify?: boolean;
}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function fileToReferenceImage(file: File): Promise<{ ref: ReferenceImage; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({
        ref: { mediaType: file.type as ReferenceImage['mediaType'], base64 },
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/** Convert an HTMLCanvasElement snapshot to a ReferenceImage + preview data URL. */
function canvasToReferenceImage(canvas: HTMLCanvasElement): { ref: ReferenceImage; dataUrl: string } {
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  return { ref: { mediaType: 'image/png', base64 }, dataUrl };
}

/**
 * Minimal chat panel for Model / Video screens.
 *
 * Owns its own message list (this is a UI concern, not app state). Each user
 * message calls `onGenerate` or `onModify` from `useSceneProject`. When the
 * request completes (`busy` clears), the latest `status` is appended as an
 * assistant reply so the user sees what happened without leaving the pane.
 */
export function ChatPanel({
  busy,
  status,
  onGenerate,
  onModify,
  onSmartSend,
  generateLabel = 'Generate',
  modifyLabel = 'Modify',
  placeholder = 'Ask to modify the model, or generate a new one…',
  emptyHint =
    "Generate builds a new model. Modify edits the one you're looking at. You can also attach or capture a reference image.",
  title = 'Model chat',
  showTitle = true,
  allowImageAttachment = true,
  showModify = true,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ ref: ReferenceImage; dataUrl: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const wasBusyRef = useRef<boolean>(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canModify = showModify && typeof onModify === 'function';
  const primaryKind: 'generate' | 'modify' = canModify ? 'modify' : 'generate';

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

  // Clean up the camera stream when the component unmounts.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const disabled = busy !== null || input.trim() === '';

  const handleFile = async (file: File) => {
    if (!allowImageAttachment || !ACCEPTED_TYPES.has(file.type)) return;
    try {
      const result = await fileToReferenceImage(file);
      setAttachedImage(result);
    } catch {
      // silently ignore unreadable files
    }
  };

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      // Camera access denied or unavailable
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setAttachedImage(canvasToReferenceImage(canvas));
    closeCamera();
  }, [closeCamera]);

  const send = (kind: 'generate' | 'modify' | 'auto') => {
    const prompt = input.trim();
    if (!prompt) return;
    const image = allowImageAttachment ? attachedImage : null;
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: 'user', text: prompt, imagePreview: image?.dataUrl },
    ]);
    setInput('');
    setAttachedImage(null);
    if (kind === 'generate') onGenerate(prompt, image?.ref);
    else if (kind === 'modify') onModify?.(prompt, image?.ref);
    else if (onSmartSend) onSmartSend(prompt, image?.ref);
    else if (canModify) onModify?.(prompt, image?.ref);
    else onGenerate(prompt, image?.ref);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {showTitle && (
        <h2 className={`flex-none ${PANEL_HEADER}`}>
          {title}
        </h2>
      )}
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {messages.length === 0 && emptyHint && (
          <p className="px-1 text-[13px] leading-snug text-text-faint">{emptyHint}</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-[14px] leading-snug ${
              m.role === 'user'
                ? 'self-end border-border-strong bg-bg-hover text-text'
                : 'self-start border-border bg-bg-raised text-text-dim'
            } ${m.kind === 'error' ? 'border-error bg-error/15 text-error' : ''}`}
          >
            {m.imagePreview && (
              <img
                src={m.imagePreview}
                alt="Attached reference"
                className="mb-1 max-h-24 rounded border border-white/20"
              />
            )}
            {m.text}
          </div>
        ))}
        {busy !== null && <div className="self-start px-1 py-1 text-[14px] italic text-text-dim">{busy}</div>}
      </div>

      {allowImageAttachment && cameraOpen && (
        <div className="flex flex-col items-center gap-1.5 rounded border border-border bg-bg-raised p-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-40 w-full rounded bg-black object-contain"
          />
          <div className="flex gap-1.5">
            <Button variant="primary" type="button" onClick={capturePhoto}>
              Capture
            </Button>
            <Button variant="secondary" type="button" onClick={closeCamera}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <form
        className={`flex flex-shrink-0 flex-col ${COMPOSER}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) send(onSmartSend ? 'auto' : primaryKind);
        }}
      >
        {allowImageAttachment && attachedImage && (
          <div className="flex items-center gap-2 rounded border border-border bg-bg-raised px-2 py-1">
            <img src={attachedImage.dataUrl} alt="Attached" className="h-10 rounded" />
            <span className="flex-1 truncate text-[12px] text-text-dim">Image attached</span>
            <button
              type="button"
              className="text-[12px] text-text-dim hover:text-error"
              onClick={() => setAttachedImage(null)}
              aria-label="Remove attached image"
            >
              x
            </button>
          </div>
        )}
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none border-none bg-transparent px-2.5 pb-1 pt-2 font-sans text-[14px] text-text outline-none placeholder:text-text-faint disabled:cursor-not-allowed disabled:text-text-faint"
          disabled={busy !== null}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !disabled) {
              event.preventDefault();
              send(onSmartSend ? 'auto' : primaryKind);
            }
          }}
          onPaste={(event) => {
            if (!allowImageAttachment) return;
            const items = event.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (item.kind === 'file' && ACCEPTED_TYPES.has(item.type)) {
                const file = item.getAsFile();
                if (file) {
                  event.preventDefault();
                  handleFile(file);
                  return;
                }
              }
            }
          }}
        />
        {allowImageAttachment && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
              event.target.value = '';
            }}
          />
        )}
        <div className="flex items-center justify-end gap-1.5 px-1.5 pb-1.5">
          {allowImageAttachment && (
            <>
              <IconButton
                disabled={busy !== null}
                onClick={openCamera}
                title="Take a photo with your camera"
                aria-label="Camera"
                className="p-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              </IconButton>
              <IconButton
                disabled={busy !== null}
                onClick={() => fileInputRef.current?.click()}
                title="Upload a reference image"
                aria-label="Upload image"
                className="p-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </IconButton>
            </>
          )}
          {canModify ? (
            <>
              <Button
                variant="ghost"
                type="button"
                disabled={disabled}
                title="Build a new model from this prompt"
                onClick={() => send('generate')}
              >
                {generateLabel}
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={disabled}
                title="Edit the current model (Enter)"
              >
                {modifyLabel}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              type="submit"
              disabled={disabled}
              title={`${generateLabel} for the selected object (Enter)`}
            >
              {generateLabel}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
