/**
 * Deterministic scene-code builders. They produce code that follows the same
 * contract the AI agents are instructed to follow (see skills/scene-generation).
 * Used for: the editor's initial scene, the server's offline fallback when no
 * OPENROUTER_API_KEY is set, and the checked-in Remotion placeholder module.
 */

export interface SceneTemplateOptions {
  title: string;
  /** Three.js geometry expression, e.g. `new THREE.IcosahedronGeometry(params.radius, 3)` */
  geometryExpr: string;
  /** Hex color for the hero object, e.g. '#4f8ef7' */
  bodyColor: string;
}

export function buildThreeSceneCode(options: SceneTemplateOptions): string {
  return `// ${options.title}
// MotionForge scene module — edit freely; tunable params drive the sliders.

export const PARAMS = {
  /**
   * @tunable
   * @min 0.2 @max 3 @step 0.05
   * @label Size
   */
  radius: 1,
  /**
   * @tunable
   * @min 0 @max 4 @step 0.05
   * @label Spin speed
   */
  spinSpeed: 0.8,
  /**
   * @tunable
   * @min 0 @max 2 @step 0.05
   * @label Bob height
   */
  bobHeight: 0.4,
  /**
   * @tunable
   * @min 0.5 @max 6 @step 0.1
   * @label Bob speed
   */
  bobSpeed: 2,
  /**
   * @tunable
   * @label Rotate
   */
  rotate: true,
  /**
   * @tunable
   * @label Wireframe
   */
  wireframe: false,
  /**
   * @tunable
   * @label Body color
   */
  bodyColor: '${options.bodyColor}',
  /**
   * @tunable
   * @label Ground color
   */
  groundColor: '#1c1f26',
  /**
   * @tunable
   * @label Background
   */
  background: '#0b0d12',
  /**
   * @tunable
   * @min 0 @max 1 @step 0.01
   * @label Metalness
   */
  metalness: 0.35,
  /**
   * @tunable
   * @min 0 @max 1 @step 0.01
   * @label Roughness
   */
  roughness: 0.35,
  /**
   * @tunable
   * @min 0 @max 6 @step 0.1
   * @label Key light
   */
  lightIntensity: 2.4,
};

export const CAMERA = { position: [4, 2.6, 5.5], lookAt: [0, 0.8, 0], fov: 45 };

export function buildScene(ctx) {
  const THREE = ctx.THREE;
  const scene = ctx.scene;
  const params = ctx.params;

  scene.background = new THREE.Color(params.background);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: params.groundColor, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const body = new THREE.Mesh(
    ${options.geometryExpr},
    new THREE.MeshStandardMaterial({
      color: params.bodyColor,
      metalness: params.metalness,
      roughness: params.roughness,
      wireframe: params.wireframe,
    })
  );
  body.position.y = params.radius + 0.2;
  scene.add(body);

  const keyLight = new THREE.DirectionalLight('#ffffff', params.lightIntensity);
  keyLight.position.set(4, 6, 3);
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight('#8899bb', 0.5));

  return { body: body, ground: ground, keyLight: keyLight };
}

export function updateScene(ctx) {
  const params = ctx.params;
  const objects = ctx.objects;
  const time = ctx.time;

  if (params.rotate) {
    objects.body.rotation.y = time * params.spinSpeed * Math.PI * 0.5;
  }
  objects.body.position.y =
    params.radius + 0.2 + Math.abs(Math.sin(time * params.bobSpeed)) * params.bobHeight;
}
`;
}

export interface BlenderTemplateOptions {
  title: string;
  /** bpy primitive call, e.g. `bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=PARAMS["radius"])` */
  primitiveCall: string;
  /** RGB triple in 0..1 for the hero object's base color */
  bodyColorRgb: [number, number, number];
}

export function buildBlenderSceneCode(options: BlenderTemplateOptions): string {
  const rgb = options.bodyColorRgb.map((c) => c.toFixed(3)).join(', ');
  return `# ${options.title}
# MotionForge Blender scene script — runnable as-is inside Blender
# (via the MotionForge bridge add-on / MCP, or Blender's Text Editor).
import bpy
import math

PARAMS = {
    "radius": 1.0,
    "spin_speed": 0.8,
    "bob_height": 0.4,
    "bob_speed": 2.0,
    "body_color": (${rgb}, 1.0),
    "light_energy": 3.0,
    "fps": 30,
    "duration_seconds": 6,
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def build_scene():
    ${options.primitiveCall}
    body = bpy.context.active_object
    body.name = "Body"
    body.location.z = PARAMS["radius"] + 0.2

    material = bpy.data.materials.new(name="BodyMaterial")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = PARAMS["body_color"]
    bsdf.inputs["Metallic"].default_value = 0.35
    bsdf.inputs["Roughness"].default_value = 0.35
    body.data.materials.append(material)

    bpy.ops.mesh.primitive_circle_add(radius=7, fill_type="NGON")
    ground = bpy.context.active_object
    ground.name = "Ground"

    bpy.ops.object.light_add(type="SUN", location=(4, -3, 6))
    sun = bpy.context.active_object
    sun.data.energy = PARAMS["light_energy"]

    bpy.ops.object.camera_add(
        location=(4, -5.5, 2.8),
        rotation=(math.radians(72), 0, math.radians(36)),
    )
    bpy.context.scene.camera = bpy.context.active_object
    return body


def animate(body):
    scene = bpy.context.scene
    fps = PARAMS["fps"]
    scene.render.fps = fps
    scene.frame_start = 1
    scene.frame_end = int(fps * PARAMS["duration_seconds"])
    for frame in range(scene.frame_start, scene.frame_end + 1, 2):
        t = (frame - 1) / fps
        body.rotation_euler.z = t * PARAMS["spin_speed"] * math.pi * 0.5
        body.location.z = (
            PARAMS["radius"] + 0.2
            + abs(math.sin(t * PARAMS["bob_speed"])) * PARAMS["bob_height"]
        )
        body.keyframe_insert(data_path="rotation_euler", frame=frame)
        body.keyframe_insert(data_path="location", frame=frame)


clear_scene()
body = build_scene()
animate(body)
print("MotionForge scene built: " + body.name)
`;
}

export const DEFAULT_SCENE_CODE = buildThreeSceneCode({
  title: 'Floating icosphere',
  geometryExpr: 'new THREE.IcosahedronGeometry(params.radius, 3)',
  bodyColor: '#4f8ef7',
});

export const DEFAULT_BLENDER_CODE = buildBlenderSceneCode({
  title: 'Floating icosphere',
  primitiveCall: 'bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=PARAMS["radius"])',
  bodyColorRgb: [0.31, 0.56, 0.97],
});
