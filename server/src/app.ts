import express from 'express';
import cors from 'cors';
import { auth0Configured, config, rendersDir } from './config';
import { ensureDir } from './utils/fsx';
import { aiAvailable } from './ai/client';
import { authErrorHandler, optionalAuth } from './auth/middleware';
import { generateRouter } from './routes/generate';
import { blenderRouter } from './routes/blender';
import { exportRouter } from './routes/export';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ai: aiAvailable(),
      model: config.ai.model,
      blenderEnabled: config.blender.enabled,
      auth0: auth0Configured,
    });
  });

  // Soft JWT check on every other `/api/*` call (anonymous allowed).
  // Mount once here rather than per-route; use `requireAuth` for hard gates.
  const api = express.Router();
  api.use(optionalAuth);
  api.use(generateRouter);
  api.use(blenderRouter);
  api.use(exportRouter);
  app.use('/api', api);
  app.use(authErrorHandler);

  // Rendered MP4s are served statically so the browser can download them.
  app.use('/renders', express.static(ensureDir(rendersDir)));

  return app;
}
