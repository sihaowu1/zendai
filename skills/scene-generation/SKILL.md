---
name: scene-generation
description: Generate and modify parametric 3D models as code. Produces a component-based Three.js scene module with tunable, annotated parameters from a natural-language prompt. Use whenever creating or editing 3D models or scenes in Zendai. Do not invent animations — modelling only.
---

# 3D Model Generation Skill

You generate **static, component-based 3D models as code** — never as images or
via a video-generation service, and **never with baked animations**. Motion is
added later by a separate step; this skill only builds poseable structure.

Every model is a Three.js/WebGL scene module (rendered live in the editor and by
the Remotion MP4 pipeline).

## Response format

Return exactly one fenced code block (brief prose around it is fine, no other
code blocks):

1. A ` ```javascript ` block — the Three.js scene module (`scene.module.js`).

## Three.js scene module contract

The module is executed in a sandbox that supplies everything it needs. It must
be completely self-contained:

- **No `import`, `require`, or `fetch`.** The host passes `THREE` in.
- Export exactly these members:
  - `export const PARAMS = { ... }` — every tunable value (see Tunables below).
  - `export const CAMERA = { position: [x, y, z], lookAt: [x, y, z], fov }` —
    optional but strongly recommended so the framing is intentional.
  - `export function buildScene({ THREE, scene, params })` — creates lights,
    materials, and **named component meshes/groups**, adds them to `scene`, and
    **returns an object map** of every part (plus lights/ground), e.g.
    `return { head, torso, leftArm, rightArm, leftLeg, rightLeg, ground, keyLight }`.
  - `export function updateScene({ THREE, scene, objects, params, time })` —
    **applies PARAMS only** (scales, colors, visibility, optional style index).
    May ignore `time`. Must **not** animate from `time`.
- `updateScene` must stay a **pure function of its inputs**: the same
  `params` (and `time`, if used later) must always produce the same pose. No
  `Math.random()` (inline a seeded PRNG if you need noise), no `Date`, no
  accumulating state between calls. This is required because the Remotion
  renderer draws frames independently and out of order.
- **No baked animations.** Do not invent spin, bob, walk, idle, or story cycles.
  Do not drive `rotation`/`position` from `time`. If the user asks for animation,
  still return a static component model and note that animation comes later.
- Keep geometry modest (under ~50k triangles). Use `MeshStandardMaterial` and
  include at least one directional/point light plus a soft ambient light.
- Read every visual constant through `params.<name>` — never duplicate a value
  that also lives in PARAMS.

## Components (required)

Build models as **assemblies of named parts**, not a single mesh:

- Split the subject into logical components (e.g. human → `head`, `torso`,
  `leftArm`, `rightArm`, `leftLeg`, `rightLeg`; vehicle → `body`, `wheelFL`, …).
- Prefer separate `THREE.Group` / `THREE.Mesh` nodes per part, parented so
  proportions stay coherent when scaled.
- **Every part must appear in the `buildScene` return map** so the editor’s
  layers list can address it.
- Prefer **structure tunables** over look-only ones: `headSize`, `torsoWidth`,
  `armLength`, `legLength`, etc., applied in `updateScene` via
  `objects.<part>.scale` (or equivalent).

### Variant / layer swaps (only when asked)

When the user explicitly asks to swap or choose variants (e.g. “helmet or
bare head”, “swap the legs”):

- Add an integer style PARAM with `@min 0 @max N @step 1` and a clear `@label`.
- Switch geometry or materials in `buildScene` / `updateScene` based on that
  index, **or** replace the named part on modify while keeping other parts.
- Do **not** invent multi-variant slots on every generate — only when requested.

## Tunables

Every value a user might want to tweak must live in `PARAMS` with a JSDoc
annotation. The editor parses these annotations to build sliders and switches:

```javascript
export const PARAMS = {
  /**
   * @tunable
   * @min 0.5 @max 2 @step 0.05
   * @label Head size
   */
  headSize: 1,
  /**
   * @tunable
   * @min 0.5 @max 2 @step 0.05
   * @label Leg length
   */
  legLength: 1,
  /**
   * @tunable
   * @label Body color
   */
  bodyColor: '#4f8ef7',
};
```

Rules:

- **Numbers** must include `@min`, `@max`, and `@step` → rendered as sliders.
- **Booleans** need only `@tunable` (plus optional `@label`) → rendered as
  switches.
- **Colors** are single-quoted hex strings (`'#rrggbb'`) → rendered as color
  pickers.
- 6–14 tunables is the sweet spot; every one must actually affect the model.
- Favor per-part size/proportion params; avoid motion params (`spinSpeed`,
  `bobHeight`, etc.).

## Modify mode

When you are given the current module code plus a change request, return the
**complete updated** block (never diffs or fragments). Preserve existing
parameter names, values, and named parts unless the request changes them. If the
user asks to swap a part or add variants, update that component (and add style
tunables if needed) without tearing down unrelated parts.
