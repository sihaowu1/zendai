import Anthropic from '@anthropic-ai/sdk';
import { assertAnimationPreservesGeometry, validateSceneModule } from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';

/**
 * Animation agent: one LLM call with the threejs-animation skill that adds a
 * user-requested, one-shot animation to an existing scene module. The host
 * stores the result as a duplicate clip — base model code stays frozen.
 * Validates the result (and geometry preservation) and retries once on failure.
 */

const JS_LANGS = new Set(['js', 'javascript']);

export interface ModelCode {
  code: string;
}

export async function animateModel(
  client: Anthropic,
  prompt: string,
  code: string,
): Promise<ModelCode> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `Add a user-requested, one-shot animation to the current Three.js model.\n\n` +
        `Animation instruction: ${prompt}\n\n` +
        `Current scene module:\n\`\`\`javascript\n${code}\n\`\`\`\n\n` +
        'The host keeps the base model immutable and stores your output as a duplicate ' +
        'animation clip — do not redesign the model; preserve geometry and PARAMS. ' +
        'Prefer ANIMATION.tracks on existing part keys. Insert a pivot/hinge only when ' +
        'correct joint motion requires it. Export ANIMATION with name + duration + tracks[]. ' +
        'Drive motion from time in updateScene (clamp, hold at end — do not loop). ' +
        'Keep every part resting at y >= 0 (do not sink through the floor). ' +
        'Do NOT set or change CAMERA. Only animate what the instruction asks for. ' +
        'Return the complete updated ```javascript block.',
    },
  ];
  return completeWithRetry(client, messages, code);
}

async function completeWithRetry(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  baselineCode: string,
): Promise<ModelCode> {
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
      throw new Error('The model declined to update this scene. Try a different prompt.');
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const blocks = extractFencedBlocks(text);
    const js = blocks.find((block) => JS_LANGS.has(block.lang));
    errors = js ? validateSceneModule(js.code) : ['the response did not include a ```javascript block'];
    if (js && errors.length === 0) {
      errors = assertAnimationPreservesGeometry(baselineCode, js.code);
    }
    if (js && errors.length === 0) {
      return { code: js.code };
    }
    messages.push({ role: 'assistant', content: response.content as Anthropic.MessageParam['content'] });
    messages.push({
      role: 'user',
      content:
        `That response was rejected by the validator: ${errors.join('; ')}. ` +
        'Return a corrected ```javascript block that follows the contract exactly. ' +
        'Do not invent new THREE.Mesh, Geometry, or Material constructors — only new THREE.Group pivots are allowed.',
    });
  }
  throw new Error(`The model did not produce a valid scene module: ${errors.join('; ')}`);
}
