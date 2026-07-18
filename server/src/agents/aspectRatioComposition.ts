import Anthropic from '@anthropic-ai/sdk';
import { validateSceneModule, DEFAULT_ASPECT_RATIO, type AspectRatio } from '@motionforge/shared';
import { config } from '../config';
import { loadSkill } from '../ai/skills';
import { extractFencedBlocks } from '../ai/extract';

/**
 * Standalone aspect-ratio-aware scene composition.
 *
 * This is NOT wired into `orchestrator.ts`, any route, or the chat panel —
 * nothing in the running app calls it. It exists to show how a caller would
 * pass a target `AspectRatio` into the `camera-composition` skill (see
 * `skills/camera-composition/SKILL.md`'s "Aspect ratio" section) so the model
 * can acknowledge it and frame the shot for it, without touching the
 * `scene-generation`/chat generate-modify pipeline in `sceneAgent.ts`.
 */

export interface AspectRatioSceneResult {
  code: string;
  blenderCode: string;
  /** The model's prose outside the code fences — expected to open with a one-line aspect-ratio acknowledgment. */
  note?: string;
}

const JS_LANGS = new Set(['js', 'javascript']);

function aspectRatioLine(aspectRatio: AspectRatio): string {
  return (
    `Target preview aspect ratio: ${aspectRatio} (width:height). Acknowledge it in one short sentence, ` +
    'then compose the camera and object placement for it per the camera-composition skill.'
  );
}

/**
 * Generates a scene for a given prompt + aspect ratio using the
 * `scene-generation` and `camera-composition` skills together. Standalone —
 * see module doc comment.
 */
export async function generateSceneForAspectRatio(
  client: Anthropic,
  prompt: string,
  aspectRatio: AspectRatio = DEFAULT_ASPECT_RATIO,
): Promise<AspectRatioSceneResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `Create a 3D scene from this prompt:\n\n${prompt}\n\n` +
        `${aspectRatioLine(aspectRatio)}\n\n` +
        'Return the ```javascript scene module and the ```python Blender script.',
    },
  ];

  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.messages.stream({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      thinking: { type: 'adaptive' },
      system: `${loadSkill('scene-generation')}\n\n${loadSkill('camera-composition')}`,
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
    const py = blocks.find((block) => block.lang === 'python');
    errors = js ? validateSceneModule(js.code) : ['the response did not include a ```javascript block'];
    if (js && errors.length === 0) {
      const note = text.replace(/```[\s\S]*?```/g, '').trim();
      return { code: js.code, blenderCode: py?.code ?? '', note: note || undefined };
    }
    messages.push({ role: 'assistant', content: response.content as Anthropic.MessageParam['content'] });
    messages.push({
      role: 'user',
      content:
        `That response was rejected by the validator: ${errors.join('; ')}. ` +
        'Return corrected ```javascript and ```python blocks that follow the contract exactly.',
    });
  }
  throw new Error(`The model did not produce a valid scene module: ${errors.join('; ')}`);
}
