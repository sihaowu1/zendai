# blender/ — Blender MCP integration

Two cooperating pieces connect the AI agent to a real, running Blender:

- **`addon.py`** — a Blender add-on. Runs *inside* Blender and opens a local
  TCP socket (default `127.0.0.1:9876`). Speaks newline-delimited JSON:
  `execute_code`, `get_scene_info`, `render_frame`. Executes everything on
  Blender's main thread via a `bpy.app.timers` queue, since `bpy` is not
  thread-safe.
- **`mcp/server.py`** — a standalone Python process speaking MCP over stdio.
  `server/src/mcp/blenderMcp.ts` spawns it as a child process and talks to it
  with the official MCP TypeScript SDK. It exposes three MCP tools
  (`execute_blender_code`, `get_scene_info`, `render_frame`) that each forward
  one request to the add-on's TCP socket and relay the JSON response back.

This split exists because Blender embeds its own Python and cannot import
arbitrary third-party packages like `mcp`; the add-on only uses the standard
library. The real MCP protocol logic runs in a normal Python 3 environment
(`mcp/server.py`) and talks to Blender only over a plain socket.

## Setup

1. **Install the add-on**: Blender → Edit → Preferences → Add-ons → Install…
   → select `blender/addon.py` → enable "MotionForge Bridge".
2. **Start the bridge**: in the 3D Viewport, open the sidebar (`N`), select
   the "MotionForge" tab, and click **Start Bridge Server**. Leave Blender
   running.
3. **Install the MCP server's dependency** (a separate Python 3 environment,
   not Blender's):
   ```bash
   python3 -m venv .venv && source .venv/bin/activate   # optional but recommended
   pip install -r blender/requirements.txt
   ```
4. **Enable it in MotionForge**: set `BLENDER_MCP_ENABLED=true` in the repo's
   `.env` (see `config/default.config.json` for the default host/port/command,
   overridable via `PORT`-style env vars). Restart `npm run dev:server`.

## Verifying

- `GET /api/blender/status` (used by the web app's Blender panel) reports
  `connected: true` and lists the three tool names once both processes are up.
- `POST /api/blender/sync` runs the editor's current Blender script once.
- `POST /api/blender/agent` lets Claude iterate against the live scene using
  the `execute_blender_code` / `get_scene_info` / `render_frame` tools.

If the status check fails, confirm Blender is open with the add-on's bridge
started, and that `blender/mcp/server.py`'s Python environment has `mcp`
installed and is on the same machine the Node server runs on.
