import Anthropic from '@anthropic-ai/sdk';
import { validateSceneModule, type AspectRatio } from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';

/**
 * Fuse agent: combine multiple independent scene modules into one real module
 * so subjects can interact (shared buildScene / updateScene / CAMERA).
 */

const JS_LANGS = new Set(['js', 'javascript']);

export interface FuseModuleInput {
  name: string;
  code: string;
}

export interface ModelCode {
  code: string;
}

export async function fuseModels(
  client: Anthropic,
  modules: FuseModuleInput[],
  aspectRatio?: AspectRatio,
): Promise<ModelCode> {
  if (modules.length < 2) {
    throw new Error('fuseModels requires at least two modules');
  }

  const ratioLine = aspectRatio
    ? `Target preview aspect ratio: ${aspectRatio}.\n\n`
    : '';

  const moduleBlocks = modules
    .map(
      (m, i) =>
        `### Module ${i + 1}: "${m.name}"\n\`\`\`javascript\n${m.code}\n\`\`\``,
    )
    .join('\n\n');

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `${ratioLine}` +
        `Fuse the following Three.js scene modules into ONE self-contained module.\n\n` +
        `Requirements:\n` +
        `- Single PARAMS, CAMERA, buildScene, updateScene (and ANIMATION only if already present — prefer omit).\n` +
        `- Namespace colliding part keys using a short slug of each source name ` +
        `(e.g. human_head, flag_pole) so every buildScene return key is unique.\n` +
        `- Place subjects so they can interact on one ground plane (not far side-by-side islands).\n` +
        `- Merge PARAMS with unique names; keep @tunable annotations.\n` +
        `- Keep a simple CAMERA (preserve the first module's CAMERA, or a sensible default looking at the origin).\n` +
        `- No import/require/fetch. Host injects THREE.\n` +
        `- Do not invent time-based animation in this fuse step.\n\n` +
        `${moduleBlocks}\n\n` +
        'Return the complete fused ```javascript block.',
    },
  ];

  return completeWithRetry(client, messages);
}

async function completeWithRetry(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
): Promise<ModelCode> {
  const system = loadSkill('threejs-modelling');
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.messages.stream({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      thinking: { type: 'adaptive' },
      system,
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined to fuse these models. Try different models.');
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
  throw new Error(`The model did not produce a valid fused scene module: ${errors.join('; ')}`);
}
