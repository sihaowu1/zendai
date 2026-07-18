import Anthropic from '@anthropic-ai/sdk';
import type { ChatIntent, IntentModelContext } from '@motionforge/shared';
import { config } from '../config';
import { trace } from '../utils/trace';

/**
 * Routes one chat message to generate or modify, so the composer can be a
 * single input instead of asking the user to classify their own request.
 *
 * Runs on `ai.fastModel` against names and layer names only — never code —
 * because it sits in front of every message the user sends and its latency is
 * felt before anything else starts.
 *
 * Failure is not an error: an unroutable message falls back to `generate`,
 * which appends a new model rather than overwriting one the user liked.
 */

const MAX_TOKENS = 400;

const SYSTEM = `You route one message in a 3D-model editing app to exactly one action.

The user has a set of generated models. Each has a name and a list of layers
(the named parts of the model, e.g. tableTop, bottleCap, leftArm).

Choose:
- "modify" when the message refers to something that already exists — it names a
  model or a layer, uses a pronoun for one ("make it wooden", "make that taller"),
  or asks to change, recolour, resize, remove, or duplicate a part of one.
- "generate" when the message asks for a subject that does not overlap anything
  in the list ("create a retro arcade machine"), or when there are no models yet.

When you choose "modify", set targetModelId to the model being edited and
targetLayers to the layer names the edit touches (empty if it affects the whole
model). Prefer the active model when the message is ambiguous about which model
it means but is clearly an edit.

Reply with exactly one JSON object and nothing else:

{"intent":"modify","targetModelId":"m3","targetLayers":["tableTop"],"reason":"making tableTop dark oak"}

"reason" is a short present-participle clause shown in the UI while the work
runs. Lowercase, no trailing period, under 60 characters.`;

function buildPrompt(prompt: string, models: IntentModelContext[], activeModelId?: string): string {
  if (models.length === 0) {
    return `There are no models yet.\n\nMessage: ${prompt}`;
  }
  const list = models
    .map((m) => {
      const active = m.id === activeModelId ? ' (active)' : '';
      const layers = m.layers.length > 0 ? m.layers.join(', ') : 'none';
      return `- id=${m.id} name="${m.name}"${active} layers: ${layers}`;
    })
    .join('\n');
  return `Existing models:\n${list}\n\nMessage: ${prompt}`;
}

/** Pull the first JSON object out of the reply, tolerating stray prose or a fence. */
function parseIntent(text: string, models: IntentModelContext[]): ChatIntent | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.intent !== 'modify' && parsed.intent !== 'generate') return null;
  const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : undefined;
  if (parsed.intent === 'generate') return { intent: 'generate', reason };

  // A modify pointing at a model that does not exist is worse than useless —
  // the client would silently edit whatever happened to be active instead.
  const target = models.find((m) => m.id === parsed.targetModelId);
  if (!target) return null;

  const layers = Array.isArray(parsed.targetLayers)
    ? parsed.targetLayers.filter(
        (layer): layer is string => typeof layer === 'string' && target.layers.includes(layer),
      )
    : [];

  return { intent: 'modify', targetModelId: target.id, targetLayers: layers, reason };
}

export async function classifyIntent(
  client: Anthropic,
  prompt: string,
  models: IntentModelContext[],
  activeModelId?: string,
): Promise<ChatIntent> {
  if (models.length === 0) return { intent: 'generate' };

  const startedAt = performance.now();
  const response = await client.messages.create({
    model: config.ai.fastModel,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(prompt, models, activeModelId) }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const parsed = parseIntent(text, models);
  // `parsed === null` is the interesting case: the classifier said something
  // unusable and the caller silently falls back to generating a new model,
  // which looks from the outside like a modify request being ignored.
  trace('intentAgent.ts:classifyIntent', 'intent.classified', {
    durationMs: Math.round(performance.now() - startedAt),
    model: config.ai.fastModel,
    prompt,
    modelIds: models.map((m) => m.id),
    activeModelId,
    raw: text,
    parsed,
    fellBackToGenerate: parsed === null,
  });

  return parsed ?? { intent: 'generate' };
}
