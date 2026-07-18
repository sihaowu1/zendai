---
name: camera-composition
description: Turn a user's prompt into concrete 3D object placement and camera position/lookAt/fov so the rendered frame actually shows what was asked for. Use together with scene-generation whenever building or reframing a Zendai scene — especially when the prompt implies a shot type ("close-up", "from above", "wide shot") or a spatial layout ("X next to Y", "Z in the background").
---

# Camera & Blocking Skill

Zendai has no camera operator and no image model to lean on — the only thing
that decides what appears in the frame is where you place objects (`buildScene`)
and where you put the camera (`CAMERA`). This skill turns a natural-language
prompt into both, deliberately, instead of leaving the camera at a generic
default that happens to point at the origin.

Use this skill alongside `scene-generation`'s module contract: it governs
*where things go and what the camera does*, not the export format.

## Coordinate system

Three.js in this project: **Y-up, right-handed**. `CAMERA` (see
`shared/src/types.ts`) supports exactly three fields — treat anything not on
this list as unavailable:

```ts
CAMERA = { position: [x, y, z], lookAt: [x, y, z], fov?: number };
```

- `position` — where the camera sits.
- `lookAt` — the point the camera aims at (defines forward direction).
- `fov` — vertical field of view in degrees (default ~50 if omitted).
- **No roll/tilt/up-vector control.** The camera never rolls sideways (no
  "Dutch angle"). If a prompt asks for a canted/tilted horizon, say so isn't
  supported and produce the closest supported framing (e.g. a low or high
  angle) instead of silently ignoring the request.

## Aspect ratio

The generation request tells you the target preview aspect ratio (`16:9`,
`1:1`, or `4:3` — see `AspectRatio` in `shared/src/types.ts`). This is a
composition input, not something you emit: it never becomes a PARAMS value or
a code comment about pixels/resolution. Two things follow from it:

1. **Acknowledge it.** Open your response with one short sentence naming the
   ratio you're composing for (e.g. "Composing for 16:9." or "Building a
   square 1:1 frame."), before the code fences.
2. **Use it for the frame check in Step 3.** `CAMERA.fov` is *vertical* FOV;
   the frame is only as wide as `hfov = 2·atan(tan(vfov/2) · aspect)`, where
   `aspect = width/height` (16/9 ≈ 1.78, 1:1 = 1, 4:3 ≈ 1.33). A composition
   that clears the vertical check can still clip subjects on the sides in a
   narrower ratio, or leave awkward empty space on the sides in a wider one —
   check both axes, not just the cone approximation in Step 3.
   - Wide ratios (16:9): more horizontal room than vertical — good for
     side-by-side blocking ("X next to Y"), horizon shots, establishing shots.
   - Square (1:1) and narrower (4:3): less horizontal margin — prefer
     centering the subject and stacking secondary elements vertically rather
     than spreading them sideways.

**This choice is made once, at generation time, and is not revisited.** If
the user later changes the aspect-ratio dropdown without re-prompting, the
scene module is not regenerated — the same `PARAMS`, `buildScene`, and
`CAMERA` keep running unchanged, and only the visible crop changes (an object
at `(1, 0, 0)` that was in frame at 16:9 may fall outside the frame at 1:1;
that is expected, not a bug to fix). Don't add logic to `buildScene` or
`updateScene` that reads or reacts to aspect ratio — the module has no way to
know it changed, and isn't supposed to. Only a fresh prompt (generate or
modify) re-runs this skill with whatever ratio is selected at that moment.

## Step 1 — Extract the blocking from the prompt

Read the prompt for three kinds of information, even when it's terse:

