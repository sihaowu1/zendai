import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { validateSceneModule, type SceneModule } from '@motionforge/shared';

export type ModelFormat = 'glb' | 'obj' | 'stl';

/**
 * Build a Three.js scene from a scene-module code string, then export it as a
 * downloadable 3D model file. Runs entirely in the browser — no server needed.
 */
export async function exportSceneAs(code: string, format: ModelFormat): Promise<void> {
  const errors = validateSceneModule(code);
  if (errors.length > 0) throw new Error(`Invalid scene module: ${errors.join('; ')}`);

  const module = await loadModule(code);
  const scene = new THREE.Scene();

  // Build the scene exactly as the viewport does.
  const params = new Proxy(module.PARAMS, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value === undefined || value === null) return 0;
      if (typeof value === 'number' && !Number.isFinite(value)) return 0;
      return value;
    },
  });
  module.buildScene({ THREE, scene, params });

  // Add basic lighting so exported GLBs look reasonable in viewers.
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(4, 6, 5);
  scene.add(light);

  switch (format) {
    case 'glb':
      return exportGLB(scene);
    case 'obj':
      return exportOBJ(scene);
    case 'stl':
      return exportSTL(scene);
  }
}

async function exportGLB(scene: THREE.Scene): Promise<void> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true });
  const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
  download(blob, 'scene.glb');
}

function exportOBJ(scene: THREE.Scene): void {
  const exporter = new OBJExporter();
  const result = exporter.parse(scene);
  const blob = new Blob([result], { type: 'text/plain' });
  download(blob, 'scene.obj');
}

function exportSTL(scene: THREE.Scene): void {
  const exporter = new STLExporter();
  const result = exporter.parse(scene, { binary: true }) as DataView;
  const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  download(blob, 'scene.stl');
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadModule(code: string): Promise<SceneModule> {
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    return (await import(/* @vite-ignore */ url)) as SceneModule;
  } finally {
    URL.revokeObjectURL(url);
  }
}
