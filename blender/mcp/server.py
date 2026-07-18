#!/usr/bin/env python3
"""
MotionForge Blender MCP server.

Spawned over stdio by server/src/mcp/blenderMcp.ts (via the official MCP
TypeScript SDK's StdioClientTransport) whenever BLENDER_MCP_ENABLED=true.
Exposes three MCP tools that Claude's Blender agent (server/src/agents/
blenderAgent.ts) calls directly; each one forwards to the MotionForge bridge
add-on (../addon.py) running inside Blender over a local TCP socket.

This process holds no Blender state itself: it is a thin protocol translator
between MCP (stdio, JSON-RPC) and the bridge's line-delimited JSON protocol.
MOTIONFORGE_BRIDGE_HOST / MOTIONFORGE_BRIDGE_PORT are set by the parent Node
process from config/default.config.json (blender.mcp.bridgeHost/Port).
"""
import json
import os
import socket

from mcp.server.fastmcp import FastMCP

BRIDGE_HOST = os.environ.get("MOTIONFORGE_BRIDGE_HOST", "127.0.0.1")
BRIDGE_PORT = int(os.environ.get("MOTIONFORGE_BRIDGE_PORT", "9876"))

mcp = FastMCP("motionforge-blender")


def _call_bridge(request: dict) -> dict:
    with socket.create_connection((BRIDGE_HOST, BRIDGE_PORT), timeout=65) as sock:
        sock.sendall((json.dumps(request) + "\n").encode("utf-8"))
        buffer = b""
        while b"\n" not in buffer:
            chunk = sock.recv(65536)
            if not chunk:
                break
            buffer += chunk
        line, _, _rest = buffer.partition(b"\n")
        if not line:
            raise RuntimeError("no response from the Blender bridge add-on")
        return json.loads(line.decode("utf-8"))


def _call_bridge_or_raise(request: dict) -> dict:
    try:
        response = _call_bridge(request)
    except OSError as exc:
        raise RuntimeError(
            "Could not reach the MotionForge bridge add-on in Blender at "
            f"{BRIDGE_HOST}:{BRIDGE_PORT}. Open Blender, enable the MotionForge "
            "Bridge add-on (blender/addon.py), and click 'Start Bridge Server' "
            "in the 3D Viewport sidebar's MotionForge tab."
        ) from exc
    if not response.get("ok"):
        raise RuntimeError(response.get("error", "unknown Blender bridge error"))
    return response.get("result", {})


@mcp.tool()
def execute_blender_code(code: str) -> str:
    """Execute a Python (bpy) script inside the running Blender instance."""
    _call_bridge_or_raise({"type": "execute_code", "code": code})
    return "executed"


@mcp.tool()
def get_scene_info() -> str:
    """Return the current Blender scene's name, frame range, and objects as JSON."""
    result = _call_bridge_or_raise({"type": "get_scene_info"})
    return json.dumps(result, indent=2)


@mcp.tool()
def render_frame(frame: int = 1) -> str:
    """Render one frame of the current Blender scene to a PNG and return its path."""
    result = _call_bridge_or_raise({"type": "render_frame", "frame": frame})
    return json.dumps(result)


if __name__ == "__main__":
    mcp.run(transport="stdio")
