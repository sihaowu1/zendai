import Anthropic from '@anthropic-ai/sdk';
import { validateSceneModule, type ReferenceImage } from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';

/**
 * The scene agent: prompts Claude (with the threejs-modelling skill as its
 * system prompt) to write a component-based Three.js scene module, validates
 * the result against the module contract, and retries once with the
 * validator's feedback if the contract was violated.
 */

const JS_LANGS = new Set(['js', 'javascript']);

const IMAGE_ANALYSIS_ADDENDUM = `

The user has attached a reference image. Before writing the scene module, analyze the image:
1. Decompose the subject into named 3D components. For each, choose the best-fit Three.js primitive (BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, etc.).
2. Extract dominant colors as hex values. Estimate material properties (metalness 0–1, roughness 0–1).
3. Identify proportions and relative sizes between parts, and the parent-child hierarchy.
4. Estimate lighting direction and intensity from shadows/highlights in the image.
Use this analysis to drive the PARAMS values (sizes, colors) and the geometry choices in buildScene.`;

export interface SceneCode {
  code: string;
  blenderCode: string;
}

/** Build user message content — plain string when no image, multimodal array when image is present. */
function buildUserContent(
  text: string,
  image?: ReferenceImage,
): string | Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> {
  if (!image) return text;
  return [
    {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 },
    },
    { type: 'text' as const, text },
  ];
}

export async function generateScene(
  client: Anthropic,
  prompt: string,
  image?: ReferenceImage,
): Promise<SceneCode> {
  const text =
    `Create a component-based static Three.js model from this prompt:\n\n${prompt}\n\n` +
    'Use named parts with per-part size tunables. Do not add time-based animation. ' +
    'Return the ```javascript scene module.';
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserContent(text, image) },
  ];
  return completeWithRetry(client, messages, '', !!image);
}

export async function modifyScene(
  client: Anthropic,
  prompt: string,
  code: string,
  blenderCode: string,
  image?: ReferenceImage,
): Promise<SceneCode> {
  const text =
    `Modify the current component-based Three.js model.\n\nInstruction: ${prompt}\n\n` +
    `Current scene module:\n\`\`\`javascript\n${code}\n\`\`\`\n\n` +
    'Preserve named parts and PARAMS unless the instruction changes them. ' +
    'If asked to swap a part or add variants, update that component (and add style tunables if needed). ' +
    'Do not add time-based animation. ' +
    'Return the complete updated ```javascript block.';
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserContent(text, image) },
  ];
  return completeWithRetry(client, messages, blenderCode, !!image);
}

async function completeWithRetry(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  previousBlenderCode: string,
  hasImage = false,
): Promise<SceneCode> {
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.messages.stream({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      thinking: { type: 'adaptive' },
      system: loadSkill('threejs-modelling') + (hasImage ? IMAGE_ANALYSIS_ADDENDUM : ''),
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined to generate this scene. Try a different prompt.');
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const blocks = extractFencedBlocks(text);
    const js = blocks.find((block) => JS_LANGS.has(block.lang));
    errors = js ? validateSceneModule(js.code) : ['the response did not include a ```javascript block'];
    if (js && errors.length === 0) {
      return { code: js.code, blenderCode: previousBlenderCode };
    }
    // Feed the validator's errors back for one corrective attempt. The full
    // content (including thinking blocks) is echoed back unchanged.
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
