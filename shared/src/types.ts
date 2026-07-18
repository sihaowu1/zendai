/** A single tunable parameter extracted from a scene module's PARAMS block. */
export interface TunableParam {
  name: string;
  label: string;
  type: 'number' | 'boolean' | 'color';
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Preview/composition aspect ratio for the Video Generation screen. This is
 * purely a framing hint for scene generation (how the AI blocks objects and
 * points the camera) and for the live viewport's letterboxing — it is
 * independent of `RenderSettings.width`/`height`, which the remotion-mp4
 * skill picks separately at export time.
 */
export type AspectRatio = '16:9' | '1:1' | '4:3';

export const ASPECT_RATIOS: ReadonlyArray<{ value: AspectRatio; label: string; ratio: number }> = [
  { value: '16:9', label: '16:9', ratio: 16 / 9 },
  { value: '1:1', label: '1:1', ratio: 1 },
  { value: '4:3', label: '4:3', ratio: 4 / 3 },
];

export const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';

/** Optional camera specification exported by a scene module as CAMERA. */
export interface CameraSpec {
  position?: [number, number, number];
  lookAt?: [number, number, number];
  fov?: number;
}

/** One keyframe on an animation track (`t` is seconds, `v` is the sampled value). */
export interface AnimationKeyframe {
  t: number;
  v: number;
}

/** A single channel track targeting a named part from the buildScene return map. */
export interface AnimationTrack {
  part: string;
  channel: 'rotation' | 'position' | 'scale';
  axis?: 'x' | 'y' | 'z';
  keyframes: AnimationKeyframe[];
}

/**
 * Optional one-shot clip exported as ANIMATION. Duration is playout length in
 * seconds; after it ends, updateScene should hold the final pose (no loop).
 */
export interface AnimationClip {
  name: string;
  duration: number;
  tracks?: AnimationTrack[];
}

/** Context passed to buildScene(). THREE/scene are host objects. */
export interface BuildContext {
  THREE: unknown;
  scene: unknown;
  params: Record<string, unknown>;
}

/** Context passed to updateScene() every frame. `time` is seconds. */
export interface UpdateContext extends BuildContext {
  objects: unknown;
  time: number;
}

/** The runtime shape every generated scene module must satisfy. */
export interface SceneModule {
  PARAMS: Record<string, unknown>;
  CAMERA?: CameraSpec;
  /** Present on modules produced by the animation skill. */
  ANIMATION?: AnimationClip;
  buildScene(ctx: BuildContext): unknown;
  updateScene(ctx: UpdateContext): void;
}

/** An optional reference image sent alongside a prompt for image-to-scene generation. */
export interface ReferenceImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  base64: string;
}

/** Settings the Remotion pipeline uses to render an MP4. */
export interface RenderSettings {
  fps: number;
  durationInSeconds: number;
  width: number;
  height: number;
}

/** What the generation API returns to the editor. */
export interface GenerationResult {
  code: string;
  blenderCode: string;
  tunables: TunableParam[];
  source: 'model' | 'template';
}

// ─── Marketplace ────────────────────────────────────────────────────────────

/** Summary returned in the paginated marketplace list (no code). */
export interface MarketplaceItemSummary {
  id: string;
  title: string;
  description: string;
  creator: { name: string; picture?: string };
  publishedAt: string;
}

/** Full item detail including source code. */
export interface MarketplaceItemDetail extends MarketplaceItemSummary {
  code: string;
  blenderCode: string;
}

/** Body sent to POST /api/marketplace/publish. */
export interface PublishRequest {
  title: string;
  description: string;
  code: string;
  blenderCode: string;
}
