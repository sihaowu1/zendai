"""
MotionForge Bridge — a Blender add-on that opens a local TCP socket so the
MotionForge MCP server (blender/mcp/server.py) can drive this Blender
instance. Install and enable it, then click "Start Bridge Server" in the
3D Viewport sidebar (N-panel) under the "MotionForge" tab.

Protocol: newline-delimited JSON on both directions.
  request:  {"type": "execute_code", "code": "..."}
            {"type": "get_scene_info"}
            {"type": "render_frame", "frame": 1}
  response: {"ok": true, "result": ...} | {"ok": false, "error": "..."}

bpy may only be touched from Blender's main thread, so the TCP accept/recv
loop runs on background threads and hands each request to the main thread
through a queue drained by a bpy.app.timers callback.
"""

bl_info = {
    "name": "MotionForge Bridge",
    "author": "MotionForge",
    "version": (0, 1, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > MotionForge",
    "description": "TCP bridge that lets the MotionForge MCP server drive Blender",
    "category": "Development",
}

import json
import queue
import socket
import threading
import traceback

import bpy

_server = None
_running = False
_command_queue = queue.Queue()


class MotionForgeServer:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.socket = None
        self.accept_thread = None
        self.running = False

    def start(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((self.host, self.port))
        self.socket.listen(5)
        self.socket.settimeout(1.0)
        self.running = True
        self.accept_thread = threading.Thread(target=self._accept_loop, daemon=True)
        self.accept_thread.start()

    def stop(self):
        self.running = False
        if self.socket is not None:
            try:
                self.socket.close()
            except OSError:
                pass
        self.socket = None

    def _accept_loop(self):
        while self.running:
            try:
                conn, _addr = self.socket.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            threading.Thread(target=self._handle_client, args=(conn,), daemon=True).start()

    def _handle_client(self, conn):
        buffer = b""
        with conn:
            while self.running:
                try:
                    chunk = conn.recv(65536)
                except OSError:
                    break
                if not chunk:
                    break
                buffer += chunk
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    if not line.strip():
                        continue
                    self._handle_line(conn, line)

    def _handle_line(self, conn, line):
        try:
            request = json.loads(line.decode("utf-8"))
        except json.JSONDecodeError as exc:
            self._respond(conn, {"ok": False, "error": f"invalid JSON: {exc}"})
            return
        done = threading.Event()
        result_box = {}
        _command_queue.put((request, result_box, done))
        if done.wait(60):
            self._respond(conn, result_box.get("response", {"ok": False, "error": "no response"}))
        else:
            self._respond(conn, {"ok": False, "error": "timed out waiting for Blender's main thread"})

    @staticmethod
    def _respond(conn, response):
        try:
            conn.sendall((json.dumps(response) + "\n").encode("utf-8"))
        except OSError:
            pass


def process_queue():
    """bpy.app.timers callback: drains queued requests on the main thread."""
    try:
        while True:
            request, result_box, done = _command_queue.get_nowait()
            result_box["response"] = execute_command(request)
            done.set()
    except queue.Empty:
        pass
    return 0.05 if _running else None


def execute_command(request):
    command_type = request.get("type")
    try:
        if command_type == "execute_code":
            run_execute_code(request.get("code", ""))
            return {"ok": True, "result": "executed"}
        if command_type == "get_scene_info":
            return {"ok": True, "result": run_get_scene_info()}
        if command_type == "render_frame":
            return {"ok": True, "result": run_render_frame(request.get("frame", 1))}
        return {"ok": False, "error": f"unknown command type: {command_type}"}
    except Exception as exc:  # surfaced to the MCP caller as tool output
        return {"ok": False, "error": f"{exc}\n{traceback.format_exc(limit=4)}"}


def run_execute_code(code):
    exec(compile(code, "<motionforge>", "exec"), {"bpy": bpy}, {})


def run_get_scene_info():
    scene = bpy.context.scene
    return {
        "scene": scene.name,
        "frame_current": scene.frame_current,
        "frame_start": scene.frame_start,
        "frame_end": scene.frame_end,
        "objects": [
            {"name": obj.name, "type": obj.type, "location": list(obj.location)}
            for obj in scene.objects
        ],
    }


def run_render_frame(frame):
    scene = bpy.context.scene
    scene.frame_set(int(frame))
    output_path = bpy.path.abspath(f"//motionforge_preview_{int(frame):04d}.png")
    scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    return {"path": output_path}


class MotionForgeProperties(bpy.types.PropertyGroup):
    host: bpy.props.StringProperty(name="Host", default="127.0.0.1")
    port: bpy.props.IntProperty(name="Port", default=9876, min=1024, max=65535)


class MOTIONFORGE_OT_start_server(bpy.types.Operator):
    bl_idname = "motionforge.start_server"
    bl_label = "Start Bridge Server"

    def execute(self, context):
        global _server, _running
        if _server is not None and _server.running:
            self.report({"INFO"}, "Bridge server already running")
            return {"CANCELLED"}
        props = context.scene.motionforge
        _server = MotionForgeServer(props.host, props.port)
        _server.start()
        _running = True
        if not bpy.app.timers.is_registered(process_queue):
            bpy.app.timers.register(process_queue, persistent=True)
        self.report({"INFO"}, f"MotionForge bridge listening on {props.host}:{props.port}")
        return {"FINISHED"}


class MOTIONFORGE_OT_stop_server(bpy.types.Operator):
    bl_idname = "motionforge.stop_server"
    bl_label = "Stop Bridge Server"

    def execute(self, context):
        global _server, _running
        _running = False
        if _server is not None:
            _server.stop()
            _server = None
        self.report({"INFO"}, "MotionForge bridge stopped")
        return {"FINISHED"}


class MOTIONFORGE_PT_panel(bpy.types.Panel):
    bl_idname = "MOTIONFORGE_PT_panel"
    bl_label = "MotionForge Bridge"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "MotionForge"

    def draw(self, context):
        layout = self.layout
        props = context.scene.motionforge
        layout.prop(props, "host")
        layout.prop(props, "port")
        running = _server is not None and _server.running
        layout.label(text=f"Status: {'running' if running else 'stopped'}")
        row = layout.row(align=True)
        row.operator("motionforge.start_server", icon="PLAY")
        row.operator("motionforge.stop_server", icon="PAUSE")


classes = (
    MotionForgeProperties,
    MOTIONFORGE_OT_start_server,
    MOTIONFORGE_OT_stop_server,
    MOTIONFORGE_PT_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.motionforge = bpy.props.PointerProperty(type=MotionForgeProperties)


def unregister():
    global _server, _running
    _running = False
    if _server is not None:
        _server.stop()
        _server = None
    del bpy.types.Scene.motionforge
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
