import { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneModule } from '@motionforge/shared';
// Overwritten with the current scene code before every render
// (server/src/remotion/renderer.ts). The checked-in file is the same
// default scene the editor and offline template fallback use, so
// `npm run studio` renders something meaningful with no prior /generate call.
import * as sceneModule from './generated/scene-module.js';

const scene = sceneModule as unknown as SceneModule;

export interface GeneratedSceneProps {
  fps: number;
  durationInSeconds: number;
  width: number;
  height: number;
}

/**
 * Drives the generated scene module inside Remotion's React tree. buildScene
 * runs once against Remotion's own THREE.Scene/camera; updateScene runs on
 * every render with time derived from the current frame, so the exact same
 * module that plays live in the web viewport renders deterministically here.
 */
function SceneDriver() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scene: threeScene, camera } = useThree();
  const objects = useRef<unknown>(null);

  useLayoutEffect(() => {
    threeScene.clear();
    const cameraSpec = scene.CAMERA;
    if (cameraSpec?.position) camera.position.set(...cameraSpec.position);
    if (cameraSpec?.fov && camera instanceof THREE.PerspectiveCamera) {
      camera.fov = cameraSpec.fov;
      camera.updateProjectionMatrix();
    }
    if (cameraSpec?.lookAt) camera.lookAt(...cameraSpec.lookAt);
    objects.current = scene.buildScene({ THREE, scene: threeScene, params: scene.PARAMS });
    // Runs once per mount (one mount per rendered frame in Remotion's headless renderer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threeScene, camera]);

  scene.updateScene({
    THREE,
    scene: threeScene,
    objects: objects.current,
    params: scene.PARAMS,
    time: frame / fps,
  });

  return null;
}

export function GeneratedScene(_props: GeneratedSceneProps) {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} linear>
      <SceneDriver />
    </ThreeCanvas>
  );
}
