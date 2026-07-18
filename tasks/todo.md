# MotionForge — Build Plan

AI-powered, code-based 3D generation and video-editing system (hackathon build).

## Plan

- [x] Repo scaffolding: workspaces, config, env template, gitignore
- [x] `shared/` — types, tunable-parameter parser/patcher, scene-module validator, scene templates
- [x] `skills/` — Claude Skills: `scene-generation` and `remotion-mp4`
- [x] `server/` — Express API: config, utils, AI client, agents (scene / blender / render / orchestrator), Blender MCP client + tool bridge, Remotion renderer, code + MP4 export, routes
- [x] `web/` — code editor (CodeMirror), element controls (sliders/switches/colors), WebGL viewport (Three.js), export panel, Blender panel
- [x] `remotion/` — composition (`Root.tsx` + `GeneratedScene.tsx`) that renders the generated scene module to MP4
- [x] `blender/` — Blender bridge add-on (TCP, `addon.py`) + Python MCP server (stdio, `mcp/server.py`)
- [x] Documentation: root README (full tree + module explanations) and `blender/README.md` with setup instructions

## Review

- `npm install` + `npm run typecheck` pass clean across all four workspaces (shared, server, web, remotion).
- Verified at runtime: `/api/health`, `/api/generate` (offline template fallback), `/api/export/code` (ZIP) all work end-to-end.
- `/api/export/mp4` was exercised through bundling; the final headless-Chromium render step could not be verified inside this sandboxed session (the downloaded chrome-headless-shell binary is unsigned and gets SIGKILL'd by macOS on launch here) — this is an environment/code-signing quirk of the sandbox, not an application bug. Re-run `npm run dev` in a normal terminal to verify the render step; if it happens on your machine too, ad-hoc sign the binary once: `codesign --sign - --force <path from the error>` or delete `server/node_modules/.remotion` to force a clean re-download.
- Blender MCP path (`addon.py` + `mcp/server.py`) is implemented per the documented protocol but requires a running Blender instance to exercise live; not testable headlessly.
