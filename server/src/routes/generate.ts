import { Router } from 'express';
import type { AspectRatio, ReferenceImage } from '@motionforge/shared';
import { ASPECT_RATIOS } from '@motionforge/shared';
import { animateModel, fuseModels, generateModel, modifyModel } from '../agents/orchestrator';
import { logError } from '../utils/logger';

export const generateRouter = Router();

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const VALID_ASPECT = new Set(ASPECT_RATIOS.map((a) => a.value));

function parseImage(body: Record<string, unknown>): ReferenceImage | undefined {
  const img = body?.image as { mediaType?: string; base64?: string } | undefined;
  if (!img) return undefined;
  if (!img.mediaType || !VALID_IMAGE_TYPES.has(img.mediaType)) return undefined;
  if (typeof img.base64 !== 'string' || img.base64.length === 0) return undefined;
  return { mediaType: img.mediaType as ReferenceImage['mediaType'], base64: img.base64 };
}

function parseAspectRatio(body: Record<string, unknown>): AspectRatio | undefined {
  const value = body?.aspectRatio;
  if (typeof value !== 'string' || !VALID_ASPECT.has(value as AspectRatio)) return undefined;
  return value as AspectRatio;
}

// Prompt → new model (Three.js module + tunables).
generateRouter.post('/generate', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }
  const image = parseImage(req.body);
  try {
    res.json(await generateModel(prompt, image));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('generate', message);
    res.status(500).json({ error: message });
  }
});

// Prompt + current code → modified model.
generateRouter.post('/modify', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const code = String(req.body?.code ?? '');
  if (!prompt || !code) {
    res.status(400).json({ error: 'prompt and code are required' });
    return;
  }
  const image = parseImage(req.body);
  try {
    res.json(await modifyModel(prompt, code, image));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('modify', message);
    res.status(500).json({ error: message });
  }
});

// Prompt + current code → animated module duplicate (base model stays frozen).
generateRouter.post('/animate', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const code = String(req.body?.code ?? '');
  if (!prompt || !code) {
    res.status(400).json({ error: 'prompt and code are required' });
    return;
  }
  try {
    res.json(await animateModel(prompt, code));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('animate', message);
    res.status(500).json({ error: message });
  }
});

// Multiple modules → one fused scene module.
generateRouter.post('/fuse', async (req, res) => {
  const raw = req.body?.modules;
  if (!Array.isArray(raw) || raw.length < 2) {
    res.status(400).json({ error: 'modules must be an array of at least two { name, code } entries' });
    return;
  }
  const modules: Array<{ name: string; code: string }> = [];
  for (const entry of raw) {
    const name = String(entry?.name ?? '').trim() || 'Model';
    const code = String(entry?.code ?? '');
    if (!code) {
      res.status(400).json({ error: 'each module must include non-empty code' });
      return;
    }
    modules.push({ name, code });
  }
  const aspectRatio = parseAspectRatio(req.body);
  try {
    res.json(await fuseModels(modules, aspectRatio));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('fuse', message);
    res.status(500).json({ error: message });
  }
});
