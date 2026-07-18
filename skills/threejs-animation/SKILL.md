---
name: threejs-animation
description: Add user-requested, one-shot timeline animations to an existing component-based Three.js model. Use for Zendai animation — pivot-targeted motion with a finite playout duration, never looping filler.
---

# Three.js Animation Skill

You add **user-requested animations** to an existing component-based Three.js
scene module. You never invent idle, bob, spin, or walk cycles the user did
not ask for. Motion is a **one-shot timeline** with a finite playout duration —
after it ends, hold the final pose (do **not** loop).

This skill adapts an action-ready pattern: animate **pivot groups at joints**,
not centered visual meshes; expose named parts via the `buildScene` return map;
drive clips from normalized progress or keyframe tracks.

## Response format

Return exactly one fenced code block (brief prose around it is fine, no other
code blocks):

1. A ` ```javascript ` block — the **complete** updated Three.js scene module.

Never return diffs or fragments. Never generate a brand-new model from scratch —
always start from the module the user provided.

## Module contract (preserve + extend)

Keep the existing modelling contract. The host injects `THREE`; the module must
be self-contained (**no `import` / `require` / `fetch`**).

Required exports:

- `export const PARAMS = { ... }` — preserve existing tunables unless the
  request requires a change.
- `export const CAMERA = { ... }` — preserve if present.
- `export function buildScene({ THREE, scene, params })` — preserve geometry;
  may insert **pivot / hinge groups** when the requested motion needs a joint.
  Return a named object map of every part (including new pivots).
- `export function updateScene({ THREE, scene, objects, params, time })` —
  apply PARAMS first, then sample the active animation from `time`.

Add:

- `export const ANIMATION = { ... }` — the one active clip (see below).

`updateScene` must stay a **pure function of its inputs**: same `params` +
`time` → same pose. No `Math.random()`, no `Date`, no accumulated state between
calls (Remotion renders frames independently).

## ANIMATION export

```javascript
export const ANIMATION = {
  name: 'openLid',   // stable id for later save/load
  duration: 1.2,     // playout length in seconds; one-shot
  tracks: [
    {
      part: 'lidHinge',    // must match a buildScene return key (prefer pivots)
      channel: 'rotation', // rotation | position | scale
      axis: 'x',           // x | y | z when channel is a vector
      keyframes: [
        { t: 0, v: 0 },
        { t: 1.2, v: -Math.PI * 0.42 },
      ],
    },
  ],
};
```

Rules:

- **One active clip** per module for now (`name` reserved for multi-clip later).
- `duration` is required and must be `> 0`. Prefer an explicit length from the
  user; otherwise choose a short, readable playout (typically 1–4 seconds).
- `tracks` are preferred for multi-part body motion. Keyframe `t` values are
  **absolute seconds** in `[0, duration]`, sorted ascending; lerp between
  neighbors (use angle-safe interpolation for rotations).
- Simple single-DOF clips may omit elaborate tracks and drive motion from
  normalized progress in `updateScene` (see sampling below) — still export
  `name` and `duration`.

## Sampling in updateScene (no loop)

Always clamp — **never** wrap with `%` or restart:

```javascript
const u = Math.min(Math.max(time / ANIMATION.duration, 0), 1); // [0, 1]
const tSec = u * ANIMATION.duration; // absolute time for keyframe lookup

// 1) Apply PARAMS (scales, colors, visibility) as the modelling module did.
// 2) Sample tracks at tSec, OR apply simple progress: e.g. angle = -u * maxAngle.
// 3) Write transforms on pivot parts only.
```

After `time >= duration`, `u === 1` — **hold the final pose**.

## Pivot-first hierarchy

Animate pivots at joints; keep visual meshes as children with local offsets.

Pivot rules:

- **Hinge** — lids, doors, jaws, levers, wings, flaps (pivot on the hinge edge).
- **Base** — upright props, poles, legs that rotate from the ground contact.
- **Branch / root** — limbs that bend from the shoulder/hip (pivot at the joint).
- **Center** — only when the whole object should spin around its center of mass.

When the existing hierarchy cannot rotate correctly at a joint, **insert a
pivot `Group`**, reparent the visual mesh under it with the correct local
offset, put the **pivot** (not only the mesh) in the `buildScene` return map,
and target that pivot in `ANIMATION.tracks`.

Do **not** invent extra meshes or materials just to animate. Preserve
unrelated parts and PARAMS.

## User intent only

- Animate **only** what the user asked for.
- Do not add idle bob, continuous spin, walk cycles, or story filler.
- If the request is ambiguous about which part moves, pick the most obvious
  named part from the current return map and keep the motion minimal.

## Worked example 1 — hinge open (normalized progress)

Chest lid opens once over 1.2 seconds. `buildScene` exposes `lidHinge` (pivot
at the back edge; lid mesh is a child). `updateScene`:

```javascript
export const ANIMATION = { name: 'openLid', duration: 1.2 };

export function updateScene({ objects, params, time }) {
  // …apply PARAMS…
  const u = Math.min(Math.max(time / ANIMATION.duration, 0), 1);
  objects.lidHinge.rotation.x = -u * Math.PI * 0.42;
}
```

## Worked example 2 — arm wave (keyframe tracks)

Character waves the right arm once over 2.5 seconds. Tracks target the arm
**pivot** (`rightArm`), not a centered mesh:

```javascript
export const ANIMATION = {
  name: 'wave',
  duration: 2.5,
  tracks: [
    {
      part: 'rightArm',
      channel: 'rotation',
      axis: 'z',
      keyframes: [
        { t: 0, v: 0 },
        { t: 0.5, v: -1.2 },
        { t: 1.0, v: -0.3 },
        { t: 1.5, v: -1.2 },
        { t: 2.5, v: 0 },
      ],
    },
  ],
};

export function updateScene({ objects, params, time }) {
  // …apply PARAMS…
  const u = Math.min(Math.max(time / ANIMATION.duration, 0), 1);
  const tSec = u * ANIMATION.duration;
  for (const track of ANIMATION.tracks) {
    const part = objects[track.part];
    if (!part) continue;
    const v = sampleKeyframes(track.keyframes, tSec); // lerp between neighbors
    if (track.channel === 'rotation') part.rotation[track.axis] = v;
    else if (track.channel === 'position') part.position[track.axis] = v;
    else if (track.channel === 'scale') part.scale[track.axis] = v;
  }
}

function sampleKeyframes(keyframes, t) {
  if (keyframes.length === 0) return 0;
  if (t <= keyframes[0].t) return keyframes[0].v;
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      return a.v + (b.v - a.v) * f;
    }
  }
  return last.v;
}
```

Inline a small `sampleKeyframes` helper in the module when using tracks (no
imports).

## Modify posture

Given the current module + an animation instruction:

1. Preserve geometry, materials, PARAMS, CAMERA, and unrelated named parts.
2. Insert or adjust pivots only when required for correct joint motion.
3. Replace or add `ANIMATION` for this request (one active clip).
4. Rewrite the motion half of `updateScene` (keep PARAMS application).
5. Return the complete `` ```javascript `` module.
