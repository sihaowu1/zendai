import Anthropic from '@anthropic-ai/sdk';
import { validateSceneModule } from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';

/**
 * The animation agent: prompts Claude (with the threejs-animation skill as
 * its system prompt) to add a user-requested, one-shot timeline animation to
 * an existing scene module. Validates the result and retries once on failure.
 */

const JS_LANGS = new Set(['js', 'javascript']);

export interface SceneCode {
  code: string;
}

export async function animateScene(
  client: Anthropic,
  prompt: string,
  code: string,
): Promise<SceneCode> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `Add a user-requested, one-shot animation to the current Three.js model.\n\n` +
        `Animation instruction: ${prompt}\n\n` +
        `Current scene module:\n\`\`\`javascript\n${code}\n\`\`\`\n\n` +
        'Preserve geometry, PARAMS, and named parts unless a pivot/hinge must be ' +
        'inserted for correct joint motion. Export ANIMATION with name + duration; ' +
        'drive motion from time in updateScene (clamp, hold at end — do not loop). ' +
        'Only animate what the instruction asks for. ' +
        'Return the complete updated ```javascript block.',
    },
  ];
  return completeWithRetry(client, messages);
}

async function completeWithRetry(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
): Promise<SceneCode> {
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.messages.stream({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      thinking: { type: 'adaptive' },
      system: loadSkill('threejs-animation'),
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined to animate this scene. Try a different prompt.');
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const blocks = extractFencedBlocks(text);
    const js = blocks.find((block) => JS_LANGS.has(block.lang));
    errors = js ? validateSceneModule(js.code) : ['the response did not include a ```javascript block'];
    if (js && errors.length === 0) {
      return { code: js.code };
    }
    messages.push({ role: 'assistant', content: response.content as Anthropic.MessageParam['content'] });
    messages.push({
      role: 'user',
      content:
        `That response was rejected by the validator: ${errors.join('; ')}. ` +
        'Return a corrected ```javascript block that follows the contract exactly.',
    });
  }
  throw new Error(`The model did not produce a valid scene module: ${errors.join('; ')}`);
}
