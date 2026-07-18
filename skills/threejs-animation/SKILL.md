---
name: threejs-animation
description: Add user-requested, one-shot timeline animations to an existing component-based Three.js model. Use for Zendai animation — pivot-targeted motion with a finite playout duration, never looping filler.
---

# Three.js Animation Skill

You add **user-requested animations** to an existing component-based Three.js
scene module. You never invent idle, bob, spin, or walk cycles the user did
not ask for. Motion is a **one-shot timeline** with a finite playout duration —
after it ends, hold the final pose (do **not** loop).

**Host contract:** the base model on the Model screen is immutable. Your output
is stored as a **duplicate clip** in an animation library — it does **not**
replace the user's source model. Prefer `ANIMATION.tracks` on existing part
keys so the host can overlay motion onto the pristine base geometry.

This skill adapts an action-ready pattern: animate **pivot groups at joints**,
not centered visual meshes; expose named parts via the `buildScene` return map;
drive clips from normalized progress or keyframe tracks.

## Response format

Return exactly one fenced code block (brief prose around it is fine, no other
code blocks):

1. A ` ```javascript ` block — the **complete** Three.js scene module (base
   module + this clip's `ANIMATION` / `updateScene` motion).

Never return diffs or fragments. Never generate a brand-new model from scratch —
always start from the module the user provided.

**Hard host reject:** the host compares constructor counts against the baseline
module. Inventing new `THREE.Mesh`, `THREE.*Geometry` / `*BufferGeometry`, or
`THREE.*Material` constructors is rejected. Inserting `THREE.Group` pivots (and
reparenting existing meshes under them) is allowed.

## Module contract (preserve + extend)

Keep the existing modelling contract. The host injects `THREE`; the module must
be self-contained (**no `import` / `require` / `fetch`**).

Required exports:

- `export const PARAMS = { ... }` — **preserve unchanged** (do not retune sizes
  or colors for the animation request).
- `export const CAMERA = { ... }` — **preserve unchanged**. Framing is owned by
  the user's live orbit in the editor; animation agents must never set or change
  CAMERA.
- `export function buildScene({ THREE, scene, params })` — **preserve geometry
  and materials**. Prefer animating existing return-map keys. Insert
  **pivot / hinge groups** only when the requested motion cannot work on the
  current hierarchy. Return a named object map of every part (including new
  pivots when added).
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

- **One clip per generation** — write a single `ANIMATION` export for this
  request. The host stores many saved clips under the model; do **not** assume
  you are erasing history, and do not try to merge prior clips into this export.
- `duration` is required and must be `> 0`. Prefer an explicit length from the
  user; otherwise choose a short, readable playout (typically 1–4 seconds).
- **`tracks` are required when any part moves** (strongly preferred always).
  The host builds per-part timeline lanes and overlays tracks onto the base
  model. Keyframe `t` values are **absolute seconds** in `[0, duration]`,
  sorted ascending; lerp between neighbors (use angle-safe interpolation for
  rotations).
- Simple single-DOF clips may also drive motion from normalized progress in
  `updateScene` — still export `name`, `duration`, and a `tracks` array naming
  the part so the host timeline works.

## Invariants the host verifies

After you return, the host executes your module headlessly with real Three.js and
samples it across the clip. It rejects and asks you to fix any of these, so
satisfy them the first time:

- **Keyframes**: every track has `>= 2` keyframes; the first is at `t = 0`, the
  last at `t = duration`; `t` values are sorted ascending and within
  `[0, duration]`; every `t`/`v` is finite. A track whose values never change is
  treated as "no motion" — either make it move or remove it.
- **Motion happens**: a subject the request asked to move must actually change
  (its tracked parts' transforms differ across time). Don't export a clip that
  no-ops.
- **Hold, don't loop**: the pose at `t = duration` must equal the pose at any
  later time (the host samples `1.5·duration`). Always clamp `time` — never wrap
  with `%`.
- **Stay on the floor**: the subject's lowest point must stay near `y >= 0`
  throughout (tiny dips under ~0.25 are tolerated; deeper sinks are rejected).
  Ground-contact math for a limb of length `L` swinging by angle `θ`
  about a pivot at height `h`: its tip reaches lowest `y ≈ h - L·(1 - cos θ)` (or
  `h - L·sin θ` for a downward swing) — keep that `>= 0`, or raise the pivot, so
  nothing sinks through the ground plane.
- **Bounded**: don't send a subject flying far from the origin or scale it
  unboundedly; keep motion proportional to the model's own size.
- **Own footprint**: you only see your own subject in multi-subject scenes — keep
  your motion within your own space so you don't drive through a neighbour you
  can't see. Use the brief's timing to stagger interactions. Intentional contact
  (grasp, pick-up, hand-off) is allowed when the brief asks for it.
- **No new geometry**: the host rejects any net-new `THREE.Mesh`, `*Geometry`, or
  `*Material` constructors vs the baseline module. Pivot `Group`s only.
- **Deterministic**: no `Math.random()`, `Date`, or `performance.now()` — same
  `time` must always give the same pose.

## Correction pass

If you are given the module plus a list of problems the host verifier found,
treat it as a targeted fix: address **exactly** those problems, preserve
everything else (geometry, PARAMS, other tracks, the parts that already work),
and keep the same `ANIMATION.duration` you were told to use. Return the complete
corrected `` ```javascript `` module.

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
and target that pivot in `ANIMATION.tracks`. Prefer existing part names when
possible so overlays match the base model.

