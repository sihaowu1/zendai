import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { repoRoot } from '../utils/fsx';

dotenv.config({ path: path.join(repoRoot, '.env') });

export interface AppConfig {
  server: { port: number };
  ai: { model: string; maxTokens: number; maxAgentIterations: number };
  auth0: { domain: string; audience: string };
  mongo: { uri: string };
  blender: {
    enabled: boolean;
    mcp: { command: string; args: string[]; bridgeHost: string; bridgePort: number };
  };
  remotion: {
    compositionId: string;
    fps: number;
    durationInSeconds: number;
    width: number;
    height: number;
    gl: string;
  };
  paths: { renders: string };
}

const raw = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'config', 'default.config.json'), 'utf8'),
) as AppConfig;

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** File config merged with environment-variable overrides. */
export const config: AppConfig = {
  ...raw,
  server: { port: Number(process.env.PORT ?? raw.server.port) },
  ai: { ...raw.ai, model: process.env.ANTHROPIC_MODEL ?? raw.ai.model },
  auth0: {
    domain: process.env.AUTH0_DOMAIN ?? raw.auth0?.domain ?? '',
    audience: process.env.AUTH0_AUDIENCE ?? raw.auth0?.audience ?? '',
  },
  mongo: { uri: process.env.MONGODB_URI ?? raw.mongo?.uri ?? '' },
  blender: { ...raw.blender, enabled: envBool('BLENDER_MCP_ENABLED', raw.blender.enabled) },
  remotion: { ...raw.remotion, gl: process.env.REMOTION_GL ?? raw.remotion.gl },
};

/** True when Auth0 JWT validation can run (domain + audience both set). */
export const auth0Configured = Boolean(config.auth0.domain && config.auth0.audience);

/** True when MongoDB URI is configured. */
export const mongoConfigured = Boolean(config.mongo.uri);

export const rendersDir = path.join(repoRoot, config.paths.renders);
