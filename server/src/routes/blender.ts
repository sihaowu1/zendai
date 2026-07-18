import { Router } from 'express';
import { blenderStatus, runBlenderCode } from '../mcp/blenderMcp';
import { runBlenderAgent } from '../agents/blenderAgent';
import { getAnthropicClient } from '../ai/client';
import { logError } from '../utils/logger';

export const blenderRouter = Router();

// Is the Blender MCP connection alive, and which tools does it expose?
blenderRouter.get('/blender/status', async (_req, res) => {
  res.json(await blenderStatus());
});

// Execute the current Blender script inside Blender (one-shot sync).
blenderRouter.post('/blender/sync', async (req, res) => {
  const code = String(req.body?.code ?? '');
  if (!code.trim()) {
    res.status(400).json({ error: 'code is required' });
    return;
  }
  try {
    const output = await runBlenderCode(code);
    res.json({ output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('blender', message);
    res.status(500).json({ error: message });
  }
});

// Let the AI agent drive Blender iteratively through MCP tools.
blenderRouter.post('/blender/agent', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }
  const client = getAnthropicClient();
  if (!client) {
    res.status(400).json({ error: 'the Blender agent requires OPENROUTER_API_KEY' });
    return;
  }
  try {
    res.json(await runBlenderAgent(client, prompt));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('blender-agent', message);
    res.status(500).json({ error: message });
  }
});
