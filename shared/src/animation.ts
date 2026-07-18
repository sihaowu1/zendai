import type { AnimationClip, AnimationKeyframe, AnimationTrack } from './types';

/**
 * Helpers for reading `export const ANIMATION = { ... }` from a scene module
 * string. Used by the client animation library and hierarchical timeline —
 * the host stores many clips; parsing must not require evaluating the module.
 */

/** Read `ANIMATION.duration` when present and valid. */
export function parseAnimationDuration(code: string): number | undefined {
  const match = code.match(
    /export\s+const\s+ANIMATION\s*=\s*\{[\s\S]*?\bduration\s*:\s*([0-9]*\.?[0-9]+)/,
  );
  if (!match) return undefined;
  const duration = Number(match[1]);
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

/** Read `ANIMATION.name` string literal when present. */
export function parseAnimationName(code: string): string | undefined {
  const match = code.match(
    /export\s+const\s+ANIMATION\s*=\s*\{[\s\S]*?\bname\s*:\s*['"]([^'"]+)['"]/,
  );
  return match?.[1];
}

/**
 * Best-effort extraction of `tracks[].part` names from the ANIMATION export.
 * Sufficient for lane labels; does not fully parse keyframes.
 */
export function parseAnimationPartNames(code: string): string[] {
  const animMatch = code.match(/export\s+const\s+ANIMATION\s*=\s*\{([\s\S]*?)\n\};?/);
  if (!animMatch) return [];
  const body = animMatch[1];
  const parts: string[] = [];
  const partRe = /\bpart\s*:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = partRe.exec(body)) !== null) {
    if (!parts.includes(m[1])) parts.push(m[1]);
  }
  return parts;
}

/**
 * Parse track entries from ANIMATION when the module uses the keyframe form.
 * Returns [] if tracks are missing or unparseable (simple progress-only clips).
 */
export function parseAnimationTracks(code: string): AnimationTrack[] {
  const animMatch = code.match(/export\s+const\s+ANIMATION\s*=\s*\{([\s\S]*?)\n\};?/);
  if (!animMatch) return [];
  const body = animMatch[1];
  const tracksMatch = body.match(/\btracks\s*:\s*\[([\s\S]*)\]/);
  if (!tracksMatch) return [];

  const tracksBody = tracksMatch[1];
  const tracks: AnimationTrack[] = [];
  // Split on top-level track objects: `{ part: ... }`
  const objectRe = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let obj: RegExpExecArray | null;
  while ((obj = objectRe.exec(tracksBody)) !== null) {
    const chunk = obj[1];
    const part = chunk.match(/\bpart\s*:\s*['"]([^'"]+)['"]/)?.[1];
    const channel = chunk.match(/\bchannel\s*:\s*['"](rotation|position|scale)['"]/)?.[1] as
      | AnimationTrack['channel']
      | undefined;
    if (!part || !channel) continue;
    const axisMatch = chunk.match(/\baxis\s*:\s*['"]([xyz])['"]/);
    const axis = axisMatch?.[1] as 'x' | 'y' | 'z' | undefined;
    const keyframes: AnimationKeyframe[] = [];
    const kfRe = /\{\s*t\s*:\s*([-+]?[0-9]*\.?[0-9]+)\s*,\s*v\s*:\s*([-+]?[0-9]*\.?[0-9]+(?:\s*\*\s*Math\.PI(?:\s*\*\s*[-+]?[0-9]*\.?[0-9]+)?)?)\s*\}/g;
    let kf: RegExpExecArray | null;
    while ((kf = kfRe.exec(chunk)) !== null) {
      const t = Number(kf[1]);
      let vExpr = kf[2].replace(/\s+/g, '');
      let v = Number.NaN;
      if (/^[-+]?[0-9]*\.?[0-9]+$/.test(vExpr)) {
        v = Number(vExpr);
      } else if (vExpr.includes('Math.PI')) {
        // Evaluate simple `n * Math.PI` or `Math.PI * n` forms.
        try {
          // eslint-disable-next-line no-new-func
          v = Function(`"use strict"; return (${kf[2]});`)() as number;
        } catch {
          v = Number.NaN;
        }
      }
      if (Number.isFinite(t) && Number.isFinite(v)) keyframes.push({ t, v });
    }
    tracks.push({ part, channel, ...(axis ? { axis } : {}), keyframes });
  }
  return tracks;
}

/**
 * Pure, three-free static checks on a module's ANIMATION clip. Returns a list
 * of human-readable problems (empty means the clip's declared keyframes/duration
 * are internally consistent).
 *
 * `expectedDuration`, when provided, checks that ANIMATION.duration matches
 * the requested clip length.
 */
export function checkAnimationClipStatic(code: string, expectedDuration?: number): string[] {
  const issues: string[] = [];
  const duration = parseAnimationDuration(code);
  if (duration === undefined) {
    issues.push('ANIMATION.duration is missing or not a positive number');
  } else if (
    expectedDuration !== undefined &&
    Math.abs(duration - expectedDuration) > 0.01
  ) {
    issues.push(
      `ANIMATION.duration is ${duration}s but the shared clip length is ${expectedDuration}s`,
    );
  }

  const tracks = parseAnimationTracks(code);
  const upper = duration ?? expectedDuration;
  for (const track of tracks) {
    const label = `track "${track.part}" (${track.channel}${track.axis ? `.${track.axis}` : ''})`;
    const kfs = track.keyframes;
    if (kfs.length < 2) {
      issues.push(`${label} has fewer than 2 keyframes, so nothing moves`);
      continue;
    }
    let prevT = -Infinity;
    let ascending = true;
    let allFinite = true;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const kf of kfs) {
      if (!Number.isFinite(kf.t) || !Number.isFinite(kf.v)) allFinite = false;
      if (kf.t < prevT - 1e-6) ascending = false;
      prevT = kf.t;
      if (kf.v < minV) minV = kf.v;
      if (kf.v > maxV) maxV = kf.v;
    }
    if (!allFinite) issues.push(`${label} has a non-finite keyframe t or v`);
    if (!ascending) issues.push(`${label} keyframes are not sorted ascending by t`);
    if (kfs[0].t > 1e-3) {
      issues.push(`${label} first keyframe starts at t=${kfs[0].t}s, not t=0`);
    }
    if (upper !== undefined) {
      const last = kfs[kfs.length - 1];
      if (last.t > upper + 1e-3) {
        issues.push(`${label} last keyframe t=${last.t}s exceeds duration ${upper}s`);
      }
      if (kfs.some((kf) => kf.t < -1e-6)) {
        issues.push(`${label} has a negative keyframe t`);
      }
    }
    if (Number.isFinite(minV) && Number.isFinite(maxV) && Math.abs(maxV - minV) < 1e-6) {
      issues.push(`${label} keyframe values never change, so the part does not move`);
    }
  }
  return issues;
}

/** Build a partial AnimationClip summary from module source. */
export function parseAnimationClip(code: string): AnimationClip | undefined {
  const duration = parseAnimationDuration(code);
  if (duration === undefined) return undefined;
  const name = parseAnimationName(code) ?? 'clip';
  const tracks = parseAnimationTracks(code);
  return {
    name,
    duration,
    ...(tracks.length > 0 ? { tracks } : {}),
  };
}

/**
 * Hard gate for animation agents: the output must not invent Mesh / Geometry /
 * Material constructors that were not in the baseline module. Pivot `Group`s
 * are allowed. Returns human-readable errors (empty = ok).
 */
export function assertAnimationPreservesGeometry(baseline: string, output: string): string[] {
  const errors: string[] = [];
  const baseCounts = countConstructorKinds(baseline);
  const outCounts = countConstructorKinds(output);

  for (const [kind, outCount] of outCounts) {
    const baseCount = baseCounts.get(kind) ?? 0;
    if (outCount > baseCount) {
      errors.push(
        `animation invented new THREE.${kind} (baseline had ${baseCount}, output has ${outCount}); ` +
          'preserve existing geometry/materials — only new THREE.Group pivots are allowed',
      );
    }
  }
  return errors;
}

/** Count `new THREE.Mesh|…Geometry|…Material(` occurrences (Groups ignored). */
function countConstructorKinds(code: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = /\bnew\s+THREE\.([A-Za-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const name = m[1];
    if (name === 'Group' || name === 'Object3D') continue;
    if (
      name === 'Mesh' ||
      name.endsWith('Geometry') ||
      name.endsWith('BufferGeometry') ||
      name.endsWith('Material')
    ) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}
