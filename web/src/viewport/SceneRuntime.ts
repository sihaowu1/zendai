import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateSceneModule, type SceneModule } from '@motionforge/shared';

const gltfLoader = new GLTFLoader();

/**
 * Synthesizes a `SceneModule` for a statically-imported GLB/glTF asset — the
 * Blender-export path bypasses the AI code-generation contract entirely
 * (there is no `buildScene` source to hot-load), so the runtime builds one
 * itself: an empty group is returned immediately (so `rebuild`'s
 * before/after diff picks it up), and the parsed glTF scene is appended into
 * it once loading resolves.
 *
 * AI-generated modules always add their own key/ambient lights (see
 * `sceneTemplate.ts`); an imported glTF has none of that, and the viewport's
 * optional "fill lights" helper defaults to off, so without a light rig of
 * its own the model renders solid black. A fixed rig is added here so an
 * import is visible without the user having to discover that toggle.
 */
function createImportedModule(assetUrl: string): SceneModule {
  return {
    PARAMS: {},
    buildScene(ctx) {
      const scene = ctx.scene as THREE.Scene;
      const root = new THREE.Group();
      root.add(new THREE.AmbientLight(0xffffff, 0.6));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
      keyLight.position.set(4, 6, 5);
      root.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
      fillLight.position.set(-4, 2, -3);
      root.add(fillLight);
      scene.add(root);
      gltfLoader.load(
        assetUrl,
        (gltf) => {
          normalizeImportedScale(gltf.scene);
          root.add(gltf.scene);
        },
        undefined,
        (err) => console.error('Failed to load imported model', err),
      );
      return { root };
    },
    updateScene() {},
  };
}

/** Target height (world units) an imported glTF is normalized to — matches the rough scale generated scene templates use, which the default camera/home-position is framed for. */
const IMPORTED_TARGET_HEIGHT = 2;

/**
 * Blender/glTF exports come in at whatever scale their source scene used
 * (millimeters, meters, arbitrary units), which puts them wildly out of frame
 * of the default camera — anywhere from a barely-visible speck to a giant
 * shell the camera starts out inside of (indistinguishable from "just black").
 * Rescaling to a fixed target height and grounding it at y=0 lands every
 * import in the same neighborhood the default camera already frames.
 */
function normalizeImportedScale(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && Number.isFinite(maxDim)) {
    const scale = IMPORTED_TARGET_HEIGHT / maxDim;
    object.scale.setScalar(scale);
  }
  const scaledBox = new THREE.Box3().setFromObject(object);
  const center = scaledBox.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= scaledBox.min.y;
}

/** A clicked object's position (units), left/right yaw (`angle`, Y-axis) and up/down pitch (`pitch`, X-axis), both in degrees. */
export interface ObjectTransform {
  x: number;
  y: number;
  z: number;
  /** Left/right rotation, degrees. */
  angle: number;
  /** Up/down rotation, degrees. */
  pitch: number;
}

/**
 * Bound to the specific object that was clicked. Reading/writing through this
 * — rather than exposing the `THREE.Object3D` itself — keeps the manual
 * position/rotation override entirely inside the runtime: it never touches
 * PARAMS, generated code, or the AI agent, and it survives `updateScene`
 * running every frame (see `SceneRuntime`'s render loop).
 */
export interface ObjectHandle {
  getTransform(): ObjectTransform;
  setTransform(transform: ObjectTransform): void;
}

export interface SceneEntry {
  id: string;
  code: string;
  /** When set, this entry is an imported GLB/glTF asset — rendered via `createImportedModule` instead of hot-loading `code`. */
  assetUrl?: string;
}

interface LoadedEntry {
  id: string;
  module: SceneModule;
  objects: unknown;
}

/** Horizontal gap (world units) between co-viewed models on the shared ground plane. */
const MERGE_SPACING = 4;

/**
 * Wrap a PARAMS object so undefined/NaN numeric reads fall back to 0, preventing
 * NaN geometry from AI-generated code that references missing param keys.
 */
function safeguardParams(params: Record<string, unknown>): Record<string, unknown> {
  return new Proxy(params, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value === undefined || value === null) return 0;
      if (typeof value === 'number' && !Number.isFinite(value)) return 0;
      return value;
    },
  });
}