Do **not** invent extra meshes or materials just to animate. The host **rejects**
new Mesh / Geometry / Material constructors relative to the baseline. Preserve
unrelated parts and PARAMS. Do **not** redesign the model.

## User intent only

- Animate **only** what the user asked for.
- Do not add idle bob, continuous spin, walk cycles, or story filler.
- If the request is ambiguous about which part moves, pick the most obvious
  named part from the current return map and keep the motion minimal.

## Multi-subject scenes (one subject per call)

When a scene has several subjects, a **director** splits the work: you animate
**one subject at a time**, given only that subject's own module and a brief for
what it does. The host re-fuses every animated subject into one scene
deterministically — you never see or edit the other subjects.

- Animate **only the subject in this module**. Do not add, remove, or redesign
  other models — you can't see them and the host will discard such attempts.
- **Honor the shared `duration`** you are given verbatim as `ANIMATION.duration`.
  Every subject in the scene shares one clip length, so a "wave then hand-off"
  interaction lines up only if all subjects use the same duration and time
  their keyframes to the same absolute seconds. Use the brief's timing cues
  (e.g. "start moving at 1s") as absolute `t` values in `[0, duration]`.
- **Never set or change `CAMERA`.** Framing is the user's live orbit / existing
  CAMERA export — there is no camera agent on the animate path. A per-subject
  CAMERA would be ignored anyway.
- Keep part keys as they are in this module. The host namespaces them per
  subject when fusing, so plain existing names (e.g. `rightArm`) are correct.

## Worked example 1 — hinge open (normalized progress)

Chest lid opens once over 1.2 seconds. `buildScene` exposes `lidHinge` (pivot
at the back edge; lid mesh is a child). `updateScene`:

```javascript
export const ANIMATION = {
  name: 'openLid',
  duration: 1.2,
  tracks: [
    {
      part: 'lidHinge',
      channel: 'rotation',
      axis: 'x',
      keyframes: [
        { t: 0, v: 0 },
        { t: 1.2, v: -Math.PI * 0.42 },
      ],
    },
  ],
};

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
3. Replace or add `ANIMATION` for this request (one active clip) with `tracks`.
4. Rewrite the motion half of `updateScene` (keep PARAMS application).
5. Return the complete `` ```javascript `` module (stored by the host as a
   duplicate clip — the user's base model is never replaced).
