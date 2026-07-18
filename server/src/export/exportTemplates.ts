/**
 * Static file templates for code export: standalone Three.js viewer,
 * React SceneCanvas host, and format-specific READMEs.
 */

export function viewerHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b0d12; }
      canvas { display: block; width: 100vw; height: 100vh; }
    </style>
    <script type="importmap">
      {
        "imports": {
          "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
          "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
        }
      }
    </script>
  </head>
  <body>
    <canvas id="viewport"></canvas>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
`;
}

export function viewerJs(): string {
  return `// Standalone viewer for the exported Zendai scene module.
// Serve this folder over HTTP (e.g. \`npx serve .\`) and open index.html.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as sceneModule from './scene.module.js';

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
const spec = sceneModule.CAMERA ?? {};
camera.position.set(...(spec.position ?? [4, 2.6, 5.5]));
if (spec.fov) camera.fov = spec.fov;
camera.updateProjectionMatrix();

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(...(spec.lookAt ?? [0, 0.8, 0]));

const objects = sceneModule.buildScene({ THREE, scene, params: sceneModule.PARAMS });

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const start = performance.now();
renderer.setAnimationLoop((now) => {
  sceneModule.updateScene({
    THREE,
    scene,
    objects,
    params: sceneModule.PARAMS,
    time: (now - start) / 1000,
  });
  controls.update();
  renderer.render(scene, camera);
});
`;
}

/** Drop-in React + Three.js host for the exported scene module. */
export function reactSceneCanvasTsx(): string {
  return `import { useEffect, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import * as sceneModule from './scene.module.js';

export interface SceneCanvasProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a Zendai scene.module.js inside a React app.
 * Install peers: \`npm i three react react-dom\`
 *
 * Optional OrbitControls (not included):
 *   import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
 */
export function SceneCanvas({ className, style }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    const spec = sceneModule.CAMERA ?? {};
    camera.position.set(...(spec.position ?? [4, 2.6, 5.5]));
    if (spec.fov) camera.fov = spec.fov;
    if (spec.lookAt) camera.lookAt(...spec.lookAt);
    camera.updateProjectionMatrix();

    const objects = sceneModule.buildScene({
      THREE,
      scene,
      params: sceneModule.PARAMS,
    });

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    let frameId = 0;
    const tick = (now: number) => {
      sceneModule.updateScene({
        THREE,
        scene,
        objects,
        params: sceneModule.PARAMS,
        time: (now - start) / 1000,
      });
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  );
}
`;
}

export function reactPackageJson(): string {
  return `${JSON.stringify(
    {
      name: 'zendai-scene',
      private: true,
      peerDependencies: {
        react: '>=18',
        'react-dom': '>=18',
        three: '>=0.160.0',
      },
    },
    null,
    2,
  )}\n`;
}

export function standaloneReadme(title: string): string {
  return `# ${title}

Exported from Zendai — a code-based 3D scene, fully editable.

## Format: Standalone HTML

## Files

- \`scene.module.js\` — the parametric Three.js scene module. \`PARAMS\` holds
  every tunable value; \`buildScene\` constructs the scene; \`updateScene\`
  animates it as a pure function of time.
- \`index.html\` + \`viewer.js\` — a standalone WebGL viewer for the module
  (Three.js is loaded from a CDN via an import map).

## Run the web viewer

Browsers block ES modules on file:// URLs, so serve the folder over HTTP:

\`\`\`bash
npx serve .
# then open the printed URL (e.g. http://localhost:3000)
\`\`\`

Expected output: the animated 3D scene rendering in your browser with orbit
controls (drag to rotate, scroll to zoom).

## Tweak it

Edit any value in \`PARAMS\` and reload — the code is the project.
`;
}

export function reactReadme(title: string): string {
  return `# ${title}

Exported from Zendai — a code-based 3D scene as a React component.

## Format: React component

## Files

- \`scene.module.js\` — the parametric Three.js scene module (\`PARAMS\`,
  \`buildScene\`, \`updateScene\`, optional \`CAMERA\`).
- \`SceneCanvas.tsx\` — drop-in React host that mounts the module on a canvas.
- \`package.json\` — peer dependency hints (\`react\`, \`react-dom\`, \`three\`).

## Install

\`\`\`bash
npm i three react react-dom
\`\`\`

## Usage

\`\`\`tsx
import { SceneCanvas } from './SceneCanvas';

export function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <SceneCanvas />
    </div>
  );
}
\`\`\`

OrbitControls are not included by default; add them from
\`three/examples/jsm/controls/OrbitControls.js\` if you want orbit interaction.

## Tweak it

Edit any value in \`PARAMS\` and reload — the code is the project.
`;
}

export function moduleReadme(title: string): string {
  return `# ${title}

Exported from Zendai — raw scene module for a custom host.

## Format: ES module only

## Files

- \`scene.module.js\` — the parametric Three.js scene module. Hosts must inject
  \`THREE\`; the module must not \`import\` / \`require\` / \`fetch\`.

## Contract

\`\`\`js
// Host responsibilities:
import * as THREE from 'three';
import * as scene from './scene.module.js';

const objects = scene.buildScene({ THREE, scene: threeScene, params: scene.PARAMS });
scene.updateScene({ THREE, scene: threeScene, objects, params: scene.PARAMS, time });
\`\`\`

Exports: \`PARAMS\`, optional \`CAMERA\`, \`buildScene\`, \`updateScene\`.

## Tweak it

Edit any value in \`PARAMS\` and reload — the code is the project.
`;
}

/** @deprecated Prefer standaloneReadme / reactReadme / moduleReadme. */
export function exportReadme(title: string): string {
  return standaloneReadme(title);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