/**
 * Live WebGL preview runtime. The editor's code string is hot-loaded as a real
 * ES module (Blob URL import), then buildScene/updateScene run against a
 * Three.js renderer with orbit controls. Any code change rebuilds the scene.
 *
 * Multiple entries are co-rendered side-by-side (not parented/constrained to
 * each other) so merges can be viewed on one plane.
 */
export class SceneRuntime {
  onError: (err: Error) => void = () => {};
  /** Fired when a raycast click hits any object in the scene (not empty space). */
  onObjectClick: (point: { x: number; y: number }, handle: ObjectHandle) => void = () => {};

  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private scene = new THREE.Scene();
  private entries: LoadedEntry[] = [];
  private raf = 0;
  private startMs = performance.now();
  private frameErrorReported = false;
  /** When set, `updateScene` is driven by this instead of the free-running wall clock (see `setTime`). */
  private controlledTime: number | null = null;
  private raycaster = new THREE.Raycaster();
  private pointerDownPos: { x: number; y: number } | null = null;
  /**
   * Manual position/rotation overrides set by clicking an object and dragging
   * its transform sliders. Re-applied after `updateScene` every frame (see
   * `loop`) so they hold even against an animated object's own per-frame
   * position assignment. Cleared on every rebuild since the objects it keys
   * on are disposed then.
   */
  private transformOverrides = new Map<THREE.Object3D, ObjectTransform>();
  /**
   * Manual camera position/yaw override set via the "Camera" editor. Unlike
   * `transformOverrides`, this must be re-applied *after* `controls.update()`
   * every frame — `OrbitControls` recomputes the camera's position/orientation
   * from its own internal spherical state and target on every call, which
   * would otherwise stomp a direct `camera.position`/`camera.rotation` write.
   * `controls.enabled` is turned off while this is set so a mouse drag over
   * the canvas can't fight the sliders, and restored on `clearCameraOverride`.
   */
  private cameraOverride: ObjectTransform | null = null;
  /** Toggled by the "Axes" button — persists across `setCode` rebuilds (the helper is re-added to each fresh `THREE.Scene`), reset only when a new `SceneRuntime` is constructed. */
  private axesVisible = false;
  private axesHelper: THREE.AxesHelper | null = null;
  private grid: THREE.GridHelper | null = null;
  private fillLights: THREE.Group | null = null;
  private gridVisible = false;
  private fillVisible = false;
  /** Camera pose the current scene was framed with, restored by `resetCamera`. */
  private homeCamera = { position: new THREE.Vector3(4, 2.6, 5.5), target: new THREE.Vector3(0, 0.8, 0) };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(4, 2.6, 5.5);
    // Yaw around world-up first, then pitch relative to that — the standard
    // FPS-camera Euler order, so a pitch (up/down) edit never introduces roll.
    this.camera.rotation.order = 'YXZ';
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.8, 0);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
  }

  async setCode(code: string): Promise<void> {
    await this.setScenes([{ id: 'scene', code }]);
  }

  async setScenes(scenes: SceneEntry[]): Promise<void> {
    if (scenes.length === 0) {
      this.entries = [];
      disposeScene(this.scene);
      this.scene = new THREE.Scene();
      return;
    }

    for (const entry of scenes) {
      if (entry.assetUrl) continue;
      const errors = validateSceneModule(entry.code);
      if (errors.length > 0) throw new Error(`${entry.id}: ${errors.join('; ')}`);
    }

    const loaded = await Promise.all(
      scenes.map(async (entry) => ({
        id: entry.id,
        module: entry.assetUrl ? createImportedModule(entry.assetUrl) : await loadSceneModule(entry.code),
      })),
    );

    this.frameErrorReported = false;
    this.rebuild(loaded);
  }

  /**
   * Hands the scene's `time` to the caller (e.g. a timeline playhead)
   * instead of the internal wall clock — a fixed `time` freezes the scene on
   * that exact frame, since `updateScene` must already be pure in `time`.
   */
  setTime(time: number): void {
    this.controlledTime = time;
  }

  setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.syncHelpers();
  }

  setFillLightsVisible(visible: boolean): void {
    this.fillVisible = visible;
    this.syncHelpers();
  }

  /** Return the camera to the pose the current scene was framed with. */
  resetCamera(): void {
    this.camera.position.copy(this.homeCamera.position);
    this.controls.target.copy(this.homeCamera.target);
    this.controls.update();
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.controls.dispose();
    disposeScene(this.scene);
    this.renderer.dispose();
  }

  // Tracked as pointerdown/up (not a native `click`) so an orbit-drag that
  // happens to start and end over the canvas isn't mistaken for a click.
  private handlePointerDown = (event: PointerEvent): void => {
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const down = this.pointerDownPos;
    this.pointerDownPos = null;
    if (!down) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) return;
    this.handleCanvasClick(event.clientX, event.clientY);
  };

  private handleCanvasClick(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    if (hits.length > 0) {
      const object = this.topLevelAncestor(hits[0].object);
      this.onObjectClick(
        { x: clientX, y: clientY },
        {
          getTransform: () => this.getObjectTransform(object),
          setTransform: (transform) => this.setObjectTransform(object, transform),
        },
      );
    }
  }

  /**
   * Walks up to whatever `buildScene` added directly to the scene — moving
   * that, not a sub-mesh, is what "the clicked object" means for compound
   * objects. Each entry's top-level objects are wrapped in a `merge:<id>`
   * group (see `rebuild`) so the stop condition is "parent is that group",
   * not "parent is `this.scene`" directly.
   */
  private topLevelAncestor(object: THREE.Object3D): THREE.Object3D {
    let node = object;
    while (node.parent && node.parent !== this.scene && !node.parent.name.startsWith('merge:')) {
      node = node.parent;
    }
    return node;
  }

  private getObjectTransform(object: THREE.Object3D): ObjectTransform {
    return {
      x: object.position.x,
      y: object.position.y,
      z: object.position.z,
      angle: THREE.MathUtils.radToDeg(object.rotation.y),
      pitch: THREE.MathUtils.radToDeg(object.rotation.x),
    };
  }

  private setObjectTransform(object: THREE.Object3D, transform: ObjectTransform): void {
    this.transformOverrides.set(object, transform);
    object.position.set(transform.x, transform.y, transform.z);
    object.rotation.set(THREE.MathUtils.degToRad(transform.pitch), THREE.MathUtils.degToRad(transform.angle), 0);
  }

  /** Handle for the "Camera" editor — mirrors `ObjectHandle` so the same `TransformControls` UI works for both. */
  getCameraHandle(): ObjectHandle {
    return {
      getTransform: () => this.getCameraTransform(),
      setTransform: (transform) => this.setCameraTransform(transform),
    };
  }

  /** Enable or disable orbit controls entirely (e.g. for non-interactive previews). */
  setControlsEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  /** Hands manual camera control back to `OrbitControls`, e.g. when the camera editor popover closes. */
  clearCameraOverride(): void {
    this.cameraOverride = null;
    this.controls.enabled = true;
  }

  private getCameraTransform(): ObjectTransform {
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
      angle: THREE.MathUtils.radToDeg(this.camera.rotation.y),
      pitch: THREE.MathUtils.radToDeg(this.camera.rotation.x),
    };
  }

  private setCameraTransform(transform: ObjectTransform): void {
    this.cameraOverride = transform;
    this.controls.enabled = false;
    this.applyCameraOverride();
  }

  private applyCameraOverride(): void {
    const transform = this.cameraOverride;
    if (!transform) return;
    this.camera.position.set(transform.x, transform.y, transform.z);
    this.camera.rotation.set(
      THREE.MathUtils.degToRad(transform.pitch),
      THREE.MathUtils.degToRad(transform.angle),
      0,
    );
  }

  /** Shows/hides the red/green/blue X/Y/Z reference axes at the scene origin. */
  setAxesVisible(visible: boolean): void {
    this.axesVisible = visible;
    this.syncAxesHelper();
  }

  getAxesVisible(): boolean {
    return this.axesVisible;
  }

  /** Re-adds the (single, reused) helper to whatever the current `this.scene` is — needed after every rebuild, since `disposeScene`/reassignment discards the previous scene's children. */
  private syncAxesHelper(): void {
    if (!this.axesVisible) {
      if (this.axesHelper) this.scene.remove(this.axesHelper);
      return;
    }
    if (!this.axesHelper) this.axesHelper = new THREE.AxesHelper(10);
    if (this.axesHelper.parent !== this.scene) this.scene.add(this.axesHelper);
  }

  private rebuild(loaded: Array<{ id: string; module: SceneModule }>): void {
    // Spare the reused axes helper from disposal — it's about to be re-added to the fresh scene, not thrown away.
    if (this.axesHelper) this.scene.remove(this.axesHelper);
    disposeScene(this.scene);
    this.scene = new THREE.Scene();
    this.entries = [];
    this.grid = null;
    this.fillLights = null;
    this.transformOverrides.clear();
    this.clearCameraOverride();
    this.syncAxesHelper();

    const primary = loaded[0]?.module;
    if (primary?.CAMERA?.position) this.camera.position.set(...primary.CAMERA.position);
    if (primary?.CAMERA?.fov) {
      this.camera.fov = primary.CAMERA.fov;
      this.camera.updateProjectionMatrix();
    }
    if (primary?.CAMERA?.lookAt) this.controls.target.set(...primary.CAMERA.lookAt);

    // Pull the camera back a bit when several models share the plane.
    if (loaded.length > 1) {
      const span = (loaded.length - 1) * MERGE_SPACING;
      this.camera.position.x = 0;
      this.camera.position.z = Math.max(this.camera.position.z, 5.5 + span * 0.45);
      this.controls.target.set(0, 0.8, 0);
    }

    for (let i = 0; i < loaded.length; i++) {
      const { id, module } = loaded[i];
      const before = new Set(this.scene.children);
      const backgroundBefore = this.scene.background;

      try {
        const objects = module.buildScene({
          THREE,
          scene: this.scene,
          params: safeguardParams(module.PARAMS),
        });

        const added = this.scene.children.filter((child) => !before.has(child));
        const group = new THREE.Group();
        group.name = `merge:${id}`;
        group.position.x = (i - (loaded.length - 1) / 2) * MERGE_SPACING;
        for (const obj of added) {
          this.scene.remove(obj);
          group.add(obj);
        }
        this.scene.add(group);

        // Keep the first module's background; later modules may overwrite it.
        if (i > 0) this.scene.background = backgroundBefore;

        this.entries.push({ id, module, objects });
      } catch (err) {
        this.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    // Framing is settled by this point (module CAMERA plus the merge pull-back),
    // so this is the pose "reset camera" should return to.
    this.homeCamera.position.copy(this.camera.position);
    this.homeCamera.target.copy(this.controls.target);

    this.syncHelpers();
  }

  /**
   * Grid and fill lights are viewport furniture, not part of the model, so they
   * are created lazily and re-added after every rebuild drops the old scene.
   */
  private syncHelpers(): void {
    if (this.gridVisible) {
      if (!this.grid) {
        this.grid = new THREE.GridHelper(20, 20, 0x4a4a4a, 0x2c2c2c);
      }
      if (this.grid.parent !== this.scene) this.scene.add(this.grid);
    } else if (this.grid?.parent) {
      this.scene.remove(this.grid);
    }

    if (this.fillVisible) {
      if (!this.fillLights) {
        const group = new THREE.Group();
        group.name = 'viewport:fill';
        group.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 0.9);
        key.position.set(4, 6, 5);
        group.add(key);
        this.fillLights = group;
      }
      if (this.fillLights.parent !== this.scene) this.scene.add(this.fillLights);
    } else if (this.fillLights?.parent) {
      this.scene.remove(this.fillLights);
    }
  }

  private loop(now: number): void {
    const time = this.controlledTime !== null ? this.controlledTime : (now - this.startMs) / 1000;
    for (const entry of this.entries) {
      try {
        entry.module.updateScene({
          THREE,
          scene: this.scene,
          objects: entry.objects,
          params: safeguardParams(entry.module.PARAMS),
          time,
        });
      } catch (err) {
        if (!this.frameErrorReported) {
          this.frameErrorReported = true;
          this.onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
    // Re-assert manual overrides after updateScene, which may have just
    // written its own position/rotation for this frame.
    for (const [object, transform] of this.transformOverrides) {
      object.position.set(transform.x, transform.y, transform.z);
      object.rotation.set(THREE.MathUtils.degToRad(transform.pitch), THREE.MathUtils.degToRad(transform.angle), 0);
    }
    this.controls.update();
    // Applied after controls.update() (not folded into the transformOverrides
    // loop above), since that call would otherwise overwrite our direct
    // camera position/rotation write with its own target-relative one.
    this.applyCameraOverride();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }
}

async function loadSceneModule(code: string): Promise<SceneModule> {
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    return (await import(/* @vite-ignore */ url)) as SceneModule;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
}
