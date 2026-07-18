# Zendai v2 — Spec

## Frontend bug fixes (current build)

Found by inspecting the live app (`web/src/styles.css`) with Tendo at
1280x720. Three are fixed directly below; one is an open issue best solved
by the Screen 1 redesign (Issue 2) rather than patched in place.

- **Fixed — status bar clipped its own message.** `.status-bar` used
  `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, so the
  default "Ready — edit the code, drag a slider, or prompt the AI." hint
  (`web/src/app/StatusBar.tsx:17`) was cut off mid-sentence with no visible
  ellipsis at 1280px, and — because `.editor-pane`/`.sidebar` had no
  `min-height: 0` as grid items — the footer could render on top of the
  Export panel's `<h2>` heading instead of below it. Fixed: removed the
  truncation rules, added `flex-shrink: 0` to `.status-bar`, and added
  `min-height: 0` to `.sidebar` and `.editor-pane` so the grid row height is
  governed by the workspace's own constrained height, not by a child's
  content size.
- **Fixed — sidebar scroll had no visible affordance.** `.sidebar` was
  already `overflow-y: auto`, but with the default (invisible-on-dark)
  browser scrollbar there was no cue that the Export panel
  existed below the fold on a ~720px-tall viewport. Fixed: added a styled
  thin scrollbar (`scrollbar-color`/`-width` plus `::-webkit-scrollbar`
  rules) so the sidebar visibly indicates it scrolls.
- **Fixed — dark color swatches were invisible.** The `Ground color`
  (`#1c1f26`) and `Background` (`#0b0d12`) pickers in
  `web/src/controls/ColorControl.tsx` render an `<input type="color">`
  against the panel's own near-black background, so the swatch looked like
  an empty/disabled box with no visible fill. Fixed: added a subtle inset
  highlight ring (`box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)`) in
  `.control.color input[type='color']` so the control reads as clickable
  regardless of the chosen color.
- **Open — sidebar still requires scrolling to reach Export on
  short viewports.** Even with the scrollbar now visible, a viewport under
  ~900px tall hides the Export panel by default, since Controls and Export
  are always-stacked in one column. Rather than patch this further, Issue 2/3
  below already replace this with a model list + on-demand controls floater,
  which removes the always-visible Controls panel from the stack entirely —
  fix this as part of that redesign, not as a standalone patch.


Redesign of the web UI into two dedicated screens (Model Generation, Video
Generation), plus GitHub-based code export and Auth0 authentication
(including signup). This document is the source of truth for the redesign;
each section below is written as a standalone issue with acceptance criteria
and implementation hints against the current codebase.

Current relevant files, for reference:
- `web/src/app/App.tsx` — single-screen layout today (prompt bar + editor +
  viewport + controls all in one view)
- `web/src/state/useSceneProject.ts` — the one client state hook
- `web/src/controls/ControlsPanel.tsx`, `SliderControl.tsx`,
  `SwitchControl.tsx`, `ColorControl.tsx` — existing tunable controls, to be
  reused inside the new floater
- `web/src/viewport/Viewport.tsx` / `SceneRuntime.ts` — Three.js viewport
- `web/src/export/ExportPanel.tsx`, `server/src/routes/export.ts` — existing
  ZIP/MP4 export, to be extended with GitHub push
- `server/src/routes/generate.ts`, `server/src/agents/orchestrator.ts` —
  scene generation pipeline that Screen 1's chat drives
- No routing library or auth is present yet (`web/src/main.tsx` mounts `App`
  directly with no router).

## Assumptions (called out because the source instructions were ambiguous)

- Screen 1's 3D viewport is on the **right** half (chat + model/layer list on
  the left, per the rest of the description; a "visualization on the left"
  reading would collide with the chat/list already placed there).
- "Floater" means an overlay/popover anchored near the clicked model in the
  list, not a modal — it should not block the viewport.
- Screen 2's bottom timeline spans the **full width** of the screen (both
  left and right columns sit above it).

---

## Issue 1 — Add a router and a screen switcher

**Goal:** Introduce two top-level routes, `/model` (Model Generation) and
`/video` (Video Generation), with a way to switch between them.

**Acceptance criteria:**
- `react-router-dom` (or equivalent) added to `web/package.json`.
- `web/src/main.tsx` wraps `App` in a router; `App.tsx` becomes a thin shell
  that renders a persistent top nav (Model / Video) plus the active screen.
- Existing single-screen layout is split into
  `web/src/screens/ModelGenerationScreen.tsx` and
  `web/src/screens/VideoGenerationScreen.tsx`; current components
  (`Viewport`, `ControlsPanel`, `CodeEditor`, `PromptBar`) are redistributed
  into these per the layouts in Issues 2–3, not duplicated.

---

## Issue 2 — Model Generation screen layout

**Goal:** Build the left/right split described for the model-generation
screen.

**Layout:**
```
+------------------+---------------------------+
| Chat             |                           |
| (top-left)       |                           |
+------------------+   3D Viewport             |
| Models & Layers  |   (full right column)     |
| (bottom-left)    |                           |
+------------------+---------------------------+
```

**Acceptance criteria:**
- Left column is a vertical split: chat on top, a "Models & Layers" list on
  the bottom. Chat reuses `PromptBar.tsx` plus a scrollback view (new —
  today's `PromptBar` is fire-and-forget with no message history; add a
  message list backed by `useSceneProject`).
- The models/layers list is new: one row per generated scene/model, each
  expandable to show its layers (mesh groups from the scene module). Source
  the list from `useSceneProject` — currently it tracks a single active
  project; extend it to track an array of generated models so the list has
  something to show.
