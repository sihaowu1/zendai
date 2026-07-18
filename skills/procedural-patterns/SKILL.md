---
name: procedural-patterns
description: Craft guidance for procedural Three.js models — primitive choice per subject, material recipes, cheap believable detail, light rigs, and a pre-emit self-check. Use alongside threejs-modelling.
---

# Procedural Patterns

`threejs-modelling` defines the contract your output must satisfy. This skill is
about whether the result is any good. A module can pass every contract rule and
still read as obviously machine-made: flat uniform materials, parts floating
apart, one light, a camera pointed at nothing in particular.

Everything below is guidance, not schema. Where a rule and taste conflict on a
specific subject, follow taste and say why in the prose around the code block.

## 1. Geometry choice

Pick the primitive that matches the part's dominant form, then adjust with
scale. Composing two cheap primitives almost always beats forcing one.

| Part shape | Primitive | Notes |
| --- | --- | --- |
| Torso, chassis, slab, block | `BoxGeometry` | Scale non-uniformly. Bevel with a slightly larger, slightly darker sub-box behind it. |
| Head, joint, berry, pod | `SphereGeometry` | 16–24 segments is plenty. Squash on one axis so it doesn't read as a default ball. |
| Limb, pillar, barrel, trunk, pipe | `CylinderGeometry` | Different top/bottom radii give taper for free — use it on limbs. |
| Nose cone, roof, spike, tree crown | `ConeGeometry` | Stack two of decreasing radius for a stepped/conifer look. |
| Ring, tyre, handle, rim | `TorusGeometry` | `tube` well under `radius`, or it reads as a doughnut. |
| Bottle, vase, goblet, turned wood | `LatheGeometry` | Best return on effort for anything with a turned profile. |
| Ground, wall, backdrop | `PlaneGeometry` | Rotate `-Math.PI / 2` for ground. Always give the subject a ground. |

Reach for a `THREE.Group` instead of a single mesh when:

- the part has sub-parts that must move or scale together (an arm holding a hand)
- a single tunable should drive several meshes at once
- the part is a repeated unit you will place more than twice

Rule of thumb: if a part needs more than three primitives to read correctly,
it is really a group of named sub-parts. Name and return them.

## 2. Material recipes

Concrete starting points. Vary within the range per part — two metal parts on
the same model should not share a roughness value.

| Recipe | roughness | metalness | Colour guidance |
| --- | --- | --- | --- |
| Polished metal | 0.10–0.25 | 0.85–1.0 | Near-neutral, slight blue or warm tint. Not pure white. |
| Brushed / worn metal | 0.35–0.55 | 0.7–0.9 | Desaturate; add a darker variant for recessed parts. |
| Hard plastic | 0.30–0.45 | 0.0 | Saturated is fine. This is where colour lives. |
| Soft / matte plastic, rubber | 0.75–0.95 | 0.0 | Dark greys and blacks; tyres, grips, feet. |
| Skin | 0.55–0.70 | 0.0 | Warm mid-tone; make shaded parts (underside, inner arm) slightly darker and redder, not just darker. |
| Fabric | 0.85–1.0 | 0.0 | Muted. Break up large areas with a second, slightly different fabric. |
| Wood | 0.60–0.80 | 0.0 | Two related browns — one for the body, one a shade darker for edges/end grain. |
| Glass | 0.05–0.15 | 0.0 | `transparent: true`, `opacity` 0.3–0.5. Use sparingly. |
| Emissive / screen / light | 0.4 | 0.0 | Set `emissive` to the base colour and `emissiveIntensity` 0.5–1.5. |

**Hard rule: never emit a model where every material shares one roughness
value.** Flat uniform materials are the single biggest tell of generated 3D. A
model with four parts should have at least two or three distinct materials.

Related rules:

- Give each material a distinct name matching its role (`bodyMetal`,
  `trimPlastic`, `groundMatte`), not `material1`.
- Adjacent parts in different materials read as designed; adjacent parts in the
  same material read as one lump. Break up long spans with a trim material.
- Pure `#000000` and `#ffffff` almost always look wrong under lighting. Use
  `#1a1a1e` and `#f0efe9` instead.

## 3. Detail recipes

Detail is what separates a shape from a model. All of these are cheap:

