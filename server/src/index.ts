import { createApp } from './app';
import { config } from './config';
import { log } from './utils/logger';

const app = createApp();

app.listen(config.server.port, () => {
  log('server', `MotionForge server listening on http://localhost:${config.server.port}`);
  log(
    'server',
    process.env.OPENROUTER_API_KEY
      ? `AI agents: Anthropic API (${config.ai.model})`
      : 'AI agents: offline template fallback (set OPENROUTER_API_KEY in .env for AI generation)',
  );
  log(
    'server',
    config.blender.enabled
      ? 'Blender MCP: enabled (will connect on first use)'
      : 'Blender MCP: disabled (set BLENDER_MCP_ENABLED=true to enable)',
  );
});
