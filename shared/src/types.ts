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

/** Optional camera specification exported by a scene module as CAMERA. */
export interface CameraSpec {
  position?: [number, number, number];
  lookAt?: [number, number, number];
  fov?: number;
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
  buildScene(ctx: BuildContext): unknown;
  updateScene(ctx: UpdateContext): void;
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
