# Zendai

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Zendai: an AI-powered, **code-based** 3D generation and video-editing system. A prompt
goes to an AI agent that writes a Three.js/WebGL scene module — never an image or
video-generation model — that stays live-editable, tunable through sliders/switches,
exportable as code, and renderable to MP4 through Remotion.

## Commands

```bash
npm install                # install all four workspaces
cp .env.example .env       # OPENROUTER_API_KEY etc; server runs fully offline without it

npm run dev                # server (http://localhost:5174) + web (Vite, proxied) together
npm run dev:server         # server only
npm run dev:web            # web only
npm run remotion:studio    # preview the Remotion composition standalone
npm run typecheck          # typecheck every workspace (tsc --noEmit, no test suite exists)
```

There is no test framework in this repo — `npm run typecheck` is the correctness gate.
There is no lint script configured.

## Architecture

npm workspaces: `shared`, `server`, `web`, `remotion`.

```
web (editor + controls + viewport)
   │  fetch /api/*
   ▼
server/routes  ─▶  server/agents (orchestrator)
   │                    │
   │                    ├─▶ server/ai (Claude + threejs-modelling / img2threejs /
   │                    │        threejs-animation skills)
   │                    │        │ offline fallback ▶ server/agents/templateFallback (shared/sceneTemplate)
   │                    └─▶ server/remotion/renderer ─▶ remotion/ (bundle + render) ─▶ renders/*.mp4
   ▼
server/export (code ZIP via shared templates, MP4 job polling)
```

- **`shared/`** — AI/browser/server-agnostic core imported by both `server` and `web` as
  `@motionforge/shared`: types (`types.ts`), PARAMS-block ↔ slider/switch/color-picker parsing
  and patching (`tunables.ts`), model-module validation (`validate.ts`), deterministic offline
  model-code templates (`sceneTemplate.ts`), animation export parsers (`animation.ts`). The
  model-module contract is defined exactly once here — never duplicate it in `server` or `web`.
- **`server/`** — Express API.
  - `config/` merges `config/default.config.json` with `.env` overrides.
  - `ai/` — Anthropic client, skill loader, fenced-code-block extraction from model output.
  - `agents/` — `orchestrator.ts` (entry point for generate/modify/animate), `modelAgent.ts`,
    `animationAgent.ts` (single agent: adds ANIMATION to a module duplicate), `fuseAgent.ts`
    (legacy AI fuse; client merges are deterministic co-view), `templateFallback.ts` (offline).
  - `remotion/` — bundles and renders the Remotion project to MP4.
  - `export/` — code (ZIP) and MP4 export flows; reuses `shared` templates, doesn't duplicate them.
  - `routes/` — `/api/generate`, `/api/modify`, `/api/animate`, `/api/fuse`, `/api/export/*`.
- **`web/`** — front end: code editor + element controls only, no other UI.
  - `components/app/` — studio router shell, prompt bar, status bar.
  - `controls/` — sliders/switches/color pickers generated from a module's `PARAMS` block.
  - `viewport/` — live Three.js/WebGL preview runtime (`SceneRuntime.ts`).
  - `state/useSceneProject.ts` — the single client-side state hook; tracks models, an
    **animation library** per model (`animations[]`; base `code` stays frozen after modelling),
    merges (deterministic fuse into one animatable module; `children` hold
    independent code snapshots for hierarchy UI — not live links to sources), and a
    hierarchical multi-track timeline (Video screen only).
  - `api/client.ts` — typed fetch client for the server API.
- **`remotion/`** — renders a generated scene module to MP4. `generated/scene-module.js` is
  overwritten per render by the server; `GeneratedScene.tsx` drives `buildScene`/`updateScene`
  inside `<ThreeCanvas>` (`@remotion/three`).

## The model-module contract

Every generated model follows the Three.js modelling contract (see
`skills/threejs-modelling/SKILL.md`):

- **Three.js module** (`scene.module.js`): no `import`/`require`/`fetch` — the host injects
  `THREE`. Must export `PARAMS`, optional `CAMERA`, `buildScene({ THREE, scene, params })`, and
  `updateScene({ THREE, scene, objects, params, time })`. Modelling produces **static
  component-based** figures: `buildScene` returns a named object map of parts (e.g. `head`,
  `torso`, `leftArm`), and `updateScene` applies PARAMS (sizes, colors) only — **no baked
  time-based animation**. It must stay pure (no `Math.random()`, `Date`, or accumulated state)
  because Remotion renders frames independently and out of order.
- **Tunables**: every user-adjustable value lives in `PARAMS` with a `@tunable` JSDoc annotation
  (`@min`/`@max`/`@step` for sliders, booleans → switches, `'#rrggbb'` strings → color pickers).
  Prefer per-part size params (`headSize`, `legLength`, …). `shared/src/tunables.ts` is the
  single parser/patcher for this — controls patch the PARAMS block directly rather than
  re-serializing the whole module.

Claude Skills that drive this: `skills/threejs-modelling/SKILL.md` (model generation/modification),
`skills/img2threejs/SKILL.md` (reconstructs a model from an attached reference image via component
decomposition, used instead of `threejs-modelling` when an image is present),
`skills/threejs-animation/SKILL.md` (one-shot timeline animations — singular video agent adds
`ANIMATION` to a duplicate of the base model module). MP4 fps/duration/resolution come from the
export UI (and config defaults), not an AI skill. Merges build one deterministic fused module
(`shared/fuseModules`) on a shared ground plane — selectable and animatable like any other
model. Child source is snapshotted into the merge (`children`); placement uses per-child
offset PARAMS.

## Config

`config/default.config.json` holds defaults (port, AI model, Remotion fps/resolution);
`.env` values override them by the same keys documented in `.env.example`. Without
`OPENROUTER_API_KEY`/`ANTHROPIC_API_KEY` set, the server still runs end-to-end via the
deterministic offline generator in `server/src/agents/templateFallback.ts`.

## In-progress redesign

`SPEC.md` at the repo root is the source-of-truth spec for an in-progress v2 redesign (router,
two-screen UI split, GitHub export, Auth0 auth) — check it before touching
`web/src/components/app/App.tsx`, `web/src/state/useSceneProject.ts`, or
`server/src/routes/export.ts`, since those are the files the redesign will change first.
