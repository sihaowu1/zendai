import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { repoRoot } from './fsx';
import { log, warn } from './logger';

/**
 * Request-scoped tracing for the generation pipeline.
 *
 * The pipeline is several model round-trips deep (spec turn, code turn, each
 * with its own retry loop, then a client-driven critique loop) and until now
 * wrote down nothing: a failure surfaced as one line of text with no record of
 * what was sent, what came back, or how long it took. This records each step as
 * a structured event, tagged with the file and function that emitted it, so a
 * bad generation can be read back instead of re-guessed.
 *
 * The context rides on AsyncLocalStorage rather than a threaded-through
 * parameter: every agent function would otherwise need a trace argument it does
 * nothing with but pass along.
 */

/** One recorded step. `data` is whatever that step is actually about. */
export interface TraceEvent {
  traceId: string;
  seq: number;
  at: string;
  /** Milliseconds since the trace opened — the number that explains "slow". */
  elapsedMs: number;
  /** Emitting site, as `file.ts:functionName`. */
  site: string;
  /** Short event name, e.g. `spec.attempt`, `model.response`. */
  event: string;
  data: Record<string, unknown>;
}

interface TraceContext {
  traceId: string;
  kind: string;
  startedAt: number;
  seq: number;
}

const storage = new AsyncLocalStorage<TraceContext>();

const TRACE_DIR = path.join(repoRoot, '.traces');

/**
 * Off unless AI_TRACE is set. Full prompts and responses are large and contain
 * whatever the user typed, so this is opt-in rather than on by default.
 */
const enabled = ['1', 'true', 'yes', 'on'].includes((process.env.AI_TRACE ?? '').toLowerCase());

/** Cap on any single stringified field, so one module body can't bury a trace. */
const MAX_FIELD_CHARS = 20000;

let warnedWriteFailure = false;

function nextSeq(ctx: TraceContext): number {
  ctx.seq += 1;
  return ctx.seq;
}

/**
 * Truncate long strings and drop base64 image payloads, which are megabytes of
 * noise that say nothing a byte count doesn't.
 */
function clean(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= MAX_FIELD_CHARS) return value;
    return `${value.slice(0, MAX_FIELD_CHARS)}…[+${value.length - MAX_FIELD_CHARS} chars]`;
  }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'base64' && typeof entry === 'string') {
        out[key] = `[base64 ${entry.length} chars]`;
        continue;
      }
      out[key] = clean(entry);
    }
    return out;
  }
  return value;
}

function write(event: TraceEvent): void {
  const file = path.join(TRACE_DIR, `${event.traceId}.jsonl`);
  try {
    fs.mkdirSync(TRACE_DIR, { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(event)}\n`);
  } catch (err) {
    // Tracing must never take down a generation it was only meant to observe.
    if (!warnedWriteFailure) {
      warnedWriteFailure = true;
      warn('trace', `could not write traces to ${TRACE_DIR}: ${String(err)}`);
    }
  }
}

/**
 * Record one step of the active trace. No-op outside `withTrace` or when
 * AI_TRACE is unset, so call sites need no guard.
 *
 * `site` is the emitting file and function, written by hand as
 * `sceneAgent.ts:runSpecTurn` — the point is to say where the data came from,
 * and a hand-written label survives bundling and renaming better than a parsed
 * stack frame does.
 */
export function trace(site: string, event: string, data: Record<string, unknown> = {}): void {
  if (!enabled) return;
  const ctx = storage.getStore();
  if (!ctx) return;

  const entry: TraceEvent = {
    traceId: ctx.traceId,
    seq: nextSeq(ctx),
    at: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - ctx.startedAt),
    site,
    event,
    data: clean(data) as Record<string, unknown>,
  };
  write(entry);
  log('trace', `${ctx.traceId} +${entry.elapsedMs}ms ${site} ${event} ${summarize(entry.data)}`);
}

/** One-line console form: scalars inline, everything else by shape. */
function summarize(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      parts.push(`${key}=${value.length > 60 ? `<${value.length} chars>` : JSON.stringify(value)}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key}=${value}`);
    } else if (Array.isArray(value)) {
      parts.push(`${key}[${value.length}]`);
    } else {
      parts.push(`${key}={${Object.keys(value as object).length}}`);
    }
  }
  return parts.join(' ');
}

/** The active trace id, for echoing back to a caller that wants to find the file. */
export function currentTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

export const tracingEnabled = enabled;

/**
 * Run `fn` inside a fresh trace. Records open/close either way, so a thrown
 * error still leaves a terminated trace with the elapsed time on it.
 */
export async function withTrace<T>(
  kind: string,
  site: string,
  data: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled) return fn();

  const ctx: TraceContext = {
    traceId: `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    startedAt: performance.now(),
    seq: 0,
  };

  return storage.run(ctx, async () => {
    trace(site, `${kind}.start`, data);
    try {
      const result = await fn();
      trace(site, `${kind}.ok`, {});
      return result;
    } catch (err) {
      trace(site, `${kind}.failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
}
