# Zendai

AI-powered, **code-based** 3D generation and video-editing system. A prompt
goes to an AI agent that writes a Three.js/WebGL scene module — never an image
or a video-generation model — that stays live-editable, tunable through
sliders/switches, exportable as code, and renderable to MP4 through Remotion.

No AI image/video generation service is used anywhere in this pipeline. Every
visual is produced by code that runs in a real WebGL renderer.

## What it does

1. You type a prompt ("a spinning gold torus knot") into the code editor's
   prompt bar.
2. An AI agent (Claude, using the `scene-generation` skill) or, offline, a
   deterministic template generator writes a **Three.js scene module**.
3. The scene module renders live in a WebGL viewport in the browser. Its
   `PARAMS` block is parsed into sliders, switches, and color pickers that
   patch the code directly when moved.
4. You can edit the code by hand, ask the AI to modify it, export the whole
   project as code, or render it to an MP4 with Remotion.

## Repository structure

```
hack-the-6ix/
├── shared/            AI/browser/server-agnostic core: types, PARAMS↔slider parsing,
│                       scene-module validation, deterministic scene-code templates
├── skills/             Claude Skills (also valid as Claude Code skills)
│   ├── scene-generation/   generates/edits the Three.js scene module
│   └── remotion-mp4/       plans fps/duration/resolution for an MP4 render
├── server/            Express API: AI agents, Remotion renderer, export
│   └── src/
│       ├── config/         merges config/default.config.json with env overrides
│       ├── ai/              Anthropic client, skill loader, fenced-code-block extraction
│       ├── agents/          orchestrator, scene agent, render agent, offline fallback
│       ├── remotion/        bundles + renders the Remotion project to MP4
│       ├── export/          code (ZIP) and MP4 export flows
│       ├── routes/          /api/generate, /api/modify, /api/export/*
│       └── utils/           filesystem, background job tracker, logger
├── web/                Front end: studio UI (model / video / export screens)
│   └── src/
│       ├── components/       screens, chat, controls, timeline, export UI
│       ├── viewport/         live Three.js/WebGL preview runtime
│       ├── state/            useSceneProject: the single client-side state hook
│       └── api/               typed fetch client for the server API
├── remotion/           Renders a generated scene module to MP4
│   └── src/
│       ├── index.ts, Root.tsx    registers the GeneratedScene composition
│       ├── GeneratedScene.tsx     drives buildScene/updateScene inside <ThreeCanvas>
│       └── generated/             scene-module.js — overwritten per render by the server
├── config/             default.config.json — ports, AI model, Remotion defaults
└── tasks/               build-plan notes (not part of the running app)
```

### How the modules interact

```
web (editor + controls + viewport)
   │  fetch /api/*
   ▼
server/routes  ─▶  server/agents (orchestrator)
   │                    │
   │                    ├─▶ server/ai (Claude + scene-generation / remotion-mp4 skills)
   │                    │        │ offline fallback ▶ server/agents/templateFallback (shared/sceneTemplate)
   │                    └─▶ server/remotion/renderer ─▶ remotion/ (bundle + render) ─▶ renders/*.mp4
   ▼
server/export (code ZIP via shared templates, MP4 job polling)
```

`shared/` is imported by both `server` and `web` (npm workspace package
`@motionforge/shared`) so the scene-module contract, tunable parsing, and
validator are defined exactly once.

## Install

Requires Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
```

## Configure

Edit `.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...   # omit to run fully offline (template fallback)
# PORT=5174
# ANTHROPIC_MODEL=anthropic/claude-opus-4-8
# REMOTION_GL=angle
```

Defaults (port, AI model, Remotion fps/resolution) live in
`config/default.config.json`; the `.env` variables above override them. Without
`ANTHROPIC_API_KEY` the server still runs end-to-end using the deterministic
offline generator in `server/src/agents/templateFallback.ts`.

## Run

```bash
npm run dev            # server (http://localhost:5174) + web (Vite, proxied) together
```

Open the printed Vite URL. Type a prompt, watch the viewport update, drag a
slider, edit the code directly, or export.

Other scripts:

```bash
npm run dev:server        # server only
npm run dev:web           # web only
npm run remotion:studio   # preview the Remotion composition standalone
npm run typecheck         # typecheck every workspace
```

## How 3D code generation works

`skills/scene-generation/SKILL.md` is both a Claude Skill and this project's
system prompt. It defines a strict contract: a self-contained Three.js module
exporting `PARAMS`, optional `CAMERA`, `buildScene(ctx)`, and
`updateScene(ctx)` (a pure function of `time`, no `Math.random()`/`Date`, so
Remotion can render frames independently and out of order).
`server/src/agents/sceneAgent.ts` sends the prompt to Claude with that skill as
the system prompt, extracts the fenced JavaScript block, validates the module
against the contract (`shared/src/validate.ts`), and retries once with the
validator's errors if it fails. Without an API key,
`server/src/agents/templateFallback.ts` maps prompt keywords onto the same
contract using `shared/src/sceneTemplate.ts` so the app never blocks on AI
access.

## How tunable elements connect to sliders and switches

Every `PARAMS` entry annotated `@tunable` in a JSDoc comment
(`skills/scene-generation/SKILL.md` documents the annotation grammar) is
parsed by `shared/src/tunables.ts`: numbers need `@min`/`@max`/`@step` and
render as sliders, plain booleans render as switches, and single-quoted hex
strings render as color pickers (`web/src/controls/*.tsx`,
`ControlsPanel.tsx`). Moving a control calls `patchParam(code, name, value)`,
which rewrites just that literal in the `PARAMS` block and pushes the new code
back into the editor and viewport — a slider drag *is* a code edit.

## Exporting generated code

The export screen posts to `POST /api/export/code`, handled by
`server/src/export/codeExport.ts` + `exportTemplates.ts`, which streams a ZIP
containing the Three.js module and a minimal runnable HTML/package wrapper so
the exported project runs standalone outside Zendai. GitHub push uses the same
file packing under `models/<slug>/`.

## Generating and exporting an MP4 with Remotion

The **Render MP4** button posts to `POST /api/export/mp4` with the current
code and fps/duration/resolution. `server/src/export/mp4Export.ts` validates
the module, optionally asks Claude (via the `remotion-mp4` skill,
`server/src/agents/renderAgent.ts`) to refine those settings from a
free-text render request, then calls `server/src/remotion/renderer.ts`, which:

1. writes the scene module to `remotion/src/generated/scene-module.js`,
2. bundles the Remotion project (`@remotion/bundler`),
3. renders the `GeneratedScene` composition (`remotion/src/GeneratedScene.tsx`,
   which runs the same `buildScene`/`updateScene` inside `@remotion/three`'s
   `<ThreeCanvas>`, driven by `frame / fps` instead of wall-clock time) with
   `@remotion/renderer` in headless Chrome (`gl: angle` for WebGL) to H.264.

The client polls `GET /api/export/mp4/:jobId` for progress and gets back a
`/renders/<file>.mp4` URL to download once done.

## Where the Claude Skills are

`skills/scene-generation/SKILL.md` and `skills/remotion-mp4/SKILL.md`. They
are loaded verbatim as system prompts by `server/src/ai/skills.ts` and are
also valid Claude Code skill files if you want to drive the same generation
logic directly from a Claude Code session against this repo.
