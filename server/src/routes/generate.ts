import { Router } from 'express';
import {
  asSceneSpec,
  validateSceneSpec,
  type IntentModelContext,
  type ReferenceImage,
  type SceneSpec,
} from '@motionforge/shared';
import {
  animateScene,
  critiqueGeneratedScene,
  generateScene,
  modifyScene,
  resolveIntent,
} from '../agents/orchestrator';
import { logError } from '../utils/logger';

export const generateRouter = Router();

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function parseImage(body: Record<string, unknown>): ReferenceImage | undefined {
  const img = body?.image as { mediaType?: string; base64?: string } | undefined;
  if (!img) return undefined;
  if (!img.mediaType || !VALID_IMAGE_TYPES.has(img.mediaType)) return undefined;
  if (typeof img.base64 !== 'string' || img.base64.length === 0) return undefined;
  return { mediaType: img.mediaType as ReferenceImage['mediaType'], base64: img.base64 };
}

/**
 * A spec sent back on modify. Dropped rather than rejected when it doesn't
 * validate: modify has a working no-spec path, so a stale or malformed spec
 * should degrade to that instead of failing the request.
 */
function parseSpec(body: Record<string, unknown>): SceneSpec | undefined {
  const spec = body?.spec;
  if (spec === undefined || spec === null) return undefined;
  return validateSceneSpec(spec).length === 0 ? asSceneSpec(spec) : undefined;
}

/** Model summaries sent for intent routing. Anything malformed is skipped. */
function parseIntentModels(body: Record<string, unknown>): IntentModelContext[] {
  if (!Array.isArray(body?.models)) return [];
  const models: IntentModelContext[] = [];
  for (const entry of body.models as unknown[]) {
    const model = entry as { id?: unknown; name?: unknown; layers?: unknown };
    if (typeof model.id !== 'string' || typeof model.name !== 'string') continue;
    const layers = Array.isArray(model.layers)
      ? model.layers.filter((layer): layer is string => typeof layer === 'string')
      : [];
    models.push({ id: model.id, name: model.name, layers });
  }
  return models;
}

// Prompt + model/layer tree → which of generate or modify this message means.
generateRouter.post('/intent', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }
  const activeModelId =
    typeof req.body?.activeModelId === 'string' ? req.body.activeModelId : undefined;
  try {
    res.json(await resolveIntent(prompt, parseIntentModels(req.body), activeModelId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('intent', message);
    res.status(500).json({ error: message });
  }
});

// Prompt → new scene (Three.js module + tunables).
generateRouter.post('/generate', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }
  const image = parseImage(req.body);
  try {
    res.json(await generateScene(prompt, image));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('generate', message);
    res.status(500).json({ error: message });
  }
});

// Prompt + current code → modified scene.
generateRouter.post('/modify', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const code = String(req.body?.code ?? '');
  if (!prompt || !code) {
    res.status(400).json({ error: 'prompt and code are required' });
    return;
  }
  const image = parseImage(req.body);
  const spec = parseSpec(req.body);
  try {
    res.json(await modifyScene(prompt, code, image, spec));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('modify', message);
    res.status(500).json({ error: message });
  }
});

// Rendered viewpoints + current code → accept, or a corrected module.
generateRouter.post('/critique', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const code = String(req.body?.code ?? '');
  if (!prompt || !code) {
    res.status(400).json({ error: 'prompt and code are required' });
    return;
  }
  const views = Array.isArray(req.body?.views)
    ? (req.body.views as unknown[]).filter(
        (view): view is { label: string; base64: string } =>
          typeof (view as { label?: unknown })?.label === 'string' &&
          typeof (view as { base64?: unknown })?.base64 === 'string',
      )
    : [];
  if (views.length === 0) {
    res.status(400).json({ error: 'at least one rendered view is required' });
    return;
  }
  try {
    res.json(
      await critiqueGeneratedScene({
        prompt,
        code,
        views,
        referenceImage: parseImage(req.body),
        spec: parseSpec(req.body),
        iteration: Number(req.body?.iteration ?? 0),
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('critique', message);
    res.status(500).json({ error: message });
  }
});

// Prompt + current code → scene with a one-shot timeline animation.
generateRouter.post('/animate', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const code = String(req.body?.code ?? '');
  if (!prompt || !code) {
    res.status(400).json({ error: 'prompt and code are required' });
    return;
  }
  try {
    res.json(await animateScene(prompt, code));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('animate', message);
    res.status(500).json({ error: message });
  }
});
