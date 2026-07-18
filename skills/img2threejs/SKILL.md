---
name: img2threejs
description: Reconstruct an object from a reference image as a code-only, procedural, component-based Three.js model. Uses decomposition, primitives, and procedural materials — no mesh extraction.
---

# Image-to-Three.js Reconstruction

You rebuild the subject in a reference image as a **code-only procedural Three.js model**
built from primitives, procedural shaders, and generated geometry. This is
reconstruction-by-code — not photogrammetry, mesh extraction, or downloaded assets.

## Pipeline (follow in order)

### 1. Analyze the Reference Image

Before writing any code, perform a structured decomposition:

**Component Decomposition:**
- Identify every distinct part of the subject (body, lid, handle, leg, wheel, etc.)
- For each part, choose the best-fit Three.js primitive: BoxGeometry, SphereGeometry,
  CylinderGeometry, ConeGeometry, TorusGeometry, LatheGeometry, ExtrudeGeometry, TubeGeometry
- Establish the parent-child hierarchy (what attaches to what)
- Estimate relative proportions and sizes between all parts

**Material Extraction:**
- Extract dominant colors as hex values from the image
- Estimate per-part material properties: metalness (0–1), roughness (0–1), emissive areas
- Note surface details: bevels, rounding, gloss variations, patterns, textures
- Identify material boundaries (where one surface meets another)

**Lighting Analysis:**
- Estimate primary light direction from shadows and highlights
- Note any rim lighting, ambient occlusion cues, or specular spots
- Determine if materials are metallic, dielectric, translucent, or emissive

**Proportions & Geometry Strategy:**
- Measure relative sizes: "the handle is ~20% the width of the body"
- Identify symmetry axes — mirror what you can
- Note complex curves that need LatheGeometry or ExtrudeGeometry vs simple primitives
- For unseen sides, infer by mirroring visible geometry or using reasonable defaults

### 2. Build as an Assembly of Named Parts

Every model must be a composed hierarchy, never a single mesh:

- Split the subject into logical named components matching the decomposition
- Each component gets its own `THREE.Group` with properly offset pivot
- Parent components so proportions stay coherent when scaled
- Parts attach at defined connection points — nothing floats in mid-air
- Use instancing or cloning for repeated elements (bolts, teeth, tiles, etc.)

### 3. Geometry Techniques (prefer in this order)

1. **Primitives** — Box, Sphere, Cylinder, Cone, Torus, Capsule for basic shapes
2. **Shape + ExtrudeGeometry** — for profiles, cross-sections, beveled edges
3. **LatheGeometry** — for rotationally symmetric objects (bottles, vases, columns)
4. **TubeGeometry + CatmullRomCurve3** — for pipes, cables, organic curves
5. **BufferGeometry** — only when above options cannot achieve the shape
6. **CSG-like composition** — overlap/subtract primitives visually with materials

Apply bevels, fillets, and rounding via `ExtrudeGeometry({ bevelEnabled: true })` or
by composing rounded primitives — real objects rarely have perfectly sharp edges.

### 4. Material Approach

Use `MeshStandardMaterial` or `MeshPhysicalMaterial` with proper PBR:

- **Independent channels** — never alias albedo into roughness or roughness into normal
- **Per-part materials** — each logical component gets its own material with extracted colors
- **Surface detail** — use `roughnessMap` or `normalMap` generated via canvas textures
  for scratches, grain, or patterns when detail matters
- **Clearcoat** for glossy finishes (painted surfaces, lacquer, glass coating)
- **Metalness** is binary or near-binary in reality — full metal (0.9–1.0) or non-metal (0.0–0.05)

### 5. Lighting Setup

Include a proper three-point setup that approximates the reference:

- Key light matching the inferred direction from the reference image
- Fill light (softer, opposite side) for ambient illumination
- Optional rim/back light for edge definition
- Ambient light for baseline visibility

### 6. Quality Standards

- **Proportions must match** the reference — this is the primary fidelity measure
- **Colors must be extracted** from the image, not invented
- **Surface character** (matte/glossy/metallic/rough) must match visual evidence
- **Component count**: enough parts to capture the subject's structure (typically 8–30 parts)
- **Polygon budget**: keep under 50k triangles total for real-time performance
- State explicitly when output is approximate — a single image cannot reveal hidden sides

## Response Format

Return exactly one fenced ` ```javascript ` block containing the Three.js scene module.

## Scene Module Contract

Same contract as standard Zendai models:

- **No `import`, `require`, or `fetch`** — the host passes `THREE` in
- Export `PARAMS`, `CAMERA`, `buildScene({ THREE, scene, params })`, and
  `updateScene({ THREE, scene, objects, params, time })`
- `buildScene` returns an object map of every named part
- `updateScene` applies PARAMS only — no baked animation from `time`
- Every visual constant lives in `PARAMS` with `@tunable` annotations
- Favor per-part size/proportion/color params (6–14 tunables sweet spot)

## Tunables for Reconstructed Models

For image reconstructions, include tunables that let users adjust:

- Overall scale
- Per-component proportions (width, height, depth of key parts)
- Material colors (extracted from image, adjustable by user)
- Metalness/roughness of key surfaces
- Lighting intensity and direction

## Modify Mode

When given existing code plus a change request, return the complete updated
` ```javascript ` block. Preserve named parts and proportions unless the
instruction explicitly changes them. If asked to refine accuracy, focus on
the specific area mentioned without tearing down unrelated components.
