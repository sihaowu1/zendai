import { parseTunables, type GenerationResult, type ReferenceImage } from '@motionforge/shared';
import { getAnthropicClient } from '../ai/client';
import * as animationAgent from './animationAgent';
import * as sceneAgent from './sceneAgent';
import { buildTemplateResult } from './templateFallback';

/**
 * The orchestrator is the single entry point the API routes call. It decides
 * whether a request is served by the AI scene agent or the offline template
 * generator, and always returns code plus the tunables parsed from it.
 */

export async function generateScene(prompt: string, image?: ReferenceImage): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    const template = buildTemplateResult(prompt);
    return { ...template, tunables: parseTunables(template.code), source: 'template' };
  }
  const result = await sceneAgent.generateScene(client, prompt, image);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}

export async function modifyScene(
  prompt: string,
  code: string,
  blenderCode: string,
  image?: ReferenceImage,
): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error(
      'AI modification requires OPENROUTER_API_KEY (the offline template generator cannot apply edits). ' +
        'You can still edit the code directly in the editor.',
    );
  }
  const result = await sceneAgent.modifyScene(client, prompt, code, blenderCode, image);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}

export async function animateScene(
  prompt: string,
  code: string,
  blenderCode: string,
): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error(
      'AI animation requires OPENROUTER_API_KEY (the offline template generator cannot add animations). ' +
        'You can still edit the code directly in the editor.',
    );
  }
  const result = await animationAgent.animateScene(client, prompt, code, blenderCode);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}
