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
 * purely a framing hint for model generation (how the AI blocks objects and
 * points the camera) and for the live viewport's letterboxing — it is
 * independent of `RenderSettings.width`/`height`, which the export UI
 * picks separately at render time.
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

/** An optional reference image sent alongside a prompt for image-to-model generation. */
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

// ─── Scene spec ─────────────────────────────────────────────────────────────

/**
 * The structural plan generation produces before writing any code. Declaring
 * the parts, materials and tunables up front means the code turn has one job,
 * and gives the validator something to check the emitted module against.
 */

/** One named part of the subject, positioned relative to its parent. */
export interface SpecComponent {
  id: string;
  parent: string | null;
  primitive: string;
  dims: number[];
  position: [number, number, number];
  rotation?: [number, number, number];
  pivot?: [number, number, number];
  /** Key into `SceneSpec.materials`. */
  material: string;
}

export interface SpecMaterial {
  color: string;
  roughness: number;
  metalness: number;
}

export interface SpecLight {
  type: string;
  position: [number, number, number];
  intensity: number;
  color: string;
}

/** A planned tunable. Mirrors `TunableParam`, plus the parts it drives. */
export interface SpecParam {
  name: string;
  label: string;
  type: 'number' | 'boolean' | 'color';
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  /** Component ids this param affects. */
  targets: string[];
}

export interface SceneSpec {
  subject: string;
  complexity: 'simple' | 'moderate' | 'detailed';
  components: SpecComponent[];
  materials: Record<string, SpecMaterial>;
  lights: SpecLight[];
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
    fov: number;
  };
  params: SpecParam[];
}

/** What the generation API returns to the editor. */
export interface GenerationResult {
  code: string;
  tunables: TunableParam[];
  source: 'model' | 'template';
  /** Absent on the offline template path and on pre-spec projects. */
  spec?: SceneSpec;
  /**
   * Plain-language description of what the agent built or changed, written by
   * the code turn alongside the module. Shown as the assistant's chat reply.
   */
  summary?: string;
  /** Short display title for the model list, e.g. "Red Sports Car". */
  title?: string;
}

// ─── Chat intent ────────────────────────────────────────────────────────────

/**
 * A model reduced to what intent routing needs to match a prompt against it:
 * its name and its layer names. Deliberately excludes code — the classifier
 * runs on every message and must stay cheap.
 */
export interface IntentModelContext {
  id: string;
  name: string;
  layers: string[];
}

/** Where the chat composer's single submit should route a message. */
export interface ChatIntent {
  intent: 'generate' | 'modify';
  /** The model an edit targets. Only meaningful when `intent` is `modify`. */
  targetModelId?: string;
  /** Layers the edit is expected to touch, used to highlight them while it runs. */
  targetLayers?: string[];
  /** Short clause naming what is about to happen, e.g. "recolouring tableTop". */
  reason?: string;
}

// ─── Marketplace ────────────────────────────────────────────────────────────

/** Summary returned in the paginated marketplace list. */
export interface MarketplaceItemSummary {
  id: string;
  title: string;
  description: string;
  code: string;
  creator: { name: string; picture?: string };
  creatorSub?: string;
  publishedAt: string;
}

/** Full item detail including source code. */
export interface MarketplaceItemDetail extends MarketplaceItemSummary {}

/** Body sent to POST /api/marketplace/publish. */
export interface PublishRequest {
  title: string;
  description: string;
  code: string;
}
