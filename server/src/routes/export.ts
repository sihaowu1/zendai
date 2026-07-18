import { Router } from 'express';
import type { Request } from 'express';
import type { RenderSettings } from '@motionforge/shared';
import { requireAuth } from '../auth/middleware';
import { getGitHubTokenForUser } from '../auth/githubToken';
import {
  parseCodeExportFormat,
  streamProjectZip,
  type CodeExportFormat,
} from '../export/codeExport';
import {
  commitFiles,
  createRepoAndCommit,
  parseOwnerRepo,
  pullModelsFromRepo,
  verifyRepoAccess,
} from '../export/githubExport';
import {
  buildGitHubProjectFiles,
  type GitHubModelInput,
} from '../export/githubProjectFiles';
import { startMp4Export } from '../export/mp4Export';
import { getJob } from '../utils/jobs';
import { logError } from '../utils/logger';

export const exportRouter = Router();

function auth0Sub(req: Request): string {
  const sub = (req as Request & { auth?: { payload?: { sub?: string } } }).auth?.payload?.sub;
  if (!sub) {
    throw new Error('Authenticated user id (sub) missing from token');
  }
  return sub;
}

function codeBody(req: Request): {
  code: string;
  title?: string;
  format: CodeExportFormat;
} {
  const code = String(req.body?.code ?? '');
  if (!code.trim()) {
    throw new Error('code is required');
  }
  return {
    code,
    title: typeof req.body?.title === 'string' ? req.body.title : undefined,
    format: parseCodeExportFormat(req.body?.format),
  };
}

function modelsBody(req: Request): {
  models: GitHubModelInput[];
  title?: string;
  format: CodeExportFormat;
} {
  const raw = req.body?.models;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('models array is required');
  }
  const models: GitHubModelInput[] = raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`models[${index}] must be an object`);
    }
    const id = String((entry as { id?: unknown }).id ?? '').trim() || `model-${index}`;
    const name = String((entry as { name?: unknown }).name ?? '').trim() || `Model ${index + 1}`;
    const code = String((entry as { code?: unknown }).code ?? '');
    if (!code.trim()) {
      throw new Error(`models[${index}].code is required`);
    }
    return { id, name, code };
  });
  return {
    models,
    title: typeof req.body?.title === 'string' ? req.body.title : undefined,
    format: parseCodeExportFormat(req.body?.format),
  };
}

// Download the generated project as code (ZIP).
exportRouter.post('/export/code', (req, res) => {
  try {
    const options = codeBody(req);
    streamProjectZip(res, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Start an MP4 render (background job; poll the jobId for progress).
exportRouter.post('/export/mp4', (req, res) => {
  const code = String(req.body?.code ?? '');
  const settings = (req.body?.settings ?? {}) as Partial<RenderSettings>;
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
  try {
    const job = startMp4Export(code, settings, prompt);
    res.json({ jobId: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('export', message);
    res.status(400).json({ error: message });
  }
});

// Poll MP4 render progress; when done, result.url points at the file.
exportRouter.get('/export/mp4/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'unknown job' });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    result: job.result,
    error: job.error,
  });
});

async function withGitHub(
  req: Request,
  res: import('express').Response,
  run: (token: string) => Promise<unknown>,
): Promise<void> {
  try {
    const sub = auth0Sub(req);
    const token = await getGitHubTokenForUser(sub);
    const result = await run(token);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('github-export', message);
    const status =
      /sign in with github/i.test(message) || /no github identity/i.test(message)
        ? 403
        : /not configured/i.test(message)
          ? 501
          : /required|must be|format/i.test(message)
            ? 400
            : /no push access|not found|404/i.test(message)
              ? 404
              : 500;
    res.status(status).json({ error: message });
  }
}

// Create a new GitHub repo and push the initial project files.
exportRouter.post('/export/github/create', requireAuth, (req, res) => {
  void withGitHub(req, res, async (token) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new Error('name is required');
    const options = modelsBody(req);
    const files = buildGitHubProjectFiles({
      models: options.models,
      title: options.title,
      format: options.format,
    });
    return createRepoAndCommit({
      token,
      name,
      private: Boolean(req.body?.private),
      files,
      message: typeof req.body?.message === 'string' ? req.body.message : undefined,
      description: options.title,
    });
  });
});

// Link an existing repo (verify write access; no commit).
exportRouter.post('/export/github/link', requireAuth, (req, res) => {
  void withGitHub(req, res, async (token) => {
    const fullName =
      typeof req.body?.fullName === 'string'
        ? req.body.fullName
        : typeof req.body?.owner === 'string' && typeof req.body?.repo === 'string'
          ? `${req.body.owner}/${req.body.repo}`
          : String(req.body?.repo ?? '');
    const { owner, repo } = parseOwnerRepo(fullName);
    return verifyRepoAccess({ token, owner, repo });
  });
});

// Commit current project files to a linked repo.
exportRouter.post('/export/github/commit', requireAuth, (req, res) => {
  void withGitHub(req, res, async (token) => {
    const owner = String(req.body?.owner ?? '').trim();
    const repo = String(req.body?.repo ?? '').trim();
    if (!owner || !repo) throw new Error('owner and repo are required');
    const options = modelsBody(req);
    const files = buildGitHubProjectFiles({
      models: options.models,
      title: options.title,
      format: options.format,
    });
    return commitFiles({
      token,
      owner,
      repo,
      branch: typeof req.body?.branch === 'string' ? req.body.branch : undefined,
      files,
      message: typeof req.body?.message === 'string' ? req.body.message : undefined,
    });
  });
});

// Pull models/ scripts from a linked repo into the app.
exportRouter.post('/export/github/pull', requireAuth, (req, res) => {
  void withGitHub(req, res, async (token) => {
    const owner = String(req.body?.owner ?? '').trim();
    const repo = String(req.body?.repo ?? '').trim();
    if (!owner || !repo) throw new Error('owner and repo are required');
    return pullModelsFromRepo({
      token,
      owner,
      repo,
      branch: typeof req.body?.branch === 'string' ? req.body.branch : undefined,
    });
  });
});
