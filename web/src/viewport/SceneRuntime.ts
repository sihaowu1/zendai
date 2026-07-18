import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { validateSceneModule, type SceneModule } from '@motionforge/shared';

/**
 * Live WebGL preview runtime. The editor's code string is hot-loaded as a real
 * ES module (Blob URL import), then buildScene/updateScene run against a
 * Three.js renderer with orbit controls. Any code change rebuilds the scene.
 */
export class SceneRuntime {
  onError: (err: Error) => void = () => {};
  /** Fired when a raycast click hits any object in the scene (not empty space). */
  onObjectClick: (point: { x: number; y: number }) => void = () => {};

  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private scene = new THREE.Scene();
  private module: SceneModule | null = null;
  private objects: unknown = null;
  private raf = 0;
  private startMs = performance.now();
  private frameErrorReported = false;
  /** When set, `updateScene` is driven by this instead of the free-running wall clock (see `setTime`). */
  private controlledTime: number | null = null;
  private raycaster = new THREE.Raycaster();
  private pointerDownPos: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(4, 2.6, 5.5);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.8, 0);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
  }

  async setCode(code: string): Promise<void> {
    const errors = validateSceneModule(code);
    if (errors.length > 0) throw new Error(errors.join('; '));
    this.module = await loadSceneModule(code);
    this.frameErrorReported = false;
    this.rebuild();
  }

  /**
   * Hands the scene's `time` to the caller (e.g. a timeline playhead)
   * instead of the internal wall clock — a fixed `time` freezes the scene on
   * that exact frame, since `updateScene` must already be pure in `time`.
   */
  setTime(time: number): void {
    this.controlledTime = time;
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
      this.onObjectClick({ x: clientX, y: clientY });
    }
  }

  private rebuild(): void {
    disposeScene(this.scene);
    this.scene = new THREE.Scene();
    const module = this.module;
    if (!module) return;
    const camera = module.CAMERA;
    if (camera?.position) this.camera.position.set(...camera.position);
    if (camera?.fov) {
      this.camera.fov = camera.fov;
      this.camera.updateProjectionMatrix();
    }
    if (camera?.lookAt) this.controls.target.set(...camera.lookAt);
    try {
      this.objects = module.buildScene({ THREE, scene: this.scene, params: module.PARAMS });
    } catch (err) {
      this.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private loop(now: number): void {
    const module = this.module;
    if (module) {
      try {
        module.updateScene({
          THREE,
          scene: this.scene,
          objects: this.objects,
          params: module.PARAMS,
          time: this.controlledTime !== null ? this.controlledTime : (now - this.startMs) / 1000,
        });
      } catch (err) {
        if (!this.frameErrorReported) {
          this.frameErrorReported = true;
          this.onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
    this.controls.update();
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
