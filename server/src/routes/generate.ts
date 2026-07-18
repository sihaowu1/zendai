import { Router } from 'express';
import type { ReferenceImage } from '@motionforge/shared';
import { animateScene, generateScene, modifyScene } from '../agents/orchestrator';
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

// Prompt → new scene (Three.js module + Blender script + tunables).
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
  const blenderCode = String(req.body?.blenderCode ?? '');
  if (!prompt || !code) {
    res.status(400).json({ error: 'prompt and code are required' });
    return;
  }
  const image = parseImage(req.body);
  try {
    res.json(await modifyScene(prompt, code, blenderCode, image));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('modify', message);
    res.status(500).json({ error: message });
  }
});

// Prompt + current code → scene with a one-shot timeline animation.
generateRouter.post('/animate', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const code = String(req.body?.code ?? '');
  const blenderCode = String(req.body?.blenderCode ?? '');
  if (!prompt || !code) {
    res.status(400).json({ error: 'prompt and code are required' });
    return;
  }
  try {
    res.json(await animateScene(prompt, code, blenderCode));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('animate', message);
    res.status(500).json({ error: message });
  }
});