1. **Subjects** — what objects/models exist. A prompt with one noun ("a red
   cube") still needs a ground plane or environment to read as staged, not
   floating in a void unless the prompt implies emptiness.
2. **Spatial relationships** — words like "next to", "behind", "above",
   "orbiting", "in a row", "scattered", "towering over". Convert these directly
   into coordinates:
   - "next to / beside" → same `y`, offset on `x` (or `z`) by roughly
     `sum of radii * 1.2` so shapes don't intersect.
   - "behind / in front of" → offset along the axis the camera looks down,
     i.e. increase separation along whichever axis is closer to the
     camera-to-lookAt direction.
   - "above / stacked on" → offset on `y` by the supporting object's height.
   - "orbiting / circling" → parametrize position with `Math.sin`/`Math.cos`
     of `time` at a fixed radius (this is animation, not a fixed camera
     concern, but it changes how much clearance the camera needs).
   - "scattered / a field of" → distribute with a **seeded** pseudo-random
     placement (never `Math.random()` — `updateScene`/`buildScene` must stay
     deterministic per the scene-generation contract) over a bounded area.
3. **Shot type** — explicit ("close-up", "wide shot", "overhead", "from
   below", "over-the-shoulder"-style framing) or implied by mood ("epic",
   "intimate", "looming", "dwarfed by"). If the prompt gives no shot type,
   default to a **3/4 eye-level establishing shot** (see table).

If the prompt is simple ("a spinning cube"), don't leave the camera at an
arbitrary default — still pick a deliberate, flattering angle (3/4 high shot,
below) rather than a dead-on front view, which tends to look flat and hides
depth.

## Step 2 — Translate shot type to camera geometry

| Prompt language | position relative to subject center `C` and its bounding radius `r` | lookAt | fov |
|---|---|---|---|
| Default / establishing / "wide shot" | `C + [2.2r, 1.4r, 2.2r]` (3/4, slightly above) | `C` | 45–55 |
| "close-up" / "macro" / "detail shot" | `C + [0.6r, 0.3r, 0.9r]` | `C` (or the specific sub-part) | 35–45 |
| "from above" / "overhead" / "bird's-eye" | `C + [0, 3.5r, 0.3r]` (mostly vertical, tiny z offset so `lookAt` isn't degenerate) | `C` | 45–60 |
| "from below" / "low angle" / "looming" / "towering" | `C + [1.5r, -0.4r, 1.5r]` (only if the scene has room below `y=0`; otherwise `C + [1.8r, 0.15r, 1.8r]`) | `C + [0, 0.3r, 0]` (aim slightly up the subject) | 50–65 |
| "front view" / "head-on" | `C + [0, 0.5r, 3r]` | `C` | 40–50 |
| "side view" / "profile" | `C + [3r, 0.5r, 0]` | `C` | 40–50 |
| "epic" / "dramatic" / "hero shot" | low angle + wide fov: `C + [2r, -0.2r, 2.5r]`, fov 60–70 | `C + [0, 0.5r, 0]` | 60–70 |
| "intimate" / "isolated" / centered subject | close-up position, narrow fov 25–35 for compression | `C` | 25–35 |
| "wide establishing" / "landscape" / "environment" | pull back further: `C + [4r, 2r, 4r]` | `C` | 55–70 |

`r` is the approximate radius of the bounding sphere around whatever the shot
is framing — for a single 1-unit-radius sphere, `r = 1`; for a scene of
several objects spread over a 6-unit area, `r ≈ 3`. When in doubt, compute `r`
as half the largest span between any two subjects, plus each subject's own
size.

## Step 3 — Verify the frame, don't just guess

Before finalizing `CAMERA`, sanity-check with the standard framing distance
formula so subjects aren't clipped or lost in empty space. Check the
*vertical* axis with the table's `fov` directly, and the *horizontal* axis
with the aspect-derived `hfov` from the Aspect ratio section above — the two
diverge as soon as the ratio isn't square:

```
vDistance ≈ (subjectHeight / 2) / tan(vfov_in_radians / 2) * margin
hDistance ≈ (subjectWidth  / 2) / tan(hfov_in_radians / 2) * margin
distance  ≈ max(vDistance, hDistance)
```

Use `margin ≈ 1.3–1.8` (tighter for close-ups, looser for wide/establishing
shots) so the subject fills a pleasing fraction of the frame without touching
the edges. If multiple subjects are in play, `subjectWidth`/`subjectHeight`
are the full span across all of them (plus each subject's own diameter), not
just one object. Taking the `max` of the two ensures the tighter axis — the
one actually at risk of clipping for this ratio — sets the distance: a wide
16:9 frame is usually vertical-bound (`vDistance` dominates, leaving spare
width to work with), while a narrower 4:3 or 1:1 frame is more often
horizontal-bound for side-by-side blocking.

Mentally trace the ray from `position` to `lookAt`: everything the prompt
calls "in the shot" should lie roughly within a cone of half-angle `vfov/2`
vertically and `hfov/2` horizontally around that ray, at a range of distances
the camera can actually resolve (nothing crammed at the same depth as the
camera itself, nothing implausibly far beyond the visible objects' own
scale).

## Step 4 — Place ground/scale references when useful

A shot with no ground plane, floor, or reference object reads as "floating in
a void" — fine for space/abstract scenes, wrong for "a car in a parking lot"
or anything with an implied "above/below" relationship. Add a simple ground
plane (`PlaneGeometry` + `MeshStandardMaterial`) at `y = 0` when the prompt's
blocking depends on a surface, and place subjects with their base resting on
it (offset each object's `y` by its own half-height, not by `0`), so a "from
below" or "towering over" shot has visible ground to establish scale against.

## Worked example

Prompt: *"A small robot standing next to a tall lighthouse, camera looking up
at the lighthouse like it's towering over everything."*

1. Subjects: robot (small, `r ≈ 0.4`), lighthouse (tall, `r ≈ 1` radius but
   ~6 units tall — use height for the low-angle framing, not radius).
2. Relationship: "next to" → offset robot from lighthouse base by
   `~1.5` units on `x`, both resting on `y = 0`.
3. Shot type: "towering over" + "looking up at" → low-angle row in the table.
   Lighthouse center for framing purposes ≈ `[0, 3, 0]` (half its height).
4. Camera: `position: [2.5, -0.3, 2.5]` is below scene floor — clamp to stay
   above `y = 0` for a floor-based scene, so use
   `position: [2.2, 0.4, 2.2]`, `lookAt: [0, 4.5, 0]` (aim above center, up
   the tower), `fov: 60` for the exaggerated, looming perspective.
5. Verify: subject height ≈ 6, `tan(30°) ≈ 0.577`, `vDistance ≈
   (6/2) / 0.577 * 1.3 ≈ 6.75`. At 16:9, `hfov = 2·atan(tan(30°)·1.78) ≈
   50.5°`, subject width ≈ 2 (lighthouse + robot span), `hDistance ≈
   (2/2)/tan(25.3°)*1.3 ≈ 2.75` — vertical dominates, so 16:9 has spare
   horizontal room and the framing above is fine as-is. At 1:1, `hfov`
   shrinks to ≈35°, `hDistance ≈ (2/2)/tan(17.5°)*1.3 ≈ 4.1`, still under the
   vertical bound, so this particular composition happens to hold at all
   three ratios — actual camera distance from origin is `√(2.2² + 0.4² +
   2.2²) ≈ 3.15`, closer than either bound suggests, which is correct here: a
   deliberately tight, exaggerated low angle is what "towering over" and
   "looking up at" ask for, not a comfortable establishing shot.

## Output

Open with one short sentence acknowledging the target aspect ratio (per the
Aspect ratio section), then apply the rest of this reasoning silently and
emit the result as the module's `CAMERA` export plus the object positions
inside `buildScene` — don't narrate the geometry math beyond that unless
asked to explain the shot choice.
