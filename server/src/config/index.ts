import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { repoRoot } from '../utils/fsx';

dotenv.config({ path: path.join(repoRoot, '.env') });

export interface AppConfig {
  server: { port: number };
  ai: {
    model: string;
    /** Cheap model for short classification calls (chat intent routing). */
    fastModel: string;
    maxTokens: number;
    maxAgentIterations: number;
    /** Off by default: it stacks a round-trip plus a possible regeneration on generation latency. */
    critique: { enabled: boolean; maxIterations: number };
  };
  auth0: {
    domain: string;
    audience: string;
    mgmtClientId: string;
    mgmtClientSecret: string;
  };
  mongo: { uri: string };
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
  ai: {
    ...raw.ai,
    model: process.env.ANTHROPIC_MODEL ?? raw.ai.model,
    fastModel: process.env.ANTHROPIC_FAST_MODEL ?? raw.ai.fastModel ?? raw.ai.model,
    critique: {
      enabled: envBool('AI_CRITIQUE_ENABLED', raw.ai.critique?.enabled ?? false),
      maxIterations: Math.min(
        2,
        Number(process.env.AI_CRITIQUE_MAX_ITERATIONS ?? raw.ai.critique?.maxIterations ?? 1),
      ),
    },
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN ?? raw.auth0?.domain ?? '',
    // Strip trailing slashes — Auth0 identifiers are exact-match.
    audience: (process.env.AUTH0_AUDIENCE ?? raw.auth0?.audience ?? '').replace(/\/+$/, ''),
    mgmtClientId: process.env.AUTH0_MGMT_CLIENT_ID ?? raw.auth0?.mgmtClientId ?? '',
    mgmtClientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET ?? raw.auth0?.mgmtClientSecret ?? '',
  },
  mongo: { uri: process.env.MONGODB_URI ?? raw.mongo?.uri ?? '' },
  remotion: { ...raw.remotion, gl: process.env.REMOTION_GL ?? raw.remotion.gl },
};

/** True when Auth0 JWT validation can run (domain + audience both set). */
export const auth0Configured = Boolean(config.auth0.domain && config.auth0.audience);

/** True when Management API can fetch GitHub IdP tokens for a user. */
export const auth0MgmtConfigured = Boolean(
  config.auth0.domain && config.auth0.mgmtClientId && config.auth0.mgmtClientSecret,
);
/** True when MongoDB URI is configured. */
export const mongoConfigured = Boolean(config.mongo.uri);

export const rendersDir = path.join(repoRoot, config.paths.renders);
