// a green cube
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
  bodyColor: '#46a758',
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
    new THREE.BoxGeometry(params.radius * 1.6, params.radius * 1.6, params.radius * 1.6),
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
