import { createApp } from './app';
import { config } from './config';
import { connectMongo } from './db/connection';
import { log } from './utils/logger';

const app = createApp();

void connectMongo();

const server = app.listen(config.server.port, () => {
  log('server', `Zendai server listening on http://localhost:${config.server.port}`);
  log(
    'server',
    process.env.OPENROUTER_API_KEY
      ? `AI agents: Anthropic API (${config.ai.model})`
      : 'AI agents: offline template fallback (set OPENROUTER_API_KEY in .env for AI generation)',
  );
});

function shutdown(signal: NodeJS.Signals): void {
  log('server', `${signal} received, shutting down`);
  server.close(() => process.exit(0));
  // Force-exit if a lingering connection blocks a clean close.
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
