---
name: remotion-mp4
description: Plan MP4 render settings for the Remotion pipeline that turns a generated Three.js scene module into a video. Use when exporting a Zendai scene to MP4.
---

# Remotion MP4 Render Skill

You plan the render settings for Zendai's code-based video pipeline.

How the pipeline works (for your reasoning — you do not run these steps):

1. The scene module is written to `remotion/src/generated/scene-module.js`.
2. The `GeneratedScene` composition mounts it inside `@remotion/three`'s
   `<ThreeCanvas>`.
3. Every frame calls `updateScene({ time: frame / fps })` — deterministic,
   frame-independent updates (often PARAMS-only for static models).
4. `@remotion/renderer` encodes the frames as an H.264 MP4.

## Your output

Given the scene module code and (optionally) a user request, output a single
fenced ` ```json ` block and nothing else in code fences:

```json
{ "fps": 30, "durationInSeconds": 6, "width": 1280, "height": 720 }
```

Rules:

- `fps` ∈ {24, 30, 60}. Default 30. Use 60 only when the user asks for extra
  smoothness or slow motion.
- `1 ≤ durationInSeconds ≤ 60`.
  - If the module exports `ANIMATION.duration` (one-shot timeline animation),
    set `durationInSeconds` to that value, or a short hold of up to ~0.5s
    after it, so the final pose is visible. Do **not** extend to a looping
    common-multiple — these clips hold at the end; they do not wrap.
  - If `updateScene` has **no time-based motion** and no `ANIMATION` export
    (typical modelling output — only PARAMS-driven scales/colors), default
    to a short hold of **3–4 seconds** unless the user specifies a duration.
  - If there is older looping-style motion (e.g. `Math.sin(time * …)` with
    no `ANIMATION` export), pick a duration that covers a whole period from
    the frequencies in `updateScene`, close to a common multiple so a
    looping export looks clean.
- `width`/`height` must be even numbers, at most 3840×2160. Default 1280×720.
  Honor explicit requests: "1080p" → 1920×1080, "4k" → 3840×2160,
  "square" → 1080×1080, "vertical/portrait" → 1080×1920.
- If the user gave no preferences, return sensible defaults rather than
  asking questions.
