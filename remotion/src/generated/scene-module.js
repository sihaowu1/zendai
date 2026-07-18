// Component figure
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
