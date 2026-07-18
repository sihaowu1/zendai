import type {
  AspectRatio,
  ChatIntent,
  GenerationResult,
  IntentModelContext,
  MarketplaceItemDetail,
  MarketplaceItemSummary,
  PublishRequest,
  ReferenceImage,
  RenderSettings,
  SceneSpec,
} from '@motionforge/shared';

/** Thin typed client for the Zendai server API (proxied through Vite). */

export interface Mp4JobResponse {
  id: string;
  status: 'running' | 'done' | 'error';
  progress: number;
  message: string;
  result?: { url: string; fileName: string; settings: RenderSettings };
  error?: string;
}

type AccessTokenGetter = () => Promise<string | undefined>;

let accessTokenGetter: AccessTokenGetter | null = null;

/** Wired by `AuthTokenBridge` when the user is signed in. */
export function setAccessTokenGetter(getter: AccessTokenGetter | null): void {
  accessTokenGetter = getter;
}

async function authHeaders(options?: { required?: boolean }): Promise<Record<string, string>> {
  if (!accessTokenGetter) {
    if (options?.required) {
      throw new Error(
        'Not signed in (no Auth0 token). Log out and log back in with GitHub, and confirm VITE_AUTH0_AUDIENCE matches an Auth0 API identifier.',
      );
    }
    return {};
  }
  const token = await accessTokenGetter();
  if (!token) {
    if (options?.required) {
      throw new Error(
        'Could not get an Auth0 API access token. Create an Auth0 API with identifier matching VITE_AUTH0_AUDIENCE, authorize this SPA, then log out and log in again.',
      );
    }
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function parseError(response: Response): Promise<Error> {
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    // response body was not JSON
  }
  return new Error(message);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: await authHeaders() });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown, options?: { requireAuth?: boolean }): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders({ required: options?.requireAuth })),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export const classifyIntent = (
  prompt: string,
  models: IntentModelContext[],
  activeModelId?: string,
) => postJson<ChatIntent>('/api/intent', { prompt, models, activeModelId });

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders({ required: true })),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

async function deleteRequest(path: string): Promise<void> {
  const response = await fetch(path, {
    method: 'DELETE',
    headers: await authHeaders({ required: true }),
  });
  if (!response.ok) throw await parseError(response);
}

export const generate = (prompt: string, image?: ReferenceImage) =>
  postJson<GenerationResult>('/api/generate', { prompt, ...(image && { image }) });

export const modify = (prompt: string, code: string, image?: ReferenceImage, spec?: SceneSpec) =>
  postJson<GenerationResult>('/api/modify', {
    prompt,
    code,
    ...(image && { image }),
    ...(spec && { spec }),
  });

export interface CritiqueRequest {
  prompt: string;
  code: string;
  views: Array<{ label: string; base64: string }>;
  image?: ReferenceImage;
  spec?: SceneSpec;
  iteration: number;
}

export type CritiqueResponse =
  | { action: 'continue'; reason?: string }
  | { action: 'revise'; code: string; reason: string; tunables?: GenerationResult['tunables'] };

export const critique = (body: CritiqueRequest) =>
  postJson<CritiqueResponse>('/api/critique', body);

export const animate = (prompt: string, code: string) =>
  postJson<GenerationResult>('/api/animate', { prompt, code });

export const fuse = (
  modules: Array<{ name: string; code: string }>,
  aspectRatio?: AspectRatio,
) =>
  postJson<GenerationResult>('/api/fuse', {
    modules,
    ...(aspectRatio && { aspectRatio }),
  });

export const startMp4Export = (code: string, settings: RenderSettings) =>
  postJson<{ jobId: string }>('/api/export/mp4', { code, settings });

export const getMp4Job = (jobId: string) =>
  getJson<Mp4JobResponse>(`/api/export/mp4/${jobId}`);

// ─── Marketplace ────────────────────────────────────────────────────────────

export interface MarketplaceListResponse {
  items: MarketplaceItemSummary[];
  total: number;
  page: number;
  pages: number;
}

export const getMarketplace = (page = 1, limit = 20, mine?: boolean) =>
  getJson<MarketplaceListResponse>(`/api/marketplace?page=${page}&limit=${limit}${mine ? '&mine=1' : ''}`);

export const getMarketplaceItem = (id: string) =>
  getJson<MarketplaceItemDetail>(`/api/marketplace/${id}`);

export const publishToMarketplace = (body: PublishRequest) =>
  postJson<{ id: string }>('/api/marketplace/publish', body);

export const updateMarketplaceItem = (id: string, body: { title?: string; description?: string }) =>
  patchJson<MarketplaceItemDetail>(`/api/marketplace/${id}`, body);

export const deleteMarketplaceItem = (id: string) =>
  deleteRequest(`/api/marketplace/${id}`);

// ─── Export ─────────────────────────────────────────────────────────────────

export const CODE_EXPORT_FORMATS = ['standalone', 'react', 'module'] as const;
export type CodeExportFormat = (typeof CODE_EXPORT_FORMATS)[number];

export async function exportCodeZip(
  code: string,
  format: CodeExportFormat = 'standalone',
): Promise<Blob> {
  const response = await fetch('/api/export/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify({ code, format }),
  });
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export interface GitHubLinkedRepo {
  owner: string;
  repo: string;
  url: string;
  defaultBranch: string;
}

export interface GitHubCommitResult {
  commitUrl: string;
  sha: string;
}

export interface GitHubCreateResult extends GitHubLinkedRepo, GitHubCommitResult {}

export interface GitHubModelPayload {
  id: string;
  name: string;
  code: string;
}

export interface GitHubProjectPayload {
  models: GitHubModelPayload[];
  title?: string;
  message?: string;
  format?: CodeExportFormat;
}

export interface GitHubPullResult {
  models: GitHubModelPayload[];
}

export const githubCreateRepo = (body: GitHubProjectPayload & { name: string; private?: boolean }) =>
  postJson<GitHubCreateResult>('/api/export/github/create', body, { requireAuth: true });

export const githubLinkRepo = (fullName: string) =>
  postJson<GitHubLinkedRepo>('/api/export/github/link', { fullName }, { requireAuth: true });

export const githubCommit = (
  body: GitHubProjectPayload & { owner: string; repo: string; branch?: string },
) => postJson<GitHubCommitResult>('/api/export/github/commit', body, { requireAuth: true });

export const githubPull = (body: { owner: string; repo: string; branch?: string }) =>
  postJson<GitHubPullResult>('/api/export/github/pull', body, { requireAuth: true });
