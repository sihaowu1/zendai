import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null | undefined;

/**
 * Lazily constructed Anthropic client, routed through OpenRouter. Returns null
 * when no OPENROUTER_API_KEY is configured, in which case callers fall back to
 * the offline template generator (agents/templateFallback).
 */
export function getAnthropicClient(): Anthropic | null {
  if (client === undefined) {
    client = process.env.OPENROUTER_API_KEY
      ? new Anthropic({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api',
        })
      : null;
  }
  return client;
}

export function aiAvailable(): boolean {
  return getAnthropicClient() !== null;
}
