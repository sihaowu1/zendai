import {
  parseTunables,
  type AspectRatio,
  type GenerationResult,
  type ReferenceImage,
} from '@motionforge/shared';
import { getAnthropicClient } from '../ai/client';
import * as animationAgent from './animationAgent';
import * as fuseAgent from './fuseAgent';
import * as modelAgent from './modelAgent';
import { buildTemplateResult } from './templateFallback';

/**
 * The orchestrator is the single entry point the API routes call. It decides
 * whether a request is served by the AI model agent or the offline template
 * generator, and always returns code plus the tunables parsed from it.
 */

export async function generateModel(prompt: string, image?: ReferenceImage): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    const template = buildTemplateResult(prompt);
    return { ...template, tunables: parseTunables(template.code), source: 'template' };
  }
  const result = await modelAgent.generateModel(client, prompt, image);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}

export async function modifyModel(
  prompt: string,
  code: string,
  image?: ReferenceImage,
): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error(
      'AI modification requires OPENROUTER_API_KEY (the offline template generator cannot apply edits). ' +
        'You can still edit the code directly in the editor.',
    );
  }
  const result = await modelAgent.modifyModel(client, prompt, code, image);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}

export async function animateModel(prompt: string, code: string): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error(
      'AI animation requires OPENROUTER_API_KEY (the offline template generator cannot add animations). ' +
        'You can still edit the code directly in the editor.',
    );
  }
  const result = await animationAgent.animateModel(client, prompt, code);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}

export async function fuseModels(
  modules: Array<{ name: string; code: string }>,
  aspectRatio?: AspectRatio,
): Promise<GenerationResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error(
      'AI fuse requires OPENROUTER_API_KEY (the offline template generator cannot fuse modules).',
    );
  }
  if (modules.length < 2) {
    throw new Error('At least two modules are required to fuse.');
  }
  const result = await fuseAgent.fuseModels(client, modules, aspectRatio);
  return { ...result, tunables: parseTunables(result.code), source: 'model' };
}
