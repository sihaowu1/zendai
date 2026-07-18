# Zendai

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Zendai: an AI-powered, **code-based** 3D generation and video-editing system. A prompt
goes to an AI agent that writes a Three.js/WebGL scene module and a matching Blender Python
script — never an image or video-generation model — and both stay live-editable, tunable
through sliders/switches, exportable as code, and renderable to MP4 through Remotion.

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

npm workspaces: `shared`, `server`, `web`, `remotion` (plus non-workspace `blender/`).

```
web (editor + controls + viewport)
   │  fetch /api/*
   ▼
server/routes  ─▶  server/agents (orchestrator)
   │                    │
   │                    ├─▶ server/ai (Claude + threejs-modelling / remotion-mp4 skills)
   │                    │        │ offline fallback ▶ server/agents/templateFallback (shared/sceneTemplate)
   │                    ├─▶ server/mcp (Blender MCP client) ─▶ blender/mcp/server.py ─▶ blender/addon.py (in Blender)
   │                    └─▶ server/remotion/renderer ─▶ remotion/ (bundle + render) ─▶ renders/*.mp4
   ▼
server/export (code ZIP via shared templates, MP4 job polling)
```

- **`shared/`** — AI/browser/server-agnostic core imported by both `server` and `web` as
  `@motionforge/shared`: types (`types.ts`), PARAMS-block ↔ slider/switch/color-picker parsing
  and patching (`tunables.ts`), scene-module validation (`validate.ts`), deterministic offline
  scene-code templates (`sceneTemplate.ts`). The scene-module contract is defined exactly once
  here — never duplicate it in `server` or `web`.
- **`server/`** — Express API.
  - `config/` merges `config/default.config.json` with `.env` overrides.
  - `ai/` — Anthropic client, skill loader, fenced-code-block extraction from model output.
  - `agents/` — `orchestrator.ts` (entry point for generate/modify), `sceneAgent.ts`,
    `blenderAgent.ts`, `renderAgent.ts`, `templateFallback.ts` (offline, no API key needed).
  - `mcp/` — `blenderMcp.ts` spawns `blender/mcp/server.py` as a child process and talks to it
    over stdio via `@modelcontextprotocol/sdk`; `toolBridge.ts` bridges MCP tools to Anthropic's
    tool-use schema.
  - `remotion/` — bundles and renders the Remotion project to MP4.
  - `export/` — code (ZIP) and MP4 export flows; reuses `shared` templates, doesn't duplicate them.
  - `routes/` — `/api/generate` + `/api/modify`, `/api/blender/*`, `/api/export/*`.
- **`web/`** — front end: code editor + element controls only, no other UI.
  - `app/` — prompt bar, top-level layout, status bar.
  - `editor/` — CodeMirror 6 editor with scene/Blender tabs.
  - `controls/` — sliders/switches/color pickers generated from a module's `PARAMS` block.
  - `viewport/` — live Three.js/WebGL preview runtime (`SceneRuntime.ts`).
  - `blender/` — Blender MCP status + sync/agent panel.
  - `export/` — export-as-code and render-to-MP4 panel.
  - `state/useSceneProject.ts` — the single client-side state hook; currently tracks one
    active project (see `SPEC.md` for a planned redesign that extends this to a list).
  - `api/client.ts` — typed fetch client for the server API.
- **`remotion/`** — renders a generated scene module to MP4. `generated/scene-module.js` is
  overwritten per render by the server; `GeneratedScene.tsx` drives `buildScene`/`updateScene`
  inside `<ThreeCanvas>` (`@remotion/three`).
- **`blender/`** — `addon.py` is a Blender add-on providing a TCP bridge server that runs
  *inside* an open Blender instance and executes `bpy` code on Blender's main thread;
  `mcp/server.py` is a stdio MCP server that exposes tools (`execute_blender_code`,
  `get_scene_info`, `render_frame`) and forwards them over TCP to `addon.py`. See
  `blender/README.md` for setup. Two server-side modes use this: one-shot sync
  (`POST /api/blender/sync`) and an iterative agent loop (`POST /api/blender/agent`).

## The scene-module contract

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

Claude Skills that drive this: `skills/threejs-modelling/SKILL.md` (component Three.js
modelling) and `skills/remotion-mp4/SKILL.md` (fps/duration/resolution planning for a render).

## Config

`config/default.config.json` holds defaults (port, AI model, Blender MCP command/ports,
Remotion fps/resolution); `.env` values override them by the same keys documented in
`.env.example`. Without `OPENROUTER_API_KEY`/`ANTHROPIC_API_KEY` set, the server still runs
end-to-end via the deterministic offline generator in `server/src/agents/templateFallback.ts`.

## In-progress redesign

`SPEC.md` at the repo root is the source-of-truth spec for an in-progress v2 redesign (router,
two-screen UI split, GitHub export, Auth0 auth) — check it before touching `web/src/app/App.tsx`,
`web/src/state/useSceneProject.ts`, or `server/src/routes/export.ts`, since those are the files
the redesign will change first.
