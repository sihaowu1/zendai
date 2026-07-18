/**
 * Deterministic scene-code builders. They produce code that follows the same
 * contract the AI agents are instructed to follow (see skills/threejs-modelling).
 * Used for: the editor's initial scene, the server's offline fallback when no
 * OPENROUTER_API_KEY is set, and the checked-in Remotion placeholder module.
 *
 * Models are static multi-part figures with per-part size tunables — no baked
 * time-based animation.
 */

export interface SceneTemplateOptions {
  title: string;
  /** Hex color for the figure, e.g. '#4f8ef7' */
  bodyColor: string;
}

export function buildThreeSceneCode(options: SceneTemplateOptions): string {
  return `// ${options.title}
// Zendai scene module — edit freely; tunable params drive the sliders.

export const PARAMS = {
  /**
   * @tunable
   * @min 0.5 @max 2 @step 0.05
   * @label Head size
   */
  headSize: 1,
  /**
   * @tunable
   * @min 0.5 @max 2 @step 0.05
   * @label Torso width
   */
  torsoWidth: 1,
  /**
   * @tunable
   * @min 0.5 @max 2 @step 0.05
   * @label Arm length
   */
  armLength: 1,
  /**
   * @tunable
   * @min 0.5 @max 2 @step 0.05
   * @label Leg length
   */
  legLength: 1,
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

  const mat = new THREE.MeshStandardMaterial({
    color: params.bodyColor,
    metalness: params.metalness,
    roughness: params.roughness,
    wireframe: params.wireframe,
  });

  const root = new THREE.Group();
  scene.add(root);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), mat.clone());
  torso.position.y = 1.35;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), mat.clone());
  head.position.y = 2.1;
  root.add(head);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), mat.clone());
  leftArm.position.set(-0.55, 1.35, 0);
  root.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), mat.clone());
  rightArm.position.set(0.55, 1.35, 0);
  root.add(rightArm);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.95, 0.26), mat.clone());
  leftLeg.position.set(-0.22, 0.48, 0);
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.95, 0.26), mat.clone());
  rightLeg.position.set(0.22, 0.48, 0);
  root.add(rightLeg);

  const keyLight = new THREE.DirectionalLight('#ffffff', params.lightIntensity);
  keyLight.position.set(4, 6, 3);
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight('#8899bb', 0.5));

  return {
    root: root,
    head: head,
    torso: torso,
    leftArm: leftArm,
    rightArm: rightArm,
    leftLeg: leftLeg,
    rightLeg: rightLeg,
    ground: ground,
    keyLight: keyLight,
  };
}

export function updateScene(ctx) {
  const params = ctx.params;
  const objects = ctx.objects;

  objects.head.scale.setScalar(params.headSize);
  objects.torso.scale.set(params.torsoWidth, 1, 1);
  objects.leftArm.scale.set(1, params.armLength, 1);
  objects.rightArm.scale.set(1, params.armLength, 1);
  objects.leftLeg.scale.set(1, params.legLength, 1);
  objects.rightLeg.scale.set(1, params.legLength, 1);

  const parts = [
    objects.head,
    objects.torso,
    objects.leftArm,
    objects.rightArm,
    objects.leftLeg,
    objects.rightLeg,
  ];
  for (let i = 0; i < parts.length; i++) {
    const mesh = parts[i];
    if (mesh.material) {
      mesh.material.color.set(params.bodyColor);
      mesh.material.metalness = params.metalness;
      mesh.material.roughness = params.roughness;
      mesh.material.wireframe = params.wireframe;
    }
  }

  objects.ground.material.color.set(params.groundColor);
  objects.keyLight.intensity = params.lightIntensity;
  ctx.scene.background.set(params.background);
}
`;
}

export interface BlenderTemplateOptions {
  title: string;
  /** RGB triple in 0..1 for the figure's base color */
  bodyColorRgb: [number, number, number];
}

export function buildBlenderSceneCode(options: BlenderTemplateOptions): string {
  const rgb = options.bodyColorRgb.map((c) => c.toFixed(3)).join(', ');
  return `# ${options.title}
# Zendai Blender scene script — runnable as-is inside Blender
# (via the Zendai bridge add-on / MCP, or Blender's Text Editor).
import bpy
import math

PARAMS = {
    "head_size": 1.0,
    "torso_width": 1.0,
    "arm_length": 1.0,
    "leg_length": 1.0,
    "body_color": (${rgb}, 1.0),
    "light_energy": 3.0,
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def make_material(name):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = PARAMS["body_color"]
    bsdf.inputs["Metallic"].default_value = 0.35
    bsdf.inputs["Roughness"].default_value = 0.35
    return material


def add_box(name, size, location, scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] * scale[0], size[1] * scale[1], size[2] * scale[2])
    obj.data.materials.append(make_material(name + "Material"))
    return obj


def build_scene():
    torso = add_box(
        "Torso",
        (0.7, 0.4, 1.0),
        (0, 0, 1.35),
        (PARAMS["torso_width"], 1.0, 1.0),
    )

    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.28 * PARAMS["head_size"],
        location=(0, 0, 2.1),
    )
    head = bpy.context.active_object
    head.name = "Head"
    head.data.materials.append(make_material("HeadMaterial"))

    left_arm = add_box(
        "LeftArm",
        (0.22, 0.22, 0.85),
        (-0.55, 0, 1.35),
        (1.0, 1.0, PARAMS["arm_length"]),
    )
    right_arm = add_box(
        "RightArm",
        (0.22, 0.22, 0.85),
        (0.55, 0, 1.35),
        (1.0, 1.0, PARAMS["arm_length"]),
    )
    left_leg = add_box(
        "LeftLeg",
        (0.26, 0.26, 0.95),
        (-0.22, 0, 0.48),
        (1.0, 1.0, PARAMS["leg_length"]),
    )
    right_leg = add_box(
        "RightLeg",
        (0.26, 0.26, 0.95),
        (0.22, 0, 0.48),
        (1.0, 1.0, PARAMS["leg_length"]),
    )

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
    return {
        "head": head,
        "torso": torso,
        "left_arm": left_arm,
        "right_arm": right_arm,
        "left_leg": left_leg,
        "right_leg": right_leg,
        "ground": ground,
    }


clear_scene()
parts = build_scene()
print("Zendai model built: " + ", ".join(parts.keys()))
`;
}

export const DEFAULT_SCENE_CODE = buildThreeSceneCode({
  title: 'Component figure',
  bodyColor: '#4f8ef7',
});

export const DEFAULT_BLENDER_CODE = buildBlenderSceneCode({
  title: 'Component figure',
  bodyColorRgb: [0.31, 0.56, 0.97],
});