- **Edge bevels.** Place a slightly larger, darker mesh directly behind a face
  so a rim of it shows around the edges. Reads as a chamfer for one extra mesh.
- **Panel seams.** Thin flattened boxes (0.01–0.02 thick) inset slightly into a
  large surface, in a darker version of the base material. Three or four seams
  transform a blank slab.
- **Greebles.** Small repeated boxes/cylinders on a large surface — vents,
  bolts, ribs, buttons. Place them with a loop over an explicit array of
  offsets, never `Math.random()` (the contract requires purity).
- **Asymmetry.** Perfect bilateral symmetry reads as synthetic. Offset one
  detail, angle one part a few degrees, make one side's trim slightly larger.
- **Insets over outsets.** Recessing a panel slightly usually looks more
  deliberate than bolting something on.
- **Grounding contact.** Add a subtle darker disc or slightly flattened base
  where the subject meets the ground; without it, things read as floating even
  when they are touching.

Stay under the ~50k triangle budget from the modelling contract. Low segment
counts on spheres and cylinders (16–24) are almost never the thing that makes a
model look bad — flat materials and bad proportions are.

## 4. Light rigs

Default to a three-light rig positioned relative to the subject's bounding box.
Let `S` be the subject's largest dimension and centre it near the origin.

- **Key** — `DirectionalLight`, intensity 2.0–3.0, at roughly
  `(1.2S, 1.6S, 1.0S)`. This is the light that defines the form. Off-axis, above,
  and in front.
- **Fill** — `DirectionalLight` or `HemisphereLight`, intensity 0.4–0.8 (about
  a quarter of key), from the opposite side at `(-1.0S, 0.6S, 0.8S)`. It opens
  up the shadow side without flattening it. Tint it slightly cool if the key is
  warm.
- **Rim** — `DirectionalLight`, intensity 1.0–2.0, from behind at
  `(-0.6S, 1.0S, -1.4S)`. Separates the silhouette from the background. This is
  the light most often missing, and adding it is the single biggest lighting win.
- **Ambient** — `AmbientLight` at 0.2–0.35, no more. Higher values wash out
  everything the other three lights are doing.

Ratio matters more than absolute values: roughly 1 : 0.25 : 0.5 for
key : fill : rim. One light at intensity 1 with ambient 0.8 is the default-look
lighting to avoid.

Return the lights in the `buildScene` map (`keyLight`, `fillLight`, `rimLight`)
so they are addressable.

## 5. Self-check before emitting

Run this against your own output before returning it. Fix anything that fails.

1. **Every part is reachable.** Every mesh and group you created appears in the
   `buildScene` return map by name. Nothing is anonymous.
2. **Materials vary.** No two materials are identical, and they do not all share
   one roughness value.
3. **Nothing floats.** The lowest point of the subject sits on the ground plane
   (y = 0), or is deliberately and visibly supported. Check the actual arithmetic
   of position minus half-height per part, don't assume.
4. **Parts connect.** Adjacent parts overlap slightly rather than butting
   exactly or leaving a gap. Limbs meet torsos inside the torso volume.
5. **Camera frames the subject.** `CAMERA.position` is far enough back that the
   whole bounding box is in frame, and `lookAt` is at the subject's centre of
   mass — usually mid-height, not the origin.
6. **Every param does something.** Each entry in `PARAMS` is read in
   `buildScene` or `updateScene` and visibly changes the model. Six to fourteen
   of them, weighted toward per-part size and proportion.
7. **Still pure.** No `Math.random()`, no `Date`, no time-driven motion, no
   state accumulated across calls.
8. **Proportions checked against reality.** A human head is about one-seventh of
   body height; a car is roughly 2.5 times as long as it is wide. Sanity-check
   the numbers you chose rather than eyeballing the code.

## 6. Honesty about what this is

These models are stylized approximations built from primitives, not scans and
not photorealistic renders. That is the medium, and the good work is done
inside it.

The practical consequence: **a clean, simple, well-proportioned form beats a
muddled detailed one every time.** When you are unsure whether to add another
layer of detail, don't. Spend the effort on proportion, material variation, and
lighting instead — those three carry almost all of the perceived quality.

If the user's prompt asks for something primitives genuinely cannot express
(a specific person's face, intricate organic surfaces, text on a curved
surface), build the closest honest interpretation and say plainly in the prose
what you approximated. Do not silently return something that misses the ask.