- Right column is `Viewport.tsx`, unchanged, sized to fill the column.

---

## Issue 3 — Model click floater (toggles + sliders)

**Goal:** Clicking a model in the bottom-left list opens a floating panel
with that model's tunable controls, instead of the current always-visible
`ControlsPanel`.

**Acceptance criteria:**
- New `web/src/controls/ControlsFloater.tsx`: a positioned popover anchored
  to the clicked row (use the row's bounding rect; dismiss on outside click
  or Escape).
- Internally reuses `ControlsPanel`/`SliderControl`/`SwitchControl`/
  `ColorControl` unchanged — this is a positioning wrapper, not a rewrite of
  the controls themselves.
- Only one floater open at a time; selecting a different model swaps its
  contents (or closes/reopens) rather than stacking floaters.
- Edits made in the floater patch the code the same way `ControlsPanel`
  does today (`shared/src/tunables.ts` PARAMS-block patching) — no change
  needed to that logic, only to where the panel is mounted.

---

## Issue 4 — Video Generation screen layout

**Goal:** Build the layout described for the video-generation screen.

**Layout:**
```
+------------+------------+------------------+
| Chat       | Materials  |                  |
| (top-left) | (from      |  Resulting Video |
|            |  Screen 1) |  (top-right)     |
+------------+------------+------------------+
|              Timeline (full width)         |
+----------------------------------------------+
```

**Acceptance criteria:**
- Top row, three panes: chat (drives video/edit prompts), a read-only
  "Materials" pane listing the models generated on the Model Generation
  screen (same underlying list as Issue 2's Models & Layers, filtered/shown
  as thumbnails or names — no regeneration UI here), and the video preview
  pane (playback of the current Remotion render, or a placeholder before the
  first render).
- Bottom row, full width: timeline — a new component,
  `web/src/timeline/Timeline.tsx`, showing clips/segments in sequence.
  Minimum viable version: one track, one clip per rendered scene, with
  start/duration; drag-to-reorder can be a fast-follow, not required for v1.
- Materials pane and Models & Layers list (Issue 2) should share one data
  source in `useSceneProject` (or a new cross-screen store) rather than two
  separate lists that can drift out of sync.
- Video preview wires to the existing render pipeline
  (`server/src/agents/renderAgent.ts`, `POST /api/export/render` per
  `server/src/routes/export.ts`) — no new render backend needed, just a
  player in this pane.

---

## Issue 5 — GitHub export (push generated code to a repo)

**Goal:** Extend the existing export flow so generated code can be pushed to
a GitHub repository, not just downloaded as a ZIP.

**Acceptance criteria:**
- Server: new route `POST /api/export/github` in `server/src/routes/export.ts`
  (alongside the existing ZIP export) that accepts a target repo (owner/name,
  create-new vs. existing) and pushes the same file set the ZIP export
  produces today (reuse whatever `shared`/export code assembles that file
  list — don't duplicate it).
- Use the GitHub REST API (`@octokit/rest`) with the user's GitHub access
  token obtained via OAuth (see Issue 7 — GitHub identity can piggyback on
  Auth0's social-login token, or be a separate GitHub App/OAuth flow if the
  user doesn't log in with GitHub). Store no token server-side beyond the
  request lifecycle unless a persistence decision is explicitly made later.
- Client: `ExportPanel.tsx` gets a "Push to GitHub" action alongside the
  existing export buttons, with a repo-name input and a result link to the
  created/updated repo.
- Out of scope for v1: automatic CI setup, branch protection, PR-based
  export — a direct push to the target branch is sufficient.

---

## Issue 6 — Auth0 integration (login)

**Goal:** Gate the app behind Auth0 authentication.

**Acceptance criteria:**
- Add `@auth0/auth0-react` to `web`; wrap the app root (`web/src/main.tsx`)
  in `Auth0Provider` configured from env vars (`VITE_AUTH0_DOMAIN`,
  `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`), documented in
  `.env.example` alongside the existing `OPENROUTER_API_KEY` etc.
- Unauthenticated users hitting `/model` or `/video` are redirected to
  Auth0 Universal Login (`loginWithRedirect`); use a route guard component
  rather than checking auth state ad hoc in each screen.
- Server: `server/src/routes/*` protected with `express-oauth2-jwt-bearer`,
  validating the Auth0-issued JWT on every `/api/*` call. Add the Auth0
  domain/audience to `config/default.config.json`'s env-override pattern,
  same as existing config values.
- Logout button in the top nav (Issue 1) calls `logout()` and returns to a
  public landing page.

---

## Issue 7 — Signup page

**Goal:** A dedicated signup entry point, not just "login also happens to
create an account."

**Acceptance criteria:**
- Public landing route (`/`) with a "Sign up" and a "Log in" action. Sign up
  calls `loginWithRedirect({ authorizationParams: { screen_hint: 'signup' }
  })` to land users on Auth0's signup form directly (same Universal Login,
  different initial screen — no custom credential-collection form needs to
  be built or to touch raw passwords).
- After signup/login, redirect to `/model` (the default screen).
- If social connections (GitHub, Google) are enabled in the Auth0 tenant,
  no extra client code is needed beyond the above — Universal Login handles
  the connection picker.

---

## Suggested build order

1. Issue 1 (router/shell) — everything else depends on having two screens.
2. Issue 2 + 3 (Model Generation screen + floater).
3. Issue 4 (Video Generation screen).
4. Issue 6 + 7 (Auth0 login + signup) — do before Issue 5 if GitHub push
   should reuse an Auth0-linked GitHub identity.
5. Issue 5 (GitHub export).
